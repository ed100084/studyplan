"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStudyTaskInline, deleteImportBatch, importStudyTasks } from "@/app/schedule/actions";
import { parseStudyTaskCsv } from "@/lib/study-task-import";
import type { StudyTaskImportBatchSummary } from "@/lib/study-task-import-history";

type TaskTypeOption = {
  value: string;
  label: string;
};

type StudentScopedProps = {
  studentId?: string;
};

export function StudyTaskContinuousForm({
  defaultDate,
  studentId,
  taskTypeOptions,
  title,
}: StudentScopedProps & {
  defaultDate: string;
  taskTypeOptions: TaskTypeOption[];
  title: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;
    if (!form) return;

    const formData = new FormData(form);
    startTransition(async () => {
      setMessage("處理中...");
      try {
        const result = await createStudyTaskInline(formData);
        if (result.ok) {
          form.reset();
          setMessage("已新增任務，可繼續輸入下一筆。");
          firstFieldRef.current?.focus();
          router.refresh();
        }
      } catch {
        setMessage("新增失敗，請重新整理後再試。");
      }
    });
  }

  return (
    <form
      className="form-card"
      data-submit-guard="off"
      id="new-study-task-form"
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <h2>{title}</h2>
      {studentId && <input name="studentId" type="hidden" value={studentId} />}
      <label>
        科目
        <input name="subjectName" placeholder="例如：數學" ref={firstFieldRef} />
      </label>
      <label>
        任務
        <input name="title" placeholder="例如：完成講義第 12 回" required />
      </label>
      <label>
        類型
        <select name="type" defaultValue="SCHOOL_HOMEWORK">
          {taskTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        日期
        <input name="plannedDate" type="date" defaultValue={defaultDate} required />
      </label>
      <div className="field-row">
        <label>
          指定開始
          <input name="plannedStartTime" type="time" />
        </label>
        <label>
          指定結束
          <input name="plannedEndTime" type="time" />
        </label>
      </div>
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
        <input name="description" placeholder="例如：錯題要重算" />
      </label>
      {message && <p className="form-status">{message}</p>}
      <button className="button primary" disabled={isPending} type="submit">
        {isPending ? "處理中..." : "新增任務"}
      </button>
    </form>
  );
}

export function StudyTaskImportPanel({ studentId }: StudentScopedProps) {
  const [csv, setCsv] = useState("");
  const [previewText, setPreviewText] = useState("");
  const preview = useMemo(() => (previewText ? parseStudyTaskCsv(previewText) : null), [previewText]);
  const canImport = Boolean(preview && preview.rows.length > 0 && preview.errors.length === 0);

  return (
    <section className="form-card study-task-import-panel">
      <h2>CSV 批次匯入任務</h2>
      <p className="panel-copy">
        可貼上純任務 CSV，也可貼上月曆匯出的 CSV；匯入時只會寫入任務列，補習、作息、可讀書時段與事件會略過。
      </p>
      <label>
        CSV 內容
        <textarea
          name="csvPreview"
          onChange={(event) => setCsv(event.target.value)}
          placeholder="subject,title,type,minutes,priority,weekHint,note"
          rows={8}
          value={csv}
        />
      </label>
      <div className="inline-actions">
        <button className="button secondary" onClick={() => setPreviewText(csv)} type="button">
          解析預覽
        </button>
        <form action={importStudyTasks} data-pending-label="匯入中...">
          {studentId && <input name="studentId" type="hidden" value={studentId} />}
          <input name="csv" type="hidden" value={csv} />
          <button className="button primary" disabled={!canImport} type="submit">
            確認匯入
          </button>
        </form>
      </div>

      {preview && (
        <div className={preview.errors.length > 0 ? "error-notice" : "notice"}>
          <strong>
            將建立 {preview.rows.length} 筆／{preview.errors.length} 筆錯誤
          </strong>
          {preview.errors.length > 0 && (
            <ul>
              {preview.errors.slice(0, 8).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export function StudyTaskImportHistory({
  batches,
  studentId,
}: StudentScopedProps & {
  batches: StudyTaskImportBatchSummary[];
}) {
  return (
    <section className="panel import-history-panel">
      <div className="panel-header">
        <h2>匯入紀錄</h2>
        <span>{batches.length} 批</span>
      </div>
      <div className="import-batch-list">
        {batches.map((batch) => (
          <div className="import-batch-card" key={batch.id}>
            <div>
              <strong>{batch.count} 筆任務</strong>
              <span>
                {batch.startDate} 至 {batch.endDate}，建立於 {batch.createdAt}
              </span>
            </div>
            <form
              action={deleteImportBatch}
              data-pending-label="刪除中..."
              onSubmit={(event) => {
                if (!window.confirm(`確定刪除這整批 ${batch.count} 筆任務？此動作不會刪除其他任務。`)) {
                  event.preventDefault();
                }
              }}
            >
              {studentId && <input name="studentId" type="hidden" value={studentId} />}
              <input name="importBatchId" type="hidden" value={batch.id} />
              <button className="small-button danger-button" type="submit">
                刪除整批
              </button>
            </form>
          </div>
        ))}
        {batches.length === 0 && <div className="empty-state">尚無 CSV 匯入紀錄。</div>}
      </div>
    </section>
  );
}
