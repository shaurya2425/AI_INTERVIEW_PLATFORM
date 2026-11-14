import { createHash } from "node:crypto";
import { dueReminders } from "./reminder-policy.mjs";

export function reminderId(booking, recipientId, minutesBefore) {
  return createHash("sha256").update(JSON.stringify([
    booking.id, new Date(booking.startTime).toISOString(), recipientId, minutesBefore,
  ])).digest("hex");
}

export async function deliverReminder({ db, send, booking, recipient, minutesBefore, payload, timeZone, now = () => new Date() }) {
  // Recheck cancellations/rescheduling immediately before each recipient's delivery.
  const latest = await db.booking.findUnique({ where: { id: booking.id } });
  if (!latest || new Date(latest.startTime).getTime() !== new Date(booking.startTime).getTime()
    || !dueReminders(latest, now(), timeZone).includes(minutesBefore)) return "skipped";
  const id = reminderId(booking, recipient.id, minutesBefore);
  const reminder = await db.interviewReminder.upsert({
    where: { id }, update: {}, create: {
      id, bookingId: booking.id, recipientId: recipient.id,
      scheduledStart: booking.startTime, minutesBefore, payload,
    },
  });
  if (reminder.sentAt) return "skipped";
  await db.interviewReminder.update({ where: { id }, data: { attempts: { increment: 1 } } });
  try {
    // Persist the first payload unchanged: retries must use identical data and key.
    const { data, error } = await send(reminder.payload, { idempotencyKey: `interview-reminder/${id}` });
    if (error || !data?.id) throw new Error(error?.name || "Email provider did not accept the reminder");
    await db.interviewReminder.update({ where: { id }, data: { sentAt: now(), providerId: data.id, lastError: null } });
    return "sent";
  } catch (error) {
    await db.interviewReminder.update({ where: { id }, data: { lastError: error.message } });
    return "failed";
  }
}
