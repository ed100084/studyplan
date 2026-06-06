import Link from "next/link";
import { FatigueLevel, FixedEventType, TaskStatus, TaskType, Weekday } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { createStudent, signOut } from "../onboarding/actions";
import { createFixedEvent, createStudyTask, createTutoringSession, updateTaskStatus } from "../schedule/actions";

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

function gradeLabel(grade: number) {
  return `國${grade - 6}`;
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
                  where: {
                    weekday: today.weekday,
                  },
                  orderBy: {
                    startTime: "asc",
                  },
                },
                tutoringSessions: {
                  where: {
                    weekday: today.weekday,
                  },
                  orderBy: {
                    startTime: "asc",
                  },
                },
                studyTasks: {
                  where: {
                    plannedDate: {
                      gte: todayRange.start,
                      lt: todayRange.end,
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
  const openTasks = student?.studyTasks.filter((task) => task.status === "PLANNED") ?? [];
  const doneTasks = student?.studyTasks.filter((task) => task.status !== "PLANNED") ?? [];
  const plannedMinutes = openTasks.reduce((total, task) => total + task.estimatedMinutes, 0);

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

              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-header">
                    <h2>今天時間軸</h2>
                    <span>{today.date}</span>
                  </div>

                  <div className="timeline-list">
                    {student.fixedEvents.map((event) => (
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
                      </div>
                    ))}

                    {student.tutoringSessions.map((sessionItem) => (
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
                      </div>
                    ))}

                    {student.fixedEvents.length === 0 && student.tutoringSessions.length === 0 && (
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
                        <form action={updateTaskStatus}>
                          <input name="taskId" type="hidden" value={task.id} />
                          <input name="status" type="hidden" value="DONE" />
                          <button className="small-button" type="submit">
                            完成
                          </button>
                        </form>
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
                      </div>
                    ))}
                  </div>
                </section>
              </div>

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
