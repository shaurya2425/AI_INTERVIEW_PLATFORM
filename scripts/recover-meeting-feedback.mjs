// Replay verified existing transcript notifications; never synthesize transcript contents.
import { loadEnvFile } from 'node:process';
import { createHmac } from 'node:crypto';
import pg from 'pg';
import { StreamClient } from '@stream-io/node-sdk';
loadEnvFile();
const endpoint = 'https://ai-interview-platform-ten-silk.vercel.app/api/webhooks/stream';
const client = new StreamClient(process.env.NEXT_PUBLIC_STREAM_API_KEY, process.env.STREAM_SECRET_KEY, { timeout: 10000 });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  const deployment = await fetch('https://api.github.com/repos/shaurya2425/AI_INTERVIEW_PLATFORM/commits/main/status', { headers: { 'User-Agent': 'prept-production-recovery' } });
  const state = await deployment.json();
  const vercel = state.statuses?.find(s => s.context === 'Vercel');
  console.log(JSON.stringify({ deployment: vercel?.state, url: vercel?.target_url }));
  if (vercel?.state !== 'success') throw new Error('Deployment not ready');
  for (const callId of ['mock_1794907122499_lyu5t', 'mock_1794977907259_7hqqx']) {
    const { transcriptions } = await client.video.call('default', callId).listTranscriptions();
    if (!transcriptions.length) throw new Error('No completed transcript');
    const body = JSON.stringify({ type: 'call.transcription_ready', call_cid: `default:${callId}` });
    const response = await fetch(endpoint, { method: 'POST', body, signal: AbortSignal.timeout(240000), headers: {
      'content-type': 'application/json',
      'x-signature': createHmac('sha256', process.env.STREAM_SECRET_KEY).update(body).digest('hex'),
    } });
    const result = await response.json();
    console.log(JSON.stringify({ callId, webhookStatus: response.status, code: result.code, causeCode: result.causeCode, validationReasons: result.validationReasons, ok: result.ok }));
    const { rows } = await pool.query(`SELECT b.id, b."feedbackState", jsonb_array_length(b."transcriptArtifacts"::jsonb) AS artifacts,
      f.id AS "reportId", f.report->>'version' AS version, f.report->>'generatedAt' AS "generatedAt",
      jsonb_array_length(f.report->'evidence') AS "evidenceCount"
      FROM "Booking" b LEFT JOIN "Feedback" f ON f."bookingId"=b.id WHERE b."streamCallId"=$1`, [callId]);
    console.log(JSON.stringify({ persisted: rows }));
    if (!response.ok) process.exitCode = 1;
  }
} catch (error) {
  console.error(JSON.stringify({ stage: 'production_recovery', code: error.code || error.name }));
  process.exitCode = 1;
} finally { await pool.end(); }
