import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import * as catalog from '../lib/interviewCatalog.js';

test('requires one content filter; count and web settings alone do not qualify', () => {
  const defaults = catalog.makeDefaultPreferences();
  assert.equal(catalog.hasQuestionFilter(defaults), false);
  assert.equal(catalog.hasQuestionFilter({ ...defaults, questionCount: 1, webResearch: 'ON' }), false);
  for (const filter of [{ subject: 'CORE_CS' }, { topic: 'DBMS' }, { questionType: 'MCQ' }, { difficulty: 'EASY' }]) {
    assert.equal(catalog.hasQuestionFilter({ ...defaults, ...filter }), true);
  }
});

const source = readFileSync(new URL('../actions/aiQuestions.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\r?\n/gm, '').replaceAll('export const ', 'const ');
const api = runInNewContext(`${source}; ({generateInterviewQuestions,collectWebContext})`, {
  ...catalog, randomUUID, QUESTION_BANK: [], process: { env: {} }, console,
  actionFailure: error => ({ error }), currentUser: async () => ({ id: 'i' }),
  db: { booking: { findUnique: async () => ({ interviewer: { clerkUserId: 'i' } }) } },
});

test('unfiltered generation is rejected before persistence or Gemini', async () => {
  const result = await api.generateInterviewQuestions({ callId: 'call', forceQuestions: true, preferences: catalog.makeDefaultPreferences() });
  assert.equal(result.error, catalog.QUESTION_FILTER_MESSAGE);
});

test('search without grounded sources is not reported as successful research', async () => {
  const ai = { models: { generateContent: async () => ({ text: 'Ungrounded response' }) } };
  await assert.rejects(api.collectWebContext(ai, 'Latest database release', { webResearch: 'ON' }), e => e.code === 'WEB_RESEARCH_UNAVAILABLE');
});
