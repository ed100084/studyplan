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
