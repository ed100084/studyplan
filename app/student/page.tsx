import Link from "next/link";
import { FatigueLevel, FixedEventType, TaskStatus, TaskType, Weekday } from "@prisma/client";
import type { FixedEvent, StudyTask, Subject, TutoringSession } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { buildTodaySchedule } from "@/lib/scheduler/today";
import { createStudent, signOut } from "../onboarding/actions";
import {
  createFixedEvent,
  createStudyTask,
  createTutoringSession,
  deleteFixedEvent,
  deleteStudyTask,
  deleteTutoringSession,
  moveTasksToTomorrow,
  updateFixedEvent,
  updateStudyTask,
  updateTaskStatus,
  updateTutoringSession,
} from "../schedule/actions";

type StudentPageProps = {
  searchParams?: Promise<{
    created?: string;
    error?: string;
    existing?: string;
    joined?: string;
    schedule?: string;
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
const orderedWeekdays: Weekday[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const readableWeekdayLabels: Record<Weekday, string> = {
  MONDAY: "週一",
  TUESDAY: "週二",
  WEDNESDAY: "週三",
  THURSDAY: "週四",
  FRIDAY: "週五",
  SATURDAY: "週六",
  SUNDAY: "週日",
};
const weekdayByEnglish: Record<string, Weekday> = {
  Monday: "MONDAY",
  Tuesday: "TUESDAY",
  Wednesday: "WEDNESDAY",
  Thursday: "THURSDAY",
  Friday: "FRIDAY",
  Saturday: "SATURDAY",
  Sunday: "SUNDAY",
};

function getTaipeiToday() {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    weekday: "long",
  }).format(now);

  return {
    date,
    weekday: weekdayByEnglish[weekdayName] ?? Weekday.MONDAY,
  };
}

function taipeiDayRange(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const start = new Date(`${date}T00:00:00+08:00`);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  const nextTaipeiDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nextDate);

  return {
    start,
    end: new Date(`${nextTaipeiDate}T00:00:00+08:00`),
  };
}

function getTaipeiWeek(date: string) {
  const start = new Date(`${date}T00:00:00+08:00`);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);

  const days = orderedWeekdays.map((weekday, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const dateValue = formatDateInput(current);

    return {
      date: dateValue,
      dayNumber: dateValue.slice(5),
      weekday,
      isToday: dateValue === date,
    };
  });

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return {
    days,
    start,
    end,
  };
}

function getTaipeiMonth(date: string) {
  const [year, month] = date.split("-").map(Number);
  const monthValue = String(month).padStart(2, "0");
  const monthLabel = `${year}-${monthValue}`;
  const start = new Date(`${monthLabel}-01T00:00:00+08:00`);
  const end = new Date(start);
  end.setMonth(start.getMonth() + 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const dayNumber = String(index + 1).padStart(2, "0");
    const dateValue = `${monthLabel}-${dayNumber}`;
    const weekdayName = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Taipei",
      weekday: "long",
    }).format(new Date(`${dateValue}T00:00:00+08:00`));
    const weekday = weekdayByEnglish[weekdayName] ?? Weekday.MONDAY;

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
    start,
    end,
    monthLabel,
    leadingBlankCount,
  };
}

function gradeLabel(grade: number) {
  return `國${grade - 6}`;
}

function formatDateInput(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function FixedEventEditor({ event }: { event: FixedEvent }) {
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

function TutoringSessionEditor({ sessionItem }: { sessionItem: TutoringSession }) {
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

function StudyTaskEditor({ task }: { task: StudyTaskWithSubject }) {
  return (
    <details className="item-editor">
      <summary>編輯</summary>
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
          <input name="plannedDate" type="date" defaultValue={formatDateInput(task.plannedDate)} required />
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
  fixedEvents,
  tutoringSessions,
  tasks,
  week,
}: {
  fixedEvents: FixedEvent[];
  tutoringSessions: TutoringSession[];
  tasks: StudyTaskWithSubject[];
  week: ReturnType<typeof getTaipeiWeek>;
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
        <span>
          任務 {weekTasks.length}，完成 {completedTasks}，待辦 {openTasks}，預估 {totalEstimatedMinutes} 分鐘
        </span>
      </div>

      <div className="week-grid">
        {week.days.map((day) => {
          const dayTasks = weekTasks.filter((task) => formatDateInput(task.plannedDate) === day.date);
          const dayFixedEvents = fixedEvents.filter((event) => event.weekday === day.weekday);
          const dayTutoringSessions = tutoringSessions.filter((sessionItem) => sessionItem.weekday === day.weekday);
          const planned = dayTasks.filter((task) => task.status === "PLANNED").length;
          const done = dayTasks.filter((task) => task.status === "DONE").length;
          const partial = dayTasks.filter((task) => task.status === "PARTIAL").length;
          const minutes = dayTasks.reduce((total, task) => total + task.estimatedMinutes, 0);

          return (
            <div className={day.isToday ? "week-day today" : "week-day"} key={day.date}>
              <div className="week-day-header">
                <strong>{readableWeekdayLabels[day.weekday]}</strong>
                <span>{day.dayNumber}</span>
              </div>
              <div className="week-metrics">
                <span>{dayTutoringSessions.length} 補習</span>
                <span>{dayFixedEvents.length} 作息</span>
                <span>{dayTasks.length} 任務</span>
              </div>
              <p>
                完成 {done}，待辦 {planned}，部分 {partial}
              </p>
              <p>預估 {minutes} 分鐘</p>
              <div className="week-items">
                {dayTutoringSessions.slice(0, 2).map((sessionItem) => (
                  <span key={sessionItem.id}>{sessionItem.subjectName}</span>
                ))}
                {dayTasks.slice(0, 2).map((task) => (
                  <span key={task.id}>{task.subject?.name ?? "未指定"}：{task.title}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MonthCalendar({
  fixedEvents,
  tutoringSessions,
  tasks,
  month,
}: {
  fixedEvents: FixedEvent[];
  tutoringSessions: TutoringSession[];
  tasks: StudyTaskWithSubject[];
  month: ReturnType<typeof getTaipeiMonth>;
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
        <span>
          任務 {monthTasks.length}，完成 {completedTasks}，待辦 {openTasks}，預估 {totalEstimatedMinutes} 分鐘
        </span>
      </div>

      <div className="month-weekdays">
        {orderedWeekdays.map((weekday) => (
          <span key={weekday}>{readableWeekdayLabels[weekday]}</span>
        ))}
      </div>
      <div className="month-grid">
        {Array.from({ length: month.leadingBlankCount }, (_, index) => (
          <div className="month-day empty" key={`blank-${index}`} />
        ))}
        {month.days.map((day) => {
          const dayTasks = monthTasks.filter((task) => formatDateInput(task.plannedDate) === day.date);
          const dayFixedEvents = fixedEvents.filter((event) => event.weekday === day.weekday);
          const dayTutoringSessions = tutoringSessions.filter((sessionItem) => sessionItem.weekday === day.weekday);
          const minutes = dayTasks.reduce((total, task) => total + task.estimatedMinutes, 0);
          const dayClassName = [
            "month-day",
            day.isToday ? "today" : "",
            dayTasks.length >= 3 || minutes >= 120 ? "heavy" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div className={dayClassName} key={day.date}>
              <div className="month-day-header">
                <strong>{day.dayNumber}</strong>
                <span>{minutes} 分鐘</span>
              </div>
              <div className="month-metrics">
                <span>{dayTutoringSessions.length} 補習</span>
                <span>{dayFixedEvents.length} 作息</span>
                <span>{dayTasks.length} 任務</span>
              </div>
              <div className="month-items">
                {dayTasks.slice(0, 2).map((task) => (
                  <span key={task.id}>{task.subject?.name ?? "未指定"}：{task.title}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default async function StudentPage({ searchParams }: StudentPageProps) {
  const params = await searchParams;
  const created = params?.created === "1";
  const existing = params?.existing === "1";
  const joined = params?.joined === "1";
  const scheduleUpdated = params?.schedule === "1";
  const error = params?.error;
  const today = getTaipeiToday();
  const todayRange = taipeiDayRange(today.date);
  const week = getTaipeiWeek(today.date);
  const month = getTaipeiMonth(today.date);
  const taskRangeStart = week.start.getTime() < month.start.getTime() ? week.start : month.start;
  const taskRangeEnd = week.end.getTime() > month.end.getTime() ? week.end : month.end;
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
              },
            },
          },
        })
      : null;

  const student = currentUser?.studentProfile;
  const className = student?.classMemberships[0]?.classroom.name;
  const todayTasks =
    student?.studyTasks.filter((task) => {
      const plannedDate = task.plannedDate.getTime();
      return plannedDate >= todayRange.start.getTime() && plannedDate < todayRange.end.getTime();
    }) ?? [];
  const todayFixedEvents = student?.fixedEvents.filter((event) => event.weekday === today.weekday) ?? [];
  const todayTutoringSessions = student?.tutoringSessions.filter((sessionItem) => sessionItem.weekday === today.weekday) ?? [];
  const openTasks = todayTasks.filter((task) => task.status === "PLANNED");
  const doneTasks = todayTasks.filter((task) => task.status !== "PLANNED");
  const plannedMinutes = openTasks.reduce((total, task) => total + task.estimatedMinutes, 0);
  const todaySchedule = student
    ? buildTodaySchedule({
        fixedEvents: todayFixedEvents,
        tutoringSessions: todayTutoringSessions,
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

  return (
    <main className="page">
      <section className="section">
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
          {existing && <div className="notice">這個 Email 已有學生資料，已切換到既有資料。{joined ? "目前有班級連結。" : "尚未連結班級。"}</div>}
          {scheduleUpdated && <div className="notice">讀書計畫資料已更新。</div>}
          {error === "email-used" && <div className="error-notice">這個 Email 已被其他角色使用，請改用學生自己的 Email。</div>}

          {student ? (
            <>
              <div className="session-card">
                <div>
                  <strong>{currentUser.displayName}</strong>
                  <p>
                    {gradeLabel(student.grade)}
                    {className ? `，${className}` : "，尚未加入班級"}。今天是 {weekdayLabels[today.weekday]}，待完成任務約{" "}
                    {plannedMinutes} 分鐘。
                  </p>
                </div>
                <form action={signOut}>
                  <button className="button secondary" type="submit">
                    登出
                  </button>
                </form>
              </div>

              <div className="link-code-card">
                <div>
                  <span className="card-meta">給家長使用</span>
                  <h2>學生連結碼</h2>
                  <p>家長不需要知道學生 Email，只要在家長端輸入這組碼，就能把你加入他的孩子清單。</p>
                </div>
                <strong>{student.linkCode ?? "尚未產生"}</strong>
              </div>

              <WeekCalendar
                fixedEvents={student.fixedEvents}
                tutoringSessions={student.tutoringSessions}
                tasks={student.studyTasks}
                week={week}
              />

              <MonthCalendar
                fixedEvents={student.fixedEvents}
                tutoringSessions={student.tutoringSessions}
                tasks={student.studyTasks}
                month={month}
              />

              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-header">
                    <h2>今天時間軸</h2>
                    <span>{today.date}</span>
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
                        <FixedEventEditor event={event} />
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
                          </p>
                        </div>
                        <form className="inline-actions" action={deleteTutoringSession}>
                          <input name="tutoringSessionId" type="hidden" value={sessionItem.id} />
                          <button className="small-button danger-button" type="submit">
                            刪除
                          </button>
                        </form>
                        <TutoringSessionEditor sessionItem={sessionItem} />
                      </div>
                    ))}

                    {todayFixedEvents.length === 0 && todayTutoringSessions.length === 0 && (
                      <div className="empty-state">今天還沒有固定行程。先輸入晚餐、洗澡、睡覺或補習時段。</div>
                    )}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <h2>今天任務</h2>
                    <span>{openTasks.length} 項待完成</span>
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
                        </div>
                        <PartialProgressForm taskId={task.id} />
                        <StudyTaskEditor task={task} />
                      </div>
                    ))}

                    {openTasks.length === 0 && <div className="empty-state">今天沒有待完成任務。</div>}

                    {doneTasks.map((task) => (
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
                        </form>
                        <StudyTaskEditor task={task} />
                      </div>
                    ))}
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

                    {todaySchedule.scheduled.length === 0 && <div className="empty-state">今天還沒有可排程資料。</div>}
                  </div>

                  {todaySchedule.unplaced.length > 0 && (
                    <div className="unplaced-list">
                      <strong>今天排不下</strong>
                      {todaySchedule.unplaced.map((segment) => (
                        <p key={segment.id}>{segment.title}：{segment.detail}</p>
                      ))}
                      <form className="unplaced-actions" action={moveTasksToTomorrow}>
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

              <div className="form-grid">
                <form className="form-card" action={createTutoringSession}>
                  <h2>新增補習</h2>
                  <label>
                    科目
                    <input name="subjectName" placeholder="例如：數學" required />
                  </label>
                  <label>
                    星期
                    <select name="weekday" defaultValue={today.weekday}>
                      {weekdayOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
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

                <form className="form-card" action={createFixedEvent}>
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
                  <label>
                    星期
                    <select name="weekday" defaultValue={today.weekday}>
                      {weekdayOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
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

                <form className="form-card" action={createStudyTask}>
                  <h2>新增今天任務</h2>
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
                  <label>
                    備註
                    <input name="description" placeholder="例如：明天要交" />
                  </label>
                  <button className="button primary" type="submit">
                    加入任務
                  </button>
                </form>
              </div>
            </>
          ) : (
            <form className="form-card narrow-form" action={createStudent}>
              <h2>建立學生資料</h2>
              <label>
                學生姓名或暱稱
                <input name="displayName" placeholder="例如：小明" required />
              </label>

              <label>
                Email
                <input name="email" type="email" placeholder="可用學生自己的 Email，也可以先空白" />
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
