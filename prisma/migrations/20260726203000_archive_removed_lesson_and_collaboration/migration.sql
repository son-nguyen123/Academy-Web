-- Lesson authoring/delivery and multi-teacher test collaboration are no longer
-- part of the active product. Preserve legacy rows outside Prisma's managed
-- schemas so the removal remains recoverable.

CREATE SCHEMA IF NOT EXISTS "archive";

DO $$
BEGIN
  IF to_regclass('"elearning"."LessonProgress"') IS NOT NULL
     AND to_regclass('"archive"."LessonProgress_legacy_20260726"') IS NULL THEN
    ALTER TABLE "elearning"."LessonProgress" SET SCHEMA "archive";
    ALTER TABLE "archive"."LessonProgress" RENAME TO "LessonProgress_legacy_20260726";
  END IF;

  IF to_regclass('"elearning"."LessonDelivery"') IS NOT NULL
     AND to_regclass('"archive"."LessonDelivery_legacy_20260726"') IS NULL THEN
    ALTER TABLE "elearning"."LessonDelivery" SET SCHEMA "archive";
    ALTER TABLE "archive"."LessonDelivery" RENAME TO "LessonDelivery_legacy_20260726";
  END IF;

  IF to_regclass('"elearning"."Lesson"') IS NOT NULL
     AND to_regclass('"archive"."Lesson_legacy_20260726"') IS NULL THEN
    ALTER TABLE "elearning"."Lesson" SET SCHEMA "archive";
    ALTER TABLE "archive"."Lesson" RENAME TO "Lesson_legacy_20260726";
  END IF;

  IF to_regclass('"elearning"."TestCollaborator"') IS NOT NULL
     AND to_regclass('"archive"."TestCollaborator_legacy_20260726"') IS NULL THEN
    ALTER TABLE "elearning"."TestCollaborator" SET SCHEMA "archive";
    ALTER TABLE "archive"."TestCollaborator" RENAME TO "TestCollaborator_legacy_20260726";
  END IF;
END $$;
