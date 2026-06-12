CREATE TYPE "ScheduleRunTrigger" AS ENUM ('SAVED', 'REGENERATED');
CREATE TYPE "ReviewPlanRevisionTrigger" AS ENUM ('CREATED', 'MANUAL_REDISTRIBUTION', 'TASK_PROGRESS');

CREATE TABLE "ExamReviewPlanRevision" (
    "id" TEXT NOT NULL,
    "examReviewPlanId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "trigger" "ReviewPlanRevisionTrigger" NOT NULL,
    "remainingMinutes" INTEGER NOT NULL,
    "scheduledMinutes" INTEGER NOT NULL,
    "unscheduledMinutes" INTEGER NOT NULL,
    "taskCount" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamReviewPlanRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleRun" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scheduleDate" TIMESTAMP(3) NOT NULL,
    "revision" INTEGER NOT NULL,
    "trigger" "ScheduleRunTrigger" NOT NULL,
    "availableMinutes" INTEGER NOT NULL,
    "scheduledStudyMinutes" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "source" "RecordSource" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClassCalendarImport" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "managerId" TEXT,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "importedRows" INTEGER NOT NULL,
    "duplicateRows" INTEGER NOT NULL,
    "studentCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassCalendarImport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExamReviewPlanRevision_examReviewPlanId_revision_key" ON "ExamReviewPlanRevision"("examReviewPlanId", "revision");
CREATE INDEX "ExamReviewPlanRevision_examReviewPlanId_createdAt_idx" ON "ExamReviewPlanRevision"("examReviewPlanId", "createdAt");
CREATE UNIQUE INDEX "ScheduleRun_studentId_scheduleDate_revision_key" ON "ScheduleRun"("studentId", "scheduleDate", "revision");
CREATE INDEX "ScheduleRun_studentId_scheduleDate_createdAt_idx" ON "ScheduleRun"("studentId", "scheduleDate", "createdAt");
CREATE INDEX "ClassCalendarImport_classroomId_createdAt_idx" ON "ClassCalendarImport"("classroomId", "createdAt");

ALTER TABLE "ExamReviewPlanRevision" ADD CONSTRAINT "ExamReviewPlanRevision_examReviewPlanId_fkey" FOREIGN KEY ("examReviewPlanId") REFERENCES "ExamReviewPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleRun" ADD CONSTRAINT "ScheduleRun_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassCalendarImport" ADD CONSTRAINT "ClassCalendarImport_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassCalendarImport" ADD CONSTRAINT "ClassCalendarImport_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
