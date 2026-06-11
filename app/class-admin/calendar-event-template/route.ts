const template = [
  "類型,標題,科目,開始日期,結束日期,備註",
  "段考,第一次段考,數學,2026-10-13,2026-10-14,範圍第一冊第 1 到 3 章",
  "學校活動,校慶,,2026-11-07,,穿著班服",
  "截止日,畢旅報名截止,,2026-09-18,,繳交家長同意書",
].join("\r\n");

export function GET() {
  return new Response(`\uFEFF${template}`, {
    headers: {
      "Content-Disposition": 'attachment; filename="class-calendar-events-template.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
