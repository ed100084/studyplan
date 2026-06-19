import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_TIME_ZONE, getDayRange, getMonth, normalizeTimeZone } from "../lib/timezone";

test("server timezone fallback is Asia/Taipei", () => {
  assert.equal(DEFAULT_TIME_ZONE, "Asia/Taipei");
  assert.equal(normalizeTimeZone(undefined), "Asia/Taipei");
  assert.equal(normalizeTimeZone("not-a-time-zone"), "Asia/Taipei");
});

test("Asia/Taipei day range keeps local evening on the same date", () => {
  const range = getDayRange("2026-06-19", "Asia/Taipei");
  const localEightPm = new Date("2026-06-19T12:00:00.000Z");

  assert.equal(range.start.toISOString(), "2026-06-18T16:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-06-19T16:00:00.000Z");
  assert.equal(localEightPm >= range.start && localEightPm < range.end, true);
});

test("month grid starts on Sunday", () => {
  const month = getMonth("2026-06-19", "Asia/Taipei");

  assert.equal(month.monthLabel, "2026-06");
  assert.equal(month.days[0].weekday, "MONDAY");
  assert.equal(month.leadingBlankCount, 1);
});
