import { NextRequest, NextResponse } from "next/server";
import { CalendarEventType, FatigueLevel, TaskStatus, TaskType, UserRole, Weekday } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { buildIcsCalendar, type IcsEvent } from "@/lib/calendar-ics";
import { formatDateInput, getCurrentDay, getMonth, getRequestTimeZone, normalizeDateInput } from "@/lib/timezone";
import { tutoringSessionFallsOnDate } from "@/lib/tutoring-sessions";

const readableWeekdayLabels: Record<Weekday, string> = {
  MONDAY: "週一",
  TUESDAY: "週二",
  WEDNESDAY: "週三",
  THURSDAY: "週四",
  FRIDAY: "週五",
  SATURDAY: "週六",
  SUNDAY: "週日",
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

function monthDateValue(rawValue: string | null, fallback: string) {
  if (rawValue && /^\d{4}-\d{2}$/.test(rawValue)) {
    return `${rawValue}-01`;
  }

  return normalizeDateInput(rawValue ?? undefined, fallback);
}

function eventFallsOnDateRange(event: { startDate: Date; endDate: Date | null }, timeZone: string) {
  const startDate = formatDateInput(event.startDate, timeZone);
  const endDate = event.endDate ? formatDateInput(event.endDate, timeZone) : startDate;
  return { startDate, endDate };
}

function activeTutoringSessionsForDate(
  sessions: Awaited<ReturnType<typeof prisma.tutoringSession.findMany>>,
  date: string,
  weekday: Weekday,
  timeZone: string,
) {
  return sessions.filter((session) => session.weekday === weekday && tutoringSessionFallsOnDate(session, date, timeZone));
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

  const [tasks, tutoringSessions, calendarEvents] = await Promise.all([
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
    prisma.tutoringSession.findMany({
      where: {
        studentId: student.id,
      },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
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

  const taskEvents: IcsEvent[] = tasks.map((task) => {
    const date = formatDateInput(task.plannedDate, timeZone);
    const subject = task.subject?.name;

    return {
      uid: `study-task-${task.id}@studyplan`,
      title: subject ? `${subject}：${task.title}` : task.title,
      date,
      description: [
        taskTypeLabels[task.type],
        `${task.estimatedMinutes} 分鐘`,
        `優先度 ${task.priority}`,
        statusLabels[task.status],
        task.description ?? "",
      ]
        .filter(Boolean)
        .join("｜"),
    };
  });

  const tutoringEvents: IcsEvent[] = month.days.flatMap((day) =>
    activeTutoringSessionsForDate(tutoringSessions, day.date, day.weekday, timeZone).map((session) => ({
      uid: `tutoring-${session.id}-${day.date}@studyplan`,
      title: `${session.subjectName}補習`,
      date: day.date,
      startTime: session.startTime,
      endTime: session.endTime,
      description: [
        readableWeekdayLabels[day.weekday],
        session.hasHomework ? "有補習作業" : "",
        session.commuteMinutes > 0 ? `通勤 ${session.commuteMinutes} 分` : "",
        `疲勞 ${fatigueLabels[session.fatigueLevel]}`,
      ]
        .filter(Boolean)
        .join("｜"),
    })),
  );

  const calendarIcsEvents: IcsEvent[] = calendarEvents.map((event) => {
    const { startDate, endDate } = eventFallsOnDateRange(event, timeZone);

    return {
      uid: `calendar-event-${event.id}@studyplan`,
      title: `${calendarEventLabels[event.type]}：${event.title}`,
      date: startDate,
      endDate,
      description: [event.subjectName ?? "", event.note ?? ""].filter(Boolean).join("｜"),
    };
  });

  const filename = `studyplan-${month.monthLabel}.ics`;
  const ics = buildIcsCalendar({
    calendarName: `StudyPlan ${student.user.displayName} ${month.monthLabel}`,
    events: [...taskEvents, ...tutoringEvents, ...calendarIcsEvents],
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}
