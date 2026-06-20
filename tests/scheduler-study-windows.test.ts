import assert from "node:assert/strict";
import test from "node:test";
import { FixedEventType, TaskType } from "@prisma/client";
import { buildTodaySchedule } from "../lib/scheduler/today";

function fixedEvent(id: string, type: FixedEventType, startTime: string, endTime: string) {
  return {
    id,
    title: id,
    type,
    startTime,
    endTime,
    commuteMinutes: 0,
  };
}

function fixedTask(id: string, startTime: string, endTime: string) {
  return {
    id,
    title: id,
    subjectName: "Math",
    type: TaskType.PRACTICE,
    plannedStartTime: startTime,
    plannedEndTime: endTime,
    estimatedMinutes: 60,
    priority: 4,
  };
}

function autoTask(id: string, estimatedMinutes = 60, priority = 4) {
  return {
    id,
    title: id,
    subjectName: "Math",
    type: TaskType.PRACTICE,
    estimatedMinutes,
    priority,
  };
}

function studySegment(schedule: ReturnType<typeof buildTodaySchedule>, taskId: string) {
  return schedule.scheduled.find((segment) => segment.kind === "study" && segment.taskId === taskId);
}

function studySegments(schedule: ReturnType<typeof buildTodaySchedule>, taskId: string) {
  return schedule.scheduled.filter((segment) => segment.kind === "study" && segment.taskId === taskId);
}

test("defaults to the full 07:00 to 22:30 scheduling boundary when no study window is configured", () => {
  const schedule = buildTodaySchedule({
    fixedEvents: [],
    tutoringSessions: [],
    tasks: [],
  });

  assert.equal(schedule.availableMinutes, 930);
});

test("schedules automatic tasks inside configured daytime study windows", () => {
  const schedule = buildTodaySchedule({
    studyWindows: [
      {
        id: "summer-morning",
        title: "Summer morning",
        startTime: "09:00",
        endTime: "12:00",
      },
    ],
    fixedEvents: [fixedEvent("breakfast", FixedEventType.MEAL, "09:00", "10:00")],
    tutoringSessions: [],
    tasks: [autoTask("math")],
  });

  const segment = studySegment(schedule, "math");
  assert.equal(schedule.availableMinutes, 120);
  assert.equal(segment?.startTime, "10:00");
  assert.equal(segment?.endTime, "11:00");
  assert.equal(segment?.conflict, undefined);
});

test("A: fixed-time daytime tasks are scheduled when only evening busy blocks exist and no study window is configured", () => {
  const schedule = buildTodaySchedule({
    fixedEvents: [
      fixedEvent("dinner", FixedEventType.MEAL, "17:30", "18:30"),
      fixedEvent("shower", FixedEventType.HYGIENE, "21:00", "21:30"),
    ],
    tutoringSessions: [],
    tasks: [fixedTask("afternoon-1", "13:30", "14:30"), fixedTask("afternoon-2", "15:00", "16:00")],
  });

  const first = studySegment(schedule, "afternoon-1");
  const second = studySegment(schedule, "afternoon-2");
  assert.equal(first?.startTime, "13:30");
  assert.equal(first?.endTime, "14:30");
  assert.equal(first?.conflict, false);
  assert.doesNotMatch(first?.detail ?? "", /衝突/);
  assert.equal(second?.startTime, "15:00");
  assert.equal(second?.endTime, "16:00");
  assert.equal(second?.conflict, false);
  assert.equal(schedule.unplaced.length, 0);
  assert.equal(schedule.scheduledStudyMinutes, 120);
});

test("B: fixed-time tasks overlapping a fixed event are marked as conflicts", () => {
  const schedule = buildTodaySchedule({
    fixedEvents: [
      fixedEvent("dinner", FixedEventType.MEAL, "17:30", "18:30"),
      fixedEvent("shower", FixedEventType.HYGIENE, "21:00", "21:30"),
    ],
    tutoringSessions: [],
    tasks: [fixedTask("during-dinner", "17:45", "18:15")],
  });

  const conflict = studySegment(schedule, "during-dinner");
  assert.equal(conflict?.startTime, "17:45");
  assert.equal(conflict?.endTime, "18:15");
  assert.equal(conflict?.conflict, true);
  assert.match(conflict?.detail ?? "", /固定行程衝突/);
  assert.equal(schedule.scheduledStudyMinutes, 0);
});

test("C: morning summer school blocks only overlapping fixed-time tasks when no study window is configured", () => {
  const schedule = buildTodaySchedule({
    fixedEvents: [fixedEvent("summer-school", FixedEventType.SCHOOL, "07:30", "12:00")],
    tutoringSessions: [],
    tasks: [fixedTask("afternoon-study", "13:30", "14:30"), fixedTask("during-school", "08:00", "09:00")],
  });

  const afternoon = studySegment(schedule, "afternoon-study");
  const duringSchool = studySegment(schedule, "during-school");
  assert.equal(afternoon?.startTime, "13:30");
  assert.equal(afternoon?.conflict, false);
  assert.equal(duringSchool?.startTime, "08:00");
  assert.equal(duringSchool?.conflict, true);
  assert.equal(schedule.scheduledStudyMinutes, 60);
});

test("D: configured study windows still restrict fixed-time tasks outside the window", () => {
  const schedule = buildTodaySchedule({
    studyWindows: [
      {
        id: "evening",
        title: "Evening",
        startTime: "18:00",
        endTime: "22:00",
      },
    ],
    fixedEvents: [],
    tutoringSessions: [],
    tasks: [fixedTask("outside-window", "14:00", "15:00")],
  });

  const outsideWindow = studySegment(schedule, "outside-window");
  assert.equal(outsideWindow?.startTime, "14:00");
  assert.equal(outsideWindow?.endTime, "15:00");
  assert.equal(outsideWindow?.conflict, true);
  assert.match(outsideWindow?.detail ?? "", /不在設定的可讀書時段內/);
  assert.equal(schedule.scheduledStudyMinutes, 0);
});

test("E: automatic scheduling still fills available study-window slots around busy blocks", () => {
  const schedule = buildTodaySchedule({
    studyWindows: [
      {
        id: "evening",
        title: "Evening",
        startTime: "18:00",
        endTime: "20:30",
      },
    ],
    fixedEvents: [fixedEvent("dinner", FixedEventType.MEAL, "18:30", "19:00")],
    tutoringSessions: [],
    tasks: [autoTask("review", 60, 5), autoTask("practice", 30, 3)],
  });

  const review = studySegments(schedule, "review");
  const practice = studySegment(schedule, "practice");
  assert.equal(schedule.availableMinutes, 120);
  assert.deepEqual(
    review.map((segment) => [segment.startTime, segment.endTime]),
    [
      ["18:00", "18:30"],
      ["19:00", "19:30"],
    ],
  );
  assert.equal(practice?.startTime, "19:40");
  assert.equal(practice?.endTime, "20:10");
  assert.equal(schedule.scheduledStudyMinutes, 90);
});

test("shows fixed-time study task conflicts alongside fixed routine blocks", () => {
  const schedule = buildTodaySchedule({
    fixedEvents: [fixedEvent("shower", FixedEventType.HYGIENE, "21:00", "21:30")],
    tutoringSessions: [],
    tasks: [fixedTask("english", "21:00", "21:30")],
  });

  const conflictingStudy = studySegment(schedule, "english");
  assert.ok(schedule.scheduled.some((segment) => segment.kind === "fixed" && segment.title === "shower"));
  assert.equal(conflictingStudy?.startTime, "21:00");
  assert.equal(conflictingStudy?.endTime, "21:30");
  assert.equal(conflictingStudy?.conflict, true);
  assert.equal(schedule.scheduledStudyMinutes, 0);
});

test("does not mark fixed-time tasks as conflicts only because fatigue reduced automatic capacity", () => {
  const schedule = buildTodaySchedule({
    fixedEvents: [],
    tutoringSessions: [
      {
        id: "math-class",
        subjectName: "Math",
        startTime: "18:00",
        endTime: "19:00",
        commuteMinutes: 0,
        fatigueLevel: "HIGH",
        hasHomework: false,
      },
    ],
    tasks: [fixedTask("science", "22:00", "22:30")],
  });

  const fixedStudy = studySegment(schedule, "science");
  assert.equal(fixedStudy?.startTime, "22:00");
  assert.equal(fixedStudy?.endTime, "22:30");
  assert.equal(fixedStudy?.conflict, false);
  assert.equal(schedule.scheduledStudyMinutes, 30);
});
