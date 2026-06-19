ALTER TABLE "FixedEvent" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "FixedEvent" ADD COLUMN "endDate" TIMESTAMP(3);

CREATE INDEX "FixedEvent_studentId_weekday_startDate_endDate_idx" ON "FixedEvent"("studentId", "weekday", "startDate", "endDate");
