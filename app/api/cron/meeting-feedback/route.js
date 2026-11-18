import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/prisma";
import { feedbackBookingInclude, prepareMeetingFeedback } from "@/lib/meeting-feedback";

export const maxDuration = 300;

// Schedule POST every five minutes using the same bearer secret as interview reminders.
export async function POST(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return Response.json({ error: "Scheduler is not configured" }, { status: 503 });
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Oldest attempts first prevents a failing report from starving the backlog.
    const bookings = await db.booking.findMany({
      where: { status: "COMPLETED", OR: [{ feedback: null, feedbackState: { in: ["PENDING", "FAILED"] } }, { feedbackState: "PENDING" },
        { feedbackState: { startsWith: "RUNNING:" }, feedbackRequestedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } }] },
      include: feedbackBookingInclude, orderBy: { updatedAt: "asc" }, take: 3,
    });
    const results = [];
    for (const booking of bookings) {
      try {
        const feedback = await prepareMeetingFeedback(booking);
        const latest = await db.booking.findUnique({ where: { id: booking.id }, select: { feedbackState: true } });
        const state = latest.feedbackState.startsWith("RUNNING:") ? "pending" : latest.feedbackState.toLowerCase();
        results.push({ bookingId: booking.id, state });
        if (!feedback) await db.booking.update({ where: { id: booking.id }, data: { updatedAt: new Date() } });
      } catch (error) {
        results.push({ bookingId: booking.id, state: "failed", error: error.publicMessage || "Feedback processing failed. Check server logs." });
      }
    }
    return Response.json({ results }, { status: results.some(result => result.state === "failed") ? 503 : 200 });
  } catch (error) {
    console.error("Meeting feedback scheduler failed", { code: error.code || error.name });
    return Response.json({ error: "Unable to load meetings for feedback. Check database availability and server logs." }, { status: 500 });
  }
}
