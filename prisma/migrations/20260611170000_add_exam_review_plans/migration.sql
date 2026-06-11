-- CreateTable
CREATE TABLE "ExamReviewPlan" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "calendarEventId" TEXT NOT NULL,
    "subjectId" TEXT,
    "title" TEXT NOT NULL,
    "scope" TEXT,
    "totalMinutes" INTEGER NOT NULL,
    "sessionMinutes" INTEGER NOT NULL DEFAULT 30,
    "priority" INTEGER NOT NULL DEFAULT 4,
    "startDate" TIMESTAMP(3) NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "source" "RecordSource" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamReviewPlan_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "StudyTask" ADD COLUMN "examReviewPlanId" TEXT;

-- CreateIndex
CREATE INDEX "ExamReviewPlan_studentId_examDate_idx" ON "ExamReviewPlan"("studentId", "examDate");

-- CreateIndex
CREATE INDEX "ExamReviewPlan_calendarEventId_idx" ON "ExamReviewPlan"("calendarEventId");

-- CreateIndex
CREATE INDEX "StudyTask_examReviewPlanId_idx" ON "StudyTask"("examReviewPlanId");

-- AddForeignKey
ALTER TABLE "ExamReviewPlan" ADD CONSTRAINT "ExamReviewPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamReviewPlan" ADD CONSTRAINT "ExamReviewPlan_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamReviewPlan" ADD CONSTRAINT "ExamReviewPlan_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyTask" ADD CONSTRAINT "StudyTask_examReviewPlanId_fkey" FOREIGN KEY ("examReviewPlanId") REFERENCES "ExamReviewPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
