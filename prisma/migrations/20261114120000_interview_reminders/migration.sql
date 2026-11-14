CREATE TABLE "InterviewReminder" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "minutesBefore" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3),
    "providerId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewReminder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InterviewReminder_bookingId_idx" ON "InterviewReminder"("bookingId");
CREATE INDEX "Booking_status_startTime_idx" ON "Booking"("status", "startTime");
ALTER TABLE "InterviewReminder" ADD CONSTRAINT "InterviewReminder_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Reminder payloads contain email addresses; access through the server's Prisma role only.
ALTER TABLE "InterviewReminder" ENABLE ROW LEVEL SECURITY;
