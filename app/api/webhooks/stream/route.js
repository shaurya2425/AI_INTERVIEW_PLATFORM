import { StreamClient } from "@stream-io/node-sdk";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { feedbackBookingInclude, prepareMeetingFeedback } from "@/lib/meeting-feedback";
import { ERROR_MESSAGES } from "@/lib/production-errors";

export const maxDuration = 300;

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
  if (!["call.transcription_ready", "call.recording_ready", "call.ended", "call.session_ended"].includes(body.type)) {
    return Response.json({ ok: true });
  }
  const streamCallId = (body.call_cid || body.call?.cid)?.replace(/^default:/, "");
  if (!streamCallId) return Response.json({ error: "Missing call ID" }, { status: 400 });
  try {
    const booking = await db.booking.findUnique({ where: { streamCallId }, include: feedbackBookingInclude });
    if (!booking || booking.status === "CANCELLED") return Response.json({ ok: true });
    const call = client.video.call("default", streamCallId);
    if (body.type === "call.recording_ready") {
      if (!body.call_recording?.url) throw new Error("Missing recording URL");
      const { recordings } = await call.listRecordings();
      await db.booking.update({ where: { id: booking.id }, data: { recordingUrl: body.call_recording.url, recordingArtifacts: JSON.parse(JSON.stringify(recordings)) } });
    }
    if (body.type === "call.transcription_ready") {
      const { transcriptions } = await call.listTranscriptions();
      const originals = transcriptions.filter(item => !item.translated).map(item => ({ ...item,
        evidence: (booking.transcriptArtifacts || []).find(saved => saved.filename === item.filename && saved.start_time === item.start_time)?.evidence || [],
      }));
      if (!originals.length) return Response.json({ code: "TRANSCRIPT_PROCESSING" }, { status: 503 });
      await db.booking.update({ where: { id: booking.id }, data: { transcriptArtifacts: JSON.parse(JSON.stringify(originals)) } });
      booking.transcriptArtifacts = originals;
    }
    // A late transcript can improve an already-persisted fallback report.
    await prepareMeetingFeedback(booking);
    revalidatePath("/appointments");
    revalidatePath("/dashboard");
    return Response.json({ ok: true });
  } catch (error) {
    if (["TRANSCRIPT_PROCESSING", "INSUFFICIENT_EVIDENCE"].includes(error.code)) return Response.json({ ok: true, code: error.code });
    console.error("Stream feedback webhook failed", { stage: body.type, callId: streamCallId, code: error.code || "WEBHOOK_PROCESSING_FAILED", status: error.status || error.StatusCode });
    // Stream must be able to retry transient processing failures.
    // Only signed callers reach here. Return fixed diagnostic codes/reasons so
    // operators can distinguish provider failures from validation or persistence.
    return Response.json({ code: "WEBHOOK_PROCESSING_FAILED", error: "Transcript synchronization encountered an error.",
      causeCode: ERROR_MESSAGES[error.code] ? error.code : undefined,
      validationReasons: error.validationReasons,
    }, { status: 500 });
  }
}
