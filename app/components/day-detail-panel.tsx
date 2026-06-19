import type {
  CalendarEvent,
  CalendarEventType,
  FatigueLevel,
  FixedEvent,
  FixedEventType,
  StudyTask,
  Subject,
  TaskStatus,
  TaskType,
  TutoringSession,
} from "@prisma/client";
import type { ScheduleSegment } from "@/lib/scheduler/today";

type StudyTaskWithSubject = StudyTask & {
  subject: Subject | null;
};

type DaySchedule = {
  scheduled: ScheduleSegment[];
  unplaced: ScheduleSegment[];
  availableMinutes: number;
  scheduledStudyMinutes: number;
};

type DayDetailPanelProps = {
  date: string;
  timeZone: string;
  weekdayLabel: string;
  isToday: boolean;
  fixedEvents: FixedEvent[];
  tutoringSessions: TutoringSession[];
  calendarEvents: CalendarEvent[];
  tasks: StudyTaskWithSubject[];
  schedule: DaySchedule | null;
  fixedEventLabels: Record<FixedEventType, string>;
  taskTypeLabels: Record<TaskType, string>;
  calendarEventLabels: Record<CalendarEventType, string>;
  fatigueLabels: Record<FatigueLevel, string>;
  statusLabels: Record<TaskStatus, string>;
};

export function DayDetailPanel({
  date,
  timeZone,
  weekdayLabel,
  isToday,
  fixedEvents,
  tutoringSessions,
  calendarEvents,
  tasks,
  schedule,
  fixedEventLabels,
  taskTypeLabels,
  calendarEventLabels,
  fatigueLabels,
  statusLabels,
}: DayDetailPanelProps) {
  const openTasks = tasks.filter((task) => task.status === "PLANNED");
  const completedTasks = tasks.filter((task) => task.status !== "PLANNED");
  const plannedMinutes = openTasks.reduce((total, task) => total + task.estimatedMinutes, 0);
  const visibleSegments = schedule?.scheduled ?? [];
  const unplacedSegments = schedule?.unplaced ?? [];

  return (
    <section className="panel day-detail-panel">
      <div className="panel-header">
        <div>
          <h2>{isToday ? "今天詳細行程" : "選取日期詳細行程"}</h2>
          <p className="panel-copy">
            {date}，{weekdayLabel}，{timeZone}
          </p>
        </div>
        <span>{plannedMinutes} 分鐘待完成</span>
      </div>

      <div className="day-detail-metrics">
        <div>
          <strong>{fixedEvents.length}</strong>
          <span>固定項目</span>
        </div>
        <div>
          <strong>{tutoringSessions.length}</strong>
          <span>補習</span>
        </div>
        <div>
          <strong>{calendarEvents.length}</strong>
          <span>考試 / 事件</span>
        </div>
        <div>
          <strong>{tasks.length}</strong>
          <span>任務</span>
        </div>
      </div>

      <div className="day-detail-grid">
        <div className="day-detail-card">
          <h3>圖表式時間軸</h3>
          <p className="panel-copy">
            可排 {schedule?.availableMinutes ?? 0} 分鐘，已排讀書 {schedule?.scheduledStudyMinutes ?? 0} 分鐘
          </p>
          <div className="timeline-list">
            {visibleSegments.map((segment) => (
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
            {visibleSegments.length === 0 && <div className="empty-state">這天還沒有可排程資料。</div>}
          </div>
          {unplacedSegments.length > 0 && (
            <div className="unplaced-list">
              <strong>這天排不下</strong>
              {unplacedSegments.map((segment) => (
                <p key={segment.id}>
                  {segment.title}：{segment.detail}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="day-detail-card">
          <h3>當日任務</h3>
          <div className="task-list compact-list">
            {openTasks.map((task) => (
              <div className="task" key={task.id}>
                <span className="task-dot" aria-hidden="true" />
                <div>
                  <strong>
                    {task.subject?.name ?? "未分類"}：{task.title}
                  </strong>
                  <span>
                    {taskTypeLabels[task.type]}，{task.estimatedMinutes} 分鐘，優先度 {task.priority}
                  </span>
                </div>
              </div>
            ))}
            {completedTasks.map((task) => (
              <div className="task muted-task" key={task.id}>
                <span className="task-dot" aria-hidden="true" />
                <div>
                  <strong>
                    {task.subject?.name ?? "未分類"}：{task.title}
                  </strong>
                  <span>{statusLabels[task.status]}</span>
                </div>
              </div>
            ))}
            {tasks.length === 0 && <div className="empty-state">這天尚未輸入任務。</div>}
          </div>
        </div>

        <div className="day-detail-card">
          <h3>固定與補習</h3>
          <div className="timeline-list">
            {fixedEvents.map((event) => (
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
            {tutoringSessions.map((sessionItem) => (
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
            {fixedEvents.length === 0 && tutoringSessions.length === 0 && <div className="empty-state">這天尚未輸入固定行程或補習。</div>}
          </div>
        </div>

        <div className="day-detail-card">
          <h3>考試與事件</h3>
          <div className="task-list compact-list">
            {calendarEvents.map((event) => (
              <div className="task" key={event.id}>
                <span className="task-dot" aria-hidden="true" />
                <div>
                  <strong>
                    {calendarEventLabels[event.type]}：{event.title}
                  </strong>
                  <span>{event.subjectName ?? "未指定科目"}</span>
                </div>
              </div>
            ))}
            {calendarEvents.length === 0 && <div className="empty-state">這天尚未輸入考試或事件。</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
