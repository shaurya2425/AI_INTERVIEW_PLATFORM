import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { SCORING_POLICY_VERSION, scoreInterview } from '../lib/interviewScoring.js';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const source = file => read(file).replace(/^import[\s\S]*?;\r?\n/gm, '').replaceAll('export ', '');
const flush = () => new Promise(resolve => setImmediate(resolve));

function roomHarness() {
  const events = [], slots = [];
  let index = 0, effect;
  const code = read('app/(main)/call/[callId]/components/CallRoom.jsx');
  const body = code.slice(code.indexOf('function ConnectedCallRoom('), code.indexOf('  const handleLeave ='));
  const render = runInNewContext(`${body} }; ConnectedCallRoom`, {
    useRouter: () => ({}),
    useState: initial => {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial;
      return [slots[slot], value => { slots[slot] = value; }];
    },
    useRef: initial => { const slot = index++; return slots[slot] ||= { current: initial }; },
    useEffect: (run, deps) => { effect = { run, deps }; },
    CallingState: { LEFT: 'left' }, console, toast: { error() {} },
    StreamVideoClient: class {
      constructor() { events.push('client'); }
      call() { return {
        state: { callingState: 'joined' },
        camera: { disable: async () => events.push('camera off') },
        microphone: { disable: async () => events.push('microphone off') },
        join: async () => events.push('join'), leave: async () => events.push('leave'),
      }; }
      async disconnectUser() { events.push('disconnect'); }
    },
  });
  return { events, render(props) { index = 0; render(props); return effect; } };
}

for (const isInterviewer of [true, false]) test(`devices are off before join; refreshed props retain connection (${isInterviewer})`, async () => {
  const h = roomHarness();
  const props = { apiKey: 'key', callId: 'call', token: 'first', currentUser: { id: 'user', name: 'Name' }, isInterviewer };
  const first = h.render(props);
  const cleanup = first.run();
  await flush();
  assert.deepEqual(h.events, ['client', 'camera off', 'microphone off', 'join']);
  const refreshed = h.render({ ...props, token: 'refreshed', currentUser: { ...props.currentUser, name: 'New name' } });
  assert.equal(first.deps[0], refreshed.deps[0], 'React must not restart the connection on server refresh');
  cleanup(); await flush();
  assert.deepEqual(h.events.slice(-2), ['leave', 'disconnect']);
});

test('effect replay waits for cleanup and never joins the cancelled effect', async () => {
  const h = roomHarness();
  const effect = h.render({ apiKey: 'key', callId: 'call', token: 'token', currentUser: { id: 'user' } });
  const firstCleanup = effect.run(); firstCleanup();
  const secondCleanup = effect.run(); await flush();
  assert.equal(h.events.filter(e => e === 'join').length, 1);
  secondCleanup(); await flush();
  assert.equal(h.events.filter(e => e === 'disconnect').length, 1);
});

test('completion winning the booking lock prevents a stale question delivery', async () => {
  const booking = { id: 'b', status: 'SCHEDULED', streamCallId: 'call',
    interviewer: { id: 'i', clerkUserId: 'i', role: 'INTERVIEWER' },
    interviewee: { id: 'c', clerkUserId: 'c', role: 'INTERVIEWEE' } };
  const saved = { id: 'q', sentAt: null };
  let deliveries = 0;
  const send = runInNewContext(`${source('actions/interviewQuestions.js')}; sendInterviewQuestion`, {
    createHash, SCORING_POLICY_VERSION, currentUser: async () => ({ id: 'i' }), console,
    process: { env: { NEXT_PUBLIC_STREAM_API_KEY: 'key', STREAM_SECRET_KEY: 'secret' } },
    StreamChat: { getInstance() { deliveries++; throw new Error('must not reach Stream'); } },
    db: { $transaction: async function(fn) { return fn(this); },
      booking: { findUnique: async () => booking, update: async () => ({ ...booking, status: 'COMPLETED' }) },
      interviewQuestion: { findUnique: async () => saved },
    },
  });
  const result = await send({ callId: 'call', question: { id: 'source' } });
  assert.equal(result.success, false);
  assert.match(result.error, /closed/);
  assert.equal(deliveries, 0);
  assert.equal(saved.sentAt, null);
});

test('call access authorizes both assigned accounts, rejects outsiders and closed bookings', async () => {
  let userId = 'i', status = 'SCHEDULED';
  const booking = { id: 'b', get status() { return status; }, startTime: new Date(), endTime: new Date(),
    interviewer: { id: 'i-db', clerkUserId: 'i', categories: [] }, interviewee: { id: 'c-db', clerkUserId: 'c' } };
  const tokens = [];
  const getCallData = runInNewContext(`${source('actions/call.js')}; getCallData`, {
    currentUser: async () => ({ id: userId }), db: { booking: { findUnique: async () => booking } },
    getClerkDisplayName: () => 'Name', withDisplayName: value => value, secureInterviewCall: async () => {},
    process: { env: { NEXT_PUBLIC_STREAM_API_KEY: 'key', STREAM_SECRET_KEY: 'secret' } },
    StreamClient: class {
      video = { call: () => ({ get: async () => ({ call: { settings: { transcription: { language: 'auto', mode: 'auto-on' } } } }) }) };
      generateUserToken({ user_id }) { tokens.push(user_id); return 'token'; }
    },
  });
  assert.equal((await getCallData('call')).isInterviewer, true);
  userId = 'c'; assert.equal((await getCallData('call')).isInterviewer, false);
  userId = 'outsider'; assert.equal((await getCallData('call')).error, 'Forbidden');
  userId = 'c'; status = 'COMPLETED'; assert.equal((await getCallData('call')).error, 'Interview closed');
  assert.deepEqual(tokens, ['i', 'c']);
});

for (const status of ['SCHEDULED', 'COMPLETED']) test(`unexpected LEFT only navigates after confirmed completion (${status})`, async () => {
  const code = read('app/(main)/call/[callId]/components/CallUI.jsx');
  const body = code.slice(code.indexOf('  const handleLeave ='), code.indexOf('  // Chat client'));
  const effects = []; let navigations = 0, leaves = 0;
  const handlers = runInNewContext(`(() => { ${body}; return { handleLeave }; })()`, {
    useCallback: fn => fn, useState: () => [null, () => {}], useEffect: fn => effects.push(fn),
    callId: 'call', callingState: 'LEFT', CallingState: { LEFT: 'LEFT' },
    call: { state: { callingState: 'LEFT' }, leave: async () => { leaves++; } },
    onLeave: () => { navigations++; }, getInterviewLifecycle: async () => ({ success: true, status }),
    setInterval: () => 1, clearInterval() {}, toast: { error() {} }, console,
  });
  const cleanup = effects[0](); await flush();
  assert.equal(navigations, status === 'COMPLETED' ? 1 : 0);
  assert.equal(leaves, 0);
  cleanup();
  if (status === 'SCHEDULED') { handlers.handleLeave(); assert.equal(navigations, 1, 'explicit Leave still navigates'); }
});

test('polling discovers answers without a Stream event and coalesces overlapping refreshes', async () => {
  const code = read('app/(main)/call/[callId]/components/InterviewQuestionMessage.jsx');
  const body = code.slice(code.indexOf('  const [questions,'), code.indexOf('  const seenAnswers'));
  const effects = [], timers = [], states = []; let reads = 0, release;
  const pending = new Promise(resolve => { release = resolve; });
  const api = runInNewContext(`(() => { ${body}; return { refresh, invalidate }; })()`, {
    callId: 'call', channel: null, client: null,
    useState: initial => { const i = states.length; states.push(initial); return [initial, value => { states[i] = value; }]; },
    useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: fn => effects.push(fn),
    getInterviewQuestions: async () => { if (++reads === 1) await pending; return { success: true, questions: [{ id: 'q', submission: { answer: 'saved' } }] }; },
    setTimeout: () => 1, clearTimeout() {}, setInterval: fn => { timers.push(fn); return 1; }, clearInterval() {},
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
  });
  const cleanup = effects.map(fn => fn());
  const first = api.refresh();
  api.invalidate(); timers[0](); release(); await first;
  assert.equal(reads, 2);
  assert.equal(states[0][0].submission.answer, 'saved');
  cleanup.forEach(fn => fn());
});

test('delivery winning the lock is included in completion; concurrent retry sends once', async () => {
  const booking = { id: 'b', status: 'SCHEDULED', streamCallId: 'call',
    interviewer: { id: 'i', clerkUserId: 'i', role: 'INTERVIEWER' },
    interviewee: { id: 'c', clerkUserId: 'c', role: 'INTERVIEWEE' } };
  const question = { id: 'q', sentAt: null, submission: null, difficulty: 'MEDIUM', options: [], topic: 'DBMS' };
  let tail = Promise.resolve(), sends = 0, release;
  const network = new Promise(resolve => { release = resolve; });
  const db = {
    $transaction(fn) { const result = tail.then(() => fn(db)); tail = result.catch(() => {}); return result; },
    booking: {
      findUnique: async () => ({ ...booking }), update: async ({ data }) => Object.assign(booking, data),
      updateMany: async ({ where, data }) => {
        if (where.status !== booking.status) return { count: 0 };
        Object.assign(booking, data); return { count: 1 };
      },
    },
    interviewQuestion: {
      findUnique: async () => ({ ...question }), findMany: async () => [question],
      update: async ({ data }) => Object.assign(question, data),
      updateMany: async ({ data }) => Object.assign(question, data),
    },
  };
  const send = runInNewContext(`${source('actions/interviewQuestions.js')}; sendInterviewQuestion`, {
    db, createHash, SCORING_POLICY_VERSION, currentUser: async () => ({ id: 'i' }), console,
    process: { env: { NEXT_PUBLIC_STREAM_API_KEY: 'key', STREAM_SECRET_KEY: 'secret' } },
    StreamChat: { getInstance: () => ({
      getMessage: async () => { throw { code: 16 }; }, upsertUsers: async () => {},
      channel: () => ({ create: async () => {}, sendEvent: async () => {}, sendMessage: async () => { sends++; await network; } }),
    }) },
  });
  const complete = runInNewContext(`${source('lib/interviewCompletion.js')}; requestInterviewCompletion`, { db, scoreInterview, SCORING_POLICY_VERSION });
  const first = send({ callId: 'call', question: { id: 'source' } });
  await flush(); assert.equal(sends, 1);
  const retry = send({ callId: 'call', question: { id: 'source' } });
  const completion = complete('b', 'i');
  await flush(); assert.equal(booking.status, 'SCHEDULED', 'completion waits for delivery acknowledgment');
  release();
  const [result, repeated] = await Promise.all([first, retry, completion]);
  assert.equal(result.success, true); assert.equal(repeated.success, true);
  assert.equal(sends, 1); assert.ok(question.sentAt);
  assert.equal(booking.status, 'COMPLETED');
  assert.equal(question.responseStatus, 'UNANSWERED');
  assert.equal(booking.scoringSummary.breakdown[0].status, 'UNANSWERED');
});
