"use server";

import { currentUser } from "@clerk/nextjs/server";
import { StreamClient } from "@stream-io/node-sdk";
import { revalidatePath } from "next/cache";
import { request } from "@arcjet/next";
import { createRateLimiter, checkRateLimit } from "@/lib/arcjet";
import { actionFailure, runAction } from "@/lib/action-result";
import { db } from "@/lib/prisma";
import { feedbackBookingInclude, generateMeetingFeedback } from "@/lib/meeting-feedback";
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
  if (booking.feedback) return { feedback: booking.feedback, state: "ready" };
  if (booking.status === "CANCELLED") return getMeetingOutcome(booking, {}, []);
  if (!booking.streamCallId) return {
    state: "unavailable", message: "No call record is available for this meeting, so attendance and feedback cannot be verified.",
  };
  const limitError = await checkRateLimit(limiter, await request(), user.id);
  if (limitError) return actionFailure(limitError);
  const client = new StreamClient(process.env.NEXT_PUBLIC_STREAM_API_KEY, process.env.STREAM_SECRET_KEY);
  const call = client.video.call("default", booking.streamCallId);
  const [details, transcriptResponse] = await Promise.all([call.get(), call.listTranscriptions()]);
  const transcriptions = transcriptResponse.transcriptions.filter((item) => !item.translated)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  const outcome = getMeetingOutcome(booking, details.call, transcriptions);
  if (outcome.state !== "transcript") return outcome;
  const feedback = await generateMeetingFeedback(booking, transcriptions);
  if (!feedback) return {
    state: "unavailable", message: "The meeting transcript contains no speech. There is not enough information to generate interview feedback.",
  };
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  return { feedback, state: "ready" };
}, "Unable to retrieve feedback right now. Please try again later.");
