CREATE TABLE "elearning"."TeacherWorkflowRun" (
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

CREATE TABLE "elearning"."TeacherWorkflowStep" (
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

CREATE INDEX "TeacherWorkflowRun_teacherId_status_updatedAt_idx"
  ON "elearning"."TeacherWorkflowRun"("teacherId", "status", "updatedAt");

CREATE INDEX "TeacherWorkflowRun_teacherId_workflowId_targetId_idx"
  ON "elearning"."TeacherWorkflowRun"("teacherId", "workflowId", "targetId");

CREATE UNIQUE INDEX "TeacherWorkflowStep_runId_stepId_key"
  ON "elearning"."TeacherWorkflowStep"("runId", "stepId");

CREATE INDEX "TeacherWorkflowStep_runId_position_idx"
  ON "elearning"."TeacherWorkflowStep"("runId", "position");

ALTER TABLE "elearning"."TeacherWorkflowRun"
  ADD CONSTRAINT "TeacherWorkflowRun_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "elearning"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "elearning"."TeacherWorkflowRun"
  ADD CONSTRAINT "TeacherWorkflowRun_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "elearning"."TeacherAgentSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "elearning"."TeacherWorkflowStep"
  ADD CONSTRAINT "TeacherWorkflowStep_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "elearning"."TeacherWorkflowRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
