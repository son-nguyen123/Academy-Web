-- Reconcile databases where migration history survived but recently added
-- e-learning objects were removed or never created. All operations are
-- idempotent so this migration is safe for databases that are already healthy.

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
    WHERE n.nspname = 'elearning' AND t.typname = 'AiGradeStatus'
  ) THEN
    CREATE TYPE "elearning"."AiGradeStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'COMPLETED', 'FAILED');
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
END $$;

ALTER TYPE "elearning"."EnrollmentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "elearning"."EnrollmentStatus" ADD VALUE IF NOT EXISTS 'LEFT';
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
  ADD COLUMN IF NOT EXISTS "aiError" TEXT,
  ADD COLUMN IF NOT EXISTS "aiFeedback" TEXT,
  ADD COLUMN IF NOT EXISTS "aiModel" TEXT,
  ADD COLUMN IF NOT EXISTS "aiReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "aiRubric" JSONB,
  ADD COLUMN IF NOT EXISTS "aiScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "aiStatus" "elearning"."AiGradeStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "status" "elearning"."GradeStatus" NOT NULL DEFAULT 'PUBLISHED';

ALTER TABLE "elearning"."Grade" ALTER COLUMN "score" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "elearning"."ClassMeeting" (
  "id" TEXT NOT NULL,
  "classSectionId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "location" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassMeeting_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE IF NOT EXISTS "elearning"."TestVersion" (
  "id" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "createdById" TEXT,
  "version" INTEGER NOT NULL,
  "changeNote" TEXT,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "elearning"."TestCollaborator" (
  "id" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'EDITOR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestCollaborator_pkey" PRIMARY KEY ("id")
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

CREATE TABLE IF NOT EXISTS "elearning"."TeacherAgentSession" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "messages" JSONB NOT NULL,
  "pendingAction" JSONB,
  "workflow" JSONB,
  "workflowEditing" BOOLEAN NOT NULL DEFAULT false,
  "currentPath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherAgentSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "elearning"."TeacherAgentExecution" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "sessionId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "result" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherAgentExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "elearning"."TeacherWorkflowRun" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "sessionId" TEXT,
  "workflowId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANNING',
  "targetType" TEXT,
  "targetId" TEXT,
  "targetLabel" TEXT,
  "goal" JSONB NOT NULL,
  "currentStepId" TEXT,
  "state" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "TeacherWorkflowRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "elearning"."TeacherWorkflowStep" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "input" JSONB,
  "result" JSONB,
  "evidence" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherWorkflowStep_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClassMeeting_classSectionId_dayOfWeek_startTime_idx"
  ON "elearning"."ClassMeeting"("classSectionId", "dayOfWeek", "startTime");
CREATE INDEX IF NOT EXISTS "LessonDelivery_classSectionId_status_idx"
  ON "elearning"."LessonDelivery"("classSectionId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "LessonDelivery_lessonId_classSectionId_key"
  ON "elearning"."LessonDelivery"("lessonId", "classSectionId");
CREATE INDEX IF NOT EXISTS "LessonProgress_studentId_status_idx"
  ON "elearning"."LessonProgress"("studentId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "LessonProgress_lessonDeliveryId_studentId_key"
  ON "elearning"."LessonProgress"("lessonDeliveryId", "studentId");
CREATE INDEX IF NOT EXISTS "TestVersion_quizId_createdAt_idx"
  ON "elearning"."TestVersion"("quizId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "TestVersion_quizId_version_key"
  ON "elearning"."TestVersion"("quizId", "version");
CREATE INDEX IF NOT EXISTS "TestCollaborator_userId_idx"
  ON "elearning"."TestCollaborator"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "TestCollaborator_quizId_userId_key"
  ON "elearning"."TestCollaborator"("quizId", "userId");
CREATE INDEX IF NOT EXISTS "QuizDelivery_classSectionId_status_dueAt_idx"
  ON "elearning"."QuizDelivery"("classSectionId", "status", "dueAt");
CREATE UNIQUE INDEX IF NOT EXISTS "QuizDelivery_quizId_classSectionId_key"
  ON "elearning"."QuizDelivery"("quizId", "classSectionId");
CREATE UNIQUE INDEX IF NOT EXISTS "TeacherAgentSession_teacherId_key"
  ON "elearning"."TeacherAgentSession"("teacherId");
CREATE UNIQUE INDEX IF NOT EXISTS "TeacherAgentExecution_teacherId_idempotencyKey_key"
  ON "elearning"."TeacherAgentExecution"("teacherId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "TeacherAgentExecution_teacherId_updatedAt_idx"
  ON "elearning"."TeacherAgentExecution"("teacherId", "updatedAt");
CREATE INDEX IF NOT EXISTS "TeacherWorkflowRun_teacherId_status_updatedAt_idx"
  ON "elearning"."TeacherWorkflowRun"("teacherId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "TeacherWorkflowRun_teacherId_workflowId_targetId_idx"
  ON "elearning"."TeacherWorkflowRun"("teacherId", "workflowId", "targetId");
CREATE UNIQUE INDEX IF NOT EXISTS "TeacherWorkflowStep_runId_stepId_key"
  ON "elearning"."TeacherWorkflowStep"("runId", "stepId");
CREATE INDEX IF NOT EXISTS "TeacherWorkflowStep_runId_position_idx"
  ON "elearning"."TeacherWorkflowStep"("runId", "position");
CREATE INDEX IF NOT EXISTS "Attempt_quizDeliveryId_studentId_idx"
  ON "elearning"."Attempt"("quizDeliveryId", "studentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassMeeting_classSectionId_fkey') THEN
    ALTER TABLE "elearning"."ClassMeeting" ADD CONSTRAINT "ClassMeeting_classSectionId_fkey"
      FOREIGN KEY ("classSectionId") REFERENCES "elearning"."ClassSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonDelivery_lessonId_fkey') THEN
    ALTER TABLE "elearning"."LessonDelivery" ADD CONSTRAINT "LessonDelivery_lessonId_fkey"
      FOREIGN KEY ("lessonId") REFERENCES "elearning"."Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonDelivery_classSectionId_fkey') THEN
    ALTER TABLE "elearning"."LessonDelivery" ADD CONSTRAINT "LessonDelivery_classSectionId_fkey"
      FOREIGN KEY ("classSectionId") REFERENCES "elearning"."ClassSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonDelivery_assignedById_fkey') THEN
    ALTER TABLE "elearning"."LessonDelivery" ADD CONSTRAINT "LessonDelivery_assignedById_fkey"
      FOREIGN KEY ("assignedById") REFERENCES "elearning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonProgress_lessonDeliveryId_fkey') THEN
    ALTER TABLE "elearning"."LessonProgress" ADD CONSTRAINT "LessonProgress_lessonDeliveryId_fkey"
      FOREIGN KEY ("lessonDeliveryId") REFERENCES "elearning"."LessonDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonProgress_studentId_fkey') THEN
    ALTER TABLE "elearning"."LessonProgress" ADD CONSTRAINT "LessonProgress_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "elearning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TestVersion_quizId_fkey') THEN
    ALTER TABLE "elearning"."TestVersion" ADD CONSTRAINT "TestVersion_quizId_fkey"
      FOREIGN KEY ("quizId") REFERENCES "elearning"."Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TestVersion_createdById_fkey') THEN
    ALTER TABLE "elearning"."TestVersion" ADD CONSTRAINT "TestVersion_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "elearning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TestCollaborator_quizId_fkey') THEN
    ALTER TABLE "elearning"."TestCollaborator" ADD CONSTRAINT "TestCollaborator_quizId_fkey"
      FOREIGN KEY ("quizId") REFERENCES "elearning"."Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TestCollaborator_userId_fkey') THEN
    ALTER TABLE "elearning"."TestCollaborator" ADD CONSTRAINT "TestCollaborator_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "elearning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuizDelivery_quizId_fkey') THEN
    ALTER TABLE "elearning"."QuizDelivery" ADD CONSTRAINT "QuizDelivery_quizId_fkey"
      FOREIGN KEY ("quizId") REFERENCES "elearning"."Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuizDelivery_classSectionId_fkey') THEN
    ALTER TABLE "elearning"."QuizDelivery" ADD CONSTRAINT "QuizDelivery_classSectionId_fkey"
      FOREIGN KEY ("classSectionId") REFERENCES "elearning"."ClassSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuizDelivery_assignedById_fkey') THEN
    ALTER TABLE "elearning"."QuizDelivery" ADD CONSTRAINT "QuizDelivery_assignedById_fkey"
      FOREIGN KEY ("assignedById") REFERENCES "elearning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Attempt_quizDeliveryId_fkey') THEN
    ALTER TABLE "elearning"."Attempt" ADD CONSTRAINT "Attempt_quizDeliveryId_fkey"
      FOREIGN KEY ("quizDeliveryId") REFERENCES "elearning"."QuizDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeacherAgentSession_teacherId_fkey') THEN
    ALTER TABLE "elearning"."TeacherAgentSession" ADD CONSTRAINT "TeacherAgentSession_teacherId_fkey"
      FOREIGN KEY ("teacherId") REFERENCES "elearning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeacherAgentExecution_teacherId_fkey') THEN
    ALTER TABLE "elearning"."TeacherAgentExecution" ADD CONSTRAINT "TeacherAgentExecution_teacherId_fkey"
      FOREIGN KEY ("teacherId") REFERENCES "elearning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeacherAgentExecution_sessionId_fkey') THEN
    ALTER TABLE "elearning"."TeacherAgentExecution" ADD CONSTRAINT "TeacherAgentExecution_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "elearning"."TeacherAgentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeacherWorkflowRun_teacherId_fkey') THEN
    ALTER TABLE "elearning"."TeacherWorkflowRun" ADD CONSTRAINT "TeacherWorkflowRun_teacherId_fkey"
      FOREIGN KEY ("teacherId") REFERENCES "elearning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeacherWorkflowRun_sessionId_fkey') THEN
    ALTER TABLE "elearning"."TeacherWorkflowRun" ADD CONSTRAINT "TeacherWorkflowRun_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "elearning"."TeacherAgentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeacherWorkflowStep_runId_fkey') THEN
    ALTER TABLE "elearning"."TeacherWorkflowStep" ADD CONSTRAINT "TeacherWorkflowStep_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "elearning"."TeacherWorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
