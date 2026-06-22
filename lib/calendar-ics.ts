export type IcsEvent = {
  uid: string;
  title: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  description?: string | null;
};

function compactDate(date: string) {
  return date.replace(/-/g, "");
}

function compactTime(time: string) {
  return time.replace(":", "") + "00";
}

function utcTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function addDateDays(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldLine(line: string) {
  const maxLength = 75;
  if (line.length <= maxLength) return line;

  const chunks: string[] = [];
  let remaining = line;
  while (remaining.length > maxLength) {
    chunks.push(remaining.slice(0, maxLength));
    remaining = remaining.slice(maxLength);
  }
  chunks.push(remaining);
  return chunks.map((chunk, index) => (index === 0 ? chunk : ` ${chunk}`)).join("\r\n");
}

function eventLines(event: IcsEvent, timestamp: string) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(event.uid)}`,
    `DTSTAMP:${timestamp}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];

  if (event.startTime && event.endTime) {
    lines.push(`DTSTART:${compactDate(event.date)}T${compactTime(event.startTime)}`);
    lines.push(`DTEND:${compactDate(event.date)}T${compactTime(event.endTime)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(event.date)}`);
    lines.push(`DTEND;VALUE=DATE:${compactDate(addDateDays(event.endDate ?? event.date, 1))}`);
  }

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }

  lines.push("END:VEVENT");
  return lines;
}

export function buildIcsCalendar({
  calendarName,
  events,
  now = new Date(),
}: {
  calendarName: string;
  events: IcsEvent[];
  now?: Date;
}) {
  const timestamp = utcTimestamp(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StudyPlan//Study Calendar//ZH-TW",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-TIMEZONE:Asia/Taipei",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    ...events.flatMap((event) => eventLines(event, timestamp)),
    "END:VCALENDAR",
  ];

  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
