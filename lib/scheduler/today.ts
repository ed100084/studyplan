import { FatigueLevel, FixedEventType, TaskType } from "@prisma/client";

export type SchedulerFixedEvent = {
  id: string;
  title: string;
  type: FixedEventType;
  startTime: string;
  endTime: string;
  commuteMinutes: number;
};

export type SchedulerTutoringSession = {
  id: string;
  subjectName: string;
  startTime: string;
  endTime: string;
  commuteMinutes: number;
  fatigueLevel: FatigueLevel;
  hasHomework: boolean;
};

export type SchedulerStudyTask = {
  id: string;
  title: string;
  subjectName?: string;
  type: TaskType;
  estimatedMinutes: number;
  priority: number;
};

export type ScheduleSegmentKind = "fixed" | "tutoring" | "study" | "break" | "unplaced";

export type ScheduleSegment = {
  id: string;
  kind: ScheduleSegmentKind;
  title: string;
  detail: string;
  startTime?: string;
  endTime?: string;
  minutes: number;
  taskId?: string;
};

type BusyBlock = {
  id: string;
  kind: "fixed" | "tutoring";
  title: string;
  detail: string;
  start: number;
  end: number;
};

type FreeSlot = {
  start: number;
  end: number;
};

const DAY_START = "17:30";
const DAY_END = "22:30";
const BREAK_MINUTES = 10;
const MIN_TASK_MINUTES = 10;

const fixedEventLabels: Record<FixedEventType, string> = {
  SCHOOL: "學校",
  TUTORING: "補習",
  COMMUTE: "通勤",
  MEAL: "吃飯",
  HYGIENE: "洗澡",
  SLEEP: "睡覺",
  FAMILY: "家庭時間",
  OTHER: "其他",
};

const taskTypeLabels: Record<TaskType, string> = {
  SCHOOL_HOMEWORK: "學校作業",
  TUTORING_HOMEWORK: "補習作業",
  REVIEW: "複習",
  PRACTICE: "練習",
  WEAK_POINT: "弱點補強",
  PREVIEW: "預習",
  EXAM_SPRINT: "考前衝刺",
};

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function clampBlock(start: number, end: number, dayStart: number, dayEnd: number) {
  return {
    start: Math.max(dayStart, start),
    end: Math.min(dayEnd, end),
  };
}

function mergeBusyBlocks(blocks: BusyBlock[]) {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: BusyBlock[] = [];

  for (const block of sorted) {
    if (block.end <= block.start) {
      continue;
    }

    const previous = merged.at(-1);
    if (!previous || block.start >= previous.end) {
      merged.push({ ...block });
      continue;
    }

    previous.end = Math.max(previous.end, block.end);
    previous.title = `${previous.title} / ${block.title}`;
    previous.detail = `${previous.detail}；${block.detail}`;
  }

  return merged;
}

function buildFreeSlots(blocks: BusyBlock[], dayStart: number, dayEnd: number) {
  const slots: FreeSlot[] = [];
  let cursor = dayStart;

  for (const block of blocks) {
    if (block.start > cursor) {
      slots.push({
        start: cursor,
        end: block.start,
      });
    }
    cursor = Math.max(cursor, block.end);
  }

  if (cursor < dayEnd) {
    slots.push({
      start: cursor,
      end: dayEnd,
    });
  }

  return slots;
}

function reduceLateCapacityForFatigue(slots: FreeSlot[], tutoringSessions: SchedulerTutoringSession[]) {
  const highFatigueEnds = tutoringSessions
    .filter((session) => session.fatigueLevel === "HIGH")
    .map((session) => toMinutes(session.endTime) + session.commuteMinutes);

  if (highFatigueEnds.length === 0) {
    return slots;
  }

  const firstHighFatigueEnd = Math.min(...highFatigueEnds);
  return slots.map((slot) => {
    if (slot.start < firstHighFatigueEnd) {
      return slot;
    }

    const duration = slot.end - slot.start;
    return {
      start: slot.start,
      end: slot.start + Math.floor(duration * 0.5),
    };
  });
}

export function buildTodaySchedule(input: {
  fixedEvents: SchedulerFixedEvent[];
  tutoringSessions: SchedulerTutoringSession[];
  tasks: SchedulerStudyTask[];
  dayStart?: string;
  dayEnd?: string;
}) {
  const dayStart = toMinutes(input.dayStart ?? DAY_START);
  const dayEnd = toMinutes(input.dayEnd ?? DAY_END);
  const fixedBlocks: BusyBlock[] = input.fixedEvents.map((event) => {
    const clamped = clampBlock(toMinutes(event.startTime), toMinutes(event.endTime), dayStart, dayEnd);
    return {
      id: `fixed-${event.id}`,
      kind: "fixed",
      title: event.title,
      detail: fixedEventLabels[event.type],
      start: clamped.start,
      end: clamped.end,
    };
  });
  const tutoringBlocks: BusyBlock[] = input.tutoringSessions.map((session) => {
    const clamped = clampBlock(
      toMinutes(session.startTime) - session.commuteMinutes,
      toMinutes(session.endTime) + session.commuteMinutes,
      dayStart,
      dayEnd,
    );
    return {
      id: `tutoring-${session.id}`,
      kind: "tutoring",
      title: `${session.subjectName}補習`,
      detail: session.commuteMinutes > 0 ? `含通勤 ${session.commuteMinutes} 分鐘` : "補習時段",
      start: clamped.start,
      end: clamped.end,
    };
  });

  const busyBlocks = mergeBusyBlocks([...fixedBlocks, ...tutoringBlocks]);
  const freeSlots = reduceLateCapacityForFatigue(buildFreeSlots(busyBlocks, dayStart, dayEnd), input.tutoringSessions).filter(
    (slot) => slot.end - slot.start >= MIN_TASK_MINUTES,
  );
  const tasks = [...input.tasks].sort((a, b) => b.priority - a.priority || b.estimatedMinutes - a.estimatedMinutes);
  const studySegments: ScheduleSegment[] = [];
  const unplaced: ScheduleSegment[] = [];
  let slotIndex = 0;
  let cursor = freeSlots[0]?.start ?? dayStart;

  for (const task of tasks) {
    let placed = false;

    while (slotIndex < freeSlots.length) {
      const slot = freeSlots[slotIndex];
      cursor = Math.max(cursor, slot.start);
      const available = slot.end - cursor;

      if (available >= task.estimatedMinutes) {
        const start = cursor;
        const end = start + task.estimatedMinutes;
        studySegments.push({
          id: `study-${task.id}`,
          kind: "study",
          title: `${task.subjectName ?? "未指定科目"}：${task.title}`,
          detail: `${taskTypeLabels[task.type]}，優先度 ${task.priority}`,
          startTime: toTime(start),
          endTime: toTime(end),
          minutes: task.estimatedMinutes,
          taskId: task.id,
        });
        cursor = end + BREAK_MINUTES;

        if (cursor <= slot.end && slot.end - cursor >= MIN_TASK_MINUTES) {
          studySegments.push({
            id: `break-${task.id}`,
            kind: "break",
            title: "休息",
            detail: "任務間自動保留 10 分鐘",
            startTime: toTime(end),
            endTime: toTime(Math.min(cursor, slot.end)),
            minutes: Math.min(BREAK_MINUTES, slot.end - end),
          });
        }

        placed = true;
        break;
      }

      slotIndex += 1;
      cursor = freeSlots[slotIndex]?.start ?? dayEnd;
    }

    if (!placed) {
      unplaced.push({
        id: `unplaced-${task.id}`,
        kind: "unplaced",
        title: `${task.subjectName ?? "未指定科目"}：${task.title}`,
        detail: `今天剩餘可用時間不足，需要 ${task.estimatedMinutes} 分鐘`,
        minutes: task.estimatedMinutes,
        taskId: task.id,
      });
    }
  }

  const fixedSegments: ScheduleSegment[] = busyBlocks.map((block) => ({
    id: block.id,
    kind: block.kind,
    title: block.title,
    detail: block.detail,
    startTime: toTime(block.start),
    endTime: toTime(block.end),
    minutes: block.end - block.start,
  }));
  const scheduled = [...fixedSegments, ...studySegments].sort((a, b) => {
    if (!a.startTime || !b.startTime) {
      return 0;
    }
    return toMinutes(a.startTime) - toMinutes(b.startTime);
  });

  return {
    scheduled,
    unplaced,
    availableMinutes: freeSlots.reduce((total, slot) => total + (slot.end - slot.start), 0),
    scheduledStudyMinutes: studySegments.reduce((total, segment) => (segment.kind === "study" ? total + segment.minutes : total), 0),
  };
}
