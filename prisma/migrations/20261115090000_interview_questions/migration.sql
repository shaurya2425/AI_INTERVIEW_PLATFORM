CREATE TABLE "InterviewQuestion" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "difficulty" TEXT NOT NULL,
  "options" TEXT[] NOT NULL,
  "referenceAnswer" TEXT NOT NULL,
  "correctOptionIndex" INTEGER,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InterviewQuestion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InterviewSubmission" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "optionIndex" INTEGER,
  "language" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notifiedAt" TIMESTAMP(3),
  CONSTRAINT "InterviewSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InterviewQuestion_bookingId_sourceId_key" ON "InterviewQuestion"("bookingId", "sourceId");
CREATE INDEX "InterviewQuestion_recipientId_idx" ON "InterviewQuestion"("recipientId");
CREATE INDEX "InterviewQuestion_authorId_idx" ON "InterviewQuestion"("authorId");
CREATE UNIQUE INDEX "InterviewSubmission_questionId_key" ON "InterviewSubmission"("questionId");
CREATE INDEX "InterviewSubmission_candidateId_idx" ON "InterviewSubmission"("candidateId");
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InterviewSubmission" ADD CONSTRAINT "InterviewSubmission_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "InterviewQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewSubmission" ADD CONSTRAINT "InterviewSubmission_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InterviewQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InterviewSubmission" ENABLE ROW LEVEL SECURITY;
