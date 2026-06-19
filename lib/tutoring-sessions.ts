import type { Weekday } from "@prisma/client";
import { formatDateInput } from "@/lib/timezone";

export type DateBoundedTutoringSession = {
  weekday: Weekday;
  startDate: Date | null;
  endDate: Date | null;
};

export type StringBoundedTutoringSession = {
  weekday: Weekday;
  startDate?: string | null;
  endDate?: string | null;
};

export function tutoringSessionFallsOnDate(session: DateBoundedTutoringSession, date: string, timeZone: string) {
  const startDate = session.startDate ? formatDateInput(session.startDate, timeZone) : null;
  const endDate = session.endDate ? formatDateInput(session.endDate, timeZone) : null;

  return (!startDate || startDate <= date) && (!endDate || date <= endDate);
}

export function stringTutoringSessionFallsOnDate(session: StringBoundedTutoringSession, date: string) {
  return (!session.startDate || session.startDate <= date) && (!session.endDate || date <= session.endDate);
}

export function tutoringSessionDateLabel(session: DateBoundedTutoringSession, timeZone: string) {
  const startDate = session.startDate ? formatDateInput(session.startDate, timeZone) : "";
  const endDate = session.endDate ? formatDateInput(session.endDate, timeZone) : "";

  if (startDate && endDate) return `${startDate} 到 ${endDate}`;
  if (startDate) return `${startDate} 起`;
  if (endDate) return `到 ${endDate}`;
  return "不限期間";
}
