import assert from "node:assert/strict";
import test from "node:test";
import { buildIcsCalendar } from "../lib/calendar-ics";

test("builds all-day study task events for calendar import", () => {
  const ics = buildIcsCalendar({
    calendarName: "StudyPlan Test",
    now: new Date("2026-06-22T00:00:00.000Z"),
    events: [
      {
        uid: "task-1@studyplan",
        title: "地理：臺灣人口-產業-都市",
        date: "2026-08-02",
        description: "複習｜60 分鐘｜優先度 5",
      },
    ],
  });

  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /SUMMARY:地理：臺灣人口-產業-都市/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260802/);
  assert.match(ics, /DTEND;VALUE=DATE:20260803/);
  assert.match(ics, /DESCRIPTION:複習｜60 分鐘｜優先度 5/);
});

test("builds timed tutoring events without forcing study task times", () => {
  const ics = buildIcsCalendar({
    calendarName: "StudyPlan Test",
    now: new Date("2026-06-22T00:00:00.000Z"),
    events: [
      {
        uid: "tutoring-1@studyplan",
        title: "數學補習",
        date: "2026-08-02",
        startTime: "18:30",
        endTime: "20:30",
      },
    ],
  });

  assert.match(ics, /SUMMARY:數學補習/);
  assert.match(ics, /DTSTART:20260802T183000/);
  assert.match(ics, /DTEND:20260802T203000/);
});

test("escapes iCalendar text characters", () => {
  const ics = buildIcsCalendar({
    calendarName: "StudyPlan, Test",
    now: new Date("2026-06-22T00:00:00.000Z"),
    events: [
      {
        uid: "task-2@studyplan",
        title: "地理,歷史;公民",
        date: "2026-08-02",
        description: "第一行\n第二行",
      },
    ],
  });

  assert.match(ics, /X-WR-CALNAME:StudyPlan\\, Test/);
  assert.match(ics, /SUMMARY:地理\\,歷史\\;公民/);
  assert.match(ics, /DESCRIPTION:第一行\\n第二行/);
});
