ALTER TABLE "Booking"
 ADD COLUMN "completedAt" TIMESTAMP(3), ADD COLUMN "completedBy" TEXT,
 ADD COLUMN "completionState" TEXT NOT NULL DEFAULT 'NONE', ADD COLUMN "completionToken" TEXT,
 ADD COLUMN "completionStartedAt" TIMESTAMP(3), ADD COLUMN "completionError" TEXT,
 ADD COLUMN "streamEndedAt" TIMESTAMP(3), ADD COLUMN "feedbackState" TEXT NOT NULL DEFAULT 'NONE',
 ADD COLUMN "feedbackRequestedAt" TIMESTAMP(3), ADD COLUMN "transcriptArtifacts" JSONB,
 ADD COLUMN "recordingArtifacts" JSONB, ADD COLUMN "scoringSummary" JSONB, ADD COLUMN "scoringPolicyVersion" TEXT;
ALTER TABLE "InterviewQuestion" ADD COLUMN "responseStatus" TEXT NOT NULL DEFAULT 'AWAITING_ANSWER';
UPDATE "InterviewQuestion" q SET "responseStatus" = 'ANSWERED' WHERE EXISTS (SELECT 1 FROM "InterviewSubmission" s WHERE s."questionId" = q.id);
ALTER TABLE "InterviewSubmission"
 ADD COLUMN "evaluationCompletedAt" TIMESTAMP(3), ADD COLUMN "suggestedScore" INTEGER,
 ADD COLUMN "approvedScore" INTEGER, ADD COLUMN "scoringPolicyVersion" TEXT,
 ADD COLUMN "difficultyWeight" DOUBLE PRECISION, ADD COLUMN "followUpMultiplier" DOUBLE PRECISION,
 ADD COLUMN "questionWeight" DOUBLE PRECISION, ADD COLUMN "weightedScore" DOUBLE PRECISION;
UPDATE "InterviewSubmission" s SET
 "approvedScore" = CASE s."approvedGrade" WHEN 'POOR' THEN 0 WHEN 'AVERAGE' THEN 40 WHEN 'GOOD' THEN 75 WHEN 'EXCELLENT' THEN 100 END,
 "scoringPolicyVersion" = 'prept-fair-v1',
 "difficultyWeight" = CASE q.difficulty WHEN 'EASY' THEN 1.25 WHEN 'MEDIUM' THEN 1.0 WHEN 'HARD' THEN 0.70 END,
 "followUpMultiplier" = CASE WHEN q."parentId" IS NOT NULL OR q.depth > 0 THEN 0.5 ELSE 1 END
 FROM "InterviewQuestion" q WHERE q.id = s."questionId" AND s."approvedGrade" IS NOT NULL;
UPDATE "InterviewSubmission" SET "questionWeight" = "difficultyWeight" * "followUpMultiplier",
 "weightedScore" = "approvedScore" * "difficultyWeight" * "followUpMultiplier" WHERE "approvedGrade" IS NOT NULL;
