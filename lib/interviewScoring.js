
export const SCORING_POLICY_VERSION = "prept-fair-v1";

export const GRADE_SCORES = Object.freeze({
  POOR: 0,
  AVERAGE: 40,
  GOOD: 75,
  EXCELLENT: 100,
});

export const DIFFICULTY_WEIGHTS = Object.freeze({
  EASY: 1.25,
  MEDIUM: 1,
  HARD: 0.7,
});

export function questionCalculation(question, grade) {
  if (
    !Object.hasOwn(GRADE_SCORES, grade) ||
    !Object.hasOwn(DIFFICULTY_WEIGHTS, question.difficulty)
  ) {
    return null;
  }

  const difficultyWeight =
    DIFFICULTY_WEIGHTS[question.difficulty];

  const followUpMultiplier =
    question.parentId || question.depth > 0 ? 0.5 : 1;

  const assisted =
    question.type !== "MCQ" &&
    question.submission?.previousAttempts?.some(
      (attempt) => attempt.correctionHintGiven === true
    );

  const approvedScore = Math.max(
    0,
    GRADE_SCORES[grade] - (assisted ? 5 : 0)
  );

  const questionWeight =
    difficultyWeight * followUpMultiplier;

  return {
    scoringPolicyVersion: SCORING_POLICY_VERSION,
    approvedScore,
    difficultyWeight,
    followUpMultiplier,
    questionWeight,
    weightedScore: approvedScore * questionWeight,
  };
}

export function scoreInterview(
  questions,
  bookingStatus = "SCHEDULED"
) {
  const breakdown = questions.map((question) => {
    const status =
      bookingStatus === "CANCELLED"
        ? "CANCELLED"
        : !question.sentAt
          ? "NOT_DELIVERED"
          : !question.submission
            ? question.responseStatus === "UNANSWERED" ||
              bookingStatus === "COMPLETED"
              ? "UNANSWERED"
              : "AWAITING_ANSWER"
            : !question.submission.approvedGrade
              ? "AWAITING_APPROVAL"
              : "GRADED";

    const calculation =
      status === "GRADED"
        ? questionCalculation(
            question,
            question.submission.approvedGrade
          )
        : null;

    return {
      questionId: question.id,
      parentId: question.parentId || null,
      difficulty: question.difficulty,
      topic: question.topic,
      status,
      ...(calculation || {}),
    };
  });

  const eligible = breakdown.filter(
    (question) =>
      question.status === "GRADED" &&
      question.questionWeight != null
  );

  const main = eligible.filter(
    (question) => question.followUpMultiplier === 1
  );

  const grill = eligible.filter(
    (question) => question.followUpMultiplier === 0.5
  );

  const average = (rows) => {
    if (!rows.length) return null;

    const weightedTotal = rows.reduce(
      (sum, question) => sum + question.weightedScore,
      0
    );

    const totalWeight = rows.reduce(
      (sum, question) => sum + question.questionWeight,
      0
    );

    return totalWeight > 0
      ? weightedTotal / totalWeight
      : null;
  };

  const mainScore = average(main);
  const grillScore = average(grill);

  const overallScore =
    mainScore === null
      ? null
      : grillScore === null
        ? mainScore
        : Math.max(
            mainScore,
            0.85 * mainScore + 0.15 * grillScore
          );

  const state =
    main.length === 0
      ? "UNAVAILABLE"
      : main.length < 2 ||
          breakdown.some((question) =>
            [
              "AWAITING_ANSWER",
              "AWAITING_APPROVAL",
              "UNANSWERED",
            ].includes(question.status)
          )
        ? "PROVISIONAL"
        : "AVAILABLE";

  return {
    policyVersion: SCORING_POLICY_VERSION,
    state,
    mainScore,
    grillScore,
    overallScore,
    mainCount: main.length,
    grillCount: grill.length,
    breakdown,
  };
}
