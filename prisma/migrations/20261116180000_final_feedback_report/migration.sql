-- Preserve existing reports; no rating means insufficient approved evidence.
ALTER TABLE "Feedback" ALTER COLUMN "overallRating" DROP NOT NULL;
ALTER TABLE "Feedback" ADD COLUMN "report" JSONB;
