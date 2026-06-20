"use client";

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
import type { CSSProperties } from "react";
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

type ChartSegment = ScheduleSegment & {
  displayMinutes: number;
  lane: number;
  laneCount: number;
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
  newStudyTaskHref?: string;
  newFixedEventHref?: string;
  newTutoringHref?: string;
  newCalendarEventHref?: string;
};

const DEFAULT_CHART_START = 7 * 60;
const DEFAULT_CHART_END = 22 * 60 + 30;
const CHART_PIXELS_PER_HOUR = 64;
const MIN_CHART_SEGMENT_MINUTES = 36;

function timeToMinutes(time: string | undefined) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function buildChartRange(segments: ScheduleSegment[]) {
  const starts = segments.map((segment) => timeToMinutes(segment.startTime)).filter((value): value is number => value !== null);
  const ends = segments.map((segment) => timeToMinutes(segment.endTime)).filter((value): value is number => value !== null);

  return {
    start: Math.min(DEFAULT_CHART_START, ...starts),
    end: Math.max(DEFAULT_CHART_END, ...ends),
  };
}

function buildChartTicks(range: { start: number; end: number }) {
  const ticks = new Set<number>([range.start, range.end]);
  const firstHour = Math.ceil(range.start / 60) * 60;

  for (let value = firstHour; value < range.end; value += 60) {
    ticks.add(value);
  }

  return Array.from(ticks).sort((left, right) => left - right);
}

function buildChartSegments({
  fixedEvents,
  tutoringSessions,
  visibleSegments,
  fixedEventLabels,
  fatigueLabels,
}: {
  fixedEvents: FixedEvent[];
  tutoringSessions: TutoringSession[];
  visibleSegments: ScheduleSegment[];
  fixedEventLabels: Record<FixedEventType, string>;
  fatigueLabels: Record<FatigueLevel, string>;
}) {
  const fixedSegments: ScheduleSegment[] = fixedEvents.map((event) => ({
    id: `fixed-${event.id}`,
    kind: "fixed",
    title: event.title,
    detail: fixedEventLabels[event.type],
    startTime: event.startTime,
    endTime: event.endTime,
    minutes: Math.max(0, (timeToMinutes(event.endTime) ?? 0) - (timeToMinutes(event.startTime) ?? 0)),
  }));
  const tutoringSegments: ScheduleSegment[] = tutoringSessions.map((sessionItem) => ({
    id: `tutoring-${sessionItem.id}`,
    kind: "tutoring",
    title: `${sessionItem.subjectName}補習`,
    detail: `疲勞 ${fatigueLabels[sessionItem.fatigueLevel]}`,
    startTime: sessionItem.startTime,
    endTime: sessionItem.endTime,
    minutes: Math.max(0, (timeToMinutes(sessionItem.endTime) ?? 0) - (timeToMinutes(sessionItem.startTime) ?? 0)),
  }));
  const generatedStudySegments = visibleSegments.filter((segment) => segment.kind === "study" || segment.kind === "break");

  return [...fixedSegments, ...tutoringSegments, ...generatedStudySegments]
    .filter((segment) => segment.startTime && segment.endTime)
    .sort((left, right) => (timeToMinutes(left.startTime) ?? 0) - (timeToMinutes(right.startTime) ?? 0));
}

function assignChartLanes(segments: ScheduleSegment[]): ChartSegment[] {
  const items = segments.map((segment) => {
    const start = timeToMinutes(segment.startTime) ?? 0;
    const end = Math.max(start + 1, timeToMinutes(segment.endTime) ?? start + 1);
    const displayMinutes = Math.max(MIN_CHART_SEGMENT_MINUTES, end - start);
    const displayEnd = start + displayMinutes;

    return { segment, start, end, displayEnd, displayMinutes };
  });
  const clusters: typeof items[] = [];
  let currentCluster: typeof items = [];
  let currentClusterEnd = -1;

  items.forEach((item) => {
    if (currentCluster.length === 0 || item.start < currentClusterEnd) {
      currentCluster.push(item);
      currentClusterEnd = Math.max(currentClusterEnd, item.displayEnd);
      return;
    }

    clusters.push(currentCluster);
    currentCluster = [item];
    currentClusterEnd = item.displayEnd;
  });

  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  return clusters.flatMap((cluster) => {
    const laneEnds: number[] = [];
    const assigned = cluster.map((item) => {
      const reusableLane = laneEnds.findIndex((end) => end <= item.start);
      const lane = reusableLane === -1 ? laneEnds.length : reusableLane;
      laneEnds[lane] = item.displayEnd;

      return { item, lane };
    });
    const laneCount = Math.max(1, laneEnds.length);

    return assigned.map(({ item, lane }) => ({
      ...item.segment,
      displayMinutes: item.displayMinutes,
      lane,
      laneCount,
    }));
  });
}

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
  newStudyTaskHref = "#new-study-task-form",
  newFixedEventHref = "#new-fixed-event-form",
  newTutoringHref = "#new-tutoring-form",
  newCalendarEventHref = "#new-calendar-event-form",
}: DayDetailPanelProps) {
  const openTasks = tasks.filter((task) => task.status === "PLANNED");
  const completedTasks = tasks.filter((task) => task.status !== "PLANNED");
  const plannedMinutes = openTasks.reduce((total, task) => total + task.estimatedMinutes, 0);
  const visibleSegments = schedule?.scheduled ?? [];
  const unplacedSegments = schedule?.unplaced ?? [];
  const chartSegments = assignChartLanes(
    buildChartSegments({ fixedEvents, tutoringSessions, visibleSegments, fixedEventLabels, fatigueLabels }),
  );
  const chartRange = buildChartRange(chartSegments);
  const chartDuration = Math.max(1, chartRange.end - chartRange.start);
  const chartTicks = buildChartTicks(chartRange);
  const chartHeight = Math.max(360, Math.round((chartDuration / 60) * CHART_PIXELS_PER_HOUR));
  const chartStyle = { "--schedule-chart-height": `${chartHeight}px` } as CSSProperties;
  const hasMetrics = fixedEvents.length + tutoringSessions.length + calendarEvents.length + tasks.length > 0;

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

      {hasMetrics && (
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
      )}

      <div className="day-detail-grid">
        <div className="day-detail-card">
          <h3>圖表式時間軸</h3>
          <p className="panel-copy">
            可排 {schedule?.availableMinutes ?? 0} 分鐘，已排讀書 {schedule?.scheduledStudyMinutes ?? 0} 分鐘
          </p>
          <div className="schedule-chart" aria-label={`${date} 圖表式時間軸`}>
            <div className="schedule-chart-scale">
              <span>開始 {minutesToTime(chartRange.start)}</span>
              <span>結束 {minutesToTime(chartRange.end)}</span>
            </div>
            <div className="schedule-chart-track" style={chartStyle}>
              <div className="schedule-chart-axis" aria-hidden="true">
                {chartTicks.map((tick) => (
                  <span
                    key={tick}
                    style={{
                      top: `${((tick - chartRange.start) / chartDuration) * 100}%`,
                    }}
                  >
                    {minutesToTime(tick)}
                  </span>
                ))}
              </div>
              <div className="schedule-chart-lanes">
                {chartTicks.map((tick) => (
                  <span
                    className="schedule-chart-gridline"
                    key={tick}
                    style={{
                      top: `${((tick - chartRange.start) / chartDuration) * 100}%`,
                    }}
                  />
                ))}
                {chartSegments.map((segment) => {
                  const start = timeToMinutes(segment.startTime) ?? chartRange.start;
                  const end = timeToMinutes(segment.endTime) ?? start;
                  const duration = Math.max(1, end - start);
                  const top = ((start - chartRange.start) / chartDuration) * 100;
                  const height = (segment.displayMinutes / chartDuration) * 100;
                  const laneWidth = 100 / segment.laneCount;
                  const isCompact = duration < 20;

                  return (
                    <div
                      className={`schedule-chart-bar schedule-${segment.kind}${isCompact ? " compact" : ""}`}
                      key={segment.id}
                      style={{
                        left: `calc(${segment.lane * laneWidth}% + 8px)`,
                        right: "auto",
                        top: `${Math.max(0, top)}%`,
                        width: `calc(${laneWidth}% - 16px)`,
                        height: `${Math.min(100 - Math.max(0, top), Math.max(5, height))}%`,
                      }}
                      title={`${segment.startTime}-${segment.endTime} ${segment.title}`}
                    >
                      <strong>{segment.title}</strong>
                      <span>
                        {segment.startTime}-{segment.endTime}
                      </span>
                    </div>
                  );
                })}
                {chartSegments.length === 0 && <div className="schedule-chart-empty">這天還沒有可畫成圖表的時間資料。</div>}
              </div>
            </div>
            <div className="schedule-chart-legend">
              <span className="legend-fixed">固定</span>
              <span className="legend-tutoring">補習</span>
              <span className="legend-study">讀書</span>
              <span className="legend-break">休息</span>
            </div>
          </div>
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
            {visibleSegments.length === 0 && (
              <div className="empty-state">
                <p>這天還沒有可排程資料。</p>
                <div className="empty-state-actions">
                  <a className="small-button" href={newStudyTaskHref}>＋ 新增第一筆任務</a>
                </div>
              </div>
            )}
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
            {tasks.length === 0 && (
              <div className="empty-state">
                <p>這天尚未輸入任務。</p>
                <div className="empty-state-actions">
                  <a className="small-button" href={newStudyTaskHref}>＋ 新增第一筆任務</a>
                </div>
              </div>
            )}
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
            {fixedEvents.length === 0 && tutoringSessions.length === 0 && (
              <div className="empty-state">
                <p>這天尚未輸入固定行程或補習。</p>
                <div className="empty-state-actions">
                  <a className="small-button" href={newFixedEventHref}>＋ 新增作息</a>
                  <a className="small-button" href={newTutoringHref}>＋ 新增補習</a>
                </div>
              </div>
            )}
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
            {calendarEvents.length === 0 && (
              <div className="empty-state">
                <p>這天尚未輸入考試或事件。</p>
                <div className="empty-state-actions">
                  <a className="small-button" href={newCalendarEventHref}>＋ 新增第一筆事件</a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
