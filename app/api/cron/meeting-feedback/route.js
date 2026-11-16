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
      where: { feedback: null, OR: [{ status: "COMPLETED" }, { status: "SCHEDULED", endTime: { lte: new Date() } }] },
      include: feedbackBookingInclude, orderBy: { updatedAt: "asc" }, take: 3,
    });
    const results = [];
    for (const booking of bookings) {
      try {
        const feedback = await prepareMeetingFeedback(booking);
        results.push({ bookingId: booking.id, state: feedback ? "ready" : "pending" });
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
