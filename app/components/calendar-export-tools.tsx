import Link from "next/link";

export function CalendarExportTools({
  monthDate,
  studentId,
}: {
  monthDate: string;
  studentId?: string;
}) {
  const query = new URLSearchParams({ month: monthDate });
  if (studentId) query.set("studentId", studentId);
  const queryString = query.toString();

  return (
    <section className="panel export-tools-panel">
      <div className="panel-header">
        <div>
          <h2>匯出資料</h2>
          <p className="panel-copy">匯出目前選取月份，可列印成 PDF，也可下載 CSV 做備份或整理。</p>
        </div>
        <span>{monthDate.slice(0, 7)}</span>
      </div>
      <div className="inline-actions export-tool-actions">
        <Link className="button secondary" href={`/calendar/print?${queryString}`}>
          月曆 PDF
        </Link>
        <Link className="button secondary" href={`/calendar/export?${queryString}`}>
          下載 CSV
        </Link>
      </div>
    </section>
  );
}
