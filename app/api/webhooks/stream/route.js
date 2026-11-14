import { StreamClient } from "@stream-io/node-sdk";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { feedbackBookingInclude, generateMeetingFeedback } from "@/lib/meeting-feedback";

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");
  const client = new StreamClient(process.env.NEXT_PUBLIC_STREAM_API_KEY, process.env.STREAM_SECRET_KEY);
  if (!signature || !client.verifyWebhook(rawBody, signature)) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }
  let body;
  try { body = JSON.parse(rawBody); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!["call.transcription_ready", "call.recording_ready"].includes(body.type)) {
    return Response.json({ ok: true });
  }
  const streamCallId = body.call_cid?.replace(/^default:/, "");
  if (!streamCallId) return Response.json({ error: "Missing call ID" }, { status: 400 });
  try {
    const booking = await db.booking.findUnique({ where: { streamCallId }, include: feedbackBookingInclude });
    if (!booking || booking.status === "CANCELLED") return Response.json({ ok: true });
    const call = client.video.call("default", streamCallId);
    if (body.type === "call.recording_ready") {
      if (!body.call_recording?.url) throw new Error("Missing recording URL");
      await db.booking.update({ where: { id: booking.id }, data: { recordingUrl: body.call_recording.url } });
    } else if (!booking.feedback) {
      // Use URLs returned by Stream, including transcripts from earlier sessions.
      const { transcriptions } = await call.listTranscriptions();
      const originals = transcriptions.filter((item) => !item.translated)
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      if (!originals.length) throw new Error("Transcript is not yet available");
      await generateMeetingFeedback(booking, originals);
    }
    revalidatePath("/appointments");
    revalidatePath("/dashboard");
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Stream feedback webhook failed:", error);
    // Stream must be able to retry transient processing failures.
    return Response.json({ error: "Feedback processing failed" }, { status: 500 });
  }
}
