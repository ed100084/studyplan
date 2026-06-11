import assert from "node:assert/strict";
import test from "node:test";
import { CalendarEventType, FixedEventType, Weekday } from "@prisma/client";
import { buildExamReviewTaskDrafts } from "../lib/exam-review-planner";

test("distributes all minutes before the exam and skips school events", () => {
  const result = buildExamReviewTaskDrafts({
    startDate: "2026-06-12",
    examDate: "2026-06-19",
    remainingMinutes: 300,
    sessionMinutes: 30,
    fixedEvents: [],
    tutoringSessions: [],
    calendarEvents: [
      {
        id: "school-event",
        type: CalendarEventType.SCHOOL_EVENT,
        startDate: "2026-06-15",
        endDate: null,
      },
    ],
  });

  assert.equal(result.scheduledMinutes, 300);
  assert.equal(result.unscheduledMinutes, 0);
  assert.ok(result.tasks.every((task) => task.plannedDate < "2026-06-19"));
  assert.ok(result.tasks.every((task) => task.plannedDate !== "2026-06-15"));
  assert.ok(result.tasks.every((task) => task.estimatedMinutes >= 10));
});

test("reports unallocated minutes when recurring events consume the whole day", () => {
  const result = buildExamReviewTaskDrafts({
    startDate: "2026-06-12",
    examDate: "2026-06-13",
    remainingMinutes: 60,
    sessionMinutes: 30,
    fixedEvents: [
      {
        id: "blocked",
        title: "整晚家庭活動",
        type: FixedEventType.FAMILY,
        weekday: Weekday.FRIDAY,
        startTime: "17:30",
        endTime: "22:30",
        commuteMinutes: 0,
      },
    ],
    tutoringSessions: [],
    calendarEvents: [],
  });

  assert.deepEqual(result.tasks, []);
  assert.equal(result.scheduledMinutes, 0);
  assert.equal(result.unscheduledMinutes, 60);
});

test("never leaves a generated task shorter than ten minutes", () => {
  const result = buildExamReviewTaskDrafts({
    startDate: "2026-06-12",
    examDate: "2026-06-16",
    remainingMinutes: 35,
    sessionMinutes: 30,
    fixedEvents: [],
    tutoringSessions: [],
    calendarEvents: [],
  });

  assert.equal(result.tasks.reduce((total, task) => total + task.estimatedMinutes, 0), 35);
  assert.ok(result.tasks.every((task) => task.estimatedMinutes >= 10));
});
