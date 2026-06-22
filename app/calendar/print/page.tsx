import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarEventType,
  FatigueLevel,
  FixedEventType,
  UserRole,
  Weekday,
} from "@prisma/client";
import type { CalendarEvent, FixedEvent, StudyTask, StudyWindow, Subject, TutoringSession } from "@prisma/client";
import { PrintButton } from "@/app/components/print-button";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import {
  addMonths,
  formatDateInput,
  getCurrentDay,
  getMonth,
  getRequestTimeZone,
  monthGridWeekdays,
  normalizeDateInput,
} from "@/lib/timezone";
import { fixedEventFallsOnDate } from "@/lib/fixed-events";
import { studyWindowFallsOnDate } from "@/lib/study-windows";
import { tutoringSessionFallsOnDate } from "@/lib/tutoring-sessions";

type CalendarPrintPageProps = {
  searchParams?: Promise<{
    month?: string;
    studentId?: string;
  }>;
};

type StudyTaskWithSubject = StudyTask & {
  subject: Subject | null;
};

type PrintItem = {
  timeLabel: string;
  title: string;
  detail: string;
  sortMinutes: number;
  tone: "fixed" | "tutoring" | "event" | "task" | "study-window";
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

const routineFixedEventTypes = new Set<FixedEventType>([
  FixedEventType.COMMUTE,
  FixedEventType.MEAL,
  FixedEventType.HYGIENE,
  FixedEventType.SLEEP,
]);

const calendarEventLabels: Record<CalendarEventType, string> = {
  SECTION_EXAM: "段考",
  MOCK_EXAM: "模擬考",
  ENTRANCE_EXAM: "升學考試",
  SCHOOL_EVENT: "學校活動",
  DEADLINE: "截止日",
  OTHER: "其他",
};

const fatigueLabels: Record<FatigueLevel, string> = {
  LOW: "低疲勞",
  NORMAL: "普通",
  HIGH: "高疲勞",
};

function minutesFromTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function monthDateValue(rawValue: string | undefined, fallback: string) {
  if (rawValue && /^\d{4}-\d{2}$/.test(rawValue)) {
    return `${rawValue}-01`;
  }

  return normalizeDateInput(rawValue, fallback);
}

function eventFallsOnDate(event: CalendarEvent, date: string, timeZone: string) {
  const startDate = formatDateInput(event.startDate, timeZone);
  const endDate = event.endDate ? formatDateInput(event.endDate, timeZone) : startDate;

  return startDate <= date && date <= endDate;
}

function eventDateLabel(event: CalendarEvent, timeZone: string) {
  const startDate = formatDateInput(event.startDate, timeZone);
  const endDate = event.endDate ? formatDateInput(event.endDate, timeZone) : startDate;

  return startDate === endDate ? startDate : `${startDate} - ${endDate}`;
}

function activeFixedEventsForDate(fixedEvents: FixedEvent[], date: string, weekday: Weekday, timeZone: string) {
  return fixedEvents.filter((event) => event.weekday === weekday && fixedEventFallsOnDate(event, date, timeZone));
}

function activeStudyWindowsForDate(studyWindows: StudyWindow[], date: string, weekday: Weekday, timeZone: string) {
  return studyWindows.filter((window) => window.weekday === weekday && studyWindowFallsOnDate(window, date, timeZone));
}

function activeTutoringSessionsForDate(tutoringSessions: TutoringSession[], date: string, weekday: Weekday, timeZone: string) {
  return tutoringSessions.filter(
    (session) => session.weekday === weekday && tutoringSessionFallsOnDate(session, date, timeZone),
  );
}

function buildPrintItems({
  calendarEvents,
  fixedEvents,
  studyWindows,
  tasks,
  tutoringSessions,
  timeZone,
}: {
  calendarEvents: CalendarEvent[];
  fixedEvents: FixedEvent[];
  studyWindows: StudyWindow[];
  tasks: StudyTaskWithSubject[];
  tutoringSessions: TutoringSession[];
  timeZone: string;
}) {
  const eventItems: PrintItem[] = calendarEvents.map((event) => ({
    timeLabel: "全天",
    title: `${calendarEventLabels[event.type]}：${event.title}`,
    detail: [event.subjectName, event.note, eventDateLabel(event, timeZone)].filter(Boolean).join("，"),
    sortMinutes: 0,
    tone: "event",
  }));

  const fixedItems: PrintItem[] = fixedEvents
    .filter((event) => !routineFixedEventTypes.has(event.type))
    .map((event) => ({
      timeLabel: `${event.startTime}-${event.endTime}`,
      title: event.title,
      detail: [
        fixedEventLabels[event.type],
        event.commuteMinutes > 0 ? `通勤 ${event.commuteMinutes} 分` : "",
        event.note,
      ]
        .filter(Boolean)
        .join("，"),
      sortMinutes: minutesFromTime(event.startTime),
      tone: "fixed",
    }));

  const studyWindowItems: PrintItem[] = studyWindows.map((window) => ({
    timeLabel: `${window.startTime}-${window.endTime}`,
    title: window.title,
    detail: [window.note, "可安排讀書任務"].filter(Boolean).join("，"),
    sortMinutes: minutesFromTime(window.startTime),
    tone: "study-window",
  }));

  const tutoringItems: PrintItem[] = tutoringSessions.map((session) => ({
    timeLabel: `${session.startTime}-${session.endTime}`,
    title: `${session.subjectName}補習`,
    detail: [
      session.hasHomework ? "有補習作業" : "",
      session.commuteMinutes > 0 ? `通勤 ${session.commuteMinutes} 分` : "",
      fatigueLabels[session.fatigueLevel],
    ]
      .filter(Boolean)
      .join("，"),
    sortMinutes: minutesFromTime(session.startTime),
    tone: "tutoring",
  }));

  const taskItems: PrintItem[] = tasks
    .sort((first, second) => second.priority - first.priority || first.title.localeCompare(second.title))
    .map((task, index) => {
      const hasFixedTime = task.plannedStartTime && task.plannedEndTime;

      return {
        timeLabel: hasFixedTime ? `${task.plannedStartTime}-${task.plannedEndTime}` : "任務",
        title: `${task.subject?.name ? `${task.subject.name}：` : ""}${task.title}`,
        detail: "",
        sortMinutes: hasFixedTime ? minutesFromTime(task.plannedStartTime!) : 22 * 60 + index,
        tone: "task" as const,
      };
    });

  return [...eventItems, ...studyWindowItems, ...fixedItems, ...tutoringItems, ...taskItems].sort(
    (left, right) => left.sortMinutes - right.sortMinutes || left.title.localeCompare(right.title),
  );
}

async function getPrintableStudent(studentId?: string) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role === UserRole.STUDENT) {
    const student = await prisma.studentProfile.findUnique({
      where: {
        userId: session.userId,
      },
      include: {
        user: true,
        classMemberships: {
          include: {
            classroom: true,
          },
        },
      },
    });

    if (!student) redirect("/student?error=student-required");
    return student;
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
            classMemberships: {
              include: {
                classroom: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!link) redirect("/guardian?error=student-required");
    return link.student;
  }

  redirect("/login");
}

export default async function CalendarPrintPage({ searchParams }: CalendarPrintPageProps) {
  const params = await searchParams;
  const timeZone = await getRequestTimeZone();
  const today = getCurrentDay(timeZone);
  const monthDate = monthDateValue(params?.month, today.date);
  const month = getMonth(monthDate, timeZone);
  const student = await getPrintableStudent(params?.studentId);
  const [fixedEvents, studyWindows, tutoringSessions, tasks, calendarEvents] = await Promise.all([
    prisma.fixedEvent.findMany({
      where: {
        studentId: student.id,
      },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    }),
    prisma.studyWindow.findMany({
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
          {
            startDate: {
              gte: month.start,
              lt: month.end,
            },
          },
          {
            endDate: {
              gte: month.start,
              lt: month.end,
            },
          },
          {
            startDate: {
              lt: month.start,
            },
            endDate: {
              gte: month.end,
            },
          },
        ],
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const backHref = params?.studentId
    ? `/guardian?tab=calendar&studentId=${student.id}&month=${monthDate}&date=${monthDate}`
    : `/student?tab=calendar&month=${monthDate}&date=${monthDate}`;
  const previousMonthHref = `/calendar/print?month=${addMonths(monthDate, -1)}${params?.studentId ? `&studentId=${student.id}` : ""}`;
  const nextMonthHref = `/calendar/print?month=${addMonths(monthDate, 1)}${params?.studentId ? `&studentId=${student.id}` : ""}`;
  const totalMinutes = tasks.reduce((total, task) => total + task.estimatedMinutes, 0);
  const className = student.classMemberships[0]?.classroom.name;

  return (
    <main className="print-page">
      <div className="print-toolbar print-hide">
        <Link className="button secondary" href={backHref}>
          返回月曆
        </Link>
        <Link className="button secondary" href={previousMonthHref}>
          上個月
        </Link>
        <Link className="button secondary" href={nextMonthHref}>
          下個月
        </Link>
        <PrintButton />
      </div>

      <section className="print-sheet">
        <header className="print-header">
          <div>
            <p className="print-eyebrow">StudyPlan 月曆列印版</p>
            <h1>{month.monthLabel} 月曆</h1>
            <p>
              {student.user.displayName}
              {className ? `｜${className}` : ""}｜時區 {timeZone}
            </p>
          </div>
          <div className="print-summary">
            <strong>{tasks.length}</strong>
            <span>任務 / {totalMinutes} 分鐘</span>
          </div>
        </header>

        <div className="print-month-weekdays">
          {monthGridWeekdays.map((weekday) => (
            <span key={weekday}>{readableWeekdayLabels[weekday]}</span>
          ))}
        </div>
        <div className="print-month-grid">
          {Array.from({ length: month.leadingBlankCount }, (_, index) => (
            <div className="print-month-day empty" key={`blank-${index}`} />
          ))}
          {month.days.map((day) => {
            const dayFixedEvents = activeFixedEventsForDate(fixedEvents, day.date, day.weekday, timeZone);
            const visibleFixedEvents = dayFixedEvents.filter((event) => !routineFixedEventTypes.has(event.type));
            const dayStudyWindows = activeStudyWindowsForDate(studyWindows, day.date, day.weekday, timeZone);
            const dayTutoringSessions = activeTutoringSessionsForDate(tutoringSessions, day.date, day.weekday, timeZone);
            const dayCalendarEvents = calendarEvents.filter((event) => eventFallsOnDate(event, day.date, timeZone));
            const dayTasks = tasks.filter((task) => formatDateInput(task.plannedDate, timeZone) === day.date);
            const dayMinutes = dayTasks.reduce((total, task) => total + task.estimatedMinutes, 0);
            const items = buildPrintItems({
              calendarEvents: dayCalendarEvents,
              fixedEvents: visibleFixedEvents,
              studyWindows: dayStudyWindows,
              tasks: dayTasks,
              tutoringSessions: dayTutoringSessions,
              timeZone,
            });
            const stats = [
              dayCalendarEvents.length ? `${dayCalendarEvents.length} 事` : "",
              dayStudyWindows.length ? `${dayStudyWindows.length} 可` : "",
              visibleFixedEvents.length ? `${visibleFixedEvents.length} 固` : "",
              dayTutoringSessions.length ? `${dayTutoringSessions.length} 補` : "",
              dayTasks.length ? `${dayTasks.length} 任` : "",
              dayMinutes ? `${dayMinutes} 分` : "",
            ].filter(Boolean);

            return (
              <div className={day.isToday ? "print-month-day today" : "print-month-day"} key={day.date}>
                <div className="print-day-header">
                  <strong>{day.dayNumber}</strong>
                  <span>{readableWeekdayLabels[day.weekday]}</span>
                </div>
                {stats.length > 0 && <div className="print-day-stats">{stats.join("｜")}</div>}
                <div className="print-day-items">
                  {items.map((item, index) => (
                    <div className={`print-day-item tone-${item.tone}`} key={`${item.tone}-${index}`}>
                      <span className="print-item-time">{item.timeLabel}</span>
                      <div>
                        <strong>{item.title}</strong>
                        {item.detail && <small>{item.detail}</small>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="print-footer">
          <span>列印日期：{today.date}</span>
          <span>顏色：紅=事件，藍=可讀書/任務，灰=固定作息，綠=補習</span>
        </footer>
      </section>
    </main>
  );
}
