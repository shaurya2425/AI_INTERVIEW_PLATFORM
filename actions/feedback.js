"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { request } from "@arcjet/next";
import { createRateLimiter, checkRateLimit } from "@/lib/arcjet";
import { productionFailure } from "@/lib/production-errors";
import { actionFailure } from "@/lib/action-result";
import { db } from "@/lib/prisma";
import { feedbackBookingInclude, prepareMeetingFeedback } from "@/lib/meeting-feedback";
import { getMeetingOutcome } from "@/lib/meeting-outcome";

async function runAction(operation) {
  try { return await operation(); }
  catch (error) {
    console.error("Feedback retrieval failed", { stage: "database_read", code: /^P\d+$/.test(error.code || "") ? error.code : error.name });
    const failure = productionFailure({ code: "DATABASE_ERROR" });
    return { ...failure, state: "failed", message: failure.error };
  }
}

const limiter = createRateLimiter({ refillRate: 10, interval: "1m", capacity: 10 });

export const getMeetingFeedback = async (bookingId, options = {}) => runAction(async () => {
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
  // Viewing a persisted report is read-only, including partial and older reports.
  if (booking.feedback?.summary && options?.retry !== true) {
    const incomplete = booking.feedback.report?.state === "INCOMPLETE";
    return { feedback: booking.feedback, state: incomplete ? "incomplete" : "ready",
      message: incomplete ? "Saved partial report. Review its limitations; retry only to check for new evidence." : "" };
  }
  if (options?.retry !== true) return { feedback: null, state: "pending",
    message: "No saved report yet. Select Generate feedback to evaluate the saved meeting evidence." };
  const limitError = await checkRateLimit(limiter, await request(), user.id);
  if (limitError) return actionFailure(limitError);
  let feedback;
  try { feedback = await prepareMeetingFeedback(booking, { retry: options?.retry === true }); }
  catch (error) { return { feedback: booking.feedback, state: booking.feedback ? (booking.feedback.report?.state === "INCOMPLETE" ? "incomplete" : "ready") : error.code === "TRANSCRIPT_PROCESSING" ? "pending" : "failed", code: error.code, retryAfterSeconds: error.retryAfterSeconds, message: error.publicMessage || "Feedback could not be generated. Please retry; saved answers are preserved." }; }
  const latest = await db.booking.findUnique({ where: { id: booking.id }, select: { feedbackState: true } });
  const state = latest?.feedbackState === "READY" ? "ready" : latest?.feedbackState === "INCOMPLETE" ? "incomplete" : "pending";
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  return { feedback, state, message: state === "pending" ? "Preparing feedback. Any previous report remains available; check again shortly."
    : state === "incomplete" ? "Report available with incomplete evidence. Check its limitations and retry after transcripts or approved grades become available." : "" };
}, "Unable to retrieve feedback right now. Please try again later.");
