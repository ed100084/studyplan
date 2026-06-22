import type { TaskType } from "@prisma/client";

export type TodayListTask = {
  id: string;
  title: string;
  subjectName?: string | null;
  type: TaskType;
  estimatedMinutes: number;
  priority: number;
  weekHint?: number | null;
};

export type TodayListItem = TodayListTask & {
  overdueWeeks: number;
};

export type TodayListBacklogSummary = {
  count: number;
  minutes: number;
};

export type TodayListResult = {
  todayList: TodayListItem[];
  backlog: TodayListBacklogSummary;
  availableMinutes: number;
  selectedMinutes: number;
};

function isoWeekNumber(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return 0;
  }

  const dayOfWeek = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));

  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function withOverdueWeeks(task: TodayListTask, todayWeek: number, index: number) {
  return {
    ...task,
    overdueWeeks: task.weekHint ? Math.max(0, todayWeek - task.weekHint) : 0,
    originalIndex: index,
  };
}

export function buildTodayList(input: {
  tasks: TodayListTask[];
  todayDate: string;
  availableMinutes: number;
  timeZone: string;
}): TodayListResult {
  const capacity = Math.max(0, Math.floor(input.availableMinutes));
  const todayWeek = isoWeekNumber(input.todayDate);
  const sorted = input.tasks
    .map((task, index) => withOverdueWeeks(task, todayWeek, index))
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        right.overdueWeeks - left.overdueWeeks ||
        left.originalIndex - right.originalIndex,
    );
  const todayList: TodayListItem[] = [];
  const backlogTasks: TodayListItem[] = [];
  let selectedMinutes = 0;

  for (const task of sorted) {
    const item: TodayListItem = {
      id: task.id,
      title: task.title,
      subjectName: task.subjectName,
      type: task.type,
      estimatedMinutes: task.estimatedMinutes,
      priority: task.priority,
      weekHint: task.weekHint,
      overdueWeeks: task.overdueWeeks,
    };

    if (task.estimatedMinutes > 0 && selectedMinutes + task.estimatedMinutes <= capacity) {
      todayList.push(item);
      selectedMinutes += task.estimatedMinutes;
    } else {
      backlogTasks.push(item);
    }
  }

  return {
    todayList,
    backlog: {
      count: backlogTasks.length,
      minutes: backlogTasks.reduce((total, task) => total + Math.max(0, task.estimatedMinutes), 0),
    },
    availableMinutes: capacity,
    selectedMinutes,
  };
}
