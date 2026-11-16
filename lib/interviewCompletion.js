import { feedbackBookingInclude, prepareMeetingFeedback } from "@/lib/meeting-feedback";
import { randomUUID } from "node:crypto";
import { StreamClient } from "@stream-io/node-sdk";
import { db } from "@/lib/prisma";
import { scoreInterview, SCORING_POLICY_VERSION } from "@/lib/interviewScoring";

export const completionInclude = {
  interviewer: { select: { id: true, clerkUserId: true } },
  interviewee: { select: { id: true, clerkUserId: true } },
};

// Both participants must use the authenticated completion action, never the SDK's end API.
export async function secureInterviewCall(client, call, participantIds) {
  // Stream only supports audio/video/screenshare in per-user revocations.
  // End/join-ended permissions are role grants on the existing default call type.
  const type = await client.video.getCallType({ name: "default" });
  const grants = {};
  const restricted = /^(end-call|join-ended-call|update-call|update-call-settings|update-call-member|update-call-member-role|update-call-permissions|remove-call-member)(-owner)?$/;
  for (const [role, permissions] of Object.entries(type.grants)) {
    if (role === "admin") continue;
    const filtered = permissions.filter(permission => !restricted.test(permission));
    if (filtered.length !== permissions.length) grants[role] = filtered;
  }
  if (Object.keys(grants).length) await client.video.updateCallType({ name: "default", grants });
  await call.updateCallMembers({ update_members: participantIds.map(user_id => ({ user_id, role: "call_member" })) });
}

export async function requestInterviewCompletion(bookingId, interviewerClerkId) {
  return db.$transaction(async tx => {
    // Conditional write checks membership/status and serializes completion against answer/grade writes.
    const changed = await tx.booking.updateMany({ where: { id: bookingId, status: "SCHEDULED",
      interviewer: { clerkUserId: interviewerClerkId } }, data: {
      status: "COMPLETED", completedAt: new Date(), completedBy: interviewerClerkId,
      completionState: "PENDING", feedbackState: "PENDING", feedbackRequestedAt: new Date(),
      scoringPolicyVersion: SCORING_POLICY_VERSION,
    } });
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: completionInclude });
    if (!booking || booking.interviewer.clerkUserId !== interviewerClerkId) throw new Error("Forbidden");
    if (booking.status !== "COMPLETED") throw new Error("Interview cannot be completed");
    if (changed.count) {
      await tx.interviewQuestion.updateMany({ where: { bookingId, sentAt: { not: null }, submission: null }, data: { responseStatus: "UNANSWERED" } });
      const questions = await tx.interviewQuestion.findMany({ where: { bookingId }, include: { submission: true } });
      await tx.booking.update({ where: { id: bookingId }, data: { scoringSummary: scoreInterview(questions, "COMPLETED") } });
    }
    return booking;
  });
}

export async function finalizeInterviewCompletion(bookingId) {
  const token = randomUUID();
  const claimed = await db.booking.updateMany({ where: { id: bookingId, status: "COMPLETED", OR: [
    { completionState: { in: ["PENDING", "FAILED"] } },
    { completionState: "RUNNING", completionStartedAt: { lt: new Date(Date.now() - 120000) } },
  ] }, data: { completionState: "RUNNING", completionStartedAt: new Date(), completionToken: token, completionError: null } });
  if (!claimed.count) return;
  try {
    const booking = await db.booking.findUnique({ where: { id: bookingId }, include: completionInclude });
    if (!booking.streamCallId) throw new Error("Missing call");
    const client = new StreamClient(process.env.NEXT_PUBLIC_STREAM_API_KEY, process.env.STREAM_SECRET_KEY, { timeout: 10000 });
    const call = client.video.call("default", booking.streamCallId);
    await secureInterviewCall(client, call, [booking.interviewer.clerkUserId, booking.interviewee.clerkUserId]);
    const { call: state } = await call.get();
    if (!state.ended_at) {
      // End terminates the shared session and finalizes its recording/transcription.
      // Never delete the call or any artifacts; ready webhooks collect asynchronous exports.
      await call.end();
    }
    await db.booking.updateMany({ where: { id: bookingId, completionToken: token }, data: {
      completionState: "COMPLETE", streamEndedAt: new Date(), completionError: null,
    } });
  } catch (error) {
    console.error("Shared call termination failed", { bookingId, code: error.code || error.name });
    await db.booking.updateMany({ where: { id: bookingId, completionToken: token }, data: {
      completionState: "FAILED", completionError: "Interview completed. Shared call termination is pending; retry finishing the call.",
    } });
  }
  // Feedback remains independent of Stream call termination retries.
  const feedbackBooking = await db.booking.findUnique({ where: { id: bookingId }, include: feedbackBookingInclude });
  if (feedbackBooking) {
    try { await prepareMeetingFeedback(feedbackBooking); }
    catch (error) { console.error("Completion feedback failed", { bookingId, message: error.publicMessage }); }
  }
}
