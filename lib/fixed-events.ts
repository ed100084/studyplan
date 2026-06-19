import type { Weekday } from "@prisma/client";
import { formatDateInput } from "@/lib/timezone";

export type DateBoundedFixedEvent = {
  weekday: Weekday;
  startDate: Date | null;
  endDate: Date | null;
};

export type StringBoundedFixedEvent = {
  weekday: Weekday;
  startDate?: string | null;
  endDate?: string | null;
};

export function fixedEventFallsOnDate(event: DateBoundedFixedEvent, date: string, timeZone: string) {
  const startDate = event.startDate ? formatDateInput(event.startDate, timeZone) : null;
  const endDate = event.endDate ? formatDateInput(event.endDate, timeZone) : null;

  return (!startDate || startDate <= date) && (!endDate || date <= endDate);
}

export function stringFixedEventFallsOnDate(event: StringBoundedFixedEvent, date: string) {
  return (!event.startDate || event.startDate <= date) && (!event.endDate || date <= event.endDate);
}

export function fixedEventDateLabel(event: DateBoundedFixedEvent, timeZone: string) {
  const startDate = event.startDate ? formatDateInput(event.startDate, timeZone) : "";
  const endDate = event.endDate ? formatDateInput(event.endDate, timeZone) : "";

  if (startDate && endDate) return `${startDate} - ${endDate}`;
  if (startDate) return `${startDate} 起`;
  if (endDate) return `到 ${endDate}`;
  return "長期";
}
