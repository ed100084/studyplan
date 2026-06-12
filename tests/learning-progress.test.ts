import assert from "node:assert/strict";
import test from "node:test";
import { TaskStatus } from "@prisma/client";
import { averageScore, buildWeeklyProgress } from "../lib/learning-progress";

test("buildWeeklyProgress credits completed and partial tasks", () => {
  const result = buildWeeklyProgress([
    { status: TaskStatus.DONE, estimatedMinutes: 40 },
    { status: TaskStatus.PARTIAL, estimatedMinutes: 30 },
    { status: TaskStatus.PLANNED, estimatedMinutes: 20 },
    { status: TaskStatus.SKIPPED, estimatedMinutes: 10 },
  ]);

  assert.deepEqual(result, {
    actionableTasks: 4,
    completedTasks: 1,
    partialTasks: 1,
    completionRate: 38,
    plannedMinutes: 100,
    creditedMinutes: 55,
  });
});

test("buildWeeklyProgress excludes rescheduled task copies", () => {
  const result = buildWeeklyProgress([
    { status: TaskStatus.RESCHEDULED, estimatedMinutes: 30 },
    { status: TaskStatus.DONE, estimatedMinutes: 30 },
  ]);

  assert.equal(result.actionableTasks, 1);
  assert.equal(result.completionRate, 100);
  assert.equal(result.plannedMinutes, 30);
});

test("buildWeeklyProgress handles an empty week", () => {
  assert.deepEqual(buildWeeklyProgress([]), {
    actionableTasks: 0,
    completedTasks: 0,
    partialTasks: 0,
    completionRate: 0,
    plannedMinutes: 0,
    creditedMinutes: 0,
  });
});

test("averageScore returns a one-decimal average", () => {
  assert.equal(averageScore([{ value: 80 }, { value: 91 }, { value: 88 }]), 86.3);
  assert.equal(averageScore([]), null);
});
