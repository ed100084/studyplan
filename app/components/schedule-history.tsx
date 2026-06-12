import type { Prisma, RecordSource, ScheduleRunTrigger } from "@prisma/client";
import { formatDateInput } from "@/lib/timezone";

type ScheduleRun = {
  id: string;
  scheduleDate: Date;
  revision: number;
  trigger: ScheduleRunTrigger;
  availableMinutes: number;
  scheduledStudyMinutes: number;
  snapshot: Prisma.JsonValue;
  source: RecordSource;
  createdAt: Date;
};

type SnapshotSegment = {
  id: string;
  title: string;
  startTime?: string;
  endTime?: string;
};

function scheduledSegments(snapshot: Prisma.JsonValue) {
  if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== "object") return [];
  const scheduled = (snapshot as Record<string, Prisma.JsonValue>).scheduled;
  if (!Array.isArray(scheduled)) return [];

  return scheduled.filter((value): value is SnapshotSegment => {
    if (!value || Array.isArray(value) || typeof value !== "object") return false;
    const item = value as Record<string, Prisma.JsonValue>;
    return typeof item.id === "string" && typeof item.title === "string";
  });
}

const triggerLabels: Record<ScheduleRunTrigger, string> = {
  SAVED: "儲存目前排程",
  REGENERATED: "重新產生",
};

const sourceLabels: Record<RecordSource, string> = {
  STUDENT: "學生",
  GUARDIAN: "家長",
  TEACHER: "老師",
  SYSTEM: "系統",
};

export function ScheduleHistory({ runs, timeZone }: { runs: ScheduleRun[]; timeZone: string }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>排程版本歷史</h2>
          <p className="panel-copy">保留每次儲存時的時段與任務快照，方便比較重新排程前後的差異。</p>
        </div>
        <span>{runs.length} 個版本</span>
      </div>

      <div className="task-list compact-list">
        {runs.map((run) => {
          const segments = scheduledSegments(run.snapshot);
          return (
            <div className="task" key={run.id}>
              <span className="task-dot" aria-hidden="true" />
              <div>
                <strong>{formatDateInput(run.scheduleDate, timeZone)} · 第 {run.revision} 版</strong>
                <span>
                  {triggerLabels[run.trigger]} · {sourceLabels[run.source]} · 已排 {run.scheduledStudyMinutes}/{run.availableMinutes} 分鐘
                </span>
                {segments.length > 0 && (
                  <span>
                    {segments.slice(0, 3).map((segment) =>
                      `${segment.startTime && segment.endTime ? `${segment.startTime}-${segment.endTime} ` : ""}${segment.title}`,
                    ).join("；")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {runs.length === 0 && <div className="empty-state">尚未儲存任何排程版本。</div>}
      </div>
    </section>
  );
}
