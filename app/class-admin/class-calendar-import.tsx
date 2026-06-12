"use client";

import { useActionState } from "react";
import {
  confirmClassCalendarEvents,
  previewClassCalendarEvents,
  type ClassCalendarPreviewState,
} from "./actions";

const initialState: ClassCalendarPreviewState = {
  issues: [],
  fileName: "",
  rows: [],
  totalRows: 0,
  duplicateRows: 0,
};

const typeLabels: Record<string, string> = {
  SECTION_EXAM: "段考",
  MOCK_EXAM: "模擬考",
  ENTRANCE_EXAM: "升學考試",
  SCHOOL_EVENT: "學校活動",
  DEADLINE: "截止日",
  OTHER: "其他",
};

export function ClassCalendarImport({ classroomId }: { classroomId: string }) {
  const [state, previewAction, pending] = useActionState(previewClassCalendarEvents, initialState);
  const importableRows = state.totalRows - state.duplicateRows;

  return (
    <div className="form-card">
      <form action={previewAction}>
        <input name="classroomId" type="hidden" value={classroomId} />
        <label>
          匯入檔案
          <input name="file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
        </label>
        <p className="panel-copy">
          必填欄位：類型、標題、開始日期。類型可填段考、模擬考、升學考試、學校活動、截止日或其他。
        </p>
        <button className="button secondary" disabled={pending} type="submit">
          {pending ? "正在驗證..." : "預覽與檢查重複"}
        </button>
      </form>

      {state.issues.length > 0 && (
        <div className="error-notice">
          {state.issues.map((issue) => <p key={issue}>{issue}</p>)}
        </div>
      )}

      {state.rows.length > 0 && (
        <div>
          <div className="panel-header">
            <div>
              <h3>匯入預覽</h3>
              <p className="panel-copy">{state.fileName}：共 {state.totalRows} 筆，可匯入 {importableRows} 筆，已存在 {state.duplicateRows} 筆。</p>
            </div>
          </div>

          <div className="task-list compact-list">
            {state.rows.slice(0, 20).map((row, index) => (
              <div className={row.duplicate ? "task muted-task" : "task"} key={`${row.startDate}-${row.title}-${index}`}>
                <span className="task-dot" aria-hidden="true" />
                <div>
                  <strong>{row.startDate}{row.endDate ? ` 至 ${row.endDate}` : ""} · {row.title}</strong>
                  <span>{typeLabels[row.type]}{row.subjectName ? ` · ${row.subjectName}` : ""}{row.duplicate ? " · 已存在，將略過" : ""}</span>
                </div>
              </div>
            ))}
            {state.rows.length > 20 && <div className="empty-state">另有 {state.rows.length - 20} 筆資料未展開顯示。</div>}
          </div>

          <form action={confirmClassCalendarEvents}>
            <input name="classroomId" type="hidden" value={classroomId} />
            <input name="fileName" type="hidden" value={state.fileName} />
            <input name="rows" type="hidden" value={JSON.stringify(state.rows)} />
            <button className="button primary" type="submit">
              確認匯入 {importableRows} 筆到全班
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
