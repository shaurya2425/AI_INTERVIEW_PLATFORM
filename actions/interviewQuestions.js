"use server";

import { after } from "next/server";
import { evaluateSubmission } from "@/lib/evaluationWorker";
import { GRADE_SCORES, scoreInterview, questionCalculation, SCORING_POLICY_VERSION } from "@/lib/interviewScoring";
import { GRADES } from "@/lib/answerEvaluation";
import { currentUser } from "@clerk/nextjs/server";
import { createHash } from "node:crypto";
import { StreamChat } from "stream-chat";
import { db } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { QUESTION_TYPES } from "@/lib/interviewCatalog";

const LANGUAGES = ["javascript", "typescript", "python", "java", "cpp", "c", "csharp", "go", "rust", "sql", "plaintext"];
const fail = (message, code) => { throw Object.assign(new Error(message), { publicMessage: message, code }); };
const text = (value, max, label, optional = false) => {
  if (optional && (value == null || value === "")) return "";
  if (typeof value !== "string" || !value.trim() || value.length > max) fail(`Invalid ${label}. Maximum ${max} characters.`);
  return value.trim();
};
async function safely(operation) {
  try { return await operation(); }
  catch (error) {
    // Do not log provider payloads, private answer keys or credentials.
    if (!error.publicMessage) console.error("Interview question operation failed", error.code || error.name);
    return { success: false, code: error.code || "DATABASE_ERROR", error: error.publicMessage || "Unable to save interview data. Please retry; ask the operator to check the database configuration if this continues." };
  }
}
async function access(callId, requiredRole) {
  text(callId, 200, "call");
  const user = await currentUser();
  if (!user) fail("Please sign in again.");
  const booking = await db.booking.findUnique({
    where: { streamCallId: callId },
    include: {
      interviewer: { select: { id: true, clerkUserId: true, role: true } },
      interviewee: { select: { id: true, clerkUserId: true, role: true } },
    },
  });
  const role = booking?.interviewer.clerkUserId === user.id ? "INTERVIEWER"
    : booking?.interviewee.clerkUserId === user.id ? "INTERVIEWEE" : null;
  if (!role || (requiredRole && requiredRole !== role)) fail("You cannot access this interview question.");
  const actor = role === "INTERVIEWER" ? booking.interviewer : booking.interviewee;
  if (actor.role !== role) fail("Your account role cannot perform this action.");
  return { booking, actor, role };
}

// Explicit public projection: never spread a database record into a response or Stream message.
function publicQuestion(q, role) {
  return {
    id: q.id, sourceId: q.sourceId, question: q.question, topic: q.topic,
    category: q.category, type: q.type, difficulty: q.difficulty, options: q.options,
    ...(role === "INTERVIEWER" ? {
      referenceAnswer: q.referenceAnswer, correctOptionIndex: q.correctOptionIndex,
      parentId: q.parentId, depth: q.depth, responseStatus: q.responseStatus,
      review: q.submission ? {
        status: q.submission.evaluationStatus, assessment: q.submission.evaluation,
        suggestedScore: q.submission.evaluation ? GRADE_SCORES[q.submission.evaluation.suggestedGrade] : null,
        approvedScore: questionCalculation(q, q.submission.approvedGrade)?.approvedScore ?? null,
        correctionWithHint: q.submission.previousAttempts?.at(-1)?.correctionHintGiven === true,
        calculation: questionCalculation(q, q.submission.approvedGrade),
        evaluatedAt: q.submission.evaluationCompletedAt?.toISOString() || null,
        error: q.submission.evaluationError, approvedGrade: q.submission.approvedGrade,
        notes: q.submission.interviewerNotes, approvedAt: q.submission.approvedAt?.toISOString() || null,
      } : null,
    } : {}),
    status: q.submission ? "ANSWERED" : q.sentAt ? "SENT" : "PENDING",
    submission: q.submission ? {
      revision: q.submission.revision || 1,
      previousAttempts: (Array.isArray(q.submission.previousAttempts) ? q.submission.previousAttempts : []).map(attempt => ({
        revision: attempt.revision, answer: attempt.answer, language: attempt.language, submittedAt: attempt.submittedAt,
        ...(role === "INTERVIEWER" ? { approvedGrade: attempt.approvedGrade, notes: attempt.interviewerNotes, evaluation: attempt.evaluation } : {}),
      })),
      answer: q.submission.answer, optionIndex: q.submission.optionIndex,
      language: q.submission.language, submittedAt: q.submission.submittedAt.toISOString(),
    } : null,
  };
}

async function deliver(booking, questionId, kind, userId, revision = 1) {
  const key = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const secret = process.env.STREAM_SECRET_KEY;
  if (!key || !secret) throw new Error("Stream configuration missing");
  const client = StreamChat.getInstance(key, secret);
  const id = `prept-${kind}-${questionId}${kind === "answer" && revision > 1 ? `-r${revision}` : ""}`;
  const cid = `messaging:${booking.streamCallId}`;
  const matches = (message) => message?.cid === cid && message?.user?.id === userId &&
    message?.prept_question_id === questionId && message?.prept_kind === kind && !message.deleted_at;
  // A deterministic Stream ID recovers both retries and ambiguous network acknowledgments.
  try {
    const existing = await client.getMessage(id);
    if (matches(existing.message)) return;
    throw new Error("Unexpected existing delivery");
  } catch (error) {
    // Only a missing message permits a new send; network/auth failures are retryable.
    if (error.code !== 16 && error.StatusCode !== 404 && error.status !== 404 && error.response?.status !== 404) throw error;
  }
  await client.upsertUsers([
    { id: booking.interviewer.clerkUserId }, { id: booking.interviewee.clerkUserId },
  ]);
  const channel = client.channel("messaging", booking.streamCallId, {
    members: [booking.interviewer.clerkUserId, booking.interviewee.clerkUserId],
    created_by_id: booking.interviewer.clerkUserId,
    name: "Interview Chat",
  });
  await channel.create();
  try {
    await channel.sendMessage({ id, user_id: userId, text: kind === "question" ? "Interview question" : "Candidate submitted an answer",
      prept_kind: kind, prept_question_id: questionId, ...(kind === "answer" ? { prept_submission_revision: revision } : {}) });
  } catch (error) {
    const existing = await client.getMessage(id).catch(() => null);
    if (!matches(existing?.message)) throw error;
  }
}

async function announceCommitted(booking, questionId, userId) {
  // Optional wake-up after the DB commit; durable messages and Refresh remain the fallback.
  try {
    const client = StreamChat.getInstance(process.env.NEXT_PUBLIC_STREAM_API_KEY, process.env.STREAM_SECRET_KEY);
    await client.channel("messaging", booking.streamCallId).sendEvent({
      type: "prept.question.updated", user_id: userId, prept_question_id: questionId,
    });
  } catch { /* A missed transient event must never roll back a durable answer. */ }
}

export async function getInterviewQuestions(callId) {
  return safely(async () => {
    const { booking, role } = await access(callId);
    const questions = await db.interviewQuestion.findMany({
      where: { bookingId: booking.id, ...(role === "INTERVIEWEE" ? { sentAt: { not: null } } : {}) },
      include: { submission: true }, orderBy: { createdAt: "asc" },
    });
    const pending = questions.filter(q => q.submission && (q.submission.evaluationStatus === "PENDING" ||
      (q.submission.evaluationStatus === "RUNNING" && new Date(q.submission.evaluationStartedAt).getTime() < Date.now() - 120000)));
    if (pending.length) after(async () => { for (const q of pending) await evaluateSubmission(q.id); });
    return { success: true, questions: questions.map(q => publicQuestion(q, role)), ...(role === "INTERVIEWER" ? { scoring: scoreInterview(questions, booking.status) } : {}) };
  });
}

export async function sendInterviewQuestion({ callId, question } = {}) {
  return safely(async () => {
    const { booking, actor } = await access(callId, "INTERVIEWER");
    const sourceId = text(question?.id, 200, "question ID");
    const id = createHash("sha256").update(JSON.stringify([booking.id, sourceId])).digest("hex");
    let saved = await db.interviewQuestion.findUnique({ where: { id }, include: { submission: true } });
    if (!saved) {
      if (booking.status !== "SCHEDULED") fail("This interview is no longer open for new questions.");
      if (!Object.hasOwn(QUESTION_TYPES, question.type)) fail("Unsupported question type.");
      if (!["EASY", "MEDIUM", "HARD"].includes(question.difficulty)) fail("Choose a specific question difficulty.");
      const options = question.type === "MCQ" && Array.isArray(question.options)
        ? question.options.map((option) => text(option, 2000, "MCQ option")) : [];
      if (question.type === "MCQ" && (options.length !== 4 || new Set(options.map(o => o.toLowerCase())).size !== 4 ||
        !Number.isInteger(question.correctOptionIndex) || question.correctOptionIndex < 0 || question.correctOptionIndex > 3)) {
        fail("This MCQ needs four distinct options and a valid private answer key. Generate it again.");
      }
      let parent = null;
      if (question.parentId) {
        parent = await db.interviewQuestion.findFirst({ where: { bookingId: booking.id,
          OR: [{ id: question.parentId }, { sourceId: question.parentId }] } });
        if (!parent) fail("Send the original question before sending its follow-up.");
        if (parent.depth >= 8) fail("Maximum follow-up depth reached.");
      }
      await db.interviewQuestion.createMany({ skipDuplicates: true, data: [{
        parentId: parent?.id || null, depth: parent ? parent.depth + 1 : 0,
        id, bookingId: booking.id, sourceId, authorId: actor.id, recipientId: booking.intervieweeId,
        question: text(question.question, 12000, "question"), topic: text(question.topic, 200, "topic"),
        category: text(question.category, 100, "category"), type: question.type, difficulty: question.difficulty,
        options, referenceAnswer: text(question.answer, 30000, "reference answer", true),
        correctOptionIndex: question.type === "MCQ" ? question.correctOptionIndex : null,
      }] });
      saved = await db.interviewQuestion.findUnique({ where: { id }, include: { submission: true } });
    }
    if (!saved.sentAt) {
      saved = await db.$transaction(async tx => {
        // Use the same booking row lock as completion and submissions. Completion
        // must see either the delivered question or a failed/pending delivery.
        const locked = await tx.booking.update({ where: { id: booking.id }, data: { scoringPolicyVersion: SCORING_POLICY_VERSION } });
        const latest = await tx.interviewQuestion.findUnique({ where: { id }, include: { submission: true } });
        if (latest.sentAt) return latest;
        if (locked.status !== "SCHEDULED") fail("This interview is closed for new question delivery.");
        try { await deliver(booking, id, "question", actor.clerkUserId); }
        catch (error) {
          console.error("Question delivery failed", { stage: "stream_delivery", bookingId: booking.id, callId: booking.streamCallId, status: error.status || error.StatusCode, code: typeof error.code === "number" ? error.code : undefined });
          fail("Question could not be delivered to participants. Question saved; retry safely.", "QUESTION_DELIVERY_FAILED");
        }
        return tx.interviewQuestion.update({ where: { id }, data: { sentAt: new Date() }, include: { submission: true } });
      }, { timeout: 30000 });
      await announceCommitted(booking, id, actor.clerkUserId);
    }
    return { success: true, question: publicQuestion(saved, "INTERVIEWER") };
  });
}

export async function submitInterviewAnswer({ callId, questionId, answer, optionIndex, language, requestId, expectedRevision } = {}) {
  return safely(async () => {
    const { booking, actor } = await access(callId, "INTERVIEWEE");
    text(questionId, 100, "question ID");
    const q = await db.interviewQuestion.findFirst({
      where: { id: questionId, bookingId: booking.id, recipientId: actor.id, sentAt: { not: null } },
      include: { submission: true },
    });
    if (!q) fail("Question is not available. Refresh and retry.");
    const revising = q.type !== "MCQ" && expectedRevision != null;
    if (revising && (!Number.isInteger(expectedRevision) || expectedRevision < 0 || typeof requestId !== "string" || !/^[\w-]{1,100}$/.test(requestId))) fail("Invalid answer revision. Refresh and try again.");
    if (!q.submission || revising) {
      if (booking.status !== "SCHEDULED") fail("This interview is closed for submissions.");
      const isCode = ["CODING", "SQL_QUERY", "DEBUGGING"].includes(q.type);
      if (q.type === "MCQ" && (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= q.options.length)) fail("Choose one option.");
      if (isCode && !LANGUAGES.includes(language)) fail("Choose a supported programming language.");
      const validatedAnswer = q.type === "MCQ" ? q.options[optionIndex] : text(answer, 30000, "answer");
      // Preserve pasted code indentation, including its first line.
      const response = isCode ? answer : validatedAnswer;
      await db.$transaction(async tx => {
        const locked = await tx.booking.update({ where: { id: booking.id }, data: { scoringPolicyVersion: SCORING_POLICY_VERSION } });
        if (locked.status !== "SCHEDULED") fail("This interview is closed for submissions.");
        let current = await tx.interviewSubmission.findUnique({ where: { questionId: q.id } });
        if (current && requestId && (current.requestId === requestId || (current.previousAttempts || []).some(a => a.requestId === requestId))) return;
        if (current && revising) {
          // Lock the current answer too: an in-flight evaluation must not slip
          // between the archived snapshot and resetting the new evaluation lease.
          current = await tx.interviewSubmission.update({ where: { questionId: q.id }, data: { id: current.id } });
          if (expectedRevision !== current.revision) fail("A newer answer was saved. Refresh and review it before resubmitting; your draft is preserved.");
          const { previousAttempts, ...previous } = current;
          await tx.interviewSubmission.update({ where: { questionId: q.id }, data: {
            answer: response, language: isCode ? language : null, requestId, revision: { increment: 1 }, submittedAt: new Date(), notifiedAt: null,
            previousAttempts: JSON.parse(JSON.stringify([...(Array.isArray(previousAttempts) ? previousAttempts : []), previous])),
            evaluationStatus: "PENDING", evaluation: Prisma.DbNull, evaluationError: null, evaluationStartedAt: null, evaluationToken: null,
            evaluationAttempts: 0, evaluationCompletedAt: null, suggestedScore: null,
            approvedGrade: null, approvedScore: null, approvedAt: null, approvedBy: null, interviewerNotes: null,
            scoringPolicyVersion: null, difficultyWeight: null, followUpMultiplier: null, questionWeight: null, weightedScore: null,
          } });
        } else if (!current) {
          if (revising && expectedRevision !== 0) fail("The original answer is unavailable. Refresh before submitting.");
          await tx.interviewSubmission.createMany({ skipDuplicates: true, data: [{
            id: `answer-${q.id}`, questionId: q.id, candidateId: actor.id, answer: response,
            optionIndex: q.type === "MCQ" ? optionIndex : null, language: isCode ? language : null,
            ...(requestId ? { requestId } : {}),
          }] });
        }
        await tx.interviewQuestion.update({ where: { id: q.id }, data: { responseStatus: "ANSWERED" } });
        if (current && revising) {
          const questions = await tx.interviewQuestion.findMany({ where: { bookingId: booking.id }, include: { submission: true } });
          await tx.booking.update({ where: { id: booking.id }, data: { scoringSummary: scoreInterview(questions, locked.status) } });
        }
      });
    }
    after(() => evaluateSubmission(q.id));
    const saved = await db.interviewQuestion.findUnique({ where: { id: q.id }, include: { submission: true } });
    await announceCommitted(booking, q.id, actor.clerkUserId);
    return { success: true, question: publicQuestion(saved) };
  });
}

export async function retryInterviewEvaluation({ callId, questionId } = {}) {
  return safely(async () => {
    const { booking } = await access(callId, "INTERVIEWER");
    text(questionId, 100, "question ID");
    const q = await db.interviewQuestion.findFirst({ where: { id: questionId, bookingId: booking.id }, include: { submission: true } });
    if (!q?.submission) fail("No saved answer to evaluate.");
    after(() => evaluateSubmission(q.id, true));
    return { success: true };
  });
}
export async function approveInterviewGrade({ callId, questionId, grade, notes = "", submissionRevision, correctionWithHint = false } = {}) {
  return safely(async () => {
    const { booking, actor } = await access(callId, "INTERVIEWER");
    text(questionId, 100, "question ID");
    if (!GRADES.includes(grade)) fail("Choose Poor, Average, Good or Excellent.");
    const validatedNotes = text(notes, 6000, "notes", true);
    const q = await db.interviewQuestion.findFirst({ where: { id: questionId, bookingId: booking.id }, include: { submission: true } });
    if (!q?.submission) fail("Wait for a saved candidate answer before grading.");
    if (!q.sentAt || booking.status === "CANCELLED") fail("Only delivered questions in a valid interview can be graded.");

    await db.$transaction(async tx => {
      const locked = await tx.booking.update({ where: { id: booking.id }, data: { scoringPolicyVersion: SCORING_POLICY_VERSION } });
      if (locked.status === "CANCELLED") fail("Cancelled interviews cannot be graded.");
      const latest = await tx.interviewSubmission.findUnique({ where: { questionId } });
      if ((latest.revision || 1) !== (submissionRevision ?? q.submission.revision ?? 1)) fail("The candidate submitted a newer answer. Refresh and review it before approving a grade.");
      if (typeof correctionWithHint !== "boolean") fail("Invalid hint confirmation.");
      const previousAttempts = Array.isArray(latest.previousAttempts) ? latest.previousAttempts.map(a => ({ ...a })) : [];
      if (correctionWithHint && (q.type === "MCQ" || !previousAttempts.length)) fail("Hint corrections require a revised non-MCQ answer.");
      if (previousAttempts.length) Object.assign(previousAttempts.at(-1), {
        correctionHintGiven: correctionWithHint, hintConfirmedBy: actor.id,
      });
      const calculation = questionCalculation({ ...q, submission: { ...latest, previousAttempts } }, grade);
      if (!calculation) fail("This question has invalid scoring metadata.");
      await tx.interviewSubmission.update({ where: { questionId }, data: {
        previousAttempts,
        approvedGrade: grade, interviewerNotes: validatedNotes, approvedBy: actor.id, approvedAt: new Date(), ...calculation,
      } });
      const questions = await tx.interviewQuestion.findMany({ where: { bookingId: booking.id }, include: { submission: true } });
      await tx.booking.update({ where: { id: booking.id }, data: { scoringSummary: {
        ...scoreInterview(questions, locked.status),
        ...(locked.scoringSummary?.feedbackEvaluations ? { feedbackEvaluations: locked.scoringSummary.feedbackEvaluations } : {}),
      },
        ...(locked.status === "COMPLETED" ? { feedbackState: "PENDING" } : {}),
      } });
    });
    const saved = await db.interviewQuestion.findUnique({ where: { id: questionId }, include: { submission: true } });
    return { success: true, question: publicQuestion(saved, "INTERVIEWER") };
  });
}
