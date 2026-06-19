import type { StudyTask } from "@prisma/client";
import { formatDateInput } from "@/lib/timezone";

export type StudyTaskImportBatchSummary = {
  id: string;
  count: number;
  startDate: string;
  endDate: string;
  createdAt: string;
};

export function buildStudyTaskImportBatches(
  tasks: Pick<StudyTask, "importBatchId" | "plannedDate" | "createdAt">[],
  timeZone: string,
) {
  const batches = new Map<
    string,
    {
      count: number;
      startDate: Date;
      endDate: Date;
      createdAt: Date;
    }
  >();

  tasks.forEach((task) => {
    if (!task.importBatchId) return;

    const batch = batches.get(task.importBatchId);
    if (!batch) {
      batches.set(task.importBatchId, {
        count: 1,
        startDate: task.plannedDate,
        endDate: task.plannedDate,
        createdAt: task.createdAt,
      });
      return;
    }

    batch.count += 1;
    if (task.plannedDate < batch.startDate) batch.startDate = task.plannedDate;
    if (task.plannedDate > batch.endDate) batch.endDate = task.plannedDate;
    if (task.createdAt > batch.createdAt) batch.createdAt = task.createdAt;
  });

  return Array.from(batches.entries())
    .map(([id, batch]) => ({
      id,
      count: batch.count,
      startDate: formatDateInput(batch.startDate, timeZone),
      endDate: formatDateInput(batch.endDate, timeZone),
      createdAt: formatDateInput(batch.createdAt, timeZone),
    }))
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}
