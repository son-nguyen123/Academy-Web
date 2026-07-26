CREATE SCHEMA IF NOT EXISTS "archive";

CREATE TABLE IF NOT EXISTS "archive"."ClassroomCourseLink_legacy_20260726" (
  "classSectionId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassroomCourseLink_legacy_20260726_pkey" PRIMARY KEY ("classSectionId")
);

INSERT INTO "archive"."ClassroomCourseLink_legacy_20260726" ("classSectionId", "courseId")
SELECT "id", "courseId"
FROM "elearning"."ClassSection"
WHERE "courseId" IS NOT NULL
ON CONFLICT ("classSectionId") DO NOTHING;

ALTER TABLE "elearning"."ClassSection"
  DROP CONSTRAINT IF EXISTS "ClassSection_courseId_fkey";

ALTER TABLE "elearning"."ClassSection"
  DROP COLUMN IF EXISTS "courseId";
