ALTER TABLE "elearning"."Attempt"
  ADD COLUMN "isReviewPractice" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewScope" TEXT,
  ADD COLUMN "sourceAttemptId" TEXT,
  ADD COLUMN "reviewQuestionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Attempt_studentId_isReviewPractice_idx"
  ON "elearning"."Attempt"("studentId", "isReviewPractice");
