CREATE TABLE "elearning"."ClassMeeting" (
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

CREATE INDEX "ClassMeeting_classSectionId_dayOfWeek_startTime_idx"
  ON "elearning"."ClassMeeting"("classSectionId", "dayOfWeek", "startTime");

ALTER TABLE "elearning"."ClassMeeting"
  ADD CONSTRAINT "ClassMeeting_classSectionId_fkey"
  FOREIGN KEY ("classSectionId") REFERENCES "elearning"."ClassSection"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
