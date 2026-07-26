CREATE TYPE "elearning"."AiGradeStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'COMPLETED', 'FAILED');

ALTER TABLE "elearning"."Grade"
  ALTER COLUMN "score" DROP NOT NULL,
  ADD COLUMN "aiStatus" "elearning"."AiGradeStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN "aiError" TEXT;
