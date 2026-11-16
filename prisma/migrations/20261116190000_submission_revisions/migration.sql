-- Keep one current submission for existing scoring, preserving older attempts.
ALTER TABLE "InterviewSubmission"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "previousAttempts" JSONB NOT NULL DEFAULT '[]';
