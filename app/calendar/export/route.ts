import { NextRequest, NextResponse } from "next/server";
import {
  CalendarEventType,
  FatigueLevel,
  FixedEventType,
  TaskStatus,
  TaskType,
  UserRole,
  Weekday,
} from "@prisma/client";
import type { CalendarEvent, FixedEvent, StudyTask, Subject, TutoringSession } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import {
  formatDateInput,
  getCurrentDay,
  getMonth,
  getRequestTimeZone,
  normalizeDateInput,
} from "@/lib/timezone";
import { fixedEventFallsOnDate } from "@/lib/fixed-events";
import { tutoringSessionFallsOnDate } from "@/lib/tutoring-sessions";

type StudyTaskWithSubject = StudyTask & {
  subject: Subject | null;
};

type CsvItem = {
  date: string;
  weekday: string;
  startTime: string;
  endTime: string;
  category: string;
  title: string;
  subject: string;
  detail: string;
  status: string;
  minutes: string;
  priority: string;
  sortMinutes: number;
};

const readableWeekdayLabels: Record<Weekday, string> = {
  MONDAY: "週一",
  TUESDAY: "週二",
  WEDNESDAY: "週三",
  THURSDAY: "週四",
  FRIDAY: "週五",
  SATURDAY: "週六",
  SUNDAY: "週日",
};

const fixedEventLabels: Record<FixedEventType, string> = {
  SCHOOL: "學校",
  TUTORING: "補習",
  COMMUTE: "通勤",
  MEAL: "吃飯",
  HYGIENE: "洗澡",
  SLEEP: "睡覺",
  FAMILY: "家庭時間",
  OTHER: "其他",
};

const taskTypeLabels: Record<TaskType, string> = {
  SCHOOL_HOMEWORK: "學校作業",
  TUTORING_HOMEWORK: "補習作業",
  REVIEW: "複習",
  PRACTICE: "練習",
  WEAK_POINT: "弱點補強",
  PREVIEW: "預習",
  EXAM_SPRINT: "考前衝刺",
};

const calendarEventLabels: Record<CalendarEventType, string> = {
  SECTION_EXAM: "段考",
  MOCK_EXAM: "模擬考",
  ENTRANCE_EXAM: "升學考試",
  SCHOOL_EVENT: "學校活動",
  DEADLINE: "截止日",
  OTHER: "其他",
};

const fatigueLabels: Record<FatigueLevel, string> = {
  LOW: "低",
  NORMAL: "普通",
  HIGH: "高",
};

const statusLabels: Record<TaskStatus, string> = {
  PLANNED: "待完成",
  DONE: "完成",
  PARTIAL: "部分完成",
  SKIPPED: "略過",
  RESCHEDULED: "改期",
};

function minutesFromTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function monthDateValue(rawValue: string | null, fallback: string) {
  if (rawValue && /^\d{4}-\d{2}$/.test(rawValue)) {
    return `${rawValue}-01`;
  }

  return normalizeDateInput(rawValue ?? undefined, fallback);
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function csvRow(values: string[]) {
  return values.map(csvCell).join(",");
}

function eventFallsOnDate(event: CalendarEvent, date: string, timeZone: string) {
  const startDate = formatDateInput(event.startDate, timeZone);
  const endDate = event.endDate ? formatDateInput(event.endDate, timeZone) : startDate;

  return startDate <= date && date <= endDate;
}

function activeFixedEventsForDate(fixedEvents: FixedEvent[], date: string, weekday: Weekday, timeZone: string) {
  return fixedEvents.filter((event) => event.weekday === weekday && fixedEventFallsOnDate(event, date, timeZone));
}

function activeTutoringSessionsForDate(tutoringSessions: TutoringSession[], date: string, weekday: Weekday, timeZone: string) {
  return tutoringSessions.filter(
    (session) => session.weekday === weekday && tutoringSessionFallsOnDate(session, date, timeZone),
  );
}

async function getExportableStudent(studentId?: string | null) {
  const session = await getCurrentSession();
  if (!session) return null;

  if (session.role === UserRole.STUDENT) {
    return prisma.studentProfile.findUnique({
      where: {
        userId: session.userId,
      },
      include: {
        user: true,
      },
    });
  }

  if (session.role === UserRole.GUARDIAN) {
    const link = await prisma.guardianStudent.findFirst({
      where: {
        ...(studentId ? { studentId } : {}),
        guardian: {
          userId: session.userId,
        },
      },
      include: {
        student: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return link?.student ?? null;
  }

  return null;
}

function buildDayItems({
  calendarEvents,
  date,
  fixedEvents,
  tasks,
  tutoringSessions,
  weekday,
}: {
  calendarEvents: CalendarEvent[];
  date: string;
  fixedEvents: FixedEvent[];
  tasks: StudyTaskWithSubject[];
  tutoringSessions: TutoringSession[];
  weekday: string;
}) {
  const eventItems: CsvItem[] = calendarEvents.map((event) => ({
    date,
    weekday,
    startTime: "全天",
    endTime: "",
    category: calendarEventLabels[event.type],
    title: event.title,
    subject: event.subjectName ?? "",
    detail: event.note ?? "",
    status: "",
    minutes: "",
    priority: "",
    sortMinutes: 0,
  }));

  const fixedItems: CsvItem[] = fixedEvents.map((event) => ({
    date,
    weekday,
    startTime: event.startTime,
    endTime: event.endTime,
    category: fixedEventLabels[event.type],
    title: event.title,
    subject: "",
    detail: [event.commuteMinutes > 0 ? `通勤 ${event.commuteMinutes} 分` : "", event.note ?? ""].filter(Boolean).join("，"),
    status: "",
    minutes: "",
    priority: "",
    sortMinutes: minutesFromTime(event.startTime),
  }));

  const tutoringItems: CsvItem[] = tutoringSessions.map((session) => ({
    date,
    weekday,
    startTime: session.startTime,
    endTime: session.endTime,
    category: "補習",
    title: `${session.subjectName}補習`,
    subject: session.subjectName,
    detail: [
      session.hasHomework ? "有補習作業" : "",
      session.commuteMinutes > 0 ? `通勤 ${session.commuteMinutes} 分` : "",
      `疲勞 ${fatigueLabels[session.fatigueLevel]}`,
    ]
      .filter(Boolean)
      .join("，"),
    status: "",
    minutes: "",
    priority: "",
    sortMinutes: minutesFromTime(session.startTime),
  }));

  const taskItems: CsvItem[] = tasks
    .sort((first, second) => second.priority - first.priority || first.title.localeCompare(second.title))
    .map((task, index) => ({
      date,
      weekday,
      startTime: "任務",
      endTime: "",
      category: taskTypeLabels[task.type],
      title: task.title,
      subject: task.subject?.name ?? "",
      detail: task.description ?? "",
      status: statusLabels[task.status],
      minutes: String(task.estimatedMinutes),
      priority: String(task.priority),
      sortMinutes: 22 * 60 + index,
    }));

  return [...eventItems, ...fixedItems, ...tutoringItems, ...taskItems].sort(
    (first, second) => first.sortMinutes - second.sortMinutes || first.title.localeCompare(second.title),
  );
}

export async function GET(request: NextRequest) {
  const timeZone = await getRequestTimeZone();
  const today = getCurrentDay(timeZone);
  const searchParams = request.nextUrl.searchParams;
  const monthDate = monthDateValue(searchParams.get("month"), today.date);
  const month = getMonth(monthDate, timeZone);
  const student = await getExportableStudent(searchParams.get("studentId"));

  if (!student) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const [fixedEvents, tutoringSessions, tasks, calendarEvents] = await Promise.all([
    prisma.fixedEvent.findMany({
      where: {
        studentId: student.id,
      },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    }),
    prisma.tutoringSession.findMany({
      where: {
        studentId: student.id,
      },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    }),
    prisma.studyTask.findMany({
      where: {
        studentId: student.id,
        plannedDate: {
          gte: month.start,
          lt: month.end,
        },
      },
      include: {
        subject: true,
      },
      orderBy: [{ plannedDate: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
    }),
    prisma.calendarEvent.findMany({
      where: {
        studentId: student.id,
        OR: [
          { startDate: { gte: month.start, lt: month.end } },
          { endDate: { gte: month.start, lt: month.end } },
          { startDate: { lt: month.start }, endDate: { gte: month.end } },
        ],
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const rows = [
    csvRow(["date", "weekday", "startTime", "endTime", "category", "title", "subject", "detail", "status", "minutes", "priority"]),
  ];

  for (const day of month.days) {
    const dayTasks = tasks.filter((task) => formatDateInput(task.plannedDate, timeZone) === day.date);
    const dayFixedEvents = activeFixedEventsForDate(fixedEvents, day.date, day.weekday, timeZone);
    const dayTutoringSessions = activeTutoringSessionsForDate(tutoringSessions, day.date, day.weekday, timeZone);
    const dayCalendarEvents = calendarEvents.filter((event) => eventFallsOnDate(event, day.date, timeZone));
    const dayItems = buildDayItems({
      calendarEvents: dayCalendarEvents,
      date: day.date,
      fixedEvents: dayFixedEvents,
      tasks: dayTasks,
      tutoringSessions: dayTutoringSessions,
      weekday: readableWeekdayLabels[day.weekday],
    });

    dayItems.forEach((item) => {
      rows.push(
        csvRow([
          item.date,
          item.weekday,
          item.startTime,
          item.endTime,
          item.category,
          item.title,
          item.subject,
          item.detail,
          item.status,
          item.minutes,
          item.priority,
        ]),
      );
    });
  }

  const filename = `studyplan-${month.monthLabel}.csv`;
  return new NextResponse(`\uFEFF${rows.join("\r\n")}\r\n`, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
