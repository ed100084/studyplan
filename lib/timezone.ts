import { cookies } from "next/headers";
import { Weekday } from "@prisma/client";
import { DEFAULT_TIME_ZONE, TIME_ZONE_COOKIE } from "@/lib/timezone-constants";

export { DEFAULT_TIME_ZONE, TIME_ZONE_COOKIE };

export const orderedWeekdays: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const weekdayByEnglish: Record<string, Weekday> = {
  Monday: "MONDAY",
  Tuesday: "TUESDAY",
  Wednesday: "WEDNESDAY",
  Thursday: "THURSDAY",
  Friday: "FRIDAY",
  Saturday: "SATURDAY",
  Sunday: "SUNDAY",
};

function isSupportedTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(timeZone?: string | null) {
  if (!timeZone) {
    return DEFAULT_TIME_ZONE;
  }

  return isSupportedTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

export async function getRequestTimeZone() {
  const cookieStore = await cookies();
  return normalizeTimeZone(cookieStore.get(TIME_ZONE_COOKIE)?.value);
}

export function formatDateInput(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function partsFromDate(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour") === 24 ? 0 : value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function offsetMillisAt(date: Date, timeZone: string) {
  const parts = partsFromDate(date, timeZone);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return localAsUtc - date.getTime();
}

export function zonedDateStart(dateValue: string, timeZone: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let utcValue = targetUtc;

  for (let index = 0; index < 2; index += 1) {
    utcValue = targetUtc - offsetMillisAt(new Date(utcValue), normalizeTimeZone(timeZone));
  }

  return new Date(utcValue);
}

function addCalendarDays(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function weekdayForDate(dateValue: string, timeZone: string) {
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeTimeZone(timeZone),
    weekday: "long",
  }).format(zonedDateStart(dateValue, timeZone));

  return weekdayByEnglish[weekdayName] ?? Weekday.MONDAY;
}

export function getCurrentDay(timeZone: string) {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const now = new Date();
  const date = formatDateInput(now, normalizedTimeZone);

  return {
    date,
    weekday: weekdayForDate(date, normalizedTimeZone),
  };
}

export function getDayRange(date: string, timeZone: string) {
  return {
    start: zonedDateStart(date, timeZone),
    end: zonedDateStart(addCalendarDays(date, 1), timeZone),
  };
}

export function getWeek(date: string, timeZone: string) {
  const weekday = weekdayForDate(date, timeZone);
  const weekdayIndex = orderedWeekdays.indexOf(weekday);
  const startDate = addCalendarDays(date, -weekdayIndex);
  const days = orderedWeekdays.map((dayWeekday, index) => {
    const dateValue = addCalendarDays(startDate, index);

    return {
      date: dateValue,
      dayNumber: dateValue.slice(5),
      weekday: dayWeekday,
      isToday: dateValue === date,
    };
  });
  const endDate = addCalendarDays(startDate, 7);

  return {
    days,
    start: zonedDateStart(startDate, timeZone),
    end: zonedDateStart(endDate, timeZone),
  };
}

export function getMonth(date: string, timeZone: string) {
  const [year, month] = date.split("-").map(Number);
  const monthValue = String(month).padStart(2, "0");
  const monthLabel = `${year}-${monthValue}`;
  const startDate = `${monthLabel}-01`;
  const nextMonthDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const dayNumber = String(index + 1).padStart(2, "0");
    const dateValue = `${monthLabel}-${dayNumber}`;
    const weekday = weekdayForDate(dateValue, timeZone);

    return {
      date: dateValue,
      dayNumber,
      weekday,
      isToday: dateValue === date,
    };
  });
  const leadingBlankCount = orderedWeekdays.indexOf(days[0]?.weekday ?? Weekday.MONDAY);

  return {
    days,
    start: zonedDateStart(startDate, timeZone),
    end: zonedDateStart(nextMonthDate, timeZone),
    monthLabel,
    leadingBlankCount,
  };
}
