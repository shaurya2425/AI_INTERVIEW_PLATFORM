ALTER TABLE "InterviewQuestion" ADD COLUMN "parentId" TEXT, ADD COLUMN "depth" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "InterviewQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InterviewSubmission"
 ADD COLUMN "evaluationStatus" TEXT NOT NULL DEFAULT 'PENDING',
 ADD COLUMN "evaluation" JSONB,
 ADD COLUMN "evaluationError" TEXT,
 ADD COLUMN "evaluationStartedAt" TIMESTAMP(3),
 ADD COLUMN "evaluationToken" TEXT,
 ADD COLUMN "evaluationAttempts" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "approvedGrade" "FeedbackRating",
 ADD COLUMN "interviewerNotes" TEXT,
 ADD COLUMN "approvedAt" TIMESTAMP(3),
 ADD COLUMN "approvedBy" TEXT;
