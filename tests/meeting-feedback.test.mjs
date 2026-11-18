import { productionFailure, productionError } from "../lib/production-errors.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';
import { scoreInterview, GRADE_SCORES } from '../lib/interviewScoring.js';

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\r?\n/gm, '').replaceAll('export ', '');
const copy = value => structuredClone(value);
const question = (id, grade = 'GOOD', sent = true) => ({ id, sourceId: `source-${id}`, question: `Explain ${id}`,
  topic: 'Databases', type: 'CONCEPTUAL', difficulty: 'MEDIUM', options: [], sentAt: sent ? new Date() : null,
  parentId: null, depth: 0, responseStatus: 'ANSWERED', referenceAnswer: 'PRIVATE_ANSWER_KEY',
  submission: { answer: `Candidate answer ${id}`, approvedGrade: grade, language: null,
    evaluationStatus: 'COMPLETE', interviewerNotes: 'PRIVATE_NOTES', evaluation: { reasoning: 'PRIVATE_EVALUATION_KEY' } } });

function harness() {
  const booking = { id: 'b', status: 'COMPLETED', endTime: new Date(Date.now() + 3600000),
    feedbackState: 'PENDING', feedbackRequestedAt: null, streamCallId: 'call', transcriptArtifacts: [], creditsCharged: 1,
    interviewer: { id: 'i-db', clerkUserId: 'i', categories: [] }, interviewee: { clerkUserId: 'c' } };
  const state = { questions: [question('q1', 'POOR'), question('q2', 'EXCELLENT'), question('unasked', 'EXCELLENT', false)],
    messages: [{ id: 'm1', user: { id: 'c' }, text: 'I used an index to avoid a full scan.' },
      { id: 'other', user: { id: 'outsider' }, text: 'OUTSIDER_SECRET' },
      { id: 'deleted', user: { id: 'c' }, deleted_at: 'date', text: 'DELETED_MESSAGE' },
      { id: 'event', user: { id: 'i' }, prept_kind: 'question', text: 'DELIVERY_EVENT' }],
    transcripts: [], prompts: [], feedback: null, earnings: 0, providerError: null, chatError: false, downloadError: false };
  const snapshot = () => copy({ ...booking, feedback: state.feedback });
  function matches(where) {
    if (where.status && where.status !== booking.status) return false;
    if (typeof where.feedbackState === 'string' && where.feedbackState !== booking.feedbackState) return false;
    if (where.feedbackRequestedAt instanceof Date && +where.feedbackRequestedAt !== +booking.feedbackRequestedAt) return false;
    if (where.OR) return where.OR.some(condition =>
      condition.feedbackState ? !booking.feedbackState.startsWith('RUNNING:')
        : condition.feedbackRequestedAt === null ? booking.feedbackRequestedAt == null
          : booking.feedbackRequestedAt && booking.feedbackRequestedAt < condition.feedbackRequestedAt.lt);
    return true;
  }
  const db = {
    $transaction: async fn => fn(db),
    booking: { findUnique: async () => snapshot(),
      updateMany: async ({ where, data }) => { if (!matches(where)) return { count: 0 }; Object.assign(booking, data); return { count: 1 }; },
      update: async ({ data }) => { Object.assign(booking, data); return snapshot(); } },
    interviewQuestion: { findMany: async ({ where, select }) => {
      assert.equal(where.bookingId, 'b'); assert.equal(where.sentAt.not, null);
      assert.equal(select.referenceAnswer, undefined); assert.equal(select.correctOptionIndex, undefined);
      assert.equal(select.submission.select.interviewerNotes, undefined); assert.equal(select.submission.select.evaluation, undefined);
      return copy(state.questions.filter(q => q.sentAt));
    } },
    aIBuddyMessage: { findMany: async ({ select }) => {
      assert.deepEqual(Object.keys(select), ['questionIds']);
      return [{ questionIds: ['source-q1', 'source-unasked'], content: 'PRIVATE_BUDDY_CHAT', payload: { answer: 'PRIVATE_BUDDY_KEY' } }];
    } },
    feedback: { findUnique: async () => copy(state.feedback), upsert: async ({ create, update }) => {
      state.feedback = state.feedback ? { ...state.feedback, ...copy(update) } : { id: 'f', sessionComment: 'keep', ...copy(create) };
      return copy(state.feedback);
    } },
    creditTransaction: { findFirst: async () => state.earnings ? { id: 'earning' } : null,
      create: async () => { state.earnings++; } },
  };
  const api = runInNewContext(`${source('lib/meeting-feedback.js')}; ({prepareMeetingFeedback, approvedOutcome, validateNarrative})`, { productionFailure, productionError,
    db, createHash, randomUUID, scoreInterview, GRADE_SCORES, Date, AbortSignal, console: { error() {} },
    process: { env: { GEMINI_API_KEY: 'mock' } },
    StreamClient: class { video = { call: () => ({ listTranscriptions: async () => ({ transcriptions: copy(state.transcripts) }) }) }; },
    StreamChat: { getInstance: () => ({ channel: () => ({ query: async () => {
      if (state.chatError) throw new Error('offline'); return { messages: copy(state.messages) };
    } }) }) },
    fetch: async () => ({ ok: !state.downloadError, text: async () => JSON.stringify({ type: 'speech', speaker_id: 'c', text: 'I considered the query complexity.', start_ts: 12 }) }),
    GoogleGenerativeAI: class { getGenerativeModel() { return { generateContent: async prompt => {
      state.prompts.push(prompt);
      if (state.wait) await state.wait;
      if (state.providerError) throw state.providerError;
      const evidence = JSON.parse(prompt.split('\nEVIDENCE:\n')[1].split('\nRETURN VALID JSON ONLY:')[0].trim());
      const claim = { text: 'The submitted explanation addresses the approach.', evidenceIds: [state.badId || evidence.find(e => e.candidateEvidence).id] };
      const data = { summary: claim, technical: claim, communication: claim, problemSolving: claim,
        strengths: [claim], weaknesses: [claim], improvements: [claim], overallScore: 100, overallRating: 'EXCELLENT', recommendation: 'Hire automatically' };
      return { response: { text: () => JSON.stringify(data) } };
    } }; } },
  });
  return { ...api, booking, state, db, snapshot, run: () => api.prepareMeetingFeedback(snapshot()) };
}

test('combines transcript, chat, delivered answers and safe Buddy provenance; scoring is deterministic', async () => {
  const h = harness(); h.state.transcripts = [{ url: 'https://transcript.test/one', filename: 'one' }];
  const report = await h.run();
  assert.equal(report.report.scoring.overallScore, 50); assert.equal(report.overallRating, 'AVERAGE');
  assert.match(report.recommendation, /^Insufficient Evidence.*Advisory/);
  assert.equal(report.report.state, 'READY');
  assert.deepEqual([...new Set(report.report.evidence.map(e => e.source))], ['question', 'transcript', 'chat']);
  assert.equal(report.report.evidence[0].origin, 'AI-assisted, delivered');
  const exposed = JSON.stringify(report) + h.state.prompts.join('');
  assert.doesNotMatch(exposed, /PRIVATE_|unasked|OUTSIDER_SECRET|DELETED_MESSAGE|DELIVERY_EVENT/);
  assert.equal(report.report.evidence.find(e => e.source === 'transcript').timestamp, 12);
});

test('no approved grades means no invented score/rating, even with candidate speech', async () => {
  const h = harness(); h.state.questions = [question('q1', null)];
  h.state.transcripts = [{ url: 'https://transcript.test/one', filename: 'one' }];
  const report = await h.run();
  assert.equal(report.overallRating, null); assert.equal(report.report.scoring.overallScore, null);
  assert.match(report.recommendation, /^Insufficient Evidence/); assert.equal(report.report.state, 'INCOMPLETE');
});

test('unanswered questions and suggestions alone produce an insufficient report without Gemini', async () => {
  const h = harness(); h.state.questions = [{ ...question('q1'), submission: null }]; h.state.messages = [];
  h.booking.completedAt = new Date(Date.now() - 3600000);
  await assert.rejects(h.run(), error => error.code === 'INSUFFICIENT_EVIDENCE');
  assert.equal(h.state.prompts.length, 0); assert.equal(h.state.feedback, null);
});

test('early completion persists once; identical retries do not repeat AI work or earnings', async () => {
  const h = harness(); const first = await h.run(); const retry = await h.run();
  assert.equal(first.id, retry.id); assert.equal(h.state.prompts.length, 1); assert.equal(h.state.earnings, 1);
  assert.equal(retry.sessionComment, 'keep'); assert.equal(h.booking.status, 'COMPLETED');
});

test('late transcripts refresh the persisted fallback without creating a second report', async () => {
  const h = harness(); const first = await h.run(); assert.equal(first.report.state, 'INCOMPLETE');
  h.state.transcripts = [{ url: 'https://transcript.test/late', filename: 'late' }];
  const next = await h.run(); assert.equal(next.id, first.id); assert.equal(next.report.state, 'READY');
  assert.equal(h.state.prompts.length, 2); assert.equal(h.state.earnings, 1);
});

test('quota failure preserves the previous report; safe retry succeeds', async () => {
  const h = harness(); const previous = await h.run(); h.state.questions[0].submission.approvedGrade = 'GOOD';
  h.state.providerError = Object.assign(new Error('quota'), { status: 429 });
  await assert.rejects(h.run(), error => error.code === 'AI_RATE_LIMITED');
  assert.deepEqual(h.state.feedback, previous); assert.equal(h.booking.feedbackState, 'FAILED');
  h.state.providerError = null; const next = await h.run(); assert.equal(next.id, previous.id);
  assert.equal(next.report.scoring.overallScore, 87.5); assert.equal(h.state.earnings, 1);
});

test('unknown evidence references fail validation instead of persisting fabricated citations', async () => {
  const h = harness(); h.state.badId = 'question:unasked';
  await assert.rejects(h.run(), error => /validation/.test(error.publicMessage));
  assert.equal(h.state.feedback, null); assert.equal(h.booking.feedbackState, 'FAILED');
});

test('parallel generation is leased; abandoned leases can be recovered', async () => {
  const h = harness(); let release; h.state.wait = new Promise(resolve => { release = resolve; });
  const first = h.run(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(await h.run(), null); assert.equal(h.state.prompts.length, 1);
  release(); await first;
  h.booking.feedbackState = 'RUNNING:abandoned'; h.booking.feedbackRequestedAt = new Date(Date.now() - 600000);
  assert.ok(await h.run()); assert.equal(h.state.prompts.length, 1);
});

test('provider retrieval failures retain previously persisted chat and speech evidence', async () => {
  const h = harness(); h.state.transcripts = [{ url: 'https://transcript.test/one', filename: 'one' }];
  const first = await h.run(); h.state.chatError = true; h.state.downloadError = true;
  const next = await h.run();
  assert.deepEqual(next.report.evidence, first.report.evidence);
  assert.equal(next.report.state, 'INCOMPLETE'); assert.ok(next.report.limitations.length);
});

test('casual leave or scheduled expiry cannot generate permanent feedback', async () => {
  const h = harness(); h.booking.status = 'SCHEDULED'; h.booking.endTime = new Date(0);
  assert.equal(await h.run(), null); assert.equal(h.state.prompts.length, 0);
});

test('both assigned participants can retrieve feedback; outsiders cannot trigger generation', async () => {
  const h = harness(); let actor = 'i', calls = 0;
  const action = runInNewContext(`${source('actions/feedback.js')}; getMeetingFeedback`, {
    productionFailure, productionError,
    currentUser: async () => ({ id: actor }), runAction: fn => fn(), actionFailure: error => ({ error }),
    createRateLimiter: () => ({}), checkRateLimit: async () => null, request: async () => ({}), revalidatePath() {},
    feedbackBookingInclude: {}, prepareMeetingFeedback: async () => { calls++; return { id: 'f' }; },
    db: { booking: { findFirst: async ({ where }) => {
      assert.equal(where.OR[0].interviewer.clerkUserId, actor); assert.equal(where.OR[1].interviewee.clerkUserId, actor);
      return ['i', 'c'].includes(actor) ? h.snapshot() : null;
    }, findUnique: async () => ({ feedbackState: 'READY' }) } },
  });
  assert.equal((await action('b')).feedback.id, 'f'); actor = 'c'; assert.equal((await action('b')).feedback.id, 'f');
  actor = 'outsider'; assert.equal((await action('b')).error, 'Meeting not found'); assert.equal(calls, 2);
});

test('an invalidated worker cannot overwrite a newer approved-score report', async () => {
  const h = harness(); let release;
  h.state.wait = new Promise(resolve => { release = resolve; });
  const stale = h.run(); await new Promise(resolve => setImmediate(resolve));
  h.state.questions[0].submission.approvedGrade = 'GOOD'; h.booking.feedbackState = 'PENDING';
  h.state.wait = null;
  const current = await h.run(); release(); await stale;
  assert.equal(h.state.feedback.report.scoring.overallScore, 87.5);
  assert.equal(h.state.feedback.report.inputHash, current.report.inputHash);
  assert.equal(h.state.earnings, 1);
});

test('a transcript arriving during generation leaves a pending refresh rather than overwriting artifacts', async () => {
  const h = harness(); let release;
  h.state.wait = new Promise(resolve => { release = resolve; });
  const pending = h.run(); await new Promise(resolve => setImmediate(resolve));
  h.booking.transcriptArtifacts = [{ filename: 'new', url: 'https://transcript.test/new' }];
  release(); assert.equal(await pending, null);
  assert.equal(h.booking.feedbackState, 'PENDING'); assert.equal(h.booking.transcriptArtifacts[0].filename, 'new');
  const refreshed = await h.run(); assert.equal(refreshed.report.state, 'READY');
});

test('signed transcript webhook refreshes even when a report already exists; unsigned events do nothing', async () => {
  let valid = false, prepared = 0, updated = 0;
  const webhook = runInNewContext(`${source('app/api/webhooks/stream/route.js')}; POST`, {
    Response, process: { env: {} }, revalidatePath() {}, console,
    feedbackBookingInclude: {}, prepareMeetingFeedback: async booking => { assert.equal(booking.transcriptArtifacts.length, 1); prepared++; },
    StreamClient: class { verifyWebhook() { return valid; } video = { call: () => ({ listTranscriptions: async () => ({ transcriptions: [{ filename: 'new' }] }) }) }; },
    db: { booking: { findUnique: async () => ({ id: 'b', status: 'COMPLETED', feedback: { id: 'f' } }), update: async () => { updated++; } } },
  });
  const request = () => new Request('https://test/api/webhooks/stream', { method: 'POST', headers: { 'x-signature': 'test' }, body: JSON.stringify({ type: 'call.transcription_ready', call_cid: 'default:call' }) });
  assert.equal((await webhook(request())).status, 401); assert.equal(prepared, 0); assert.equal(updated, 0);
  valid = true; assert.equal((await webhook(request())).status, 200); assert.equal(prepared, 1); assert.equal(updated, 1);
});

test('final feedback uses adjusted latest scores without leaking archived private evidence',async()=>{
 const h=harness();
 h.state.questions[0].submission.approvedGrade='EXCELLENT';
 h.state.questions[0].submission.previousAttempts=[{correctionHintGiven:true,interviewerNotes:'ARCHIVED_PRIVATE',evaluation:{reasoning:'ARCHIVED_KEY'},answer:'old answer'}];
 await h.run();
 const persisted=JSON.stringify(h.state.feedback);assert.ok(!persisted.includes('ARCHIVED_PRIVATE'));assert.ok(!persisted.includes('ARCHIVED_KEY'));
 assert.equal(h.state.feedback.overallRating,'EXCELLENT');
 assert.equal(h.state.feedback.report.scoring.overallScore,97.5);
 assert.ok(!h.state.prompts.join('').includes('ARCHIVED_PRIVATE'));
});

test('chat-only and transcript-only evidence generate narratives without inventing grades', async () => {
  for (const mode of ['chat', 'transcript']) {
    const h = harness(); h.state.questions = [];
    if (mode === 'transcript') { h.state.messages = []; h.state.transcripts = [{ url: 'https://transcript.test/one', filename: 'one' }]; }
    const report = await h.run();
    assert.equal(h.state.prompts.length, 1);
    assert.equal(report.overallRating, null);
    assert.equal(report.report.scoring.overallScore, null);
    assert.ok(report.report.evidence.some(e => e.source === mode && e.candidateEvidence));
    assert.equal((await h.run()).id, report.id);
    assert.equal(h.state.prompts.length, 1);
  }
});
test('delayed transcript keeps pending and later recovers without a second report', async () => {
  const h = harness(); h.state.questions = []; h.state.messages = [];
  h.booking.completedAt = new Date();
  await assert.rejects(h.run(), error => error.code === 'TRANSCRIPT_PROCESSING');
  assert.equal(h.booking.feedbackState, 'PENDING'); assert.equal(h.state.feedback, null);
  h.state.transcripts = [{ url: 'https://transcript.test/late', filename: 'late' }];
  assert.ok(await h.run()); assert.equal(h.state.prompts.length, 1);
});
test('only exact unassessed statements may omit citations', () => {
  const h = harness(); const empty = { text: 'Not assessed.', evidenceIds: [] };
  const data = { summary: empty, technical: empty, communication: empty, problemSolving: empty, strengths: [], weaknesses: [], improvements: [] };
  assert.ok(h.validateNarrative(data, []));
  assert.throws(() => h.validateNarrative({ ...data, technical: { text: 'Not assessed. The candidate is excellent.', evidenceIds: [] } }, []), /supporting evidence/);
});

test('Gemini failure preserves downloaded transcript evidence before a report exists', async () => {
  const h = harness(); h.state.transcripts = [{ url: 'https://transcript.test/one', filename: 'one' }];
  h.state.providerError = Object.assign(new Error('busy'), { status: 503 });
  await assert.rejects(h.run(), error => error.code === 'AI_MODEL_UNAVAILABLE');
  assert.equal(h.state.feedback, null);
  assert.equal(h.booking.transcriptArtifacts[0].evidence.length, 1);
  h.state.providerError = null; h.state.downloadError = true;
  const report = await h.run();
  assert.ok(report.report.evidence.some(e => e.source === 'transcript' && e.candidateEvidence));
});
test('greetings alone do not fabricate a performance report', async () => {
  const h = harness(); h.state.questions = []; h.state.messages = [{ id: 'hi', user: { id: 'c' }, text: 'Hello, thanks!' }];
  h.booking.completedAt = new Date(Date.now() - 3600000);
  await assert.rejects(h.run(), error => error.code === 'INSUFFICIENT_EVIDENCE');
  assert.equal(h.state.prompts.length, 0);
});
