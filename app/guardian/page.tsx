import Link from "next/link";
import { CalendarEventType, FatigueLevel, FixedEventType, TaskStatus, TaskType, Weekday } from "@prisma/client";
import type { CalendarEvent, FixedEvent, StudyTask, Subject, TutoringSession } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { buildTodaySchedule } from "@/lib/scheduler/today";
import {
  addDateDays,
  addMonths,
  formatDateInput,
  getCurrentDay,
  getDayRange,
  getMonth,
  getRequestTimeZone,
  getWeek,
  monthGridWeekdays,
  normalizeDateInput,
} from "@/lib/timezone";
import { tutoringSessionDateLabel, tutoringSessionFallsOnDate } from "@/lib/tutoring-sessions";
import { fixedEventFallsOnDate } from "@/lib/fixed-events";
import { ExamReviewPlans } from "@/app/components/exam-review-plans";
import { ScheduleHistory } from "@/app/components/schedule-history";
import { LearningProgress } from "@/app/components/learning-progress";
import { DayDetailPanel } from "@/app/components/day-detail-panel";
import { CalendarDayDetailBrowser } from "@/app/components/calendar-day-detail-browser";
import { createGuardian, linkStudentToGuardian, signOut } from "../onboarding/actions";
import {
  createFixedEvent,
  createCalendarEvent,
  createStudyTask,
  createTutoringSession,
  deleteCalendarEvent,
  deleteFixedEvent,
  deleteStudyTask,
  deleteTutoringSession,
  moveTasksToTomorrow,
  saveTodaySchedule,
  updateFixedEvent,
  updateStudyTask,
  updateTaskStatus,
  updateTutoringSession,
} from "../schedule/actions";

type GuardianPageProps = {
  searchParams?: Promise<{
    created?: string;
    error?: string;
    linked?: string;
    schedule?: string;
    scheduleHistory?: string;
    examPlan?: string;
    learning?: string;
    tab?: string;
    studentId?: string;
    date?: string;
    week?: string;
    month?: string;
  }>;
};

const weekdayLabels: Record<Weekday, string> = {
  MONDAY: "星期一",
  TUESDAY: "星期二",
  WEDNESDAY: "星期三",
  THURSDAY: "星期四",
  FRIDAY: "星期五",
  SATURDAY: "星期六",
  SUNDAY: "星期日",
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

const weekdayOptions = Object.entries(weekdayLabels);
const fixedEventOptions = Object.entries(fixedEventLabels);
const taskTypeOptions = Object.entries(taskTypeLabels);
const calendarEventOptions = Object.entries(calendarEventLabels);
const readableWeekdayLabels: Record<Weekday, string> = {
  MONDAY: "週一",
  TUESDAY: "週二",
  WEDNESDAY: "週三",
  THURSDAY: "週四",
  FRIDAY: "週五",
  SATURDAY: "週六",
  SUNDAY: "週日",
};

type DashboardTab = "today" | "calendar" | "learning" | "settings";

const dashboardTabs: Array<{ value: DashboardTab; label: string }> = [
  { value: "today", label: "今日" },
  { value: "calendar", label: "行事曆" },
  { value: "learning", label: "成績與弱點" },
  { value: "settings", label: "設定" },
];

function normalizeDashboardTab(value?: string): DashboardTab {
  return value === "calendar" || value === "learning" || value === "settings" ? value : "today";
}

function gradeLabel(grade: number) {
  return `國${grade - 6}`;
}

function WeekdayCheckboxGroup({ defaultWeekday }: { defaultWeekday: Weekday }) {
  return (
    <fieldset className="weekday-checkbox-group">
      <legend>星期</legend>
      <div>
        {weekdayOptions.map(([value, label]) => (
          <label className="checkbox-label" key={value}>
            <input name="weekday" type="checkbox" value={value} defaultChecked={value === defaultWeekday} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
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

function activeTutoringSessionsForDate(tutoringSessions: TutoringSession[], date: string, weekday: Weekday, timeZone: string) {
  return tutoringSessions.filter(
    (sessionItem) => sessionItem.weekday === weekday && tutoringSessionFallsOnDate(sessionItem, date, timeZone),
  );
}

function activeFixedEventsForDate(fixedEvents: FixedEvent[], date: string, weekday: Weekday, timeZone: string) {
  return fixedEvents.filter((event) => event.weekday === weekday && fixedEventFallsOnDate(event, date, timeZone));
}

function uniqueDates(dates: string[]) {
  return Array.from(new Set(dates));
}

function calendarHref(params: { tab?: DashboardTab; studentId?: string; date?: string; week?: string; month?: string }) {
  const query = new URLSearchParams();
  if (params.tab) query.set("tab", params.tab);
  if (params.studentId) query.set("studentId", params.studentId);
  if (params.date) query.set("date", params.date);
  if (params.week) query.set("week", params.week);
  if (params.month) query.set("month", params.month);
  const value = query.toString();
  return value ? `/guardian?${value}` : "/guardian";
}

function dashboardTabHref(
  tab: DashboardTab,
  params: { studentId: string; date: string; week: string; month: string },
) {
  return calendarHref({ tab, studentId: params.studentId, date: params.date, week: params.week, month: params.month });
}

function settingsSectionHref(anchor: string, params: { studentId: string; date: string; week: string; month: string }) {
  return `${dashboardTabHref("settings", params)}${anchor}`;
}

function DashboardTabs({
  activeTab,
  hrefForTab,
}: {
  activeTab: DashboardTab;
  hrefForTab: (tab: DashboardTab) => string;
}) {
  return (
    <nav className="dashboard-tabs" aria-label="頁面區段">
      {dashboardTabs.map((tab) => (
        <Link
          className={tab.value === activeTab ? "dashboard-tab active" : "dashboard-tab"}
          href={hrefForTab(tab.value)}
          aria-current={tab.value === activeTab ? "page" : undefined}
          key={tab.value}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function StudentIdInput({ studentId }: { studentId: string }) {
  return <input name="studentId" type="hidden" value={studentId} />;
}

function FixedEventEditor({ event, studentId, timeZone }: { event: FixedEvent; studentId: string; timeZone: string }) {
  return (
    <details className="item-editor">
      <summary>編輯</summary>
      <form action={updateFixedEvent}>
        <StudentIdInput studentId={studentId} />
        <input name="fixedEventId" type="hidden" value={event.id} />
        <label>
          名稱
          <input name="title" defaultValue={event.title} required />
        </label>
        <label>
          類型
          <select name="type" defaultValue={event.type}>
            {fixedEventOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          星期
          <select name="weekday" defaultValue={event.weekday}>
            {weekdayOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="field-row">
          <label>
            開始日期
            <input name="startDate" type="date" defaultValue={event.startDate ? formatDateInput(event.startDate, timeZone) : ""} />
          </label>
          <label>
            結束日期
            <input name="endDate" type="date" defaultValue={event.endDate ? formatDateInput(event.endDate, timeZone) : ""} />
          </label>
        </div>
        <div className="field-row">
          <label>
            開始
            <input name="startTime" type="time" defaultValue={event.startTime} required />
          </label>
          <label>
            結束
            <input name="endTime" type="time" defaultValue={event.endTime} required />
          </label>
        </div>
        <label>
          通勤分鐘
          <input name="commuteMinutes" type="number" min="0" defaultValue={event.commuteMinutes} />
        </label>
        <label>
          備註
          <input name="note" defaultValue={event.note ?? ""} />
        </label>
        <button className="small-button" type="submit">
          儲存
        </button>
      </form>
    </details>
  );
}

function TutoringSessionEditor({ sessionItem, studentId, timeZone }: { sessionItem: TutoringSession; studentId: string; timeZone: string }) {
  return (
    <details className="item-editor">
      <summary>編輯</summary>
      <form action={updateTutoringSession}>
        <StudentIdInput studentId={studentId} />
        <input name="tutoringSessionId" type="hidden" value={sessionItem.id} />
        <label>
          科目
          <input name="subjectName" defaultValue={sessionItem.subjectName} required />
        </label>
        <label>
          星期
          <select name="weekday" defaultValue={sessionItem.weekday}>
            {weekdayOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="field-row">
          <label>
            開始日期
            <input name="startDate" type="date" defaultValue={sessionItem.startDate ? formatDateInput(sessionItem.startDate, timeZone) : ""} />
          </label>
          <label>
            結束日期
            <input name="endDate" type="date" defaultValue={sessionItem.endDate ? formatDateInput(sessionItem.endDate, timeZone) : ""} />
          </label>
        </div>
        <div className="field-row">
          <label>
            開始
            <input name="startTime" type="time" defaultValue={sessionItem.startTime} required />
          </label>
          <label>
            結束
            <input name="endTime" type="time" defaultValue={sessionItem.endTime} required />
          </label>
        </div>
        <label>
          通勤分鐘
          <input name="commuteMinutes" type="number" min="0" defaultValue={sessionItem.commuteMinutes} />
        </label>
        <label>
          疲勞程度
          <select name="fatigueLevel" defaultValue={sessionItem.fatigueLevel}>
            <option value="LOW">低</option>
            <option value="NORMAL">普通</option>
            <option value="HIGH">高</option>
          </select>
        </label>
        <label className="checkbox-label">
          <input name="hasHomework" type="checkbox" defaultChecked={sessionItem.hasHomework} /> 有補習作業
        </label>
        <button className="small-button" type="submit">
          儲存
        </button>
      </form>
    </details>
  );
}

function TutoringScheduleList({
  sessions,
  studentId,
  timeZone,
  newTutoringHref = "#new-tutoring-form",
}: {
  sessions: TutoringSession[];
  studentId: string;
  timeZone: string;
  newTutoringHref?: string;
}) {
  const sortedSessions = [...sessions].sort(
    (first, second) =>
      weekdayOptions.findIndex(([value]) => value === first.weekday) -
        weekdayOptions.findIndex(([value]) => value === second.weekday) ||
      first.startTime.localeCompare(second.startTime),
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>補習排程清單</h2>
        <span>{sortedSessions.length} 筆</span>
      </div>
      <p className="panel-copy">這裡列出這位孩子所有補習排程，包含未來、已過期與不限期間的安排，可直接修改或刪除整筆排程。</p>
      <div className="task-list compact-list">
        {sortedSessions.map((sessionItem) => (
          <div className="task" key={sessionItem.id}>
            <span className="task-dot" aria-hidden="true" />
            <div>
              <strong>{sessionItem.subjectName}補習</strong>
              <span>
                {weekdayLabels[sessionItem.weekday]} {sessionItem.startTime}-{sessionItem.endTime}，
                {tutoringSessionDateLabel(sessionItem, timeZone)}
                {sessionItem.commuteMinutes > 0 ? `，通勤 ${sessionItem.commuteMinutes} 分鐘` : ""}
                {sessionItem.hasHomework ? "，有補習作業" : ""}
              </span>
            </div>
            <form className="inline-actions" action={deleteTutoringSession}>
              <input name="studentId" type="hidden" value={studentId} />
              <input name="tutoringSessionId" type="hidden" value={sessionItem.id} />
              <button className="small-button danger-button" type="submit">
                刪除排程
              </button>
            </form>
            <TutoringSessionEditor sessionItem={sessionItem} studentId={studentId} timeZone={timeZone} />
          </div>
        ))}
        {sortedSessions.length === 0 && (
          <div className="empty-state">
            <p>尚未建立補習排程。</p>
            <div className="empty-state-actions">
              <a className="small-button" href={newTutoringHref}>＋ 新增第一筆補習</a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

type StudyTaskWithSubject = StudyTask & {
  subject: Subject | null;
};

function StudyTaskEditor({ task, studentId, timeZone }: { task: StudyTaskWithSubject; studentId: string; timeZone: string }) {
  return (
    <details className="item-editor">
      <summary>編輯</summary>
      <form action={updateStudyTask}>
        <StudentIdInput studentId={studentId} />
        <input name="taskId" type="hidden" value={task.id} />
        <label>
          科目
          <input name="subjectName" defaultValue={task.subject?.name ?? ""} />
        </label>
        <label>
          任務
          <input name="title" defaultValue={task.title} required />
        </label>
        <label>
          類型
          <select name="type" defaultValue={task.type}>
            {taskTypeOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          日期
          <input name="plannedDate" type="date" defaultValue={formatDateInput(task.plannedDate, timeZone)} required />
        </label>
        <div className="field-row">
          <label>
            預估分鐘
            <input name="estimatedMinutes" type="number" min="10" step="5" defaultValue={task.estimatedMinutes} />
          </label>
          <label>
            優先度
            <input name="priority" type="number" min="1" max="5" defaultValue={task.priority} />
          </label>
        </div>
        <label>
          備註
          <input name="description" defaultValue={task.description ?? ""} />
        </label>
        <button className="small-button" type="submit">
          儲存
        </button>
      </form>
    </details>
  );
}

function PartialProgressForm({ taskId, studentId }: { taskId: string; studentId: string }) {
  return (
    <details className="item-editor progress-editor">
      <summary>部分完成</summary>
      <form action={updateTaskStatus}>
        <StudentIdInput studentId={studentId} />
        <input name="taskId" type="hidden" value={taskId} />
        <input name="status" type="hidden" value="PARTIAL" />
        <div className="field-row">
          <label>
            已完成分鐘
            <input name="actualMinutes" type="number" min="1" step="5" defaultValue="15" />
          </label>
          <label>
            難度 1-5
            <input name="difficulty" type="number" min="1" max="5" defaultValue="3" />
          </label>
        </div>
        <label>
          卡住原因
          <input name="reason" placeholder="例如：題目太難、時間不夠、觀念不熟" />
        </label>
        <button className="small-button" type="submit">
          紀錄部分完成
        </button>
      </form>
    </details>
  );
}

function WeekCalendar({
  calendarEvents,
  fixedEvents,
  tutoringSessions,
  tasks,
  week,
  selectedWeekDate,
  selectedDate,
  todayDate,
  timeZone,
  studentId,
}: {
  calendarEvents: CalendarEvent[];
  fixedEvents: FixedEvent[];
  tutoringSessions: TutoringSession[];
  tasks: StudyTaskWithSubject[];
  week: ReturnType<typeof getWeek>;
  selectedWeekDate: string;
  selectedDate: string;
  todayDate: string;
  timeZone: string;
  studentId: string;
}) {
  const weekTasks = tasks.filter((task) => {
    const plannedDate = task.plannedDate.getTime();
    return plannedDate >= week.start.getTime() && plannedDate < week.end.getTime();
  });
  const totalEstimatedMinutes = weekTasks.reduce((total, task) => total + task.estimatedMinutes, 0);
  const completedTasks = weekTasks.filter((task) => task.status === "DONE").length;
  const openTasks = weekTasks.filter((task) => task.status === "PLANNED").length;

  return (
    <section className="panel week-panel">
      <div className="panel-header">
        <div>
          <h2>本週行事曆</h2>
          <p className="panel-copy">
            {week.days[0]?.date} - {week.days[6]?.date}
          </p>
        </div>
        <div className="inline-actions">
          <Link className="small-button" href={calendarHref({ tab: "calendar", studentId, date: addDateDays(selectedWeekDate, -7), week: addDateDays(selectedWeekDate, -7) })}>上一週</Link>
          <Link className="small-button" href={calendarHref({ tab: "calendar", studentId, date: todayDate, week: todayDate })}>本週</Link>
          <Link className="small-button" href={calendarHref({ tab: "calendar", studentId, date: addDateDays(selectedWeekDate, 7), week: addDateDays(selectedWeekDate, 7) })}>下一週</Link>
        </div>
      </div>
      <p className="panel-copy">任務 {weekTasks.length}，完成 {completedTasks}，待辦 {openTasks}，預估 {totalEstimatedMinutes} 分鐘</p>

      <div className="week-grid">
        {week.days.map((day) => {
          const dayTasks = weekTasks.filter((task) => formatDateInput(task.plannedDate, timeZone) === day.date);
          const dayCalendarEvents = calendarEvents.filter((event) => eventFallsOnDate(event, day.date, timeZone));
          const dayFixedEvents = activeFixedEventsForDate(fixedEvents, day.date, day.weekday, timeZone);
          const dayTutoringSessions = activeTutoringSessionsForDate(tutoringSessions, day.date, day.weekday, timeZone);
          const minutes = dayTasks.reduce((total, task) => total + task.estimatedMinutes, 0);
          const dayClassName = ["week-day", day.isToday ? "today" : "", day.date === selectedDate ? "selected" : ""]
            .filter(Boolean)
            .join(" ");
          const itemCount = dayTutoringSessions.length + dayCalendarEvents.length + dayFixedEvents.length + dayTasks.length;

          return (
            <Link
              className={dayClassName}
              href={calendarHref({ tab: "calendar", studentId, date: day.date, week: day.date, month: day.date })}
              data-calendar-date={day.date}
              key={day.date}
            >
              <div className="week-day-header">
                <strong>{readableWeekdayLabels[day.weekday]}</strong>
                <span>{day.dayNumber}</span>
              </div>
              <div className="calendar-day-summary" aria-label={`${day.date} ${itemCount} 個項目`}>
                {dayTutoringSessions.length > 0 && <span className="summary-chip tutoring">{dayTutoringSessions.length} 補</span>}
                {dayCalendarEvents.length > 0 && <span className="summary-chip event">{dayCalendarEvents.length} 事</span>}
                {dayFixedEvents.length > 0 && <span className="summary-chip fixed">{dayFixedEvents.length} 固</span>}
                {dayTasks.length > 0 && <span className="summary-chip task">{dayTasks.length} 任</span>}
              </div>
              {minutes > 0 && <span className="calendar-day-minutes">{minutes} 分</span>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function MonthCalendar({
  calendarEvents,
  fixedEvents,
  tutoringSessions,
  tasks,
  month,
  selectedMonthDate,
  selectedDate,
  todayDate,
  timeZone,
  studentId,
}: {
  calendarEvents: CalendarEvent[];
  fixedEvents: FixedEvent[];
  tutoringSessions: TutoringSession[];
  tasks: StudyTaskWithSubject[];
  month: ReturnType<typeof getMonth>;
  selectedMonthDate: string;
  selectedDate: string;
  todayDate: string;
  timeZone: string;
  studentId: string;
}) {
  const monthTasks = tasks.filter((task) => {
    const plannedDate = task.plannedDate.getTime();
    return plannedDate >= month.start.getTime() && plannedDate < month.end.getTime();
  });
  const totalEstimatedMinutes = monthTasks.reduce((total, task) => total + task.estimatedMinutes, 0);
  const completedTasks = monthTasks.filter((task) => task.status === "DONE").length;
  const openTasks = monthTasks.filter((task) => task.status === "PLANNED").length;

  return (
    <section className="panel month-panel">
      <div className="panel-header">
        <div>
          <h2>本月行事曆</h2>
          <p className="panel-copy">{month.monthLabel}</p>
        </div>
        <div className="inline-actions">
          <Link className="small-button" href={calendarHref({ tab: "calendar", studentId, date: addMonths(selectedMonthDate, -1), month: addMonths(selectedMonthDate, -1) })}>上個月</Link>
          <Link className="small-button" href={calendarHref({ tab: "calendar", studentId, date: todayDate, month: todayDate })}>本月</Link>
          <Link className="small-button" href={calendarHref({ tab: "calendar", studentId, date: addMonths(selectedMonthDate, 1), month: addMonths(selectedMonthDate, 1) })}>下個月</Link>
        </div>
      </div>
      <p className="panel-copy">任務 {monthTasks.length}，完成 {completedTasks}，待辦 {openTasks}，預估 {totalEstimatedMinutes} 分鐘</p>

      <div className="month-weekdays">
        {monthGridWeekdays.map((weekday) => (
          <span key={weekday}>{readableWeekdayLabels[weekday]}</span>
        ))}
      </div>
      <div className="month-grid">
        {Array.from({ length: month.leadingBlankCount }, (_, index) => (
          <div className="month-day empty" key={`blank-${index}`} />
        ))}
        {month.days.map((day) => {
          const dayTasks = monthTasks.filter((task) => formatDateInput(task.plannedDate, timeZone) === day.date);
          const dayCalendarEvents = calendarEvents.filter((event) => eventFallsOnDate(event, day.date, timeZone));
          const dayFixedEvents = activeFixedEventsForDate(fixedEvents, day.date, day.weekday, timeZone);
          const dayTutoringSessions = activeTutoringSessionsForDate(tutoringSessions, day.date, day.weekday, timeZone);
          const minutes = dayTasks.reduce((total, task) => total + task.estimatedMinutes, 0);
          const dayClassName = [
            "month-day",
            day.isToday ? "today" : "",
            day.date === selectedDate ? "selected" : "",
            dayTasks.length >= 3 || minutes >= 120 ? "heavy" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const itemCount = dayTutoringSessions.length + dayCalendarEvents.length + dayFixedEvents.length + dayTasks.length;

          return (
            <Link
              className={dayClassName}
              href={calendarHref({ tab: "calendar", studentId, date: day.date, week: day.date, month: day.date })}
              data-calendar-date={day.date}
              key={day.date}
            >
              <div className="month-day-header">
                <strong>{day.dayNumber}</strong>
                {minutes > 0 && <span>{minutes} 分</span>}
              </div>
              <div className="calendar-day-summary" aria-label={`${day.date} ${itemCount} 個項目`}>
                {dayTutoringSessions.length > 0 && <span className="summary-dot tutoring" title={`${dayTutoringSessions.length} 補習`} />}
                {dayCalendarEvents.length > 0 && <span className="summary-dot event" title={`${dayCalendarEvents.length} 事件`} />}
                {dayFixedEvents.length > 0 && <span className="summary-dot fixed" title={`${dayFixedEvents.length} 作息`} />}
                {dayTasks.length > 0 && <span className="summary-chip task">{dayTasks.length} 任</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default async function GuardianPage({ searchParams }: GuardianPageProps) {
  const params = await searchParams;
  const created = params?.created === "1";
  const linked = params?.linked === "1";
  const scheduleUpdated = params?.schedule === "1";
  const scheduleHistoryUpdated = params?.scheduleHistory === "1";
  const examPlanUpdated = params?.examPlan === "1";
  const error = params?.error;
  const timeZone = await getRequestTimeZone();
  const today = getCurrentDay(timeZone);
  const todayRange = getDayRange(today.date, timeZone);
  const selectedDate = normalizeDateInput(params?.date, today.date);
  const selectedDateRange = getDayRange(selectedDate, timeZone);
  const selectedDateWeek = getWeek(selectedDate, timeZone);
  const selectedDay = selectedDateWeek.days.find((day) => day.date === selectedDate) ?? today;
  const selectedWeekDate = normalizeDateInput(params?.week, today.date);
  const selectedMonthDate = normalizeDateInput(params?.month, today.date);
  const week = getWeek(selectedWeekDate, timeZone);
  const month = getMonth(selectedMonthDate, timeZone);
  const taskRangeStart = new Date(Math.min(week.start.getTime(), month.start.getTime(), selectedDateRange.start.getTime()));
  const taskRangeEnd = new Date(Math.max(week.end.getTime(), month.end.getTime(), selectedDateRange.end.getTime()));
  const session = await getCurrentSession();
  const currentUser =
    session?.role === "GUARDIAN"
      ? await prisma.user.findUnique({
          where: {
            id: session.userId,
          },
          include: {
            guardianProfile: {
              include: {
                studentLinks: {
                  orderBy: {
                    createdAt: "asc",
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
                        fixedEvents: {
                          orderBy: {
                            startTime: "asc",
                          },
                        },
                        tutoringSessions: {
                          orderBy: {
                            startTime: "asc",
                          },
                        },
                        studyTasks: {
                          where: {
                            plannedDate: {
                              gte: taskRangeStart,
                              lt: taskRangeEnd,
                            },
                          },
                          include: {
                            subject: true,
                          },
                          orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
                        },
                        examReviewPlans: {
                          where: {
                            examDate: {
                              gte: todayRange.start,
                            },
                          },
                          include: {
                            subject: true,
                            calendarEvent: true,
                            tasks: {
                              include: {
                                logs: true,
                              },
                              orderBy: [{ plannedDate: "asc" }, { createdAt: "asc" }],
                            },
                            revisions: {
                              orderBy: { revision: "desc" },
                              take: 3,
                            },
                          },
                          orderBy: [{ examDate: "asc" }, { createdAt: "asc" }],
                        },
                        scheduleRuns: {
                          orderBy: { createdAt: "desc" },
                          take: 8,
                        },
                        calendarEvents: {
                          where: {
                            OR: [
                              {
                                startDate: {
                                  gte: taskRangeStart,
                                  lt: taskRangeEnd,
                                },
                              },
                              {
                                endDate: {
                                  gte: taskRangeStart,
                                  lt: taskRangeEnd,
                                },
                              },
                              {
                                startDate: {
                                  lt: taskRangeStart,
                                },
                                endDate: {
                                  gte: taskRangeEnd,
                                },
                              },
                              {
                                type: {
                                  in: ["SECTION_EXAM", "MOCK_EXAM", "ENTRANCE_EXAM"],
                                },
                                startDate: {
                                  gte: todayRange.start,
                                },
                              },
                            ],
                          },
                          orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
                        },
                        scores: {
                          include: {
                            subject: true,
                          },
                          orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }],
                          take: 12,
                        },
                        weakPoints: {
                          include: {
                            subject: true,
                          },
                          orderBy: { updatedAt: "desc" },
                          take: 12,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : null;

  const linkedStudents = currentUser?.guardianProfile?.studentLinks.map((link) => link.student) ?? [];
  const activeStudent = linkedStudents.find((student) => student.id === params?.studentId) ?? linkedStudents[0];
  const activeTodayTasks =
    activeStudent?.studyTasks.filter((task) => {
      const plannedDate = task.plannedDate.getTime();
      return plannedDate >= todayRange.start.getTime() && plannedDate < todayRange.end.getTime();
    }) ?? [];
  const activeWeekTasks =
    activeStudent?.studyTasks.filter((task) => {
      const plannedDate = task.plannedDate.getTime();
      return plannedDate >= week.start.getTime() && plannedDate < week.end.getTime();
    }) ?? [];
  const activeTodayFixedEvents = activeStudent
    ? activeFixedEventsForDate(activeStudent.fixedEvents, today.date, today.weekday, timeZone)
    : [];
  const activeTodayTutoringSessions =
    activeStudent ? activeTutoringSessionsForDate(activeStudent.tutoringSessions, today.date, today.weekday, timeZone) : [];
  const openTasks = activeTodayTasks.filter((task) => task.status === "PLANNED");
  const plannedMinutes = openTasks.reduce((total, task) => total + task.estimatedMinutes, 0);
  const activeClass = activeStudent?.classMemberships[0]?.classroom.name;
  const todaySchedule = activeStudent
    ? buildTodaySchedule({
        fixedEvents: activeTodayFixedEvents,
        tutoringSessions: activeTodayTutoringSessions,
        tasks: openTasks.map((task) => ({
          id: task.id,
          title: task.title,
          subjectName: task.subject?.name,
          type: task.type,
          estimatedMinutes: task.estimatedMinutes,
          priority: task.priority,
        })),
      })
    : null;
  const selectedTasks =
    activeStudent?.studyTasks.filter((task) => {
      const plannedDate = task.plannedDate.getTime();
      return plannedDate >= selectedDateRange.start.getTime() && plannedDate < selectedDateRange.end.getTime();
    }) ?? [];
  const selectedFixedEvents = activeStudent
    ? activeFixedEventsForDate(activeStudent.fixedEvents, selectedDate, selectedDay.weekday, timeZone)
    : [];
  const selectedTutoringSessions = activeStudent
    ? activeTutoringSessionsForDate(activeStudent.tutoringSessions, selectedDate, selectedDay.weekday, timeZone)
    : [];
  const selectedCalendarEvents = activeStudent?.calendarEvents.filter((event) => eventFallsOnDate(event, selectedDate, timeZone)) ?? [];
  const selectedOpenTasks = selectedTasks.filter((task) => task.status === "PLANNED");
  const selectedSchedule = activeStudent
    ? buildTodaySchedule({
        fixedEvents: selectedFixedEvents,
        tutoringSessions: selectedTutoringSessions,
        tasks: selectedOpenTasks.map((task) => ({
          id: task.id,
          title: task.title,
          subjectName: task.subject?.name,
          type: task.type,
          estimatedMinutes: task.estimatedMinutes,
          priority: task.priority,
        })),
      })
    : null;
  const activeTab = normalizeDashboardTab(params?.tab);
  const tabParams = activeStudent
    ? { studentId: activeStudent.id, date: selectedDate, week: selectedWeekDate, month: selectedMonthDate }
    : null;
  const formHref = (anchor: string) => (tabParams ? settingsSectionHref(anchor, tabParams) : anchor);
  const calendarDetailDays = activeStudent
    ? uniqueDates([...week.days.map((day) => day.date), ...month.days.map((day) => day.date), selectedDate]).map((date) => {
        const dateRange = getDayRange(date, timeZone);
        const dateWeek = getWeek(date, timeZone);
        const dateDay = dateWeek.days.find((day) => day.date === date) ?? today;
        const dateTasks = activeStudent.studyTasks.filter((task) => {
          const plannedDate = task.plannedDate.getTime();
          return plannedDate >= dateRange.start.getTime() && plannedDate < dateRange.end.getTime();
        });
        const dateFixedEvents = activeFixedEventsForDate(activeStudent.fixedEvents, date, dateDay.weekday, timeZone);
        const dateTutoringSessions = activeTutoringSessionsForDate(activeStudent.tutoringSessions, date, dateDay.weekday, timeZone);
        const dateCalendarEvents = activeStudent.calendarEvents.filter((event) => eventFallsOnDate(event, date, timeZone));
        const dateOpenTasks = dateTasks.filter((task) => task.status === "PLANNED");

        return {
          date,
          weekdayLabel: weekdayLabels[dateDay.weekday],
          isToday: date === today.date,
          fixedEvents: dateFixedEvents,
          tutoringSessions: dateTutoringSessions,
          calendarEvents: dateCalendarEvents,
          tasks: dateTasks,
          schedule: buildTodaySchedule({
            fixedEvents: dateFixedEvents,
            tutoringSessions: dateTutoringSessions,
            tasks: dateOpenTasks.map((task) => ({
              id: task.id,
              title: task.title,
              subjectName: task.subject?.name,
              type: task.type,
              estimatedMinutes: task.estimatedMinutes,
              priority: task.priority,
            })),
          }),
        };
      })
    : [];

  return (
    <main className="page">
      <section className="section">
        <div className="shell">
          <Link className="back-link" href="/">
            回首頁
          </Link>
          <span className="eyebrow">家長端</span>
          <h1 className="page-title">管理多位孩子的讀書計畫</h1>
          <p className="lead">
            家長用學生端提供的「學生連結碼」新增孩子。可同時管理國一、國二、國三等多位學生，每位學生的補習、作息、任務互相獨立。
          </p>

          {created && <div className="notice">家長資料已建立。{linked ? "已連結學生。" : "尚未連結學生，可在下方輸入學生連結碼。"}</div>}
          {linked && <div className="notice">學生已加入你的孩子清單。</div>}
          {scheduleUpdated && <div className="notice">孩子的讀書計畫資料已更新。</div>}
          {scheduleHistoryUpdated && <div className="notice">孩子今天的排程版本已儲存。</div>}
          {examPlanUpdated && <div className="notice">孩子的考前複習計畫已更新，剩餘進度已重新分配。</div>}
          {params?.learning === "1" && <div className="notice">孩子的學習成果資料已更新。</div>}

          {error === "email-required" && <div className="error-notice">請填寫 Email，之後才能從登入頁回到帳號。</div>}
          {error === "password-invalid" && <div className="error-notice">密碼長度必須為 8 到 128 個字元。</div>}
          {error === "account-exists" && (
            <div className="error-notice">這個 Email 已有帳號，請改用 <Link href="/login?role=GUARDIAN">家長登入頁</Link>。</div>
          )}
          {error === "student-code-not-found" && <div className="error-notice">找不到這組學生連結碼，請確認學生端顯示的連結碼是否輸入正確。</div>}
          {error === "student-not-linked" && <div className="error-notice">這位學生尚未和此家長連結，不能代填資料。</div>}
          {error === "exam-event-not-found" && <div className="error-notice">找不到可建立計畫的考試事件。</div>}
          {error === "exam-plan-date" && <div className="error-notice">複習開始日期必須早於考試日期。</div>}
          {error === "exam-plan-exists" && <div className="error-notice">這個考試與科目已經有複習計畫。</div>}
          {error === "exam-plan-not-found" && <div className="error-notice">找不到這個考前複習計畫。</div>}
          {error === "teacher-event-readonly" && <div className="error-notice">老師套用的班級事件只能由老師管理。</div>}
          {error === "fixed-event-date-range" && <div className="error-notice">固定作息結束日期不能早於開始日期。</div>}
          {error === "tutoring-date-range" && <div className="error-notice">補習結束日期不能早於開始日期。</div>}
          {error === "invalid-score" && <div className="error-notice">成績必須是 0 到 100 分，並填寫科目。</div>}
          {error === "invalid-weak-point" && <div className="error-notice">請填寫弱點科目與內容。</div>}

          {currentUser?.guardianProfile ? (
            <>
              <div className="session-card">
                <div>
                  <strong>{currentUser.displayName}</strong>
                  <p>已連結 {linkedStudents.length} 位學生。可以繼續新增孩子，也可以切換目前管理的孩子。</p>
                </div>
                <div className="inline-actions">
                  <Link className="button secondary" href="/account/security">帳號安全</Link>
                  <form action={signOut}>
                    <button className="button secondary" type="submit">登出</button>
                  </form>
                </div>
              </div>

              <div className="guardian-tools">
                <form className="form-card compact-form" id="link-student-form" action={linkStudentToGuardian}>
                  <h2>新增孩子</h2>
                  <label>
                    學生連結碼
                    <input name="studentLinkCode" placeholder="例如：SP7A1B2C3" required />
                  </label>
                  <button className="button primary" type="submit">
                    連結學生
                  </button>
                </form>

                <section className="panel child-switcher">
                  <div className="panel-header">
                    <h2>孩子清單</h2>
                    <span>{linkedStudents.length} 位</span>
                  </div>
                  <div className="child-list">
                    {linkedStudents.map((student) => (
                      <Link
                        className={student.id === activeStudent?.id ? "child-pill active" : "child-pill"}
                        href={`/guardian?studentId=${student.id}`}
                        key={student.id}
                      >
                        <strong>{student.user.displayName}</strong>
                        <span>
                          {gradeLabel(student.grade)}
                          {student.classMemberships[0]?.classroom.name ? `，${student.classMemberships[0].classroom.name}` : ""}
                        </span>
                      </Link>
                    ))}

                    {linkedStudents.length === 0 && (
                      <div className="empty-state">
                        <p>尚未連結學生。請先向孩子取得學生連結碼。</p>
                        <div className="empty-state-actions">
                          <a className="small-button" href="#link-student-form">＋ 連結第一位孩子</a>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {activeStudent ? (
                <>
                  <div className="active-student-heading">
                    <div>
                      <span className="card-meta">目前管理</span>
                      <h2>
                        {activeStudent.user.displayName}，{gradeLabel(activeStudent.grade)}
                        {activeClass ? `，${activeClass}` : ""}
                      </h2>
                    </div>
                    <span className="version-badge">
                      {today.date}，{timeZone}
                    </span>
                  </div>

                  {tabParams && (
                  <DashboardTabs activeTab={activeTab} hrefForTab={(tab) => dashboardTabHref(tab, tabParams)} />
                  )}

                  {activeTab === "today" && (
                  <DayDetailPanel
                    date={selectedDate}
                    timeZone={timeZone}
                    weekdayLabel={weekdayLabels[selectedDay.weekday]}
                    isToday={selectedDate === today.date}
                    fixedEvents={selectedFixedEvents}
                    tutoringSessions={selectedTutoringSessions}
                    calendarEvents={selectedCalendarEvents}
                    tasks={selectedTasks}
                    schedule={selectedSchedule}
                    fixedEventLabels={fixedEventLabels}
                    taskTypeLabels={taskTypeLabels}
                    calendarEventLabels={calendarEventLabels}
                    fatigueLabels={fatigueLabels}
                    statusLabels={statusLabels}
                    newStudyTaskHref={formHref("#new-study-task-form")}
                    newFixedEventHref={formHref("#new-fixed-event-form")}
                    newTutoringHref={formHref("#new-tutoring-form")}
                    newCalendarEventHref={formHref("#new-calendar-event-form")}
                  />
                  )}

                  {activeTab === "calendar" && (
                  <CalendarDayDetailBrowser
                    initialDate={selectedDate}
                    days={calendarDetailDays}
                    timeZone={timeZone}
                    fixedEventLabels={fixedEventLabels}
                    taskTypeLabels={taskTypeLabels}
                    calendarEventLabels={calendarEventLabels}
                    fatigueLabels={fatigueLabels}
                    statusLabels={statusLabels}
                    newStudyTaskHref={formHref("#new-study-task-form")}
                    newFixedEventHref={formHref("#new-fixed-event-form")}
                    newTutoringHref={formHref("#new-tutoring-form")}
                    newCalendarEventHref={formHref("#new-calendar-event-form")}
                  >
                    <WeekCalendar
                      calendarEvents={activeStudent.calendarEvents}
                      fixedEvents={activeStudent.fixedEvents}
                      tutoringSessions={activeStudent.tutoringSessions}
                      tasks={activeStudent.studyTasks}
                      week={week}
                      selectedWeekDate={selectedWeekDate}
                      selectedDate={selectedDate}
                      todayDate={today.date}
                      timeZone={timeZone}
                      studentId={activeStudent.id}
                    />

                    <MonthCalendar
                      calendarEvents={activeStudent.calendarEvents}
                      fixedEvents={activeStudent.fixedEvents}
                      tutoringSessions={activeStudent.tutoringSessions}
                      tasks={activeStudent.studyTasks}
                      month={month}
                      selectedMonthDate={selectedMonthDate}
                      selectedDate={selectedDate}
                      todayDate={today.date}
                      timeZone={timeZone}
                      studentId={activeStudent.id}
                    />
                  </CalendarDayDetailBrowser>
                  )}

                  {activeTab === "learning" && (
                  <LearningProgress
                    studentId={activeStudent.id}
                    scores={activeStudent.scores}
                    weakPoints={activeStudent.weakPoints}
                    weeklyTasks={activeWeekTasks}
                    today={today.date}
                    timeZone={timeZone}
                  />
                  )}

                  {activeTab === "learning" && (
                  <ExamReviewPlans
                    studentId={activeStudent.id}
                    plans={activeStudent.examReviewPlans}
                    examEvents={activeStudent.calendarEvents.filter((event) =>
                      ["SECTION_EXAM", "MOCK_EXAM", "ENTRANCE_EXAM"].includes(event.type),
                    )}
                    today={today.date}
                    timeZone={timeZone}
                  />
                  )}

                  {activeTab === "calendar" && (
                  <section className="panel event-panel">
                    <div className="panel-header">
                      <h2>近期考試 / 活動</h2>
                      <span>{activeStudent.calendarEvents.length} 筆</span>
                    </div>
                    <div className="task-list compact-list">
                      {activeStudent.calendarEvents.map((event) => (
                        <div className="task" key={event.id}>
                          <span className="task-dot" aria-hidden="true" />
                          <div>
                            <strong>
                              {calendarEventLabels[event.type]}：{event.title}
                            </strong>
                            <span>
                              {eventDateLabel(event, timeZone)}
                              {event.subjectName ? `，${event.subjectName}` : ""}
                            </span>
                          </div>
                            {event.source !== "TEACHER" && (
                              <form className="inline-actions" action={deleteCalendarEvent}>
                                <input name="studentId" type="hidden" value={activeStudent.id} />
                                <input name="calendarEventId" type="hidden" value={event.id} />
                                <button className="small-button danger-button" type="submit">
                                  刪除
                                </button>
                              </form>
                            )}
                        </div>
                      ))}

                      {activeStudent.calendarEvents.length === 0 && (
                        <div className="empty-state">
                          <p>本週或本月尚未輸入考試與學校活動。</p>
                          <div className="empty-state-actions">
                            <a className="small-button" href={formHref("#new-calendar-event-form")}>＋ 新增第一筆事件</a>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                  )}

                  {activeTab === "calendar" && (
                  <TutoringScheduleList
                    sessions={activeStudent.tutoringSessions}
                    studentId={activeStudent.id}
                    timeZone={timeZone}
                    newTutoringHref={formHref("#new-tutoring-form")}
                  />
                  )}

                  {activeTab === "today" && (
                  <>
                  <div className="dashboard-grid">
                    <section className="panel">
                      <div className="panel-header">
                        <h2>今天行程</h2>
                        <span>{weekdayLabels[today.weekday]}</span>
                      </div>

                      <div className="timeline-list">
                        {activeTodayFixedEvents.map((event) => (
                          <div className="timeline-item" key={event.id}>
                            <span className="timeline-time">
                              {event.startTime}-{event.endTime}
                            </span>
                            <div>
                              <strong>{event.title}</strong>
                              <p>{fixedEventLabels[event.type]}</p>
                            </div>
                            <form className="inline-actions" action={deleteFixedEvent}>
                              <input name="studentId" type="hidden" value={activeStudent.id} />
                              <input name="fixedEventId" type="hidden" value={event.id} />
                              <button className="small-button danger-button" type="submit">
                                刪除
                              </button>
                            </form>
                            <FixedEventEditor event={event} studentId={activeStudent.id} timeZone={timeZone} />
                          </div>
                        ))}

                        {activeTodayTutoringSessions.map((sessionItem) => (
                          <div className="timeline-item accent-item" key={sessionItem.id}>
                            <span className="timeline-time">
                              {sessionItem.startTime}-{sessionItem.endTime}
                            </span>
                            <div>
                              <strong>{sessionItem.subjectName}補習</strong>
                              <p>
                                疲勞 {fatigueLabels[sessionItem.fatigueLevel]}
                                {sessionItem.hasHomework ? "，有補習作業" : ""}
                                ，{tutoringSessionDateLabel(sessionItem, timeZone)}
                              </p>
                            </div>
                            <form className="inline-actions" action={deleteTutoringSession}>
                              <input name="studentId" type="hidden" value={activeStudent.id} />
                              <input name="tutoringSessionId" type="hidden" value={sessionItem.id} />
                              <button className="small-button danger-button" type="submit">
                                刪除
                              </button>
                            </form>
                            <TutoringSessionEditor sessionItem={sessionItem} studentId={activeStudent.id} timeZone={timeZone} />
                          </div>
                        ))}

                        {activeTodayFixedEvents.length === 0 && activeTodayTutoringSessions.length === 0 && (
                          <div className="empty-state">
                            <p>今天尚未輸入固定行程。</p>
                            <div className="empty-state-actions">
                              <a className="small-button" href={formHref("#new-fixed-event-form")}>＋ 新增作息</a>
                              <a className="small-button" href={formHref("#new-tutoring-form")}>＋ 新增補習</a>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="panel">
                      <div className="panel-header">
                        <h2>今天任務</h2>
                        <span>待完成約 {plannedMinutes} 分鐘</span>
                      </div>

                      <div className="task-list compact-list">
                        {activeTodayTasks.map((task) => (
                          <div className={task.status === "PLANNED" ? "task" : "task muted-task"} key={task.id}>
                            <span className="task-dot" aria-hidden="true" />
                            <div>
                              <strong>
                                {task.subject?.name ?? "未指定科目"}：{task.title}
                              </strong>
                              <span>
                                {taskTypeLabels[task.type]}，{task.estimatedMinutes} 分鐘，{statusLabels[task.status]}
                              </span>
                            </div>
                            {task.status === "PLANNED" ? (
                              <div className="inline-actions">
                              <form action={updateTaskStatus}>
                                <input name="studentId" type="hidden" value={activeStudent.id} />
                                <input name="taskId" type="hidden" value={task.id} />
                                <input name="status" type="hidden" value="DONE" />
                                <button className="small-button" type="submit">
                                  代勾完成
                                </button>
                              </form>
                                <form action={updateTaskStatus}>
                                  <input name="studentId" type="hidden" value={activeStudent.id} />
                                  <input name="taskId" type="hidden" value={task.id} />
                                  <input name="status" type="hidden" value="RESCHEDULED" />
                                  <button className="small-button" type="submit">
                                    延後
                                  </button>
                                </form>
                                <form action={updateTaskStatus}>
                                  <input name="studentId" type="hidden" value={activeStudent.id} />
                                  <input name="taskId" type="hidden" value={task.id} />
                                  <input name="status" type="hidden" value="SKIPPED" />
                                  <button className="small-button" type="submit">
                                    略過
                                  </button>
                                </form>
                                {!task.examReviewPlanId && (
                                  <form action={deleteStudyTask}>
                                    <input name="studentId" type="hidden" value={activeStudent.id} />
                                    <input name="taskId" type="hidden" value={task.id} />
                                    <button className="small-button danger-button" type="submit">
                                      刪除
                                    </button>
                                  </form>
                                )}
                              </div>
                            ) : (
                              <div className="inline-actions">
                                <span className="time">{statusLabels[task.status]}</span>
                                {!task.examReviewPlanId && (
                                  <form action={deleteStudyTask}>
                                    <input name="studentId" type="hidden" value={activeStudent.id} />
                                    <input name="taskId" type="hidden" value={task.id} />
                                    <button className="small-button danger-button" type="submit">
                                      刪除
                                    </button>
                                  </form>
                                )}
                              </div>
                            )}
                            {task.status === "PLANNED" ? <PartialProgressForm taskId={task.id} studentId={activeStudent.id} /> : null}
                            {!task.examReviewPlanId && (
                              <StudyTaskEditor task={task} studentId={activeStudent.id} timeZone={timeZone} />
                            )}
                          </div>
                        ))}

                        {activeTodayTasks.length === 0 && (
                          <div className="empty-state">
                            <p>今天尚未輸入任務。</p>
                            <div className="empty-state-actions">
                              <a className="small-button" href={formHref("#new-study-task-form")}>＋ 新增第一筆任務</a>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>

                  {todaySchedule && (
                    <section className="panel schedule-panel">
                      <div className="panel-header">
                        <h2>系統自動排程</h2>
                        <span>
                          可排 {todaySchedule.availableMinutes} 分鐘，已排讀書 {todaySchedule.scheduledStudyMinutes} 分鐘
                        </span>
                      </div>

                      <div className="inline-actions">
                        <form action={saveTodaySchedule}>
                          <input name="studentId" type="hidden" value={activeStudent.id} />
                          <input name="trigger" type="hidden" value="SAVED" />
                          <button className="small-button" type="submit">儲存目前排程</button>
                        </form>
                        <form action={saveTodaySchedule}>
                          <input name="studentId" type="hidden" value={activeStudent.id} />
                          <input name="trigger" type="hidden" value="REGENERATED" />
                          <button className="small-button" type="submit">重新產生並儲存</button>
                        </form>
                      </div>

                      <div className="timeline-list">
                        {todaySchedule.scheduled.map((segment) => (
                          <div className={`timeline-item schedule-${segment.kind}`} key={segment.id}>
                            <span className="timeline-time">
                              {segment.startTime}-{segment.endTime}
                            </span>
                            <div>
                              <strong>{segment.title}</strong>
                              <p>{segment.detail}</p>
                            </div>
                          </div>
                        ))}

                        {todaySchedule.scheduled.length === 0 && (
                          <div className="empty-state">
                            <p>今天還沒有可排程資料。</p>
                            <div className="empty-state-actions">
                              <a className="small-button" href={formHref("#new-study-task-form")}>＋ 新增第一筆任務</a>
                            </div>
                          </div>
                        )}
                      </div>

                      {todaySchedule.unplaced.length > 0 && (
                        <div className="unplaced-list">
                          <strong>今天排不下</strong>
                          {todaySchedule.unplaced.map((segment) => (
                            <p key={segment.id}>{segment.title}：{segment.detail}</p>
                          ))}
                          <form className="unplaced-actions" action={moveTasksToTomorrow}>
                            <input name="studentId" type="hidden" value={activeStudent.id} />
                            {todaySchedule.unplaced.map((segment) =>
                              segment.taskId ? <input key={segment.taskId} name="taskId" type="hidden" value={segment.taskId} /> : null,
                            )}
                            <button className="small-button" type="submit">
                              全部延到明天
                            </button>
                          </form>
                        </div>
                      )}
                    </section>
                  )}

                  <ScheduleHistory runs={activeStudent.scheduleRuns} timeZone={timeZone} />
                  </>
                  )}

                  {activeTab === "settings" && (
                  <div className="form-grid">
                    <form className="form-card" id="new-tutoring-form" action={createTutoringSession}>
                      <h2>替 {activeStudent.user.displayName} 代填補習</h2>
                      <input name="studentId" type="hidden" value={activeStudent.id} />
                      <label>
                        科目
                        <input name="subjectName" placeholder="例如：數學" required />
                      </label>
                      <WeekdayCheckboxGroup defaultWeekday={today.weekday} />
                      <div className="field-row">
                        <label>
                          開始日期
                          <input name="startDate" type="date" />
                        </label>
                        <label>
                          結束日期
                          <input name="endDate" type="date" />
                        </label>
                      </div>
                      <div className="field-row">
                        <label>
                          開始
                          <input name="startTime" type="time" defaultValue="18:30" required />
                        </label>
                        <label>
                          結束
                          <input name="endTime" type="time" defaultValue="20:30" required />
                        </label>
                      </div>
                      <label>
                        通勤分鐘
                        <input name="commuteMinutes" type="number" min="0" defaultValue="0" />
                      </label>
                      <label>
                        疲勞程度
                        <select name="fatigueLevel" defaultValue="NORMAL">
                          <option value="LOW">低</option>
                          <option value="NORMAL">普通</option>
                          <option value="HIGH">高</option>
                        </select>
                      </label>
                      <label className="checkbox-label">
                        <input name="hasHomework" type="checkbox" /> 這堂補習通常有作業
                      </label>
                      <button className="button primary" type="submit">
                        加入補習
                      </button>
                    </form>

                    <form className="form-card" id="new-fixed-event-form" action={createFixedEvent}>
                      <h2>替 {activeStudent.user.displayName} 代填作息</h2>
                      <input name="studentId" type="hidden" value={activeStudent.id} />
                      <label>
                        名稱
                        <input name="title" placeholder="例如：晚餐、洗澡、睡覺" required />
                      </label>
                      <label>
                        類型
                        <select name="type" defaultValue="MEAL">
                          {Object.entries(fixedEventLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <WeekdayCheckboxGroup defaultWeekday={today.weekday} />
                      <div className="field-row">
                        <label>
                          開始日期
                          <input name="startDate" type="date" />
                        </label>
                        <label>
                          結束日期
                          <input name="endDate" type="date" />
                        </label>
                      </div>
                      <div className="field-row">
                        <label>
                          開始
                          <input name="startTime" type="time" defaultValue="18:00" required />
                        </label>
                        <label>
                          結束
                          <input name="endTime" type="time" defaultValue="18:30" required />
                        </label>
                      </div>
                      <button className="button primary" type="submit">
                        加入作息
                      </button>
                    </form>

                    <form className="form-card" id="new-study-task-form" action={createStudyTask}>
                      <h2>替 {activeStudent.user.displayName} 代填作業 / 自習</h2>
                      <input name="studentId" type="hidden" value={activeStudent.id} />
                      <label>
                        科目
                        <input name="subjectName" placeholder="例如：英文" />
                      </label>
                      <label>
                        任務
                        <input name="title" placeholder="例如：完成習作第 12 頁" required />
                      </label>
                      <label>
                        類型
                        <select name="type" defaultValue="SCHOOL_HOMEWORK">
                          {Object.entries(taskTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        日期
                        <input name="plannedDate" type="date" defaultValue={today.date} required />
                      </label>
                      <div className="field-row">
                        <label>
                          預估分鐘
                          <input name="estimatedMinutes" type="number" min="10" step="5" defaultValue="30" />
                        </label>
                        <label>
                          優先度
                          <input name="priority" type="number" min="1" max="5" defaultValue="3" />
                        </label>
                      </div>
                      <button className="button primary" type="submit">
                        加入任務
                      </button>
                    </form>
                    <form className="form-card" id="new-calendar-event-form" action={createCalendarEvent}>
                      <h2>替 {activeStudent.user.displayName} 新增考試 / 學校活動</h2>
                      <input name="studentId" type="hidden" value={activeStudent.id} />
                      <label>
                        類型
                        <select name="type" defaultValue="SECTION_EXAM">
                          {calendarEventOptions.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        標題
                        <input name="title" placeholder="例如：第一次段考、校慶、報名截止" required />
                      </label>
                      <label>
                        科目
                        <input name="subjectName" placeholder="可留空；例如：數學、英文" />
                      </label>
                      <div className="field-row">
                        <label>
                          開始日期
                          <input name="startDate" type="date" defaultValue={today.date} required />
                        </label>
                        <label>
                          結束日期
                          <input name="endDate" type="date" />
                        </label>
                      </div>
                      <label>
                        備註
                        <input name="note" placeholder="例如：範圍、攜帶物品、報名資訊" />
                      </label>
                      <button className="button primary" type="submit">
                        新增事件
                      </button>
                    </form>
                  </div>
                  )}
                </>
              ) : null}
            </>
          ) : (
            <form className="form-card narrow-form" action={createGuardian}>
              <h2>建立家長資料</h2>
              <p className="panel-copy">這裡只建立新帳號。已有家長帳號請前往 <Link href="/login?role=GUARDIAN">登入頁</Link>。</p>
              <label>
                家長姓名
                <input name="displayName" placeholder="例如：王媽媽" required />
              </label>

              <label>
                家長 Email
                <input name="email" type="email" autoComplete="email" placeholder="家長使用的 Email" required />
              </label>

              <label>
                密碼
                <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
              </label>

              <label>
                第一位孩子的學生連結碼
                <input name="studentLinkCode" placeholder="可空白，之後也能新增" />
              </label>

              <button className="button primary" type="submit">
                建立家長資料
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
