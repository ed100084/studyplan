-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('SECTION_EXAM', 'MOCK_EXAM', 'ENTRANCE_EXAM', 'SCHOOL_EVENT', 'DEADLINE', 'OTHER');

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CalendarEventType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "subjectName" TEXT,
    "note" TEXT,
    "source" "RecordSource" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_studentId_startDate_idx" ON "CalendarEvent"("studentId", "startDate");

-- CreateIndex
CREATE INDEX "CalendarEvent_studentId_endDate_idx" ON "CalendarEvent"("studentId", "endDate");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
