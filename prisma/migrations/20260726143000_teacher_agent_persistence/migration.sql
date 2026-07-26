CREATE TABLE "elearning"."TeacherAgentSession" (
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

CREATE TABLE "elearning"."TeacherAgentExecution" (
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

CREATE UNIQUE INDEX "TeacherAgentSession_teacherId_key"
  ON "elearning"."TeacherAgentSession"("teacherId");

CREATE UNIQUE INDEX "TeacherAgentExecution_teacherId_idempotencyKey_key"
  ON "elearning"."TeacherAgentExecution"("teacherId", "idempotencyKey");

CREATE INDEX "TeacherAgentExecution_teacherId_updatedAt_idx"
  ON "elearning"."TeacherAgentExecution"("teacherId", "updatedAt");

ALTER TABLE "elearning"."TeacherAgentSession"
  ADD CONSTRAINT "TeacherAgentSession_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "elearning"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "elearning"."TeacherAgentExecution"
  ADD CONSTRAINT "TeacherAgentExecution_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "elearning"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "elearning"."TeacherAgentExecution"
  ADD CONSTRAINT "TeacherAgentExecution_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "elearning"."TeacherAgentSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
