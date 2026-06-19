ALTER TABLE "TutoringSession"
ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "endDate" TIMESTAMP(3);

CREATE INDEX "TutoringSession_studentId_weekday_startDate_endDate_idx"
ON "TutoringSession"("studentId", "weekday", "startDate", "endDate");
