import Link from "next/link";
import { FatigueLevel, FixedEventType, TaskStatus, TaskType, Weekday } from "@prisma/client";
import type { FixedEvent, StudyTask, Subject, TutoringSession } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { buildTodaySchedule } from "@/lib/scheduler/today";
import { createGuardian, linkStudentToGuardian, signOut } from "../onboarding/actions";
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

type GuardianPageProps = {
  searchParams?: Promise<{
    created?: string;
    error?: string;
    existing?: string;
    linked?: string;
    schedule?: string;
    studentId?: string;
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

function formatDateInput(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function StudentIdInput({ studentId }: { studentId: string }) {
  return <input name="studentId" type="hidden" value={studentId} />;
}

function FixedEventEditor({ event, studentId }: { event: FixedEvent; studentId: string }) {
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

function TutoringSessionEditor({ sessionItem, studentId }: { sessionItem: TutoringSession; studentId: string }) {
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

function StudyTaskEditor({ task, studentId }: { task: StudyTaskWithSubject; studentId: string }) {
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

export default async function GuardianPage({ searchParams }: GuardianPageProps) {
  const params = await searchParams;
  const created = params?.created === "1";
  const existing = params?.existing === "1";
  const linked = params?.linked === "1";
  const scheduleUpdated = params?.schedule === "1";
  const error = params?.error;
  const today = getTaipeiToday();
  const todayRange = taipeiDayRange(today.date);
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
                },
              },
            },
          },
        })
      : null;

  const linkedStudents = currentUser?.guardianProfile?.studentLinks.map((link) => link.student) ?? [];
  const activeStudent = linkedStudents.find((student) => student.id === params?.studentId) ?? linkedStudents[0];
  const openTasks = activeStudent?.studyTasks.filter((task) => task.status === "PLANNED") ?? [];
  const plannedMinutes = openTasks.reduce((total, task) => total + task.estimatedMinutes, 0);
  const activeClass = activeStudent?.classMemberships[0]?.classroom.name;
  const todaySchedule = activeStudent
    ? buildTodaySchedule({
        fixedEvents: activeStudent.fixedEvents,
        tutoringSessions: activeStudent.tutoringSessions,
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
          <span className="eyebrow">家長端</span>
          <h1 className="page-title">管理多位孩子的讀書計畫</h1>
          <p className="lead">
            家長用學生端提供的「學生連結碼」新增孩子。可同時管理國一、國二、國三等多位學生，每位學生的補習、作息、任務互相獨立。
          </p>

          {created && <div className="notice">家長資料已建立。{linked ? "已連結學生。" : "尚未連結學生，可在下方輸入學生連結碼。"}</div>}
          {existing && <div className="notice">這個 Email 已有家長資料，已切換到既有資料。</div>}
          {linked && <div className="notice">學生已加入你的孩子清單。</div>}
          {scheduleUpdated && <div className="notice">孩子的讀書計畫資料已更新。</div>}

          {error === "email-used" && <div className="error-notice">這個 Email 已被其他角色使用，請改用家長 Email。</div>}
          {error === "student-code-not-found" && <div className="error-notice">找不到這組學生連結碼，請確認學生端顯示的連結碼是否輸入正確。</div>}
          {error === "student-not-linked" && <div className="error-notice">這位學生尚未和此家長連結，不能代填資料。</div>}

          {currentUser?.guardianProfile ? (
            <>
              <div className="session-card">
                <div>
                  <strong>{currentUser.displayName}</strong>
                  <p>已連結 {linkedStudents.length} 位學生。可以繼續新增孩子，也可以切換目前管理的孩子。</p>
                </div>
                <form action={signOut}>
                  <button className="button secondary" type="submit">
                    登出
                  </button>
                </form>
              </div>

              <div className="guardian-tools">
                <form className="form-card compact-form" action={linkStudentToGuardian}>
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

                    {linkedStudents.length === 0 && <div className="empty-state">尚未連結學生。請先向孩子取得學生連結碼。</div>}
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
                    <span className="version-badge">{today.date}</span>
                  </div>

                  <div className="dashboard-grid">
                    <section className="panel">
                      <div className="panel-header">
                        <h2>今天行程</h2>
                        <span>{weekdayLabels[today.weekday]}</span>
                      </div>

                      <div className="timeline-list">
                        {activeStudent.fixedEvents.map((event) => (
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
                            <FixedEventEditor event={event} studentId={activeStudent.id} />
                          </div>
                        ))}

                        {activeStudent.tutoringSessions.map((sessionItem) => (
                          <div className="timeline-item accent-item" key={sessionItem.id}>
                            <span className="timeline-time">
                              {sessionItem.startTime}-{sessionItem.endTime}
                            </span>
                            <div>
                              <strong>{sessionItem.subjectName}補習</strong>
                              <p>
                                疲勞 {fatigueLabels[sessionItem.fatigueLevel]}
                                {sessionItem.hasHomework ? "，有補習作業" : ""}
                              </p>
                            </div>
                            <form className="inline-actions" action={deleteTutoringSession}>
                              <input name="studentId" type="hidden" value={activeStudent.id} />
                              <input name="tutoringSessionId" type="hidden" value={sessionItem.id} />
                              <button className="small-button danger-button" type="submit">
                                刪除
                              </button>
                            </form>
                            <TutoringSessionEditor sessionItem={sessionItem} studentId={activeStudent.id} />
                          </div>
                        ))}

                        {activeStudent.fixedEvents.length === 0 && activeStudent.tutoringSessions.length === 0 && (
                          <div className="empty-state">今天尚未輸入固定行程。</div>
                        )}
                      </div>
                    </section>

                    <section className="panel">
                      <div className="panel-header">
                        <h2>今天任務</h2>
                        <span>待完成約 {plannedMinutes} 分鐘</span>
                      </div>

                      <div className="task-list compact-list">
                        {activeStudent.studyTasks.map((task) => (
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
                                <form action={deleteStudyTask}>
                                  <input name="studentId" type="hidden" value={activeStudent.id} />
                                  <input name="taskId" type="hidden" value={task.id} />
                                  <button className="small-button danger-button" type="submit">
                                    刪除
                                  </button>
                                </form>
                              </div>
                            ) : (
                              <div className="inline-actions">
                                <span className="time">{statusLabels[task.status]}</span>
                                <form action={deleteStudyTask}>
                                  <input name="studentId" type="hidden" value={activeStudent.id} />
                                  <input name="taskId" type="hidden" value={task.id} />
                                  <button className="small-button danger-button" type="submit">
                                    刪除
                                  </button>
                                </form>
                              </div>
                            )}
                            {task.status === "PLANNED" ? <PartialProgressForm taskId={task.id} studentId={activeStudent.id} /> : null}
                            <StudyTaskEditor task={task} studentId={activeStudent.id} />
                          </div>
                        ))}

                        {activeStudent.studyTasks.length === 0 && <div className="empty-state">今天尚未輸入任務。</div>}
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

                  <div className="form-grid">
                    <form className="form-card" action={createTutoringSession}>
                      <h2>替 {activeStudent.user.displayName} 代填補習</h2>
                      <input name="studentId" type="hidden" value={activeStudent.id} />
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
                      <button className="button primary" type="submit">
                        加入作息
                      </button>
                    </form>

                    <form className="form-card" action={createStudyTask}>
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
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <form className="form-card narrow-form" action={createGuardian}>
              <h2>建立家長資料</h2>
              <label>
                家長姓名
                <input name="displayName" placeholder="例如：王媽媽" required />
              </label>

              <label>
                家長 Email
                <input name="email" type="email" placeholder="可空白，但建議填寫" />
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
