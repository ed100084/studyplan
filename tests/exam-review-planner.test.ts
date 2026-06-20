import assert from "node:assert/strict";
import test from "node:test";
import { CalendarEventType, FatigueLevel, FixedEventType, Weekday } from "@prisma/client";
import { buildExamReviewTaskDrafts } from "../lib/exam-review-planner";
import { classCalendarImportRowKey, validateClassCalendarImportRows } from "../lib/class-calendar-import";

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
        startTime: "07:00",
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

test("counts tutoring sessions only inside their active date range", () => {
  const inactiveResult = buildExamReviewTaskDrafts({
    startDate: "2026-06-12",
    examDate: "2026-06-13",
    remainingMinutes: 60,
    sessionMinutes: 30,
    fixedEvents: [],
    tutoringSessions: [
      {
        id: "summer-math",
        subjectName: "數學",
        weekday: Weekday.FRIDAY,
        startDate: "2026-07-01",
        endDate: "2026-08-31",
        startTime: "07:00",
        endTime: "22:30",
        commuteMinutes: 0,
        fatigueLevel: FatigueLevel.NORMAL,
        hasHomework: false,
      },
    ],
    calendarEvents: [],
  });
  const activeResult = buildExamReviewTaskDrafts({
    startDate: "2026-06-12",
    examDate: "2026-06-13",
    remainingMinutes: 60,
    sessionMinutes: 30,
    fixedEvents: [],
    tutoringSessions: [
      {
        id: "june-math",
        subjectName: "數學",
        weekday: Weekday.FRIDAY,
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        startTime: "07:00",
        endTime: "22:30",
        commuteMinutes: 0,
        fatigueLevel: FatigueLevel.NORMAL,
        hasHomework: false,
      },
    ],
    calendarEvents: [],
  });

  assert.equal(inactiveResult.scheduledMinutes, 60);
  assert.equal(inactiveResult.unscheduledMinutes, 0);
  assert.equal(activeResult.scheduledMinutes, 0);
  assert.equal(activeResult.unscheduledMinutes, 60);
});

test("counts fixed events only inside their active date range", () => {
  const inactiveResult = buildExamReviewTaskDrafts({
    startDate: "2026-06-12",
    examDate: "2026-06-13",
    remainingMinutes: 60,
    sessionMinutes: 30,
    fixedEvents: [
      {
        id: "summer-school",
        title: "summer school",
        type: FixedEventType.SCHOOL,
        weekday: Weekday.FRIDAY,
        startDate: "2026-07-01",
        endDate: "2026-08-31",
        startTime: "07:00",
        endTime: "22:30",
        commuteMinutes: 0,
      },
    ],
    tutoringSessions: [],
    calendarEvents: [],
  });
  const activeResult = buildExamReviewTaskDrafts({
    startDate: "2026-06-12",
    examDate: "2026-06-13",
    remainingMinutes: 60,
    sessionMinutes: 30,
    fixedEvents: [
      {
        id: "june-school",
        title: "june school",
        type: FixedEventType.SCHOOL,
        weekday: Weekday.FRIDAY,
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        startTime: "07:00",
        endTime: "22:30",
        commuteMinutes: 0,
      },
    ],
    tutoringSessions: [],
    calendarEvents: [],
  });

  assert.equal(inactiveResult.scheduledMinutes, 60);
  assert.equal(inactiveResult.unscheduledMinutes, 0);
  assert.equal(activeResult.scheduledMinutes, 0);
  assert.equal(activeResult.unscheduledMinutes, 60);
});

test("validates serialized class calendar rows before confirmation", () => {
  const result = validateClassCalendarImportRows([
    {
      type: CalendarEventType.SECTION_EXAM,
      title: "第一次段考",
      subjectName: "數學",
      startDate: "2026-06-18",
      endDate: "2026-06-19",
      note: "第一冊",
      duplicate: false,
    },
  ]);

  assert.deepEqual(result.issues, []);
  assert.equal(result.rows.length, 1);
  assert.equal(classCalendarImportRowKey(result.rows[0]), "SECTION_EXAM|第一次段考|數學|2026-06-18|2026-06-19|第一冊");
});

test("rejects duplicate and invalid serialized class calendar rows", () => {
  const row = {
    type: CalendarEventType.SCHOOL_EVENT,
    title: "校慶",
    subjectName: null,
    startDate: "2026-06-20",
    endDate: null,
    note: null,
  };
  const duplicateResult = validateClassCalendarImportRows([row, row]);
  const invalidResult = validateClassCalendarImportRows([{ ...row, startDate: "2026-02-30" }]);

  assert.ok(duplicateResult.issues.some((issue) => issue.includes("重複")));
  assert.ok(invalidResult.issues.some((issue) => issue.includes("開始日期格式無效")));
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
