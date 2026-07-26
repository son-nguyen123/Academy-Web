UPDATE "elearning"."Grade"
SET
  "aiStatus" = 'COMPLETED',
  "score" = NULL,
  "feedback" = NULL
WHERE
  "status" = 'DRAFT'
  AND "gradedById" IS NULL
  AND "aiScore" IS NOT NULL;
