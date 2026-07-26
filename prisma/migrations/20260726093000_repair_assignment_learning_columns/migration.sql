-- Repair databases where the original sync migration was marked applied
-- before these Assignment columns were added to that migration file.
ALTER TYPE "elearning"."ExamSkill" ADD VALUE IF NOT EXISTS 'VOCABULARY';
ALTER TYPE "elearning"."ExamSkill" ADD VALUE IF NOT EXISTS 'PRONUNCIATION';

ALTER TABLE "elearning"."Assignment"
  ADD COLUMN IF NOT EXISTS "allowLateSubmission" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "allowResubmission" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "cefrLevel" TEXT,
  ADD COLUMN IF NOT EXISTS "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS "rubric" TEXT,
  ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "skill" "elearning"."ExamSkill" NOT NULL DEFAULT 'MIXED';
