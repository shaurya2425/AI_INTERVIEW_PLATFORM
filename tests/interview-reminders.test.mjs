import test from "node:test";
import assert from "node:assert/strict";
import { dueReminders, REMINDER_TIME_ZONE } from "../lib/reminder-policy.mjs";
import { deliverReminder, reminderId } from "../lib/reminder-delivery.mjs";
import { interviewReminderEmail } from "../emails/interview-reminder.mjs";

const booking = {
  id: "booking-1", status: "SCHEDULED", startTime: new Date("2026-11-15T18:00:00+05:30"),
  endTime: new Date("2026-11-15T18:45:00+05:30"), createdAt: new Date("2026-11-14T12:00:00Z"),
  streamCallId: "call-1",
};
const now = new Date("2026-11-15T12:00:00+05:30");

test("six-hour and thirty-minute reminders become due at the exact boundaries", () => {
  assert.deepEqual(dueReminders(booking, new Date(now.getTime() - 1)), []);
  assert.deepEqual(dueReminders(booking, now), [360]);
  assert.deepEqual(dueReminders(booking, new Date("2026-11-15T17:30:00+05:30")), [30]);
});
test("same-day rule uses India time, not UTC or the host timezone", () => {
  const early = { ...booking, startTime: new Date("2026-11-15T05:00:00+05:30") };
  assert.deepEqual(dueReminders(early, new Date("2026-11-14T23:00:00+05:30")), []);
  assert.deepEqual(dueReminders(early, new Date("2026-11-15T04:30:00+05:30")), [30]);
  const midnight = { ...booking, startTime: new Date("2026-11-15T00:15:00+05:30") };
  assert.deepEqual(dueReminders(midnight, new Date("2026-11-14T23:45:00+05:30")), []);
});
test("cancelled, completed, past, and late bookings do not send stale reminders", () => {
  for (const status of ["CANCELLED", "COMPLETED"]) assert.deepEqual(dueReminders({ ...booking, status }, now), []);
  assert.deepEqual(dueReminders(booking, booking.startTime), []);
  assert.deepEqual(dueReminders(booking, new Date(now.getTime() + 600001)), []);
  assert.deepEqual(dueReminders({ ...booking, createdAt: new Date(now.getTime() + 1) }, new Date(now.getTime() + 60000)), []);
});
test("each recipient, time, and reminder has a distinct delivery identity", () => {
  const keys = [reminderId(booking, "a", 360), reminderId(booking, "b", 360), reminderId(booking, "a", 30),
    reminderId({ ...booking, startTime: new Date("2026-11-16T18:00:00+05:30") }, "a", 360)];
  assert.equal(new Set(keys).size, 4);
});

function fixture() {
  const records = new Map();
  let latest = booking;
  const db = {
    booking: { findUnique: async () => latest },
    interviewReminder: {
      upsert: async ({ where, create }) => {
        if (!records.has(where.id)) records.set(where.id, { ...create, sentAt: null });
        return { ...records.get(where.id) };
      },
      update: async ({ where, data }) => Object.assign(records.get(where.id), data),
    },
  };
  return { db, records, setLatest: (value) => { latest = value; } };
}
const recipient = { id: "interviewer", email: "interviewer@example.com", name: "Interviewer" };
const base = { booking, recipient, minutesBefore: 360, payload: { to: recipient.email, subject: "Reminder" }, timeZone: REMINDER_TIME_ZONE, now: () => now };

test("repeated runs do not send an accepted reminder twice", async () => {
  const { db } = fixture();
  let sends = 0;
  const send = async () => { sends++; return { data: { id: "email-1" } }; };
  assert.equal(await deliverReminder({ ...base, db, send }), "sent");
  assert.equal(await deliverReminder({ ...base, db, send }), "skipped");
  assert.equal(sends, 1);
});
test("a failed recipient retries with the original payload and idempotency key", async () => {
  const { db } = fixture();
  const calls = [];
  const send = async (payload, options) => {
    calls.push({ payload, options });
    return calls.length === 1 ? { error: { name: "rate_limit_exceeded" } } : { data: { id: "email-1" } };
  };
  assert.equal(await deliverReminder({ ...base, db, send }), "failed");
  assert.equal(await deliverReminder({ ...base, db, send, payload: { subject: "changed" } }), "sent");
  assert.deepEqual(calls[0], calls[1]);
});
test("cancellation or rescheduling before delivery skips the provider call", async () => {
  const { db, setLatest } = fixture();
  const send = async () => { assert.fail("Must not send"); };
  setLatest({ ...booking, status: "CANCELLED" });
  assert.equal(await deliverReminder({ ...base, db, send }), "skipped");
  setLatest({ ...booking, startTime: new Date("2026-11-16T18:00:00+05:30") });
  assert.equal(await deliverReminder({ ...base, db, send }), "skipped");
});
test("retry after a database acknowledgment failure reuses the provider request", async () => {
  const { db } = fixture();
  const update = db.interviewReminder.update;
  let failOnce = true;
  db.interviewReminder.update = async (args) => {
    if (args.data.sentAt && failOnce) {
      failOnce = false;
      throw new Error("Temporary database outage");
    }
    return update(args);
  };
  const provider = new Map();
  const send = async (payload, { idempotencyKey }) => {
    if (!provider.has(idempotencyKey)) provider.set(idempotencyKey, payload);
    assert.deepEqual(provider.get(idempotencyKey), payload);
    return { data: { id: "accepted-email" } };
  };
  assert.equal(await deliverReminder({ ...base, db, send }), "failed");
  assert.equal(await deliverReminder({ ...base, db, send }), "sent");
  assert.equal(provider.size, 1);
});
test("both recipients get their own email and a partial failure retries independently", async () => {
  const { db } = fixture();
  const calls = [];
  let fail = true;
  const send = async (payload) => {
    calls.push(payload.to);
    if (payload.to === "interviewee@example.com" && fail) {
      fail = false;
      return { error: { name: "temporary_error" } };
    }
    return { data: { id: `email-${calls.length}` } };
  };
  const second = { ...base, recipient: { id: "interviewee" }, payload: { to: "interviewee@example.com", subject: "Reminder" } };
  assert.equal(await deliverReminder({ ...base, db, send }), "sent");
  assert.equal(await deliverReminder({ ...second, db, send }), "failed");
  assert.equal(await deliverReminder({ ...base, db, send }), "skipped");
  assert.equal(await deliverReminder({ ...second, db, send }), "sent");
  assert.deepEqual(calls, ["interviewer@example.com", "interviewee@example.com", "interviewee@example.com"]);
});
test("email escapes names and sends a private recipient-specific join link", () => {
  const email = interviewReminderEmail({ ...base, other: { name: "<script>unsafe</script>" }, role: "interviewer",
    from: "Prept <reminders@example.com>", appUrl: "https://prept.example.com", timeZone: REMINDER_TIME_ZONE });
  assert.equal(email.to, recipient.email);
  assert.match(email.html, /&lt;script&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.text, /https:\/\/prept.example.com\/call\/call-1/);
  assert.match(email.text, /Asia\/Kolkata/);
});
