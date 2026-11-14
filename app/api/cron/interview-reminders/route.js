import { timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { db } from "@/lib/prisma";
import { dueReminders, reminderWindows, REMINDER_TIME_ZONE } from "@/lib/reminder-policy.mjs";
import { deliverReminder } from "@/lib/reminder-delivery.mjs";
import { interviewReminderEmail } from "@/emails/interview-reminder.mjs";

export const maxDuration = 60;

export async function POST(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return Response.json({ error: "Scheduler is not configured" }, { status: 503 });
  const authorization = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (authorization.length !== expected.length || !timingSafeEqual(authorization, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const from = process.env.REMINDER_EMAIL_FROM;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!process.env.RESEND_API_KEY || !from || !appUrl) {
    return Response.json({ error: "Email configuration is incomplete" }, { status: 503 });
  }
  try {
    const parsedUrl = new URL(appUrl);
    if (parsedUrl.protocol !== "https:") throw new Error("Reminder links require a public HTTPS app URL");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const now = new Date();
    const deadline = Date.now() + 45000;
    const totals = { sent: 0, skipped: 0, failed: 0, more: false };
    let cursor;
    while (Date.now() < deadline) {
      const bookings = await db.booking.findMany({
        where: { status: "SCHEDULED", OR: reminderWindows(now) },
        include: {
          interviewer: { select: { id: true, name: true, email: true } },
          interviewee: { select: { id: true, name: true, email: true } },
        },
        orderBy: { id: "asc" }, take: 25,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!bookings.length) { totals.more = false; break; }
      for (const booking of bookings) {
        for (const minutesBefore of dueReminders(booking, new Date())) {
          for (const role of ["interviewer", "interviewee"]) {
            if (Date.now() >= deadline) return Response.json({ ...totals, more: true });
            const recipient = booking[role];
            const other = booking[role === "interviewer" ? "interviewee" : "interviewer"];
            const payload = interviewReminderEmail({ booking, recipient, other, role, minutesBefore, from, appUrl, timeZone: REMINDER_TIME_ZONE });
            const outcome = await deliverReminder({
              db, booking, recipient, minutesBefore, payload, timeZone: REMINDER_TIME_ZONE,
              send: async (...args) => {
                // Stay below Resend's default two requests/second per account.
                await new Promise((resolve) => setTimeout(resolve, 600));
                return resend.emails.send(...args);
              },
            });
            totals[outcome]++;
          }
        }
      }
      cursor = bookings.at(-1).id;
      if (bookings.length < 25) { totals.more = false; break; }
      totals.more = true;
    }
    return Response.json(totals, { status: totals.failed ? 503 : 200 });
  } catch (error) {
    console.error("Interview reminder job failed:", error.message);
    return Response.json({ error: "Reminder processing failed" }, { status: 500 });
  }
}
