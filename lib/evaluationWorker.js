import { randomUUID } from "node:crypto";
import { db } from "@/lib/prisma";
import { questionCalculation } from "@/lib/interviewScoring";
import { assessAnswer, evaluationFailure } from "@/lib/answerEvaluation";

// Persisted state plus a lease makes duplicate callbacks safe and interrupted work recoverable.
export async function evaluateSubmission(questionId, retry = false, meetingLease = null) {
  const token = randomUUID();
  const claimed = await db.interviewSubmission.updateMany({ where: {
    questionId, OR: [ { evaluationStatus: "PENDING" },
      { evaluationStatus: "RUNNING", evaluationStartedAt: { lt: new Date(Date.now() - 120000) } },
      ...(retry ? [{ evaluationStatus: "FAILED" }, { evaluationStatus: "COMPLETE" }] : []) ],
  }, data: { evaluationStatus: "RUNNING", evaluationStartedAt: new Date(), evaluationToken: token,
    evaluationAttempts: { increment: 1 }, evaluationError: null } });
  if (!claimed.count) return;
  try {
    const question = await db.interviewQuestion.findUnique({ where: { id: questionId }, include: { submission: true } });
    const evaluation = await assessAnswer(question);
    const { scoringPolicyVersion = null, difficultyWeight = null, followUpMultiplier = null, questionWeight = null } = questionCalculation(question, evaluation.suggestedGrade) || {};
    const saved = await db.interviewSubmission.updateMany({ where: { questionId, evaluationToken: token },
      data: { evaluation, scoringPolicyVersion, difficultyWeight, followUpMultiplier, questionWeight, suggestedScore: evaluation.score, evaluationCompletedAt: new Date(), evaluationStatus: "COMPLETE", evaluationError: null } });
    if (saved.count) await db.booking.updateMany({ where: { id: question.bookingId, status: "COMPLETED",
      ...(meetingLease ? { feedbackState: { not: meetingLease } } : {}),
    }, data: { feedbackState: "PENDING" } });
  } catch (error) {
    await db.interviewSubmission.updateMany({ where: { questionId, evaluationToken: token, evaluationStatus: "RUNNING" },
      data: { evaluationStatus: "FAILED", evaluationError: evaluationFailure(error) } });
  }
}
