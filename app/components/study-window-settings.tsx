import type { StudyWindow, Weekday } from "@prisma/client";
import { createStudyWindow, deleteStudyWindow, updateStudyWindow } from "@/app/schedule/actions";
import { formatDateInput } from "@/lib/timezone";
import { studyWindowDateLabel } from "@/lib/study-windows";

const weekdayLabels: Record<Weekday, string> = {
  MONDAY: "星期一",
  TUESDAY: "星期二",
  WEDNESDAY: "星期三",
  THURSDAY: "星期四",
  FRIDAY: "星期五",
  SATURDAY: "星期六",
  SUNDAY: "星期日",
};

const weekdayOptions = Object.entries(weekdayLabels) as Array<[Weekday, string]>;

function StudentIdInput({ studentId }: { studentId?: string }) {
  return studentId ? <input name="studentId" type="hidden" value={studentId} /> : null;
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

function StudyWindowEditor({ studentId, timeZone, window }: { studentId?: string; timeZone: string; window: StudyWindow }) {
  return (
    <details className="item-editor">
      <summary>編輯</summary>
      <form action={updateStudyWindow}>
        <StudentIdInput studentId={studentId} />
        <input name="studyWindowId" type="hidden" value={window.id} />
        <label>
          名稱
          <input name="title" defaultValue={window.title} required />
        </label>
        <label>
          星期
          <select name="weekday" defaultValue={window.weekday}>
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
            <input name="startDate" type="date" defaultValue={window.startDate ? formatDateInput(window.startDate, timeZone) : ""} />
          </label>
          <label>
            結束日期
            <input name="endDate" type="date" defaultValue={window.endDate ? formatDateInput(window.endDate, timeZone) : ""} />
          </label>
        </div>
        <div className="field-row">
          <label>
            開始
            <input name="startTime" type="time" defaultValue={window.startTime} required />
          </label>
          <label>
            結束
            <input name="endTime" type="time" defaultValue={window.endTime} required />
          </label>
        </div>
        <label>
          備註
          <input name="note" defaultValue={window.note ?? ""} />
        </label>
        <button className="small-button" type="submit">
          儲存
        </button>
      </form>
    </details>
  );
}

export function StudyWindowSettings({
  defaultWeekday,
  heading,
  studentId,
  timeZone,
  windows,
}: {
  defaultWeekday: Weekday;
  heading: string;
  studentId?: string;
  timeZone: string;
  windows: StudyWindow[];
}) {
  return (
    <section className="form-card study-window-settings" id="new-study-window-form">
      <h2>{heading}</h2>
      <p className="panel-copy">
        可讀書時段會限制自動排程的範圍；暑假白天、平日下課後、週末上午都可以分開設定。
      </p>
      <form action={createStudyWindow} className="embedded-form">
        <StudentIdInput studentId={studentId} />
        <label>
          名稱
          <input name="title" placeholder="例如：暑假上午、下課後自習" required />
        </label>
        <WeekdayCheckboxGroup defaultWeekday={defaultWeekday} />
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
            <input name="startTime" type="time" defaultValue="17:30" required />
          </label>
          <label>
            結束
            <input name="endTime" type="time" defaultValue="23:30" required />
          </label>
        </div>
        <label>
          備註
          <input name="note" placeholder="可空白；例如：暑假期間白天可用" />
        </label>
        <button className="button primary" type="submit">
          加入可讀書時段
        </button>
      </form>

      <div className="study-window-list">
        {windows.map((window) => (
          <div className="timeline-item study-window-item" key={window.id}>
            <span className="timeline-time">
              {window.startTime}-{window.endTime}
            </span>
            <div>
              <strong>{window.title}</strong>
              <p>
                {weekdayLabels[window.weekday]}，{studyWindowDateLabel(window, timeZone)}
                {window.note ? `，${window.note}` : ""}
              </p>
            </div>
            <form className="inline-actions" action={deleteStudyWindow}>
              <StudentIdInput studentId={studentId} />
              <input name="studyWindowId" type="hidden" value={window.id} />
              <button className="small-button danger-button" type="submit">
                刪除
              </button>
            </form>
            <StudyWindowEditor studentId={studentId} timeZone={timeZone} window={window} />
          </div>
        ))}
        {windows.length === 0 && <div className="empty-state">尚未設定可讀書時段；未設定時會使用 07:00-22:30 扣除固定行程後的空檔。</div>}
      </div>
    </section>
  );
}
