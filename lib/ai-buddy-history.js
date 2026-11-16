import "server-only";
import { db } from "@/lib/prisma";

export function historyFailure(error) {
  console.error("AI Buddy history operation failed", { code: error.code || error.name });
  return { success: false, error: ["P2021", "P2022"].includes(error.code)
    ? "Conversation storage needs the Task 3.1 database migration. Your browser history has not been deleted. Apply the migration and retry sync."
    : error.code === "INVALID_HISTORY" ? "A saved conversation record could not be imported because its format or size is unsupported. The original browser history is retained; contact the administrator before clearing browser data."
    : "Conversation history could not be saved or loaded. Your browser copy is preserved. Check your connection and retry sync." };
}

export async function appendBuddyMessage(bookingId, authorId, message, kind = "CONVERSATION") {
  if (!message || typeof message.id !== "string" || !/^[\w:.-]{1,160}$/.test(message.id) ||
      !["user", "assistant"].includes(message.role) || typeof message.text !== "string" ||
      message.text.length > 60000 || !Array.isArray(message.cards || []) ||
      (message.cards || []).length > 25 || Buffer.byteLength(JSON.stringify(message), "utf8") > 400000) {
    throw Object.assign(new Error("Invalid conversation record"), { code: "INVALID_HISTORY" });
  }
  const date = new Date(message.createdAt || Date.now());
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid message date");
  // Never overwrite a committed AI response or delete history when importing a browser copy.
  return db.aIBuddyMessage.upsert({
    where: { bookingId_messageId: { bookingId, messageId: message.id } }, update: {},
    create: { bookingId, messageId: message.id, authorId, role: message.role, content: message.text,
      kind, occurredAt: date, questionIds: [...new Set([
        ...(message.cards || []).map(q => q?.id),
        ...(Array.isArray(message.questionIds) ? message.questionIds : []),
      ].filter(id => typeof id === "string" && id.length <= 200))],
      payload: JSON.parse(JSON.stringify(message)) },
  });
}

export function buddyMessageView(record) {
  const payload = { ...record.payload };
  delete payload.result;
  return { ...payload, id: record.messageId, role: record.role, text: record.content, createdAt: record.occurredAt.toISOString() };
}
