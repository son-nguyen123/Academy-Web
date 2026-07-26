DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'elearning' AND t.typname = 'GradeStatus'
  ) THEN
    CREATE TYPE "elearning"."GradeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'REVISION_REQUESTED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'elearning' AND t.typname = 'DeliveryStatus'
  ) THEN
    CREATE TYPE "elearning"."DeliveryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'elearning' AND t.typname = 'LessonProgressStatus'
  ) THEN
    CREATE TYPE "elearning"."LessonProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
  END IF;
END
$$;

ALTER TYPE "elearning"."ExamSkill" ADD VALUE IF NOT EXISTS 'VOCABULARY';
ALTER TYPE "elearning"."ExamSkill" ADD VALUE IF NOT EXISTS 'PRONUNCIATION';
ALTER TYPE "elearning"."SubmissionStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE "elearning"."SubmissionStatus" ADD VALUE IF NOT EXISTS 'REVISION_REQUESTED';

ALTER TABLE "elearning"."Assignment"
  ADD COLUMN IF NOT EXISTS "allowLateSubmission" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "allowResubmission" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "cefrLevel" TEXT,
  ADD COLUMN IF NOT EXISTS "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS "rubric" TEXT,
  ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "skill" "elearning"."ExamSkill" NOT NULL DEFAULT 'MIXED';

ALTER TABLE "elearning"."Attempt"
  ADD COLUMN IF NOT EXISTS "quizDeliveryId" TEXT;

ALTER TABLE "elearning"."Grade"
  ADD COLUMN IF NOT EXISTS "aiConfidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "aiFeedback" TEXT,
  ADD COLUMN IF NOT EXISTS "aiModel" TEXT,
  ADD COLUMN IF NOT EXISTS "aiReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "aiRubric" JSONB,
  ADD COLUMN IF NOT EXISTS "aiScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "status" "elearning"."GradeStatus" NOT NULL DEFAULT 'PUBLISHED';

CREATE TABLE IF NOT EXISTS "elearning"."LessonDelivery" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "classSectionId" TEXT NOT NULL,
  "assignedById" TEXT,
  "status" "elearning"."DeliveryStatus" NOT NULL DEFAULT 'PUBLISHED',
  "availableAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LessonDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "elearning"."LessonProgress" (
  "id" TEXT NOT NULL,
  "lessonDeliveryId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" "elearning"."LessonProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "elearning"."QuizDelivery" (
  "id" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "classSectionId" TEXT NOT NULL,
  "assignedById" TEXT,
  "status" "elearning"."DeliveryStatus" NOT NULL DEFAULT 'PUBLISHED',
  "openAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "attemptLimit" INTEGER NOT NULL DEFAULT 1,
  "showAnswersAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuizDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LessonDelivery_classSectionId_status_idx"
  ON "elearning"."LessonDelivery"("classSectionId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "LessonDelivery_lessonId_classSectionId_key"
  ON "elearning"."LessonDelivery"("lessonId", "classSectionId");
CREATE INDEX IF NOT EXISTS "LessonProgress_studentId_status_idx"
  ON "elearning"."LessonProgress"("studentId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "LessonProgress_lessonDeliveryId_studentId_key"
  ON "elearning"."LessonProgress"("lessonDeliveryId", "studentId");
CREATE INDEX IF NOT EXISTS "QuizDelivery_classSectionId_status_dueAt_idx"
  ON "elearning"."QuizDelivery"("classSectionId", "status", "dueAt");
CREATE UNIQUE INDEX IF NOT EXISTS "QuizDelivery_quizId_classSectionId_key"
  ON "elearning"."QuizDelivery"("quizId", "classSectionId");
CREATE INDEX IF NOT EXISTS "Attempt_quizDeliveryId_studentId_idx"
  ON "elearning"."Attempt"("quizDeliveryId", "studentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonDelivery_lessonId_fkey') THEN
    ALTER TABLE "elearning"."LessonDelivery"
      ADD CONSTRAINT "LessonDelivery_lessonId_fkey"
      FOREIGN KEY ("lessonId") REFERENCES "elearning"."Lesson"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonDelivery_classSectionId_fkey') THEN
    ALTER TABLE "elearning"."LessonDelivery"
      ADD CONSTRAINT "LessonDelivery_classSectionId_fkey"
      FOREIGN KEY ("classSectionId") REFERENCES "elearning"."ClassSection"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonDelivery_assignedById_fkey') THEN
    ALTER TABLE "elearning"."LessonDelivery"
      ADD CONSTRAINT "LessonDelivery_assignedById_fkey"
      FOREIGN KEY ("assignedById") REFERENCES "elearning"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonProgress_lessonDeliveryId_fkey') THEN
    ALTER TABLE "elearning"."LessonProgress"
      ADD CONSTRAINT "LessonProgress_lessonDeliveryId_fkey"
      FOREIGN KEY ("lessonDeliveryId") REFERENCES "elearning"."LessonDelivery"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonProgress_studentId_fkey') THEN
    ALTER TABLE "elearning"."LessonProgress"
      ADD CONSTRAINT "LessonProgress_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "elearning"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuizDelivery_quizId_fkey') THEN
    ALTER TABLE "elearning"."QuizDelivery"
      ADD CONSTRAINT "QuizDelivery_quizId_fkey"
      FOREIGN KEY ("quizId") REFERENCES "elearning"."Quiz"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuizDelivery_classSectionId_fkey') THEN
    ALTER TABLE "elearning"."QuizDelivery"
      ADD CONSTRAINT "QuizDelivery_classSectionId_fkey"
      FOREIGN KEY ("classSectionId") REFERENCES "elearning"."ClassSection"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuizDelivery_assignedById_fkey') THEN
    ALTER TABLE "elearning"."QuizDelivery"
      ADD CONSTRAINT "QuizDelivery_assignedById_fkey"
      FOREIGN KEY ("assignedById") REFERENCES "elearning"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Attempt_quizDeliveryId_fkey') THEN
    ALTER TABLE "elearning"."Attempt"
      ADD CONSTRAINT "Attempt_quizDeliveryId_fkey"
      FOREIGN KEY ("quizDeliveryId") REFERENCES "elearning"."QuizDelivery"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
