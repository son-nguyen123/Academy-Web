CREATE TABLE "elearning"."TestVersion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "createdById" TEXT,
    "version" INTEGER NOT NULL,
    "changeNote" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."TestCollaborator" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestCollaborator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TestVersion_quizId_version_key" ON "elearning"."TestVersion"("quizId", "version");
CREATE INDEX "TestVersion_quizId_createdAt_idx" ON "elearning"."TestVersion"("quizId", "createdAt");
CREATE UNIQUE INDEX "TestCollaborator_quizId_userId_key" ON "elearning"."TestCollaborator"("quizId", "userId");
CREATE INDEX "TestCollaborator_userId_idx" ON "elearning"."TestCollaborator"("userId");

ALTER TABLE "elearning"."TestVersion" ADD CONSTRAINT "TestVersion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "elearning"."Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."TestVersion" ADD CONSTRAINT "TestVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "elearning"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "elearning"."TestCollaborator" ADD CONSTRAINT "TestCollaborator_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "elearning"."Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."TestCollaborator" ADD CONSTRAINT "TestCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "elearning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
