import Link from "next/link";
import { CalendarEventType, FatigueLevel, FixedEventType, TaskStatus, TaskType, Weekday } from "@prisma/client";
import type { CalendarEvent, FixedEvent, StudyTask, StudyWindow, Subject, TutoringSession } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { buildTodaySchedule } from "@/lib/scheduler/today";
import { buildTodayList } from "@/lib/scheduler/today-list";
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
import { studyWindowFallsOnDate } from "@/lib/study-windows";
import { fixedEventFallsOnDate } from "@/lib/fixed-events";
import { ExamReviewPlans } from "@/app/components/exam-review-plans";
import { LearningProgress } from "@/app/components/learning-progress";
import { CalendarDayDetailBrowser } from "@/app/components/calendar-day-detail-browser";
import { CalendarExportTools } from "@/app/components/calendar-export-tools";
import { StudyWindowSettings } from "@/app/components/study-window-settings";
import { StudyTaskContinuousForm, StudyTaskImportHistory, StudyTaskImportPanel } from "@/app/components/study-task-tools";
import { buildStudyTaskImportBatches } from "@/lib/study-task-import-history";
import { createStudent, signOut } from "../onboarding/actions";
import {
  createFixedEvent,
  createCalendarEvent,
  createTutoringSession,
  deleteFixedEvent,
  deleteStudyTask,
  deleteTutoringSession,
  updateFixedEvent,
  updateStudyTask,
  updateTaskStatus,
  updateTutoringSession,
} from "../schedule/actions";

type StudentPageProps = {
  searchParams?: Promise<{
    created?: string;
    error?: string;
    joined?: string;
    schedule?: string;
    scheduleHistory?: string;
    examPlan?: string;
    learning?: string;
    tab?: string;
    date?: string;
    week?: string;
    month?: string;
    view?: string;
    imported?: string;
    deletedBatch?: string;
    importErrors?: string;
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

const routineFixedEventTypes = new Set<FixedEventType>([
  FixedEventType.COMMUTE,
  FixedEventType.MEAL,
  FixedEventType.HYGIENE,
  FixedEventType.SLEEP,
]);

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
type CalendarView = "month" | "week";

const dashboardTabs: Array<{ value: DashboardTab; label: string }> = [
  { value: "today", label: "今日" },
  { value: "calendar", label: "行事曆" },
  { value: "learning", label: "成績與弱點" },
  { value: "settings", label: "設定" },
];

function normalizeDashboardTab(value?: string): DashboardTab {
  return value === "calendar" || value === "learning" || value === "settings" ? value : "today";
}

function normalizeCalendarView(value?: string): CalendarView {
  return value === "week" ? "week" : "month";
}

function gradeLabel(grade: number) {
  return `國${grade - 6}`;
}

function formatHourEstimate(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0 && remainingMinutes > 0) return `${hours} 小時 ${remainingMinutes} 分`;
  if (hours > 0) return `${hours} 小時`;
  return `${remainingMinutes} 分`;
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

function activeTutoringSessionsForDate(tutoringSessions: TutoringSession[], date: string, weekday: Weekday, timeZone: string) {
  return tutoringSessions.filter(
    (sessionItem) => sessionItem.weekday === weekday && tutoringSessionFallsOnDate(sessionItem, date, timeZone),
  );
}

function activeFixedEventsForDate(fixedEvents: FixedEvent[], date: string, weekday: Weekday, timeZone: string) {
  return fixedEvents.filter((event) => event.weekday === weekday && fixedEventFallsOnDate(event, date, timeZone));
}

function activeStudyWindowsForDate(studyWindows: StudyWindow[], date: string, weekday: Weekday, timeZone: string) {
  return studyWindows.filter((window) => window.weekday === weekday && studyWindowFallsOnDate(window, date, timeZone));
}

function uniqueDates(dates: string[]) {
  return Array.from(new Set(dates));
}

type MonthDayItem = {
  label: string;
  sortMinutes: number;
  tone: "fixed" | "tutoring" | "event" | "task";
};

function minutesFromTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function shortLabel(value: string, maxLength = 8) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function buildMonthDayItems({
  fixedEvents,
  tutoringSessions,
  calendarEvents,
  tasks,
}: {
  fixedEvents: FixedEvent[];
  tutoringSessions: TutoringSession[];
  calendarEvents: CalendarEvent[];
  tasks: StudyTaskWithSubject[];
}) {
  const fixedItems: MonthDayItem[] = fixedEvents
    .filter((event) => !routineFixedEventTypes.has(event.type))
    .map((event) => ({
      label: `${event.startTime} ${shortLabel(event.title, 5)}`,
      sortMinutes: minutesFromTime(event.startTime),
      tone: "fixed",
    }));
  const tutoringItems: MonthDayItem[] = tutoringSessions.map((sessionItem) => ({
    label: `${sessionItem.startTime} ${shortLabel(sessionItem.subjectName, 5)}`,
    sortMinutes: minutesFromTime(sessionItem.startTime),
    tone: "tutoring",
  }));
  const eventItems: MonthDayItem[] = calendarEvents.map((event) => ({
    label: shortLabel(event.title, 7),
    sortMinutes: 23 * 60,
    tone: "event",
  }));
  const taskItems: MonthDayItem[] = tasks.map((task) => ({
    label: shortLabel(task.subject?.name ?? task.title, 7),
    sortMinutes: 24 * 60,
    tone: "task",
  }));

  return [...fixedItems, ...tutoringItems, ...eventItems, ...taskItems].sort(
    (left, right) => left.sortMinutes - right.sortMinutes || left.label.localeCompare(right.label),
  );
}

function calendarHref(params: { tab?: DashboardTab; date?: string; week?: string; month?: string; view?: CalendarView }) {
  const query = new URLSearchParams();
  if (params.tab) query.set("tab", params.tab);
  if (params.date) query.set("date", params.date);
  if (params.week) query.set("week", params.week);
  if (params.month) query.set("month", params.month);
  if (params.view) query.set("view", params.view);
  const value = query.toString();
  return value ? `/student?${value}` : "/student";
}

function dashboardTabHref(tab: DashboardTab, params: { date: string; week: string; month: string; view: CalendarView }) {
  return calendarHref({ tab, date: params.date, week: params.week, month: params.month, view: params.view });
}

function settingsSectionHref(anchor: string, params: { date: string; week: string; month: string; view: CalendarView }) {
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
          data-nav-feedback
          data-pending-label={`正在切換到${tab.label}`}
          key={tab.value}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function CalendarViewSwitcher({
  activeView,
  hrefForView,
}: {
  activeView: CalendarView;
  hrefForView: (view: CalendarView) => string;
}) {
  return (
    <div className="calendar-view-switcher" aria-label="行事曆顯示模式">
      <Link
        className={activeView === "month" ? "calendar-view-button active" : "calendar-view-button"}
        href={hrefForView("month")}
        data-nav-feedback
        data-pending-label="正在載入月行事曆"
      >
        月行事曆
      </Link>
      <Link
        className={activeView === "week" ? "calendar-view-button active" : "calendar-view-button"}
        href={hrefForView("week")}
        data-nav-feedback
        data-pending-label="正在載入週行事曆"
      >
        週行事曆
      </Link>
    </div>
  );
}

function FixedEventEditor({ event, timeZone }: { event: FixedEvent; timeZone: string }) {
  return (
    <details className="item-editor">
      <summary>編輯</summary>
      <form action={updateFixedEvent}>
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

function TutoringSessionEditor({ sessionItem, timeZone }: { sessionItem: TutoringSession; timeZone: string }) {
  return (
    <details className="item-editor">
      <summary>編輯</summary>
      <form action={updateTutoringSession}>
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

type StudyTaskWithSubject = StudyTask & {
  subject: Subject | null;
};

function StudyTaskEditor({ task, timeZone }: { task: StudyTaskWithSubject; timeZone: string }) {
  return (
    <div className="item-editor task-editor-panel">
      <strong>編輯任務</strong>
      <form action={updateStudyTask}>
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
            指定開始
            <input name="plannedStartTime" type="time" defaultValue={task.plannedStartTime ?? ""} />
          </label>
          <label>
            指定結束
            <input name="plannedEndTime" type="time" defaultValue={task.plannedEndTime ?? ""} />
          </label>
        </div>
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
    </div>
  );
}

function PartialProgressForm({ taskId }: { taskId: string }) {
  return (
    <details className="item-editor progress-editor">
      <summary>部分完成</summary>
      <form action={updateTaskStatus}>
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
          <Link className="small-button" href={calendarHref({ tab: "calendar", date: addDateDays(selectedWeekDate, -7), week: addDateDays(selectedWeekDate, -7), view: "week" })} data-nav-feedback data-pending-label="正在載入上一週">上一週</Link>
          <Link className="small-button" href={calendarHref({ tab: "calendar", date: todayDate, week: todayDate, view: "week" })} data-nav-feedback data-pending-label="正在載入本週">本週</Link>
          <Link className="small-button" href={calendarHref({ tab: "calendar", date: addDateDays(selectedWeekDate, 7), week: addDateDays(selectedWeekDate, 7), view: "week" })} data-nav-feedback data-pending-label="正在載入下一週">下一週</Link>
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
              href={calendarHref({ tab: "calendar", date: day.date, week: day.date, month: day.date, view: "week" })}
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
          <Link className="small-button" href={calendarHref({ tab: "calendar", date: addMonths(selectedMonthDate, -1), month: addMonths(selectedMonthDate, -1), view: "month" })} data-nav-feedback data-pending-label="正在載入上個月">上個月</Link>
          <Link className="small-button" href={calendarHref({ tab: "calendar", date: todayDate, month: todayDate, view: "month" })} data-nav-feedback data-pending-label="正在載入本月">本月</Link>
          <Link className="small-button" href={calendarHref({ tab: "calendar", date: addMonths(selectedMonthDate, 1), month: addMonths(selectedMonthDate, 1), view: "month" })} data-nav-feedback data-pending-label="正在載入下個月">下個月</Link>
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
          const visibleFixedEvents = dayFixedEvents.filter((event) => !routineFixedEventTypes.has(event.type));
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
          const itemCount = dayTutoringSessions.length + dayCalendarEvents.length + visibleFixedEvents.length + dayTasks.length;
          const dayItems = buildMonthDayItems({
            fixedEvents: visibleFixedEvents,
            tutoringSessions: dayTutoringSessions,
            calendarEvents: dayCalendarEvents,
            tasks: dayTasks,
          });
          const visibleDayItems = dayItems.slice(0, 3);
          const hiddenDayItemCount = Math.max(0, dayItems.length - visibleDayItems.length);

          return (
            <Link
              className={dayClassName}
              href={calendarHref({ tab: "calendar", date: day.date, week: day.date, month: day.date, view: "month" })}
              data-calendar-date={day.date}
              key={day.date}
            >
              <div className="month-day-header">
                <strong>{day.dayNumber}</strong>
                {minutes > 0 && <span>{minutes} 分</span>}
              </div>
              <div className="month-day-items" aria-label={`${day.date} ${itemCount} 個項目`}>
                {visibleDayItems.map((item, index) => (
                  <span className={`month-day-item ${item.tone}`} title={item.label} key={`${item.tone}-${index}`}>
                    {item.label}
                  </span>
                ))}
                {hiddenDayItemCount > 0 && <span className="month-day-more">+{hiddenDayItemCount}</span>}
              </div>
              <div className="calendar-day-summary" aria-label={`${day.date} ${itemCount} 個項目`}>
                {dayTutoringSessions.length > 0 && <span className="summary-dot tutoring" title={`${dayTutoringSessions.length} 補習`} />}
                {dayCalendarEvents.length > 0 && <span className="summary-dot event" title={`${dayCalendarEvents.length} 事件`} />}
                {visibleFixedEvents.length > 0 && <span className="summary-dot fixed" title={`${visibleFixedEvents.length} 作息`} />}
                {dayTasks.length > 0 && <span className="summary-chip task">{dayTasks.length} 任</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default async function StudentPage({ searchParams }: StudentPageProps) {
  const params = await searchParams;
  const created = params?.created === "1";
  const joined = params?.joined === "1";
  const scheduleUpdated = params?.schedule === "1";
  const scheduleHistoryUpdated = params?.scheduleHistory === "1";
  const examPlanUpdated = params?.examPlan === "1";
  const error = params?.error;
  const timeZone = await getRequestTimeZone();
  const today = getCurrentDay(timeZone);
  const todayRange = getDayRange(today.date, timeZone);
  const selectedDate = normalizeDateInput(params?.date, today.date);
  const selectedDateRange = getDayRange(selectedDate, timeZone);
  const selectedWeekDate = normalizeDateInput(params?.week, today.date);
  const selectedMonthDate = normalizeDateInput(params?.month, today.date);
  const calendarView = normalizeCalendarView(params?.view);
  const week = getWeek(selectedWeekDate, timeZone);
  const month = getMonth(selectedMonthDate, timeZone);
  const taskRangeStart = new Date(Math.min(week.start.getTime(), month.start.getTime(), selectedDateRange.start.getTime()));
  const taskRangeEnd = new Date(Math.max(week.end.getTime(), month.end.getTime(), selectedDateRange.end.getTime()));
  const session = await getCurrentSession();
  const currentUser =
    session?.role === "STUDENT"
      ? await prisma.user.findUnique({
          where: {
            id: session.userId,
          },
          include: {
            studentProfile: {
              include: {
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
                studyWindows: {
                  orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
                },
                tutoringSessions: {
                  orderBy: {
                    startTime: "asc",
                  },
                },
                studyTasks: {
                  where: {
                    plannedDate: {
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
        })
      : null;

  const student = currentUser?.studentProfile;
  const className = student?.classMemberships[0]?.classroom.name;
  const importBatchTasks = student
    ? await prisma.studyTask.findMany({
        where: {
          studentId: student.id,
          importBatchId: {
            not: null,
          },
        },
        select: {
          importBatchId: true,
          plannedDate: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    : [];
  const importBatches = buildStudyTaskImportBatches(importBatchTasks, timeZone);
  const todayTasks =
    student?.studyTasks.filter((task) => {
      const plannedDate = task.plannedDate.getTime();
      return plannedDate >= todayRange.start.getTime() && plannedDate < todayRange.end.getTime();
    }) ?? [];
  const weekTasks =
    student?.studyTasks.filter((task) => {
      const plannedDate = task.plannedDate.getTime();
      return plannedDate >= week.start.getTime() && plannedDate < week.end.getTime();
    }) ?? [];
  const todayFixedEvents = student ? activeFixedEventsForDate(student.fixedEvents, today.date, today.weekday, timeZone) : [];
  const todayStudyWindows = student ? activeStudyWindowsForDate(student.studyWindows, today.date, today.weekday, timeZone) : [];
  const todayTutoringSessions = student
    ? activeTutoringSessionsForDate(student.tutoringSessions, today.date, today.weekday, timeZone)
    : [];
  const openTasks = todayTasks.filter((task) => task.status === "PLANNED");
  const todayDoneTasks = todayTasks.filter((task) => task.status !== "PLANNED");
  const backlogTasks =
    student?.studyTasks.filter((task) => task.status === "PLANNED" && task.plannedDate.getTime() < todayRange.end.getTime()) ?? [];
  const plannedMinutes = openTasks.reduce((total, task) => total + task.estimatedMinutes, 0);
  const todaySchedule = student
    ? buildTodaySchedule({
        fixedEvents: todayFixedEvents,
        studyWindows: todayStudyWindows,
        tutoringSessions: todayTutoringSessions,
        tasks: [],
      })
    : null;
  const todayList =
    todaySchedule && backlogTasks.length > 0
      ? buildTodayList({
          todayDate: today.date,
          availableMinutes: todaySchedule.availableMinutes,
          timeZone,
          tasks: backlogTasks.map((task) => ({
            id: task.id,
            title: task.title,
            subjectName: task.subject?.name,
            type: task.type,
            estimatedMinutes: task.estimatedMinutes,
            priority: task.priority,
            weekHint: task.weekHint,
          })),
        })
      : null;
  const selectedTodayTasks = todayList
    ? todayList.todayList.flatMap((item) => {
        const task = backlogTasks.find((backlogTask) => backlogTask.id === item.id);
        return task ? [{ item, task }] : [];
      })
    : [];
  const activeTab = normalizeDashboardTab(params?.tab);
  const tabParams = { date: selectedDate, week: selectedWeekDate, month: selectedMonthDate, view: calendarView };
  const formHref = (anchor: string) => settingsSectionHref(anchor, tabParams);
  const calendarDetailDays = student
    ? uniqueDates([...week.days.map((day) => day.date), ...month.days.map((day) => day.date), selectedDate]).map((date) => {
        const dateRange = getDayRange(date, timeZone);
        const dateWeek = getWeek(date, timeZone);
        const dateDay = dateWeek.days.find((day) => day.date === date) ?? today;
        const dateTasks = student.studyTasks.filter((task) => {
          const plannedDate = task.plannedDate.getTime();
          return plannedDate >= dateRange.start.getTime() && plannedDate < dateRange.end.getTime();
        });
        const dateFixedEvents = activeFixedEventsForDate(student.fixedEvents, date, dateDay.weekday, timeZone);
        const dateStudyWindows = activeStudyWindowsForDate(student.studyWindows, date, dateDay.weekday, timeZone);
        const dateTutoringSessions = activeTutoringSessionsForDate(student.tutoringSessions, date, dateDay.weekday, timeZone);
        const dateCalendarEvents = student.calendarEvents.filter((event) => eventFallsOnDate(event, date, timeZone));
        const dateSchedule = buildTodaySchedule({
          fixedEvents: dateFixedEvents,
          studyWindows: dateStudyWindows,
          tutoringSessions: dateTutoringSessions,
          tasks: [],
        });
        const dateBacklogTasks = student.studyTasks.filter(
          (task) => task.status === "PLANNED" && task.plannedDate.getTime() < dateRange.end.getTime(),
        );
        const dateTodayList = buildTodayList({
          todayDate: date,
          availableMinutes: dateSchedule.availableMinutes,
          timeZone,
          tasks: dateBacklogTasks.map((task) => ({
            id: task.id,
            title: task.title,
            subjectName: task.subject?.name,
            type: task.type,
            estimatedMinutes: task.estimatedMinutes,
            priority: task.priority,
            weekHint: task.weekHint,
          })),
        });
        const dateListTasks = dateTodayList.todayList.flatMap((item) => {
          const task = dateBacklogTasks.find((backlogTask) => backlogTask.id === item.id);
          return task ? [task] : [];
        });

        return {
          date,
          weekdayLabel: weekdayLabels[dateDay.weekday],
          isToday: date === today.date,
          fixedEvents: dateFixedEvents,
          studyWindows: dateStudyWindows,
          tutoringSessions: dateTutoringSessions,
          calendarEvents: dateCalendarEvents,
          tasks: [...dateListTasks, ...dateTasks.filter((task) => task.status !== "PLANNED")],
          schedule: dateSchedule,
        };
      })
    : [];

  return (
    <main className="page">
      <section className={student ? "section compact-dashboard-section" : "section"}>
        <div className="shell">
          <Link className="back-link" href="/">
            回首頁
          </Link>
          <span className="eyebrow">學生端</span>
          <h1 className="page-title">我的放學後讀書計畫</h1>
          <p className="lead">
            學生先建立自己的讀書資料，再把連結碼給家長。補習、作息與今天任務都可以在這裡快速輸入。
          </p>

          {created && <div className="notice">學生資料已建立。{joined ? "已加入班級。" : "尚未加入班級，可之後補上班級代碼。"}</div>}
          {scheduleUpdated && <div className="notice">讀書計畫資料已更新。</div>}
          {scheduleHistoryUpdated && <div className="notice">今天的排程版本已儲存。</div>}
          {examPlanUpdated && <div className="notice">考前複習計畫已更新，剩餘進度已重新分配。</div>}
          {params?.learning === "1" && <div className="notice">學習成果資料已更新。</div>}
          {params?.imported && <div className="notice">已匯入 {params.imported} 筆任務。</div>}
          {params?.deletedBatch && <div className="notice">已刪除 {params.deletedBatch} 筆匯入任務。</div>}
          {error === "email-required" && <div className="error-notice">請填寫 Email，之後才能從登入頁回到帳號。</div>}
          {error === "password-invalid" && <div className="error-notice">密碼長度必須為 8 到 128 個字元。</div>}
          {error === "account-exists" && (
            <div className="error-notice">這個 Email 已有帳號，請改用 <Link href="/login?role=STUDENT">學生登入頁</Link>。</div>
          )}
          {error === "exam-event-not-found" && <div className="error-notice">找不到可建立計畫的考試事件。</div>}
          {error === "exam-plan-date" && <div className="error-notice">複習開始日期必須早於考試日期。</div>}
          {error === "exam-plan-exists" && <div className="error-notice">這個考試與科目已經有複習計畫。</div>}
          {error === "exam-plan-not-found" && <div className="error-notice">找不到這個考前複習計畫。</div>}
          {error === "teacher-event-readonly" && <div className="error-notice">老師套用的班級事件只能由老師管理。</div>}
          {error === "fixed-event-date-range" && <div className="error-notice">固定作息結束日期不能早於開始日期。</div>}
          {error === "study-window-date-range" && <div className="error-notice">可讀書時段的結束日期不能早於開始日期。</div>}
          {error === "study-window-time-range" && <div className="error-notice">可讀書時段的結束時間必須晚於開始時間。</div>}
          {error === "study-window-not-found" && <div className="error-notice">找不到這筆可讀書時段設定。</div>}
          {error === "tutoring-date-range" && <div className="error-notice">補習結束日期不能早於開始日期。</div>}
          {error === "task-import" && <div className="error-notice">CSV 匯入失敗：{params?.importErrors ?? "請檢查格式。"}</div>}
          {error === "task-time-range" && <div className="error-notice">任務指定時間必須同時填開始與結束，且至少 10 分鐘、結束晚於開始。</div>}
          {error === "task-import-batch-required" && <div className="error-notice">缺少匯入批次代碼，無法刪除整批任務。</div>}
          {error === "invalid-score" && <div className="error-notice">成績必須是 0 到 100 分，並填寫科目。</div>}
          {error === "invalid-weak-point" && <div className="error-notice">請填寫弱點科目與內容。</div>}

          {student ? (
            <>
              <div className="session-card compact-session-card dashboard-topbar">
                <div className="dashboard-identity">
                  <strong>{currentUser.displayName}</strong>
                  <p>
                    {gradeLabel(student.grade)}
                    {className ? `，${className}` : "，尚未加入班級"}。今天是 {weekdayLabels[today.weekday]}，待完成任務約{" "}
                    {plannedMinutes} 分鐘。
                  </p>
                </div>
                <DashboardTabs activeTab={activeTab} hrefForTab={(tab) => dashboardTabHref(tab, tabParams)} />
                <div className="inline-actions dashboard-account-actions">
                  <Link className="button secondary" href="/account/security">帳號安全</Link>
                  <form action={signOut}>
                    <button className="button secondary" type="submit">登出</button>
                  </form>
                </div>
              </div>

              {activeTab === "today" && (
              <section className="panel schedule-panel">
                <div className="panel-header">
                  <div>
                    <h2>今日優先清單</h2>
                    <p className="panel-copy">
                      今天可讀約 {formatHourEstimate(todaySchedule?.availableMinutes ?? 0)}
                    </p>
                  </div>
                  <span>
                    {todayList?.selectedMinutes ?? 0}/{todaySchedule?.availableMinutes ?? 0} 分
                  </span>
                </div>

                <div className="task-list compact-list">
                  {selectedTodayTasks.map(({ item, task }) => (
                    <div className="task" key={task.id}>
                      <span className="task-dot" aria-hidden="true" />
                      <div>
                        <strong>
                          {task.subject?.name ?? "未指定科目"}：{task.title}
                        </strong>
                        <span>
                          {taskTypeLabels[task.type]}，{task.estimatedMinutes} 分鐘，優先度 {task.priority}
                          {item.overdueWeeks > 0 ? `，落後 ${item.overdueWeeks} 週` : ""}
                        </span>
                      </div>
                      <div className="inline-actions">
                        <form action={updateTaskStatus}>
                          <input name="taskId" type="hidden" value={task.id} />
                          <input name="status" type="hidden" value="DONE" />
                          <button className="small-button" type="submit">
                            完成
                          </button>
                        </form>
                        <PartialProgressForm taskId={task.id} />
                      </div>
                    </div>
                  ))}

                  {selectedTodayTasks.length === 0 && (
                    <div className="empty-state">
                      <p>今天沒有需要排入清單的待辦任務。</p>
                      <div className="empty-state-actions">
                        <a className="small-button" href={formHref("#new-study-task-form")}>＋ 新增任務</a>
                      </div>
                    </div>
                  )}
                </div>

                {todayList && todayList.backlog.count > 0 && (
                  <p className="panel-copy">
                    Backlog 尚有 {todayList.backlog.count} 筆，約 {todayList.backlog.minutes} 分鐘，會依優先度與落後週數自動上浮。
                  </p>
                )}
              </section>
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
                <CalendarViewSwitcher
                  activeView={calendarView}
                  hrefForView={(view) =>
                    calendarHref({ tab: "calendar", date: selectedDate, week: selectedWeekDate, month: selectedMonthDate, view })
                  }
                />
                {calendarView === "week" ? (
                <WeekCalendar
                  calendarEvents={student.calendarEvents}
                  fixedEvents={student.fixedEvents}
                  tutoringSessions={student.tutoringSessions}
                  tasks={student.studyTasks}
                  week={week}
                  selectedWeekDate={selectedWeekDate}
                  selectedDate={selectedDate}
                  todayDate={today.date}
                  timeZone={timeZone}
                />
                ) : (
                <MonthCalendar
                  calendarEvents={student.calendarEvents}
                  fixedEvents={student.fixedEvents}
                  tutoringSessions={student.tutoringSessions}
                  tasks={student.studyTasks}
                  month={month}
                  selectedMonthDate={selectedMonthDate}
                  selectedDate={selectedDate}
                  todayDate={today.date}
                  timeZone={timeZone}
                />
                )}
              </CalendarDayDetailBrowser>
              )}

              {activeTab === "learning" && (
              <LearningProgress
                scores={student.scores}
                weakPoints={student.weakPoints}
                weeklyTasks={weekTasks}
                today={today.date}
                timeZone={timeZone}
              />
              )}

              {activeTab === "learning" && (
              <ExamReviewPlans
                plans={student.examReviewPlans}
                examEvents={student.calendarEvents.filter((event) =>
                  ["SECTION_EXAM", "MOCK_EXAM", "ENTRANCE_EXAM"].includes(event.type),
                )}
                today={today.date}
                timeZone={timeZone}
              />
              )}

              {activeTab === "today" && (
              <>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-header">
                    <h2>今天時間軸</h2>
                    <span>
                      {today.date}，{timeZone}
                    </span>
                  </div>

                  <div className="timeline-list">
                    {todayFixedEvents.map((event) => (
                      <div className="timeline-item" key={event.id}>
                        <span className="timeline-time">
                          {event.startTime}-{event.endTime}
                        </span>
                        <div>
                          <strong>{event.title}</strong>
                          <p>
                            {fixedEventLabels[event.type]}
                            {event.commuteMinutes > 0 ? `，通勤 ${event.commuteMinutes} 分鐘` : ""}
                          </p>
                        </div>
                        <form className="inline-actions" action={deleteFixedEvent}>
                          <input name="fixedEventId" type="hidden" value={event.id} />
                          <button className="small-button danger-button" type="submit">
                            刪除
                          </button>
                        </form>
                        <FixedEventEditor event={event} timeZone={timeZone} />
                      </div>
                    ))}

                    {todayTutoringSessions.map((sessionItem) => (
                      <div className="timeline-item accent-item" key={sessionItem.id}>
                        <span className="timeline-time">
                          {sessionItem.startTime}-{sessionItem.endTime}
                        </span>
                        <div>
                          <strong>{sessionItem.subjectName}補習</strong>
                          <p>
                            疲勞 {fatigueLabels[sessionItem.fatigueLevel]}
                            {sessionItem.hasHomework ? "，有補習作業" : ""}
                            {sessionItem.commuteMinutes > 0 ? `，通勤 ${sessionItem.commuteMinutes} 分鐘` : ""}
                            ，{tutoringSessionDateLabel(sessionItem, timeZone)}
                          </p>
                        </div>
                        <form className="inline-actions" action={deleteTutoringSession}>
                          <input name="tutoringSessionId" type="hidden" value={sessionItem.id} />
                          <button className="small-button danger-button" type="submit">
                            刪除
                          </button>
                        </form>
                        <TutoringSessionEditor sessionItem={sessionItem} timeZone={timeZone} />
                      </div>
                    ))}

                    {todayFixedEvents.length === 0 && todayTutoringSessions.length === 0 && (
                      <div className="empty-state">
                        <p>今天還沒有固定行程。先輸入晚餐、洗澡、睡覺或補習時段。</p>
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
                    <span>
                      {today.date}，{openTasks.length} 項待完成
                    </span>
                  </div>

                  <div className="task-list compact-list">
                    {openTasks.map((task) => (
                      <div className="task" key={task.id}>
                        <span className="task-dot" aria-hidden="true" />
                        <div>
                          <strong>
                            {task.subject?.name ?? "未指定科目"}：{task.title}
                          </strong>
                          <span>
                            {taskTypeLabels[task.type]}，{task.estimatedMinutes} 分鐘，優先度 {task.priority}
                          </span>
                        </div>
                        <div className="inline-actions">
                        <form action={updateTaskStatus}>
                          <input name="taskId" type="hidden" value={task.id} />
                          <input name="status" type="hidden" value="DONE" />
                          <button className="small-button" type="submit">
                            完成
                          </button>
                        </form>
                          <form action={updateTaskStatus}>
                            <input name="taskId" type="hidden" value={task.id} />
                            <input name="status" type="hidden" value="RESCHEDULED" />
                            <button className="small-button" type="submit">
                              延後
                            </button>
                          </form>
                          <form action={updateTaskStatus}>
                            <input name="taskId" type="hidden" value={task.id} />
                            <input name="status" type="hidden" value="SKIPPED" />
                            <button className="small-button" type="submit">
                              略過
                            </button>
                          </form>
                          <form action={deleteStudyTask}>
                            <input name="taskId" type="hidden" value={task.id} />
                            <button className="small-button danger-button" type="submit">
                              刪除
                            </button>
                          </form>
                          {task.examReviewPlanId && (
                            <span className="task-source-note">此任務來自考前複習計畫，刪除後不影響其他任務。</span>
                          )}
                        </div>
                        <PartialProgressForm taskId={task.id} />
                        <StudyTaskEditor task={task} timeZone={timeZone} />
                      </div>
                    ))}

                    {openTasks.length === 0 && (
                      <div className="empty-state">
                        <p>今天沒有待完成任務。</p>
                        <div className="empty-state-actions">
                          <a className="small-button" href={formHref("#new-study-task-form")}>＋ 新增第一筆任務</a>
                        </div>
                      </div>
                    )}

                    {todayDoneTasks.map((task) => (
                      <div className="task muted-task" key={task.id}>
                        <span className="task-dot" aria-hidden="true" />
                        <div>
                          <strong>
                            {task.subject?.name ?? "未指定科目"}：{task.title}
                          </strong>
                          <span>{statusLabels[task.status]}</span>
                        </div>
                        <span className="time">{task.estimatedMinutes} 分</span>
                        <form className="inline-actions" action={deleteStudyTask}>
                          <input name="taskId" type="hidden" value={task.id} />
                          <button className="small-button danger-button" type="submit">
                            刪除
                          </button>
                          {task.examReviewPlanId && (
                            <span className="task-source-note">此任務來自考前複習計畫，刪除後不影響其他任務。</span>
                          )}
                        </form>
                        <StudyTaskEditor task={task} timeZone={timeZone} />
                      </div>
                    ))}

                  </div>
                </section>
              </div>

              </>
              )}

              {activeTab === "settings" && (
              <>
              <div className="settings-tools-grid">
                <div className="link-code-card settings-link-code">
                  <div>
                    <span className="card-meta">給家長使用</span>
                    <h2>學生連結碼</h2>
                    <p>家長不需要知道學生 Email，只要在家長端輸入這組碼，就能把你加入他的孩子清單。</p>
                  </div>
                  <strong>{student.linkCode ?? "尚未產生"}</strong>
                </div>
                <CalendarExportTools monthDate={selectedMonthDate} />
                <StudyTaskImportPanel />
                <StudyTaskImportHistory batches={importBatches} />
              </div>
              <div className="form-grid">
                <StudyWindowSettings
                  defaultWeekday={today.weekday}
                  heading="設定可讀書時段"
                  timeZone={timeZone}
                  windows={student.studyWindows}
                />

                <form className="form-card" id="new-tutoring-form" action={createTutoringSession}>
                  <h2>新增補習</h2>
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
                  <h2>新增固定作息</h2>
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
                  <label>
                    備註
                    <input name="note" placeholder="可空白" />
                  </label>
                  <button className="button primary" type="submit">
                    加入作息
                  </button>
                </form>

                <StudyTaskContinuousForm
                  defaultDate={today.date}
                  taskTypeOptions={taskTypeOptions.map(([value, label]) => ({ value, label }))}
                  title="新增今天任務"
                />

                <form className="form-card" id="new-calendar-event-form" action={createCalendarEvent}>
                  <h2>新增考試 / 學校活動</h2>
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
              </>
              )}
            </>
          ) : (
            <form className="form-card narrow-form" action={createStudent}>
              <h2>建立學生資料</h2>
              <p className="panel-copy">這裡只建立新帳號。已有學生帳號請前往 <Link href="/login?role=STUDENT">登入頁</Link>。</p>
              <label>
                學生姓名或暱稱
                <input name="displayName" placeholder="例如：小明" required />
              </label>

              <label>
                Email
                <input name="email" type="email" autoComplete="email" placeholder="學生自己的 Email" required />
              </label>

              <label>
                密碼
                <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
              </label>

              <label>
                年級
                <select name="grade" defaultValue="7">
                  <option value="7">國一</option>
                  <option value="8">國二</option>
                  <option value="9">國三</option>
                </select>
              </label>

              <label>
                座號
                <input name="seatNumber" type="number" min="1" max="99" placeholder="可空白" />
              </label>

              <label>
                班級代碼
                <input name="classCode" placeholder="例如：ALJ701A1B2，可之後再填" />
              </label>

              <button className="button primary" type="submit">
                建立學生資料
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
