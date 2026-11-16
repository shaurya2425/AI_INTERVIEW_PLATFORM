"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { request } from "@arcjet/next";
import { createRateLimiter, checkRateLimit } from "@/lib/arcjet";
import { actionFailure, runAction } from "@/lib/action-result";
import { db } from "@/lib/prisma";
import { feedbackBookingInclude, prepareMeetingFeedback } from "@/lib/meeting-feedback";
import { getMeetingOutcome } from "@/lib/meeting-outcome";

const limiter = createRateLimiter({ refillRate: 10, interval: "1m", capacity: 10 });

export const getMeetingFeedback = async (bookingId) => runAction(async () => {
  const user = await currentUser();
  if (!user) return actionFailure("Unauthorized");
  if (typeof bookingId !== "string" || !bookingId) return actionFailure("Invalid meeting");
  const booking = await db.booking.findFirst({
    where: { id: bookingId, OR: [
      { interviewer: { clerkUserId: user.id } },
      { interviewee: { clerkUserId: user.id } },
    ] },
    include: feedbackBookingInclude,
  });
  if (!booking) return actionFailure("Meeting not found");
  if (booking.status === "CANCELLED") return getMeetingOutcome(booking, {}, []);
  if (booking.status !== "COMPLETED") return {
    state: "pending", message: "The interview is still scheduled or active. Feedback is generated after completion.",
  };
  const limitError = await checkRateLimit(limiter, await request(), user.id);
  if (limitError) return actionFailure(limitError);
  let feedback;
  try { feedback = await prepareMeetingFeedback(booking); }
  catch (error) { return { feedback: booking.feedback, state: "failed", message: error.publicMessage || "Feedback could not be generated. Please retry; saved answers are preserved." }; }
  const latest = await db.booking.findUnique({ where: { id: booking.id }, select: { feedbackState: true } });
  const state = latest?.feedbackState === "READY" ? "ready" : latest?.feedbackState === "INCOMPLETE" ? "incomplete" : "pending";
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  return { feedback, state, message: state === "pending" ? "Preparing feedback. Any previous report remains available; check again shortly."
    : state === "incomplete" ? "Report available with incomplete evidence. Check its limitations and retry after transcripts or approved grades become available." : "" };
}, "Unable to retrieve feedback right now. Please try again later.");
