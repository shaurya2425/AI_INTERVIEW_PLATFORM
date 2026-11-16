CREATE TABLE "AIBuddyMessage" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "questionIds" TEXT[] NOT NULL,
  "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIBuddyMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AIBuddyMessage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AIBuddyMessage_bookingId_messageId_key" ON "AIBuddyMessage"("bookingId", "messageId");
CREATE INDEX "AIBuddyMessage_bookingId_occurredAt_createdAt_idx" ON "AIBuddyMessage"("bookingId", "occurredAt", "createdAt");
