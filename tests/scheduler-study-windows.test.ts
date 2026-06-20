import assert from "node:assert/strict";
import test from "node:test";
import { FixedEventType, TaskType } from "@prisma/client";
import { buildTodaySchedule } from "../lib/scheduler/today";

test("defaults to a 17:30 to 23:30 study window when none is configured", () => {
  const schedule = buildTodaySchedule({
    fixedEvents: [],
    tutoringSessions: [],
    tasks: [],
  });

  assert.equal(schedule.availableMinutes, 360);
});

test("schedules tasks inside configured daytime study windows", () => {
  const schedule = buildTodaySchedule({
    studyWindows: [
      {
        id: "summer-morning",
        title: "暑假上午",
        startTime: "09:00",
        endTime: "12:00",
      },
    ],
    fixedEvents: [
      {
        id: "breakfast",
        title: "早餐",
        type: FixedEventType.MEAL,
        startTime: "09:00",
        endTime: "10:00",
        commuteMinutes: 0,
      },
    ],
    tutoringSessions: [],
    tasks: [
      {
        id: "math",
        title: "練習題",
        subjectName: "數學",
        type: TaskType.PRACTICE,
        estimatedMinutes: 60,
        priority: 4,
      },
    ],
  });

  const studySegment = schedule.scheduled.find((segment) => segment.kind === "study");
  assert.equal(schedule.availableMinutes, 120);
  assert.equal(studySegment?.startTime, "10:00");
  assert.equal(studySegment?.endTime, "11:00");
});

test("shows fixed-time study task conflicts alongside fixed routine blocks", () => {
  const schedule = buildTodaySchedule({
    fixedEvents: [
      {
        id: "shower",
        title: "洗澡",
        type: FixedEventType.HYGIENE,
        startTime: "21:00",
        endTime: "21:30",
        commuteMinutes: 0,
      },
    ],
    tutoringSessions: [],
    tasks: [
      {
        id: "english",
        title: "英文閱讀",
        subjectName: "英文",
        type: TaskType.REVIEW,
        plannedStartTime: "21:00",
        plannedEndTime: "21:30",
        estimatedMinutes: 30,
        priority: 4,
      },
    ],
  });

  const conflictingStudy = schedule.scheduled.find((segment) => segment.kind === "study" && segment.taskId === "english");
  assert.ok(schedule.scheduled.some((segment) => segment.kind === "fixed" && segment.title === "洗澡"));
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
        subjectName: "數學",
        startTime: "18:00",
        endTime: "19:00",
        commuteMinutes: 0,
        fatigueLevel: "HIGH",
        hasHomework: false,
      },
    ],
    tasks: [
      {
        id: "science",
        title: "自然整理",
        subjectName: "自然",
        type: TaskType.REVIEW,
        plannedStartTime: "22:00",
        plannedEndTime: "22:30",
        estimatedMinutes: 30,
        priority: 3,
      },
    ],
  });

  const fixedStudy = schedule.scheduled.find((segment) => segment.kind === "study" && segment.taskId === "science");
  assert.equal(fixedStudy?.startTime, "22:00");
  assert.equal(fixedStudy?.endTime, "22:30");
  assert.equal(fixedStudy?.conflict, false);
  assert.equal(schedule.scheduledStudyMinutes, 30);
});
