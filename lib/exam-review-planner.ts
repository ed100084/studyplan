import { CalendarEventType, FatigueLevel, FixedEventType, Weekday } from "@prisma/client";
import { buildTodaySchedule } from "./scheduler/today";
import { stringFixedEventFallsOnDate } from "./fixed-events";
import { stringTutoringSessionFallsOnDate } from "./tutoring-sessions";

type FixedEventInput = {
  id: string;
  title: string;
  type: FixedEventType;
  weekday: Weekday;
  startDate?: string | null;
  endDate?: string | null;
  startTime: string;
  endTime: string;
  commuteMinutes: number;
};

type TutoringSessionInput = {
  id: string;
  subjectName: string;
  weekday: Weekday;
  startDate?: string | null;
  endDate?: string | null;
  startTime: string;
  endTime: string;
  commuteMinutes: number;
  fatigueLevel: FatigueLevel;
  hasHomework: boolean;
};

type CalendarEventInput = {
  id: string;
  type: CalendarEventType;
  startDate: string;
  endDate: string | null;
};

export type ExamReviewTaskDraft = {
  plannedDate: string;
  estimatedMinutes: number;
  sequence: number;
};

const weekdayByIndex: Weekday[] = [
  Weekday.SUNDAY,
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
];

function addDays(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function weekdayForDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return weekdayByIndex[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function eventFallsOnDate(event: CalendarEventInput, date: string) {
  const endDate = event.endDate ?? event.startDate;
  return event.startDate <= date && date <= endDate;
}

function roundUpFive(minutes: number) {
  return Math.ceil(minutes / 5) * 5;
}

function splitDailyMinutes(minutes: number, sessionMinutes: number) {
  const chunks: number[] = [];
  let remaining = minutes;

  while (remaining > 0) {
    if (remaining <= sessionMinutes || remaining - sessionMinutes < 10) {
      chunks.push(remaining);
      break;
    }

    chunks.push(sessionMinutes);
    remaining -= sessionMinutes;
  }

  return chunks;
}

export function buildExamReviewTaskDrafts(input: {
  startDate: string;
  examDate: string;
  remainingMinutes: number;
  sessionMinutes: number;
  fixedEvents: FixedEventInput[];
  tutoringSessions: TutoringSessionInput[];
  calendarEvents: CalendarEventInput[];
}) {
  const availableDays: Array<{ date: string; limit: number }> = [];

  for (let date = input.startDate; date < input.examDate; date = addDays(date, 1)) {
    const isBlockedBySchoolEvent = input.calendarEvents.some(
      (event) => event.type === CalendarEventType.SCHOOL_EVENT && eventFallsOnDate(event, date),
    );
    if (isBlockedBySchoolEvent) continue;

    const weekday = weekdayForDate(date);
    const schedule = buildTodaySchedule({
      fixedEvents: input.fixedEvents.filter((event) => event.weekday === weekday && stringFixedEventFallsOnDate(event, date)),
      tutoringSessions: input.tutoringSessions.filter(
        (session) => session.weekday === weekday && stringTutoringSessionFallsOnDate(session, date),
      ),
      tasks: [],
    });
    const dailyLimit = Math.min(schedule.availableMinutes, Math.max(120, input.sessionMinutes));
    if (dailyLimit >= 10) {
      availableDays.push({ date, limit: dailyLimit });
    }
  }

  let remaining = Math.max(0, input.remainingMinutes);
  let sequence = 1;
  const tasks: ExamReviewTaskDraft[] = [];

  availableDays.forEach((day, index) => {
    if (remaining <= 0) return;

    const daysLeft = availableDays.length - index;
    const target = Math.min(day.limit, remaining, Math.max(10, roundUpFive(remaining / daysLeft)));
    splitDailyMinutes(target, input.sessionMinutes).forEach((estimatedMinutes) => {
      tasks.push({ plannedDate: day.date, estimatedMinutes, sequence });
      sequence += 1;
    });
    remaining -= target;
  });

  const lastTask = tasks.at(-1);
  const previousTask = tasks.at(-2);
  if (lastTask && previousTask && lastTask.estimatedMinutes < 10) {
    previousTask.estimatedMinutes += lastTask.estimatedMinutes;
    tasks.pop();
  }

  return {
    tasks,
    scheduledMinutes: input.remainingMinutes - remaining,
    unscheduledMinutes: remaining,
    availableDayCount: availableDays.length,
  };
}
