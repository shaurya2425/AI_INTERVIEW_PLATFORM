export const SCORING_POLICY_VERSION = "prept-fair-v1";
export const GRADE_SCORES = Object.freeze({ POOR: 0, AVERAGE: 40, GOOD: 75, EXCELLENT: 100 });
export const DIFFICULTY_WEIGHTS = Object.freeze({ EASY: 1.25, MEDIUM: 1, HARD: 0.7 });

export function questionCalculation(question, grade) {
  if (!Object.hasOwn(GRADE_SCORES, grade) || !Object.hasOwn(DIFFICULTY_WEIGHTS, question.difficulty)) return null;
  const difficultyWeight = DIFFICULTY_WEIGHTS[question.difficulty];
  const followUpMultiplier = question.parentId || question.depth > 0 ? 0.5 : 1;
  const approvedScore = GRADE_SCORES[grade];
  const questionWeight = difficultyWeight * followUpMultiplier;
  return { scoringPolicyVersion: SCORING_POLICY_VERSION, approvedScore, difficultyWeight,
    followUpMultiplier, questionWeight, weightedScore: approvedScore * questionWeight };
}

export function scoreInterview(questions, bookingStatus = "SCHEDULED") {
  const breakdown = questions.map(q => {
    const status = bookingStatus === "CANCELLED" ? "CANCELLED" : !q.sentAt ? "NOT_DELIVERED" :
      !q.submission ? (q.responseStatus === "UNANSWERED" || bookingStatus === "COMPLETED" ? "UNANSWERED" : "AWAITING_ANSWER") :
        !q.submission.approvedGrade ? "AWAITING_APPROVAL" : "GRADED";
    const calculation = status === "GRADED" ? questionCalculation(q, q.submission.approvedGrade) : null;
    return { questionId: q.id, parentId: q.parentId || null, difficulty: q.difficulty, topic: q.topic,
      status, ...(calculation || {}) };
  });
  const eligible = breakdown.filter(q => q.status === "GRADED" && q.questionWeight != null);
  const main = eligible.filter(q => q.followUpMultiplier === 1);
  const grill = eligible.filter(q => q.followUpMultiplier === 0.5);
  const average = rows => rows.length ? rows.reduce((sum, q) => sum + q.weightedScore, 0) / rows.reduce((sum, q) => sum + q.questionWeight, 0) : null;
  const mainScore = average(main), grillScore = average(grill);
  const overallScore = mainScore === null ? null : grillScore === null ? mainScore : Math.max(mainScore, 0.85 * mainScore + 0.15 * grillScore);
  // One main answer is usable evidence but insufficient for a stable interview-wide score.
  const state = main.length === 0 ? "UNAVAILABLE" : main.length < 2 || breakdown.some(q => ["AWAITING_ANSWER", "AWAITING_APPROVAL", "UNANSWERED"].includes(q.status)) ? "PROVISIONAL" : "AVAILABLE";
  return { policyVersion: SCORING_POLICY_VERSION, state, mainScore, grillScore, overallScore,
    mainCount: main.length, grillCount: grill.length, breakdown };
}
