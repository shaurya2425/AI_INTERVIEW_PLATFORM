"use server";

import { actionFailure, runAction } from "@/lib/action-result";
import { validateDateRange } from "@/lib/time-validation";

import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { getDisplayName, withDisplayName } from "@/lib/user-name";
import { revalidatePath } from "next/cache";
import { request } from "@arcjet/next";
import { createRateLimiter, checkRateLimit } from "@/lib/arcjet";
import { Resend } from "resend";
import { WithdrawalRequestEmail } from "@/emails/WithdrawalRequestEmail";
import { render } from "@react-email/render";

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = "askshauryarajput@gmail.com";

const withdrawalLimiter = createRateLimiter({
  refillRate: 1,
  interval: "1h",
  capacity: 3,
});

// ─── AVAILABILITY ─────────────────────────────────────────────────────────────

export const setAvailability = async ({ startTime, endTime }) => runAction(async () => {
  const user = await currentUser();
  if (!user) return actionFailure("Unauthorized");

  const dbUser = await db.user.findUnique({ where: { clerkUserId: user.id } });
  if (!dbUser || dbUser.role !== "INTERVIEWER") return actionFailure("Forbidden");

  const timeError = validateDateRange(startTime, endTime);
  if (timeError) return actionFailure(timeError);

  try {
    const existing = await db.availability.findFirst({
      where: { interviewerId: dbUser.id, status: "AVAILABLE" },
    });

    if (existing) {
      await db.availability.update({
        where: { id: existing.id },
        data: { startTime: new Date(startTime), endTime: new Date(endTime) },
      });
    } else {
      await db.availability.create({
        data: {
          interviewerId: dbUser.id,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          status: "AVAILABLE",
        },
      });
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error(err);
    return actionFailure("Failed to save availability");
  }
}, "Unable to save availability. Please try again.");

export const getAvailability = async () => {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const dbUser = await db.user.findUnique({ where: { clerkUserId: user.id } });
  if (!dbUser) throw new Error("User not found");

  return db.availability.findFirst({
    where: { interviewerId: dbUser.id, status: "AVAILABLE" },
  });
};

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────────

export const getInterviewerAppointments = async () => {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const dbUser = await db.user.findUnique({ where: { clerkUserId: user.id } });
  if (!dbUser) throw new Error("User not found");

  const bookings = await db.booking.findMany({
    where: { interviewerId: dbUser.id },
    include: {
      interviewee: { select: { name: true, imageUrl: true, email: true } },
      feedback: true,
    },
    orderBy: { startTime: "desc" },
  });
  return bookings.map((booking) => ({
    ...booking,
    interviewee: withDisplayName(booking.interviewee),
  }));
};

// ─── EARNINGS / WITHDRAWAL ────────────────────────────────────────────────────

export const getInterviewerStats = async () => {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const dbUser = await db.user.findUnique({
    where: { clerkUserId: user.id },
    select: {
      creditBalance: true,
      creditRate: true,
      bookingsAsInterviewer: {
        where: { status: "COMPLETED" },
        select: { creditsCharged: true },
      },
    },
  });
  if (!dbUser) throw new Error("User not found");

  const totalEarned = dbUser.bookingsAsInterviewer.reduce(
    (sum, b) => sum + b.creditsCharged,
    0
  );

  return {
    creditBalance: dbUser.creditBalance,
    creditRate: dbUser.creditRate,
    totalEarned,
    completedSessions: dbUser.bookingsAsInterviewer.length,
  };
};

// Assignment
export const requestWithdrawal = async ({
  credits,
  paymentMethod,
  paymentDetail,
}) => runAction(async () => {
  const user = await currentUser();
  if (!user) return actionFailure("Unauthorized");

  const req = await request();
  const rateLimitError = await checkRateLimit(withdrawalLimiter, req, user.id);
  if (rateLimitError) return actionFailure(rateLimitError);

  const dbUser = await db.user.findUnique({ where: { clerkUserId: user.id } });
  if (!dbUser || dbUser.role !== "INTERVIEWER") return actionFailure("Forbidden");

  if (!credits || credits <= 0) return actionFailure("Invalid credit amount");
  if (credits > dbUser.creditBalance)
    return actionFailure("Insufficient credit balance");
  if (!paymentMethod || !paymentDetail)
    return actionFailure("Payment details required");

  const PLATFORM_FEE = 0.2;
  const netAmount = credits * (1 - PLATFORM_FEE) * 5;
  const platformFee = credits * PLATFORM_FEE * 5;

  try {
    const [payout] = await db.$transaction([
      db.payout.create({
        data: {
          interviewerId: dbUser.id,
          credits,
          platformFee,
          netAmount,
          paymentMethod,
          paymentDetail,
          status: "PROCESSING",
        },
      }),
      db.user.update({
        where: { id: dbUser.id },
        data: { creditBalance: { decrement: credits } },
      }),
    ]);

    // Fire admin email — non-blocking, failure won't affect the user
    try {
      const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/payout/${payout.id}`;
      const html = await render(
        WithdrawalRequestEmail({
          interviewerName: getDisplayName(dbUser.name, "Unknown"),
          interviewerEmail: dbUser.email,
          credits,
          platformFee,
          netAmount,
          paymentMethod,
          paymentDetail,
          reviewUrl,
        })
      );
      await resend.emails.send({
        from: "Prept <onboarding@resend.dev>",
        to: ADMIN_EMAIL,
        subject: `Withdrawal Request — ${getDisplayName(dbUser.name)} · ${credits} credits`,
        html,
      });
    } catch (emailErr) {
      console.error("Withdrawal email failed:", emailErr);
    }

    revalidatePath("/dashboard");
    return { success: true, netAmount };
  } catch (err) {
    console.error(err);
    return actionFailure("Withdrawal request failed");
  }
}, "Unable to request withdrawal. Please try again.");

export const getWithdrawalHistory = async () => {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const dbUser = await db.user.findUnique({ where: { clerkUserId: user.id } });
  if (!dbUser) throw new Error("User not found");

  return db.payout.findMany({
    where: { interviewerId: dbUser.id },
    orderBy: { createdAt: "desc" },
  });
};
