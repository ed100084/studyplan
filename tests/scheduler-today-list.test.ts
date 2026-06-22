import assert from "node:assert/strict";
import test from "node:test";
import { TaskType } from "@prisma/client";
import { buildTodayList, recommendedDailyStudyMinutes, type TodayListTask } from "../lib/scheduler/today-list";

function task(overrides: Partial<TodayListTask> & Pick<TodayListTask, "id">): TodayListTask {
  return {
    title: overrides.id,
    subjectName: "Math",
    type: TaskType.PRACTICE,
    estimatedMinutes: 30,
    priority: 3,
    ...overrides,
  };
}

test("selects a priority-ordered today list within available minutes", () => {
  const result = buildTodayList({
    todayDate: "2026-06-22",
    availableMinutes: 120,
    timeZone: "Asia/Taipei",
    tasks: [
      task({ id: "regular", estimatedMinutes: 50, priority: 3 }),
      task({ id: "weak-subject", type: TaskType.WEAK_POINT, estimatedMinutes: 70, priority: 5 }),
      task({ id: "large-review", estimatedMinutes: 60, priority: 4 }),
    ],
  });

  assert.deepEqual(
    result.todayList.map((item) => item.id),
    ["weak-subject", "regular"],
  );
  assert.equal(result.selectedMinutes, 120);
  assert.equal(result.selectedMinutes <= result.availableMinutes, true);
  assert.deepEqual(result.backlog, { count: 1, minutes: 60 });
});

test("moves overdue tasks up when priorities are tied", () => {
  const result = buildTodayList({
    todayDate: "2026-06-22",
    availableMinutes: 90,
    timeZone: "Asia/Taipei",
    tasks: [
      task({ id: "current-week", estimatedMinutes: 30, priority: 4, weekHint: 26 }),
      task({ id: "two-weeks-late", estimatedMinutes: 30, priority: 4, weekHint: 24 }),
      task({ id: "one-week-late", estimatedMinutes: 30, priority: 4, weekHint: 25 }),
    ],
  });

  assert.deepEqual(
    result.todayList.map((item) => [item.id, item.overdueWeeks]),
    [
      ["two-weeks-late", 2],
      ["one-week-late", 1],
      ["current-week", 0],
    ],
  );
});

test("keeps remaining tasks in the backlog summary", () => {
  const result = buildTodayList({
    todayDate: "2026-06-22",
    availableMinutes: 45,
    timeZone: "Asia/Taipei",
    tasks: [
      task({ id: "first", estimatedMinutes: 30, priority: 5 }),
      task({ id: "second", estimatedMinutes: 30, priority: 4 }),
      task({ id: "third", estimatedMinutes: 20, priority: 3 }),
    ],
  });

  assert.deepEqual(
    result.todayList.map((item) => item.id),
    ["first"],
  );
  assert.equal(result.selectedMinutes, 30);
  assert.deepEqual(result.backlog, { count: 2, minutes: 50 });
});

test("recommends daily study limits by grade", () => {
  assert.equal(recommendedDailyStudyMinutes(7), 90);
  assert.equal(recommendedDailyStudyMinutes(8), 120);
  assert.equal(recommendedDailyStudyMinutes(9), 180);
});
