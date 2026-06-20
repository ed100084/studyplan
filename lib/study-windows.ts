import type { Weekday } from "@prisma/client";
import { formatDateInput } from "@/lib/timezone";

export type DateBoundedStudyWindow = {
  weekday: Weekday;
  startDate: Date | null;
  endDate: Date | null;
};

export type StringBoundedStudyWindow = {
  weekday: Weekday;
  startDate?: string | null;
  endDate?: string | null;
};

export function studyWindowFallsOnDate(window: DateBoundedStudyWindow, date: string, timeZone: string) {
  const startDate = window.startDate ? formatDateInput(window.startDate, timeZone) : null;
  const endDate = window.endDate ? formatDateInput(window.endDate, timeZone) : null;

  return (!startDate || startDate <= date) && (!endDate || date <= endDate);
}

export function stringStudyWindowFallsOnDate(window: StringBoundedStudyWindow, date: string) {
  return (!window.startDate || window.startDate <= date) && (!window.endDate || date <= window.endDate);
}

export function studyWindowDateLabel(window: DateBoundedStudyWindow, timeZone: string) {
  const startDate = window.startDate ? formatDateInput(window.startDate, timeZone) : "";
  const endDate = window.endDate ? formatDateInput(window.endDate, timeZone) : "";

  if (startDate && endDate) return `${startDate} 到 ${endDate}`;
  if (startDate) return `${startDate} 起`;
  if (endDate) return `到 ${endDate}`;
  return "不限期間";
}
