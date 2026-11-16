"use server";

import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { appendBuddyMessage, buddyMessageView, historyFailure } from "@/lib/ai-buddy-history";

async function access(callId) {
  const user = await currentUser();
  if (!user || typeof callId !== "string" || !callId || callId.length > 200) return null;
  const booking = await db.booking.findUnique({ where: { streamCallId: callId }, select: {
    id: true, interviewer: { select: { clerkUserId: true } },
  } });
  return booking?.interviewer.clerkUserId === user.id ? { booking, user } : null;
}

export async function getAIBuddyHistory(callId) {
  try {
    const context = await access(callId);
    if (!context) return { success: false, error: "Only the assigned interviewer can access this private conversation." };
    const messages = await db.aIBuddyMessage.findMany({ where: { bookingId: context.booking.id }, orderBy: [
      { occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" },
    ] });
    return { success: true, messages: messages.map(buddyMessageView) };
  } catch (error) { return historyFailure(error); }
}

export async function importAIBuddyHistory(callId, messages) {
  try {
    const context = await access(callId);
    if (!context) return { success: false, error: "Only the assigned interviewer can import this conversation." };
    if (!Array.isArray(messages) || messages.length > 10 || Buffer.byteLength(JSON.stringify(messages), "utf8") > 800000) {
      return { success: false, error: "History batch is too large. Your local copy is preserved." };
    }
    for (const message of messages) await appendBuddyMessage(context.booking.id, context.user.id, message, "LEGACY_IMPORT");
    return { success: true };
  } catch (error) { return historyFailure(error); }
}
