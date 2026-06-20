CREATE TABLE "StudyWindow" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyWindow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudyWindow_studentId_weekday_startDate_endDate_idx" ON "StudyWindow"("studentId", "weekday", "startDate", "endDate");

ALTER TABLE "StudyWindow" ADD CONSTRAINT "StudyWindow_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
