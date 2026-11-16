import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { randomUUID } from "node:crypto";

// Exercise the existing server action with deterministic provider/auth boundaries.
const catalogSource = readFileSync(new URL("../lib/interviewCatalog.js", import.meta.url), "utf8").replaceAll("export ", "");
const catalog = runInNewContext(`${catalogSource}; ({ INTERVIEW_CATALOG, QUESTION_TYPES, makeDefaultPreferences })`);
const source = readFileSync(new URL("../actions/aiQuestions.js", import.meta.url), "utf8")
  .replace(/^import[\s\S]*?;\r?\n/gm, "").replaceAll("export const ", "const ");
function harness(response, authorized = true, bank = [], records = [], dependencies = {}) {
  const calls = [];
  const api = runInNewContext(`${source}; ({ generateInterviewQuestions, resolveRequest, createAIQuestions, aiFailure })`, {
    currentUser: async () => ({ id: "interviewer" }),
    db: { booking: { findUnique: async () => authorized ? { id: "booking", interviewer: { clerkUserId: "interviewer" } } : null }, interviewQuestion: { findMany: async () => records } },
    ...catalog, QUESTION_BANK: bank, randomUUID, performance, console,
    process: { env: { GEMINI_API_KEY: "test-only" } },
    ...dependencies,
    actionFailure: (error) => ({ error }),
    getCallData: async () => ({ isInterviewer: authorized }),
    GoogleGenAI: class { models = { generateContent: async (request) => {
      calls.push(request);
      const data = typeof response === "function" ? await response(request, calls.length) : response;
      return { text: JSON.stringify(data) };
    } }; },
  });
  return { ...api, calls };
}
const question = (changes = {}) => ({ category: "DSA", question: "Find the missing integer in a sorted array", answer: "Use binary search.", topic: "Arrays", type: "CODING", difficulty: "MEDIUM", options: [], correctOptionIndex: -1, ...changes });
const request = (changes = {}) => ({ callId: "test-call", preferences: { ...catalog.makeDefaultPreferences(), webResearch: "OFF", questionCount: 1 }, instruction: "Give one coding question", ...changes });
const output = (questions) => ({ intent: "QUESTIONS", message: "Try these.", bankIds: [], generated: questions });

test("default is unrestricted Free Flow", () => {
  const pref = catalog.makeDefaultPreferences();
  assert.equal(pref.subject, "ALL"); assert.equal(pref.mode, "FREE_FLOW");
  assert.equal(pref.topic, "ALL"); assert.equal(pref.questionType, "ANY");
  assert.equal(pref.difficulty, "MIXED"); assert.equal(pref.webResearch, "AUTO");
});
test("selected filters win, query count overrides, Grill progresses from parent", () => {
  const api = harness();
  const resolved = api.resolveRequest({ ...catalog.makeDefaultPreferences(), questionType: "CODING", difficulty: "EASY" }, "three hard MCQs", null, "AUTO");
  assert.equal(resolved.questionType, "CODING"); assert.equal(resolved.difficulty, "EASY"); assert.equal(resolved.questionCount, 3);
  const grill = api.resolveRequest(catalog.makeDefaultPreferences(), "edge cases", question({ difficulty: "MEDIUM" }), "GRILL", "DEEPER");
  assert.equal(grill.difficulty, "HARD"); assert.equal(grill.questionCount, 1);
});
test("unauthorized requests never reach Gemini", async () => {
  const api = harness(output([question()]), false);
  assert.equal((await api.generateInterviewQuestions(request())).error, "Forbidden");
  assert.equal(api.calls.length, 0);
});
test("Free Flow preserves Markdown code solutions without forcing cards", async () => {
  const message = "```js\nconst answer = 42;\n```";
  const api = harness({ intent: "MESSAGE", message, bankIds: [], generated: [] });
  const result = await api.generateInterviewQuestions(request({ instruction: "Explain this with code" }));
  assert.equal(result.message, message); assert.equal(result.questions.length, 0);
});
test("valid MCQ keeps explicit correct answer and four options", async () => {
  const q = question({ type: "MCQ", options: ["O(1)", "O(log n)", "O(n)", "O(n²)"], correctOptionIndex: 1 });
  const api = harness(output([q]));
  const result = await api.generateInterviewQuestions(request({ instruction: "one MCQ" }));
  assert.equal(result.questions[0].correctOptionIndex, 1);
  assert.match(result.questions[0].answer, /Correct answer: B/);
});
test("invalid MCQs and repeated questions fail after bounded validation retry", async () => {
  for (const q of [question({ type: "MCQ", options: ["same", "same", "C", "D"], correctOptionIndex: 8 }), question()]) {
    const api = harness(output([q]));
    const result = await api.generateInterviewQuestions(request({ instruction: "one question", history: q.type === "MCQ" ? [] : [q] }));
    assert.equal(result.code, "INVALID_AI_RESPONSE"); assert.equal(api.calls.length, 2);
  }
});
test("Grill links parent, keeps hints and returns harder question", async () => {
  const api = harness(output([question({ question: "Handle concurrent writes to the cache", difficulty: "HARD" })]));
  const result = await api.generateInterviewQuestions(request({ mode: "GRILL", activeQuestion: { ...question(), id: "parent", depth: 1 }, grillLevel: "CHALLENGE", instruction: "probe race conditions" }));
  assert.equal(result.questions[0].parentId, "parent"); assert.equal(result.questions[0].depth, 2);
  assert.match(api.calls[0].contents, /probe race conditions/);
});
test("provider failures classify safely without repeated quota calls", async () => {
  for (const [status, code] of [[429, "AI_QUOTA_EXCEEDED"], [401, "AI_INVALID_KEY"], [404, "AI_MODEL_UNAVAILABLE"], [503, "AI_NETWORK_ERROR"]]) {
    const api = harness(() => { throw { status, message: "private-provider-details" }; });
    const result = await api.generateInterviewQuestions(request());
    assert.equal(result.code, code); assert.equal(api.calls.length, 1);
    assert.ok(!result.error.includes("private-provider-details"));
  }
});
test("curated plus original questions meet requested count", async () => {
  const bankQuestion = question({ id: "bank-1", type: "CONCEPTUAL", question: "What is a binary search tree?" });
  const api = harness({ ...output([question()]), bankIds: ["bank-1"] }, true, [bankQuestion]);
  const result = await api.generateInterviewQuestions(request({ instruction: "two questions" }));
  assert.equal(result.questions.length, 2); assert.equal(result.metadata.bankCount, 1);
});
test("web failure remains visible while generation can succeed", async () => {
  const api = harness((req) => { if (req.config.tools) throw { status: 503 }; return output([question()]); });
  const result = await api.generateInterviewQuestions(request({ preferences: { ...catalog.makeDefaultPreferences(), webResearch: "ON", questionCount: 1 } }));
  assert.equal(result.questions.length, 1); assert.match(result.warning, /Web research unavailable/);
});

test("null model output is invalid response rather than network failure", async () => {
  const api = harness(null);
  const result = await api.generateInterviewQuestions(request());
  assert.equal(result.code, "INVALID_AI_RESPONSE");
  assert.equal(api.calls.length, 2);
});

test("specific topic and type must match and MCQs cannot have extra options", () => {
  const api = harness();
  const pref = { ...catalog.makeDefaultPreferences(), topic: "Arrays" };
  assert.equal(api.createAIQuestions([question({ topic: "Graphs" })], pref, [], 1).length, 0);
  assert.equal(api.createAIQuestions([question({ type: "UNKNOWN" })], pref, [], 1).length, 0);
  assert.equal(api.createAIQuestions([question({ type: "MCQ", options: ["A", "B", "C", "D", "E"], correctOptionIndex: 0 })], pref, [], 1).length, 0);
});

for (const approvedGrade of ["POOR", "EXCELLENT"]) test(`durable ${approvedGrade} performance overrides client grades and informs Grill`, async () => {
  const saved = { ...question(), id: "db-parent", sourceId: "parent", referenceAnswer: "Private reference", depth: 1,
    submission: { answer: "Actual submitted answer", approvedGrade, interviewerNotes: "Saved reviewer note" } };
  const api = harness(output([question({ question: "Handle concurrent writes to the cache", difficulty: "HARD" })]), true, [], [saved]);
  const result = await api.generateInterviewQuestions(request({ mode: "GRILL", activeQuestion: { ...question(), id: "parent", grade: 2, candidateAnswer: "forged", depth: 0 }, grillLevel: "CHALLENGE" }));
  assert.equal(result.questions[0].parentId, "parent"); assert.equal(result.questions[0].depth, 2);
  const prompt = api.calls[0].contents;
  assert.match(prompt, /Actual submitted answer/); assert.match(prompt, /Saved reviewer note/); assert.ok(!prompt.includes("forged"));
  assert.ok(prompt.includes('"grade":' + (approvedGrade === "POOR" ? 1 : 4)));
});
test("saved questions prevent repeats after local conversation is cleared", async () => {
  const saved = { ...question(), sourceId: "old", submission: null };
  const api = harness(output([question()]), true, [], [saved]);
  const result = await api.generateInterviewQuestions(request({ history: [] }));
  assert.equal(result.code, "INVALID_AI_RESPONSE");
});

test("history schema failures are not mislabeled as Gemini outages", async () => {
  const api = harness(output([question()]), true, [], [], { db: {
    booking: { findUnique: async () => ({ interviewer: { clerkUserId: "interviewer" } }) },
    interviewQuestion: { findMany: async () => { throw new Error("Unknown field parent; private database details"); } },
  } });
  const result = await api.generateInterviewQuestions(request());
  assert.equal(result.code, "INTERVIEW_CONTEXT_ERROR"); assert.equal(api.calls.length, 0);
  assert.ok(!result.error.includes("private database details"));
});
test("AI generation does not call Stream or change the video session", async () => {
  const api = harness(output([question()]), true, [], [], { getCallData: async () => { throw new Error("Stream unavailable"); } });
  const result = await api.generateInterviewQuestions(request());
  assert.equal(result.questions.length, 1);
});
test("authentication outages stop generation with an access-specific error", async () => {
  const api = harness(output([question()]), true, [], [], { currentUser: async () => { throw new Error("private auth payload"); } });
  const result = await api.generateInterviewQuestions(request());
  assert.equal(result.code, "INTERVIEW_AUTH_ERROR"); assert.equal(api.calls.length, 0);
});

for (const [instruction, difficulty] of [['Harder', 'HARD'], ['Easier', 'EASY'], ['Next question', 'MEDIUM']]) {
  test(`${instruction} requests one question even when the default batch is five`, async () => {
    const api = harness(output([question({ difficulty })]));
    const result = await api.generateInterviewQuestions(request({ instruction, preferences: { ...catalog.makeDefaultPreferences(), questionCount: 5, webResearch: 'OFF' } }));
    assert.equal(result.questions.length, 1);
    assert.equal(api.calls.length, 1);
    assert.match(api.calls[0].contents, /Required question count: 1/);
    assert.match(api.calls[0].contents, /FORCE QUESTIONS: YES/);
    if (instruction !== 'Next question') assert.equal(result.questions[0].difficulty, difficulty);
  });
}
test('Harder still validates output and overrides the current difficulty one step', async () => {
  const api = harness(output([question({ difficulty: 'EASY' })]));
  const result = await api.generateInterviewQuestions(request({ instruction: 'Harder' }));
  assert.equal(result.code, 'INVALID_AI_RESPONSE');
  const filtered = api.resolveRequest({ ...catalog.makeDefaultPreferences(), difficulty: 'MEDIUM', questionCount: 5 }, 'Harder', null, 'AUTO');
  assert.equal(filtered.questionCount, 1); assert.equal(filtered.difficulty, 'HARD');
});
test('explicit multi-question requests preserve their requested count', () => {
  const api = harness();
  assert.equal(api.resolveRequest(catalog.makeDefaultPreferences(), 'three harder questions', null, 'AUTO').questionCount, 3);
});

test('Harder MCQ schema enforces topic, difficulty and question intent', async () => {
  const mcq = question({ category: 'CORE_CS', topic: 'DBMS', difficulty: 'HARD', type: 'MCQ', question: 'Which decomposition preserves this join dependency?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 2 });
  const api = harness(output([mcq]));
  const result = await api.generateInterviewQuestions(request({ instruction: 'Harder', preferences: { ...catalog.makeDefaultPreferences(), subject: 'CORE_CS', topic: 'DBMS', questionType: 'MCQ', webResearch: 'OFF' } }));
  assert.equal(result.questions.length, 1);
  const schema = api.calls[0].config.responseSchema;
  assert.equal(schema.properties.intent.enum.join(), 'QUESTIONS');
  const fields = schema.properties.generated.items.properties;
  assert.equal(fields.difficulty.enum.join(), 'HARD'); assert.equal(fields.topic.enum.join(), 'DBMS');
  assert.equal(fields.type.enum.join(), 'MCQ'); assert.equal(fields.category.enum.join(), 'CORE_CS');
});
test('validation retry explains the rejected difficulty instead of repeating the same prompt', async () => {
  const api = harness((req, attempt) => output([question({ difficulty: attempt === 1 ? 'MEDIUM' : 'HARD' })]));
  const result = await api.generateInterviewQuestions(request({ instruction: 'Harder' }));
  assert.equal(result.questions[0].difficulty, 'HARD');
  assert.match(api.calls[1].contents, /VALIDATION CORRECTION.*Difficulty must exactly match/);
  assert.notEqual(api.calls[0].contents, api.calls[1].contents);
});
test('failed validation retains safe diagnostic reasons', async () => {
  const errors = [];
  const api = harness(output([question({ difficulty: 'MEDIUM' })]), true, [], [], { console: { error: (...args) => errors.push(args) } });
  const result = await api.generateInterviewQuestions(request({ instruction: 'Harder' }));
  assert.equal(result.code, 'INVALID_AI_RESPONSE');
  assert.ok(errors[0][1].validationReasons.some(reason => reason.includes('Difficulty')));
});
test('single-question generation hides bank candidates that cannot be selected', async () => {
  const bank = question({ id: 'bank-hard', difficulty: 'HARD', question: 'UNUSED BANK SENTINEL' });
  const api = harness(output([question({ difficulty: 'HARD' })]), true, [bank]);
  const result = await api.generateInterviewQuestions(request({ instruction: 'Harder' }));
  assert.equal(result.questions.length, 1);
  assert.ok(!api.calls[0].contents.includes('UNUSED BANK SENTINEL'));
});

test('Core CS / DBMS / Easy plus Harder requests Medium while retaining subject and topic', async () => {
  const api = harness(output([question({ category: 'CORE_CS', topic: 'DBMS', difficulty: 'MEDIUM', type: 'MCQ', options: ['A','B','C','D'], correctOptionIndex: 1 })]));
  const result = await api.generateInterviewQuestions(request({ instruction: 'Harder', preferences: { ...catalog.makeDefaultPreferences(), subject: 'CORE_CS', topic: 'DBMS', difficulty: 'EASY', webResearch: 'OFF' }, activeQuestion: { ...question(), category: 'CORE_CS', topic: 'DBMS', difficulty: 'EASY' } }));
  assert.equal(result.questions.length, 1); assert.equal(result.questions[0].difficulty, 'MEDIUM');
  const fields = api.calls[0].config.responseSchema.properties.generated.items.properties;
  assert.equal(fields.difficulty.enum.join(), 'MEDIUM'); assert.equal(fields.category.enum.join(), 'CORE_CS'); assert.equal(fields.topic.enum.join(), 'DBMS');
});
test('difficulty shortcuts step from the active question and clamp at the limits', () => {
  const api = harness(); const pref = { ...catalog.makeDefaultPreferences(), difficulty: 'EASY' };
  assert.equal(api.resolveRequest(pref, 'Harder', { difficulty: 'MEDIUM' }, 'AUTO').difficulty, 'HARD');
  assert.equal(api.resolveRequest(pref, 'Harder', { difficulty: 'HARD' }, 'AUTO').difficulty, 'HARD');
  assert.equal(api.resolveRequest(pref, 'Easier', { difficulty: 'HARD' }, 'AUTO').difficulty, 'MEDIUM');
  assert.equal(api.resolveRequest(pref, 'Easier', { difficulty: 'EASY' }, 'AUTO').difficulty, 'EASY');
});
