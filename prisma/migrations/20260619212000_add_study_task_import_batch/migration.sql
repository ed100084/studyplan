ALTER TABLE "StudyTask" ADD COLUMN "importBatchId" TEXT;

CREATE INDEX "StudyTask_studentId_importBatchId_idx" ON "StudyTask"("studentId", "importBatchId");
