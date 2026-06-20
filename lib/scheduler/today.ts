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
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  estimatedMinutes: number;
  priority: number;
};

export type SchedulerStudyWindow = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
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
  conflict?: boolean;
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

type TaskPlacement = {
  chunks: FreeSlot[];
  slotIndex: number;
  cursor: number;
};

const DAY_START = "17:30";
const DAY_END = "23:30";
const BREAK_MINUTES = 10;
const MIN_TASK_MINUTES = 10;

const fixedEventLabels: Record<FixedEventType, string> = {
  SCHOOL: "學校",
  TUTORING: "補習",
  COMMUTE: "通勤",
  MEAL: "用餐",
  HYGIENE: "盥洗",
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

function buildFreeSlots(blocks: FreeSlot[], dayStart: number, dayEnd: number) {
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

function buildFreeSlotsWithinStudyWindows(blocks: BusyBlock[], studyWindows: FreeSlot[]) {
  const slots: FreeSlot[] = [];

  for (const window of studyWindows) {
    const windowBlocks = blocks
      .map((block) => clampBlock(block.start, block.end, window.start, window.end))
      .filter((block) => block.end > block.start)
      .sort((a, b) => a.start - b.start || a.end - b.end);

    slots.push(...buildFreeSlots(mergeFreeSlotBlocks(windowBlocks), window.start, window.end));
  }

  return slots.sort((a, b) => a.start - b.start || a.end - b.end);
}

function mergeFreeSlotBlocks(blocks: FreeSlot[]) {
  const merged: FreeSlot[] = [];

  for (const block of blocks) {
    const previous = merged.at(-1);
    if (!previous || block.start >= previous.end) {
      merged.push({ ...block });
      continue;
    }

    previous.end = Math.max(previous.end, block.end);
  }

  return merged;
}

function normalizeStudyWindows(studyWindows: SchedulerStudyWindow[] | undefined, dayStart: number, dayEnd: number) {
  const windows = studyWindows?.length
    ? studyWindows.map((window) => ({
        start: toMinutes(window.startTime),
        end: toMinutes(window.endTime),
      }))
    : [{ start: dayStart, end: dayEnd }];

  return mergeFreeSlotBlocks(windows.filter((window) => window.end - window.start >= MIN_TASK_MINUTES).sort((a, b) => a.start - b.start));
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

function remainingSlotsFrom(freeSlots: FreeSlot[], slotIndex: number, cursor: number) {
  return freeSlots.slice(slotIndex).map((slot, index) => (index === 0 ? { ...slot, start: Math.max(cursor, slot.start) } : slot));
}

function explainUnplacedTask(task: SchedulerStudyTask, slots: FreeSlot[], availableMinutes: number) {
  const largestSlot = slots.reduce((largest, slot) => Math.max(largest, Math.max(0, slot.end - slot.start)), 0);

  if (slots.length === 0 || availableMinutes === 0) {
    return `今天已沒有可用自習空檔，這個任務需要 ${task.estimatedMinutes} 分鐘。`;
  }

  if (availableMinutes < task.estimatedMinutes) {
    return `今天剩下 ${availableMinutes} 分鐘，但這個任務需要 ${task.estimatedMinutes} 分鐘。`;
  }

  if (largestSlot < MIN_TASK_MINUTES) {
    return `剩餘空檔都小於 ${MIN_TASK_MINUTES} 分鐘，不適合再安排自習。`;
  }

  return "剩餘時間太零碎或已被高優先任務使用，建議降低預估時間或移到明天。";
}

function explainFixedTimeConflict(task: SchedulerStudyTask) {
  if (task.plannedStartTime && task.plannedEndTime) {
    return `指定時間 ${task.plannedStartTime}-${task.plannedEndTime} 不在可用自習空檔內，可能撞到固定作息、補習或超出可讀書時段。`;
  }

  return "指定時間不完整，請同時填寫開始與結束時間。";
}

function splitSlotAround(slot: FreeSlot, used: FreeSlot) {
  const nextSlots: FreeSlot[] = [];
  if (slot.start < used.start) {
    nextSlots.push({ start: slot.start, end: used.start });
  }
  if (used.end < slot.end) {
    nextSlots.push({ start: used.end, end: slot.end });
  }

  return nextSlots.filter((item) => item.end - item.start >= MIN_TASK_MINUTES);
}

function subtractSlotFromFreeSlots(freeSlots: FreeSlot[], used: FreeSlot) {
  return freeSlots
    .flatMap((slot) => {
      const overlapStart = Math.max(slot.start, used.start);
      const overlapEnd = Math.min(slot.end, used.end);

      if (overlapEnd <= overlapStart) {
        return [slot];
      }

      return splitSlotAround(slot, { start: overlapStart, end: overlapEnd });
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

function reserveFixedTaskSlot(task: SchedulerStudyTask, freeSlots: FreeSlot[]) {
  if (!task.plannedStartTime || !task.plannedEndTime) {
    return null;
  }

  const fixedSlot = {
    start: toMinutes(task.plannedStartTime),
    end: toMinutes(task.plannedEndTime),
  };
  if (fixedSlot.end - fixedSlot.start < MIN_TASK_MINUTES) {
    return null;
  }

  const slotIndex = freeSlots.findIndex((slot) => slot.start <= fixedSlot.start && fixedSlot.end <= slot.end);
  if (slotIndex === -1) {
    return null;
  }

  const nextFreeSlots = [
    ...freeSlots.slice(0, slotIndex),
    ...splitSlotAround(freeSlots[slotIndex], fixedSlot),
    ...freeSlots.slice(slotIndex + 1),
  ].sort((a, b) => a.start - b.start || a.end - b.end);

  return {
    fixedSlot,
    nextFreeSlots,
  };
}

function fixedTaskSlot(task: SchedulerStudyTask) {
  if (!task.plannedStartTime || !task.plannedEndTime) {
    return null;
  }

  const slot = {
    start: toMinutes(task.plannedStartTime),
    end: toMinutes(task.plannedEndTime),
  };

  return slot.end - slot.start >= MIN_TASK_MINUTES ? slot : null;
}

function planTaskChunks(task: SchedulerStudyTask, freeSlots: FreeSlot[], slotIndex: number, cursor: number, dayEnd: number): TaskPlacement | null {
  const chunks: FreeSlot[] = [];
  let remaining = task.estimatedMinutes;
  let localSlotIndex = slotIndex;
  let localCursor = cursor;

  while (localSlotIndex < freeSlots.length && remaining > 0) {
    const slot = freeSlots[localSlotIndex];
    localCursor = Math.max(localCursor, slot.start);
    const available = slot.end - localCursor;

    if (available <= 0 || (available < MIN_TASK_MINUTES && remaining > available)) {
      localSlotIndex += 1;
      localCursor = freeSlots[localSlotIndex]?.start ?? dayEnd;
      continue;
    }

    let chunkMinutes = Math.min(remaining, available);
    const remainingAfterChunk = remaining - chunkMinutes;

    if (remainingAfterChunk > 0 && remainingAfterChunk < MIN_TASK_MINUTES && chunkMinutes > MIN_TASK_MINUTES) {
      const adjustedChunkMinutes = chunkMinutes - (MIN_TASK_MINUTES - remainingAfterChunk);
      if (adjustedChunkMinutes >= MIN_TASK_MINUTES) {
        chunkMinutes = adjustedChunkMinutes;
      }
    }

    const start = localCursor;
    const end = start + chunkMinutes;
    chunks.push({ start, end });
    remaining -= chunkMinutes;
    localCursor = end;

    if (remaining > 0) {
      localSlotIndex += 1;
      localCursor = freeSlots[localSlotIndex]?.start ?? dayEnd;
    }
  }

  if (remaining > 0 || chunks.length === 0) {
    return null;
  }

  return {
    chunks,
    slotIndex: localSlotIndex,
    cursor: localCursor,
  };
}

function addStudySegments(task: SchedulerStudyTask, placement: TaskPlacement, segments: ScheduleSegment[]) {
  const totalParts = placement.chunks.length;

  placement.chunks.forEach((chunk, index) => {
    segments.push({
      id: totalParts === 1 ? `study-${task.id}` : `study-${task.id}-${index + 1}`,
      kind: "study",
      title: `${task.subjectName ?? "未指定科目"}：${task.title}`,
      detail:
        totalParts === 1
          ? `${taskTypeLabels[task.type]}，優先度 ${task.priority}`
          : `${taskTypeLabels[task.type]}，優先度 ${task.priority}，第 ${index + 1}/${totalParts} 段`,
      startTime: toTime(chunk.start),
      endTime: toTime(chunk.end),
      minutes: chunk.end - chunk.start,
      taskId: task.id,
    });
  });
}

function addFixedTimeStudySegment(task: SchedulerStudyTask, slot: FreeSlot, segments: ScheduleSegment[], conflict = false) {
  segments.push({
    id: `study-${task.id}`,
    kind: "study",
    title: `${task.subjectName ?? "未指定科目"}：${task.title}`,
    detail: conflict
      ? `${taskTypeLabels[task.type]}，優先度 ${task.priority}，指定時間與固定行程衝突，請調整`
      : `${taskTypeLabels[task.type]}，優先度 ${task.priority}，指定時間`,
    startTime: toTime(slot.start),
    endTime: toTime(slot.end),
    minutes: slot.end - slot.start,
    taskId: task.id,
    conflict,
  });
}

function addBreakAfterTask(taskId: string, slot: FreeSlot | undefined, start: number, cursor: number, segments: ScheduleSegment[]) {
  if (!slot || cursor > slot.end || slot.end - cursor < MIN_TASK_MINUTES) {
    return;
  }

  segments.push({
    id: `break-${taskId}`,
    kind: "break",
    title: "休息",
    detail: "任務後保留 10 分鐘休息",
    startTime: toTime(start),
    endTime: toTime(Math.min(cursor, slot.end)),
    minutes: Math.min(BREAK_MINUTES, slot.end - start),
  });
}

export function buildTodaySchedule(input: {
  fixedEvents: SchedulerFixedEvent[];
  studyWindows?: SchedulerStudyWindow[];
  tutoringSessions: SchedulerTutoringSession[];
  tasks: SchedulerStudyTask[];
  dayStart?: string;
  dayEnd?: string;
}) {
  const dayStart = toMinutes(input.dayStart ?? DAY_START);
  const dayEnd = toMinutes(input.dayEnd ?? DAY_END);
  const studyWindows = normalizeStudyWindows(input.studyWindows, dayStart, dayEnd);
  const scheduleStart = studyWindows[0]?.start ?? dayStart;
  const scheduleEnd = studyWindows.at(-1)?.end ?? dayEnd;
  const fixedBlocks: BusyBlock[] = input.fixedEvents.map((event) => {
    const clamped = clampBlock(toMinutes(event.startTime), toMinutes(event.endTime), scheduleStart, scheduleEnd);
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
      scheduleStart,
      scheduleEnd,
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
  let fixedTaskFreeSlots = buildFreeSlotsWithinStudyWindows(busyBlocks, studyWindows).filter(
    (slot) => slot.end - slot.start >= MIN_TASK_MINUTES,
  );
  let freeSlots = reduceLateCapacityForFatigue(fixedTaskFreeSlots, input.tutoringSessions).filter(
    (slot) => slot.end - slot.start >= MIN_TASK_MINUTES,
  );
  const fixedTimeTasks = input.tasks
    .filter((task) => task.plannedStartTime || task.plannedEndTime)
    .sort(
      (a, b) =>
        toMinutes(a.plannedStartTime ?? "00:00") - toMinutes(b.plannedStartTime ?? "00:00") ||
        b.priority - a.priority ||
        b.estimatedMinutes - a.estimatedMinutes,
    );
  const tasks = input.tasks
    .filter((task) => !task.plannedStartTime && !task.plannedEndTime)
    .sort((a, b) => b.priority - a.priority || b.estimatedMinutes - a.estimatedMinutes);
  const studySegments: ScheduleSegment[] = [];
  const unplaced: ScheduleSegment[] = [];
  const availableMinutes = freeSlots.reduce((total, slot) => total + (slot.end - slot.start), 0);

  for (const task of fixedTimeTasks) {
    const reservation = reserveFixedTaskSlot(task, fixedTaskFreeSlots);

    if (!reservation) {
      const slot = fixedTaskSlot(task);
      if (slot) {
        addFixedTimeStudySegment(task, slot, studySegments, true);
      } else {
        unplaced.push({
          id: `unplaced-${task.id}`,
          kind: "unplaced",
          title: `${task.subjectName ?? "未指定科目"}：${task.title}`,
          detail: explainFixedTimeConflict(task),
          minutes: task.estimatedMinutes,
          taskId: task.id,
        });
      }
      continue;
    }

    addFixedTimeStudySegment(task, reservation.fixedSlot, studySegments);
    fixedTaskFreeSlots = reservation.nextFreeSlots;
    freeSlots = subtractSlotFromFreeSlots(freeSlots, reservation.fixedSlot);
  }

  let slotIndex = 0;
  let cursor = freeSlots[0]?.start ?? scheduleStart;

  for (const task of tasks) {
    const placement = planTaskChunks(task, freeSlots, slotIndex, cursor, scheduleEnd);

    if (!placement) {
      const remainingSlots = remainingSlotsFrom(freeSlots, slotIndex, cursor);
      const remainingAvailableMinutes = remainingSlots.reduce((total, slot) => total + Math.max(0, slot.end - slot.start), 0);
      unplaced.push({
        id: `unplaced-${task.id}`,
        kind: "unplaced",
        title: `${task.subjectName ?? "未指定科目"}：${task.title}`,
        detail: explainUnplacedTask(task, remainingSlots, remainingAvailableMinutes),
        minutes: task.estimatedMinutes,
        taskId: task.id,
      });
      continue;
    }

    addStudySegments(task, placement, studySegments);
    slotIndex = placement.slotIndex;
    cursor = placement.cursor + BREAK_MINUTES;

    const slot = freeSlots[slotIndex];
    addBreakAfterTask(task.id, slot, placement.cursor, cursor, studySegments);

    if (!slot || cursor > slot.end) {
      slotIndex += 1;
      cursor = freeSlots[slotIndex]?.start ?? scheduleEnd;
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
    availableMinutes,
    scheduledStudyMinutes: studySegments.reduce(
      (total, segment) => (segment.kind === "study" && !segment.conflict ? total + segment.minutes : total),
      0,
    ),
  };
}
