import { TaskStatus } from "@prisma/client";

export type ProgressTask = {
  status: TaskStatus;
  estimatedMinutes: number;
};

export type WeeklyProgress = {
  actionableTasks: number;
  completedTasks: number;
  partialTasks: number;
  completionRate: number;
  plannedMinutes: number;
  creditedMinutes: number;
};

export function buildWeeklyProgress(tasks: ProgressTask[]): WeeklyProgress {
  const actionable = tasks.filter((task) => task.status !== TaskStatus.RESCHEDULED);
  const completedTasks = actionable.filter((task) => task.status === TaskStatus.DONE).length;
  const partialTasks = actionable.filter((task) => task.status === TaskStatus.PARTIAL).length;
  const plannedMinutes = actionable.reduce((total, task) => total + task.estimatedMinutes, 0);
  const creditedMinutes = actionable.reduce((total, task) => {
    if (task.status === TaskStatus.DONE) {
      return total + task.estimatedMinutes;
    }

    if (task.status === TaskStatus.PARTIAL) {
      return total + Math.round(task.estimatedMinutes / 2);
    }

    return total;
  }, 0);
  const completionUnits = completedTasks + partialTasks * 0.5;
  const completionRate = actionable.length === 0 ? 0 : Math.round((completionUnits / actionable.length) * 100);

  return {
    actionableTasks: actionable.length,
    completedTasks,
    partialTasks,
    completionRate,
    plannedMinutes,
    creditedMinutes,
  };
}

export function averageScore(scores: Array<{ value: number }>) {
  if (scores.length === 0) {
    return null;
  }

  return Math.round((scores.reduce((total, score) => total + score.value, 0) / scores.length) * 10) / 10;
}
