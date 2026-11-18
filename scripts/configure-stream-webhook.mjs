import { loadEnvFile } from 'node:process';
import { createHmac } from 'node:crypto';
import { StreamClient } from '@stream-io/node-sdk';
loadEnvFile();
const url = 'https://ai-interview-platform-ten-silk.vercel.app/api/webhooks/stream';
const client = new StreamClient(process.env.NEXT_PUBLIC_STREAM_API_KEY, process.env.STREAM_SECRET_KEY, { timeout: 10000 });
try {
  // An ignored probe verifies deployed credentials without mutating meeting data.
  const body = JSON.stringify({ type: 'prept.configuration_probe' });
  const unsigned = await fetch(url, { method: 'POST', body });
  const signed = await fetch(url, { method: 'POST', body, headers: {
    'content-type': 'application/json',
    'x-signature': createHmac('sha256', process.env.STREAM_SECRET_KEY).update(body).digest('hex'),
  } });
  console.log(JSON.stringify({ unsignedStatus: unsigned.status, signedStatus: signed.status }));
  if (unsigned.status !== 401 || signed.status !== 200) throw new Error('Signature probe failed');
  const { app } = await client.getApp();
  const hooks = app.event_hooks || [];
  const events = ['call.transcription_ready', 'call.recording_ready', 'call.ended', 'call.session_ended'];
  const existing = hooks.find(h => h.webhook_url === url);
  if (existing) {
    existing.enabled = true;
    existing.event_types = [...new Set([...(existing.event_types || []), ...events])];
  } else hooks.push({ enabled: true, hook_type: 'webhook', webhook_url: url, event_types: events });
  await client.updateApp({ event_hooks: hooks });
  const verified = (await client.getApp()).app.event_hooks.find(h => h.webhook_url === url);
  console.log(JSON.stringify({ enabled: verified?.enabled, url, events: verified?.event_types }));
} catch (error) {
  console.error(JSON.stringify({ stage: 'configure_webhook', code: error.code || error.name, status: error.status || error.StatusCode }));
  process.exitCode = 1;
}
