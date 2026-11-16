"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/prisma";
import { requestInterviewCompletion, finalizeInterviewCompletion, completionInclude } from "@/lib/interviewCompletion";

export async function completeInterview(bookingId) {
  try {
    const user = await currentUser();
    if (!user || typeof bookingId !== "string" || !bookingId) return { success: false, error: "Unauthorized" };
    const booking = await db.booking.findUnique({ where: { id: bookingId }, include: completionInclude });
    if (!booking || booking.interviewer.clerkUserId !== user.id) return { success: false, error: "Only the assigned interviewer can end this interview." };
    if (booking.status === "CANCELLED") return { success: false, error: "This interview was cancelled." };
    await requestInterviewCompletion(bookingId, user.id);
    revalidatePath("/appointments"); revalidatePath("/dashboard");
    // Durable intent is committed before external work; response does not wait for feedback.
    after(() => finalizeInterviewCompletion(bookingId));
    return { success: true, completed: true, message: "Interview completed. Preparing Feedback." };
  } catch {
    return { success: false, error: "Completion could not be confirmed. Retry safely; saved interview evidence is preserved." };
  }
}

export async function getInterviewLifecycle(callId) {
  const user = await currentUser();
  if (!user || typeof callId !== "string") return { success: false };
  const booking = await db.booking.findUnique({ where: { streamCallId: callId }, include: completionInclude });
  if (!booking || ![booking.interviewer.clerkUserId, booking.interviewee.clerkUserId].includes(user.id)) return { success: false };
  if (booking.completedAt && ["PENDING", "RUNNING", "FAILED"].includes(booking.completionState)) after(() => finalizeInterviewCompletion(booking.id));
  return { success: true, status: booking.status, completionState: booking.completionState };
}
