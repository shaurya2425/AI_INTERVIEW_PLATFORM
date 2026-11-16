// Opt-in integration check. Creates clearly labelled synthetic users/booking/evidence;
// never reads or completes a real user's interview. Leaves its completed fixture for inspection.
// node --env-file=.env scripts/task3-integration-smoke.mjs
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, extname } from "node:path";
import { runInNewContext } from "node:vm";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
import { StreamClient } from "@stream-io/node-sdk";
import { StreamChat } from "stream-chat";
import { GRADE_SCORES, scoreInterview, questionCalculation, SCORING_POLICY_VERSION } from "../lib/interviewScoring.js";
import { QUESTION_TYPES } from "../lib/interviewCatalog.js";

const root = fileURLToPath(new URL("../", import.meta.url));
registerHooks({ resolve(specifier, context, nextResolve) {
  let url;
  if (specifier.startsWith("@/")) url = pathToFileURL(resolve(root, specifier.slice(2)));
  else if (specifier.startsWith(".") && context.parentURL?.startsWith(pathToFileURL(root).href) && !context.parentURL.includes("/node_modules/")) url = new URL(specifier, context.parentURL);
  if (url && !extname(url.pathname)) {
    for (const extension of [".js", ".ts"]) if (existsSync(fileURLToPath(url) + extension)) return nextResolve(url.href + extension, context);
  }
  return nextResolve(specifier, context);
} });
const { db } = await import("../lib/prisma.js");
const { evaluateSubmission } = await import("../lib/evaluationWorker.js");
const { requestInterviewCompletion, finalizeInterviewCompletion, secureInterviewCall, completionInclude } = await import("../lib/interviewCompletion.js");
const source = file => readFileSync(resolve(root, file), "utf8").replace(/^import[\s\S]*?;\r?\n/gm, "").replaceAll("export ", "");
const suffix = randomUUID();
const interviewerId = `prept-task3-interviewer-${suffix}`, candidateId = `prept-task3-candidate-${suffix}`;
const callId = `prept-task3-smoke-${suffix}`;
const jobs = [];
let actor = interviewerId;
const client = new StreamClient(process.env.NEXT_PUBLIC_STREAM_API_KEY, process.env.STREAM_SECRET_KEY, { timeout: 10000 });
try {
  const [interviewer, candidate] = await db.$transaction([
    db.user.create({ data: { clerkUserId: interviewerId, email: `${interviewerId}@example.invalid`, name: "Task 3 synthetic interviewer", role: "INTERVIEWER", categories: [] } }),
    db.user.create({ data: { clerkUserId: candidateId, email: `${candidateId}@example.invalid`, name: "Task 3 synthetic candidate", role: "INTERVIEWEE", categories: [] } }),
  ]);
  const booking = await db.booking.create({ data: { interviewerId: interviewer.id, intervieweeId: candidate.id,
    startTime: new Date(), endTime: new Date(Date.now() + 3600000), status: "SCHEDULED", streamCallId: callId, creditsCharged: 0 } });
  await client.upsertUsers([{ id: interviewerId, name: "Synthetic interviewer" }, { id: candidateId, name: "Synthetic candidate" }]);
  const call = client.video.call("default", callId);
  await call.getOrCreate({ data: { created_by_id: interviewerId, members: [{ user_id: interviewerId }, { user_id: candidateId }] } });
  await secureInterviewCall(client, call, [interviewerId, candidateId]);
  const userToken = client.generateUserToken({ user_id: candidateId });
  const endpoint = 'https://video.stream-io-api.com/api/v2/video/call/default/' + encodeURIComponent(callId);
  const query = '?api_key=' + encodeURIComponent(process.env.NEXT_PUBLIC_STREAM_API_KEY);
  const headers = { Authorization: userToken, 'stream-auth-type': 'jwt', 'Content-Type': 'application/json' };
  const ownResponse = await fetch(endpoint + query, { headers });
  assert.equal(ownResponse.ok, true, 'Synthetic candidate can read the active call');
  const own = await ownResponse.json();
  assert.ok(!own.own_capabilities.includes('end-call'));
  assert.ok(!own.own_capabilities.includes('join-ended-call'));
  const deniedEnd = await fetch(endpoint + '/mark_ended' + query, { method: 'POST', headers, body: '{}' });
  assert.equal(deniedEnd.status, 403, 'Candidate must not bypass the application and end the Stream call directly');
  const globals = { db, process, console, Date, createHash, QUESTION_TYPES, GRADES: Object.keys(GRADE_SCORES),
    GRADE_SCORES, scoreInterview, questionCalculation, SCORING_POLICY_VERSION, StreamChat,
    currentUser: async () => ({ id: actor }), after: job => jobs.push(job), evaluateSubmission,
    requestInterviewCompletion, finalizeInterviewCompletion, completionInclude, revalidatePath: () => {} };
  const actions = runInNewContext(`${source("actions/interviewQuestions.js")}; ({sendInterviewQuestion,submitInterviewAnswer,approveInterviewGrade,getInterviewQuestions,deliver})`, globals);
  const complete = runInNewContext(`${source("actions/interviewCompletion.js")};completeInterview`, { ...globals });
  const drain = async () => { while (jobs.length) await jobs.shift()(); };
  const ask = async (id, changes = {}) => {
    actor = interviewerId;
    const result = await actions.sendInterviewQuestion({ callId, question: { id, question: "Which option is correct?", topic: "DBMS", category: "CORE_CS", type: "MCQ", difficulty: "EASY", options: ["A", "B", "C", "D"], correctOptionIndex: 1, answer: "B is the correct answer.", ...changes } });
    if (!result.success) await actions.deliver({ ...booking, interviewer, interviewee: candidate }, createHash("sha256").update(JSON.stringify([booking.id,id])).digest("hex"), "question", interviewerId);
    assert.equal(result.success, true, result.error); return result.question;
  };
  const answer = async (q, payload) => {
    actor = candidateId;
    const result = await actions.submitInterviewAnswer({ callId, questionId: q.id, ...payload });
    assert.equal(result.success, true, result.error); assert.equal(result.question.review, undefined);
    await drain();
    actor = interviewerId;
    const saved = (await actions.getInterviewQuestions(callId)).questions.find(item => item.id === q.id);
    assert.equal(saved.review.status, "COMPLETE", saved.review.error);
    const approval = await actions.approveInterviewGrade({ callId, questionId: q.id, grade: saved.review.assessment.suggestedGrade, notes: "Synthetic integration verification" });
    assert.equal(approval.success, true, approval.error); return approval.question;
  };
  const first = await ask("main-correct");
  const correct = await answer(first, { optionIndex: 1 }); assert.equal(correct.review.approvedScore, 100);
  const incorrect = await answer(await ask("main-incorrect"), { optionIndex: 0 }); assert.equal(incorrect.review.approvedScore, 0);
  const before = (await actions.getInterviewQuestions(callId)).scoring;
  assert.equal(before.overallScore, 50);
  const grill = await answer(await ask("grill", { parentId: first.sourceId, difficulty: "HARD" }), { optionIndex: 0 });
  assert.equal(grill.depth, 1); assert.equal(grill.review.calculation.questionWeight, 0.35);
  assert.equal((await actions.getInterviewQuestions(callId)).scoring.overallScore, 50);
  const override = await actions.approveInterviewGrade({ callId, questionId: incorrect.id, grade: "GOOD", notes: "Synthetic override" });
  assert.equal(override.question.review.approvedScore, 75);
  assert.equal((await actions.getInterviewQuestions(callId)).scoring.overallScore, 87.5);
  actor = candidateId;
  assert.equal((await complete(booking.id)).success, false);
  const publicQuestions = await actions.getInterviewQuestions(callId);
  assert.equal(publicQuestions.scoring, undefined); assert.ok(publicQuestions.questions.every(q => !q.review && !q.referenceAnswer));
  actor = interviewerId;
  assert.equal((await complete(booking.id)).success, true); await drain();
  assert.equal((await complete(booking.id)).success, true); await drain();
  const final = await db.booking.findUnique({ where: { id: booking.id }, include: { questions: { include: { submission: true } } } });
  assert.equal(final.status, "COMPLETED"); assert.equal(final.completionState, "COMPLETE", final.completionError);
  assert.equal(final.feedbackState, "PENDING"); assert.ok(final.completedAt < final.endTime);
  assert.equal(final.questions.length, 3); assert.ok(final.questions.every(q => q.submission));
  assert.ok((await call.get()).call.ended_at);
  // Check the application's own rejoin guard, using real DB data and a synthetic identity.
  const getCall = runInNewContext(`${source("actions/call.js")};getCallData`, { ...globals, StreamClient, secureInterviewCall });
  assert.equal((await getCall(callId)).error, "Interview closed");
  const unfinishedFixtures = await db.booking.findMany({ where: { streamCallId: { startsWith: 'prept-task3-smoke-' },
    interviewer: { clerkUserId: { startsWith: 'prept-task3-interviewer-' } }, interviewee: { clerkUserId: { startsWith: 'prept-task3-candidate-' } },
    status: 'SCHEDULED' }, include: { interviewer: true } });
  for (const fixture of unfinishedFixtures) {
    await requestInterviewCompletion(fixture.id, fixture.interviewer.clerkUserId);
    await finalizeInterviewCompletion(fixture.id);
  }
  console.log(JSON.stringify({ result: "passed", closedPriorSyntheticFixtures: unfinishedFixtures.length, bookingId: booking.id, fixture: callId,
    checks: ["question delivery", "correct/incorrect MCQ", "deterministic scores", "Grill relationship", "bonus-only Grill", "grade override", "private projection", "candidate completion denied", "direct Stream end denied", "ended-call capability removed", "early permanent completion", "repeat completion", "Stream ended", "rejoin blocked", "evidence retained", "feedback pending"] }));
} catch (error) {
  let detail = String(error.message || "");
  for (const key of ["DATABASE_URL", "STREAM_SECRET_KEY", "NEXT_PUBLIC_STREAM_API_KEY", "GEMINI_API_KEY"]) if (process.env[key]) detail = detail.split(process.env[key]).join("[redacted]");
  console.error("Synthetic provider diagnostic", detail.slice(0,1200));
  console.error("Task 3 integration failed", { name: error.name, code: error.code, message: error instanceof assert.AssertionError ? error.message : "Check database/Stream configuration; raw provider details suppressed." });
  process.exitCode = 1;
} finally { await db.$disconnect(); }
process.exit(process.exitCode || 0);
