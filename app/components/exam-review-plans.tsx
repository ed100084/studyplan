import { TaskStatus } from "@prisma/client";
import { formatDateInput } from "@/lib/timezone";
import {
  createExamReviewPlan,
  deleteExamReviewPlan,
  redistributeExamReviewPlanAction,
} from "@/app/schedule/actions";

type ExamEvent = {
  id: string;
  title: string;
  subjectName: string | null;
  note: string | null;
  startDate: Date;
};

type ReviewTask = {
  id: string;
  status: TaskStatus;
  plannedDate: Date;
  estimatedMinutes: number;
  logs: Array<{ actualMinutes: number | null }>;
};

type ReviewPlan = {
  id: string;
  title: string;
  scope: string | null;
  totalMinutes: number;
  sessionMinutes: number;
  priority: number;
  startDate: Date;
  examDate: Date;
  subject: { name: string } | null;
  calendarEvent: ExamEvent;
  tasks: ReviewTask[];
};

function dateDifference(from: string, to: string) {
  return Math.ceil((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function planProgress(plan: ReviewPlan) {
  const completedMinutes = plan.tasks.reduce((total, task) => {
    if (task.status === TaskStatus.DONE) return total + task.estimatedMinutes;
    if (task.status !== TaskStatus.PARTIAL) return total;

    const actualMinutes = task.logs.reduce((sum, log) => sum + (log.actualMinutes ?? 0), 0);
    return total + Math.min(task.estimatedMinutes, actualMinutes);
  }, 0);
  const plannedMinutes = plan.tasks
    .filter((task) => task.status === TaskStatus.PLANNED)
    .reduce((total, task) => total + task.estimatedMinutes, 0);
  const remainingMinutes = Math.max(0, plan.totalMinutes - completedMinutes);

  return {
    completedMinutes,
    plannedMinutes,
    remainingMinutes,
    unallocatedMinutes: Math.max(0, remainingMinutes - plannedMinutes),
    percentage: Math.min(100, Math.round((completedMinutes / plan.totalMinutes) * 100)),
  };
}

export function ExamReviewPlans({
  studentId,
  plans,
  examEvents,
  today,
  timeZone,
}: {
  studentId?: string;
  plans: ReviewPlan[];
  examEvents: ExamEvent[];
  today: string;
  timeZone: string;
}) {
  const upcomingExamEvents = examEvents.filter((event) => formatDateInput(event.startDate, timeZone) > today);

  return (
    <section className="panel exam-plan-panel">
      <div className="panel-header">
        <div>
          <h2>段考倒數與跨日複習</h2>
          <p className="panel-copy">系統會把總複習時間分配到考前各天，避開學校活動並扣除補習與固定作息。</p>
        </div>
        <span>{plans.length} 個計畫</span>
      </div>

      <div className="exam-plan-list">
        {plans.map((plan) => {
          const examDate = formatDateInput(plan.examDate, timeZone);
          const countdown = dateDifference(today, examDate);
          const progress = planProgress(plan);
          const nextTasks = plan.tasks
            .filter((task) => task.status === TaskStatus.PLANNED)
            .sort((a, b) => a.plannedDate.getTime() - b.plannedDate.getTime())
            .slice(0, 4);

          return (
            <article className="exam-plan-card" key={plan.id}>
              <div className="exam-plan-heading">
                <div>
                  <span className="card-meta">{countdown > 0 ? `倒數 ${countdown} 天` : countdown === 0 ? "今天考試" : "考試已結束"}</span>
                  <h3>{plan.subject?.name ?? plan.calendarEvent.subjectName ?? "綜合"}：{plan.title}</h3>
                  <p>{examDate}{plan.scope ? `，範圍：${plan.scope}` : ""}</p>
                </div>
                <strong>{progress.percentage}%</strong>
              </div>

              <div
                className="exam-plan-progress"
                role="progressbar"
                aria-label={`完成 ${progress.percentage}%`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.percentage}
              >
                <span style={{ width: `${progress.percentage}%` }} />
              </div>
              <div className="exam-plan-metrics">
                <span>完成 {progress.completedMinutes} 分</span>
                <span>待完成 {progress.remainingMinutes} 分</span>
                <span>已排入 {progress.plannedMinutes} 分</span>
                {progress.unallocatedMinutes > 0 && <span className="warning-text">尚缺 {progress.unallocatedMinutes} 分鐘可用時段</span>}
              </div>

              <div className="exam-plan-tasks">
                {nextTasks.map((task) => (
                  <span key={task.id}>{formatDateInput(task.plannedDate, timeZone)} · {task.estimatedMinutes} 分鐘</span>
                ))}
                {nextTasks.length === 0 && <span>{progress.remainingMinutes === 0 ? "複習計畫已完成。" : "目前沒有可排入的考前日期。"}</span>}
              </div>

              <div className="inline-actions">
                <form action={redistributeExamReviewPlanAction}>
                  <input name="examReviewPlanId" type="hidden" value={plan.id} />
                  {studentId && <input name="studentId" type="hidden" value={studentId} />}
                  <button className="small-button" type="submit">重新分配剩餘進度</button>
                </form>
                <form action={deleteExamReviewPlan}>
                  <input name="examReviewPlanId" type="hidden" value={plan.id} />
                  {studentId && <input name="studentId" type="hidden" value={studentId} />}
                  <button className="small-button danger-button" type="submit">刪除計畫</button>
                </form>
              </div>
            </article>
          );
        })}

        {plans.length === 0 && <div className="empty-state">尚未建立考前複習計畫。</div>}
      </div>

      {upcomingExamEvents.length > 0 ? (
        <form className="form-card exam-plan-form" action={createExamReviewPlan}>
          <h3>建立考前複習計畫</h3>
          {studentId && <input name="studentId" type="hidden" value={studentId} />}
          <label>
            考試
            <select name="calendarEventId" required>
              {upcomingExamEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {formatDateInput(event.startDate, timeZone)} · {event.subjectName ? `${event.subjectName} · ` : ""}{event.title}
                </option>
              ))}
            </select>
          </label>
          <div className="field-row">
            <label>
              科目
              <input name="subjectName" placeholder="例如：數學" required />
            </label>
            <label>
              計畫名稱
              <input name="title" placeholder="例如：第一次段考複習" required />
            </label>
          </div>
          <label>
            複習範圍
            <input name="scope" placeholder="例如：第一冊第 1 到 3 章" />
          </label>
          <div className="field-row">
            <label>
              開始日期
              <input name="startDate" type="date" min={today} defaultValue={today} required />
            </label>
            <label>
              總複習分鐘
              <input name="totalMinutes" type="number" min="30" max="5000" step="10" defaultValue="300" required />
            </label>
          </div>
          <div className="field-row">
            <label>
              每次目標分鐘
              <input name="sessionMinutes" type="number" min="10" max="180" step="5" defaultValue="30" required />
            </label>
            <label>
              優先度
              <input name="priority" type="number" min="1" max="5" defaultValue="4" required />
            </label>
          </div>
          <button className="button primary" type="submit">產生跨日複習任務</button>
        </form>
      ) : (
        <div className="empty-state">請先新增未來的段考、模擬考或升學考試事件，再建立複習計畫。</div>
      )}
    </section>
  );
}
