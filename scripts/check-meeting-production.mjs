// Read-only diagnostics. Uses local .env; never prints keys, transcript text, or signed URLs.
import { loadEnvFile } from 'node:process';
import pg from 'pg';
import { StreamClient } from '@stream-io/node-sdk';
loadEnvFile();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
const safeError = error => ({ code: typeof error.code === 'number' || /^[A-Z0-9_]+$/.test(error.code || '') ? error.code : error.name, status: error.status || error.StatusCode });
try {
  console.log(JSON.stringify({ configuration: { geminiKeyPresent: Boolean(process.env.GEMINI_API_KEY), questionModel: process.env.PREPT_GEMINI_MODEL || 'gemini-3.5-flash-lite', feedbackModel: process.env.GEMINI_FEEDBACK_MODEL || process.env.PREPT_GEMINI_MODEL || 'gemini-2.5-flash', streamConfigured: Boolean(process.env.NEXT_PUBLIC_STREAM_API_KEY && process.env.STREAM_SECRET_KEY) } }));
  const { rows } = await pool.query(`SELECT b.id, b."streamCallId", b.status, b."feedbackState", b."completedAt",
    jsonb_array_length(COALESCE(b."transcriptArtifacts"::jsonb, '[]')) AS artifacts,
    (SELECT count(*) FROM "InterviewQuestion" q WHERE q."bookingId"=b.id) AS questions,
    (SELECT count(*) FROM "InterviewQuestion" q WHERE q."bookingId"=b.id AND q."sentAt" IS NOT NULL) AS sent,
    (SELECT count(*) FROM "InterviewQuestion" q JOIN "InterviewSubmission" s ON s."questionId"=q.id WHERE q."bookingId"=b.id) AS answers,
    (SELECT count(*) FROM "Feedback" f WHERE f."bookingId"=b.id) AS reports
    FROM "Booking" b WHERE b.id=$1 OR b."streamCallId"=$2 ORDER BY b."createdAt" DESC`, ['fe5105b1-d321-4319-9479-ff6961594a87', 'mock_1794977907259_7hqqx']);
  const client = new StreamClient(process.env.NEXT_PUBLIC_STREAM_API_KEY, process.env.STREAM_SECRET_KEY, { timeout: 10000 });
  const settings = await client.getApp();
  const app = settings.app || settings;
  const safeUrl = value => { try { const u = new URL(value); return u.origin + u.pathname; } catch { return null; } };
  console.log(JSON.stringify({ streamWebhooks: { url: safeUrl(app.webhook_url), events: app.webhook_events, hooks: app.event_hooks?.map(h => ({ enabled: h.enabled, product: h.product, type: h.hook_type, url: safeUrl(h.webhook_url), events: h.event_types })) } }));
  for (const row of rows) {
    console.log(JSON.stringify({ booking: row }));
    try {
      const call = client.video.call('default', row.streamCallId);
      const [transcripts, details] = await Promise.all([call.listTranscriptions(), call.get()]);
      for (const t of transcripts.transcriptions) {
        const response = await fetch(t.url, { signal: AbortSignal.timeout(15000) });
        const lines = response.ok ? (await response.text()).trim().split('\n').map(line => { try { return JSON.parse(line); } catch { return {}; } }) : [];
        console.log(JSON.stringify({ transcriptShape: { sessionId: t.session_id, status: response.status, lines: lines.length, fields: Object.keys(lines[0] || {}), speechLines: lines.filter(l => l.type === 'speech').length, attributedLines: lines.filter(l => l.speaker_id).length } }));
      }
      console.log(JSON.stringify({ callId: row.streamCallId, transcriptions: transcripts.transcriptions.map(t => ({ sessionId: t.session_id, hasUrl: Boolean(t.url), start: t.start_time, end: t.end_time })), transcriptionSettings: details.call.settings.transcription, endedAt: details.call.ended_at, sessionId: details.call.session?.id }));
    } catch (error) { console.log(JSON.stringify({ stage: 'stream_lookup', ...safeError(error) })); }
  }
} catch (error) { console.log(JSON.stringify({ stage: 'database_read', ...safeError(error) })); process.exitCode = 1; }
finally { await pool.end(); }
