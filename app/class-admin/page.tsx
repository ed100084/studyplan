import Link from "next/link";
import { CalendarEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getCurrentDay, getRequestTimeZone } from "@/lib/timezone";
import { createClassCalendarEvent } from "./actions";
import { ClassCalendarImport } from "./class-calendar-import";
import { createClassroom, signOut } from "../onboarding/actions";

type ClassAdminPageProps = {
  searchParams?: Promise<{
    code?: string;
    count?: string;
    created?: string;
    error?: string;
    event?: string;
    imported?: string;
    duplicates?: string;
    issues?: string;
    rows?: string;
    students?: string;
  }>;
};

const calendarEventLabels: Record<CalendarEventType, string> = {
  SECTION_EXAM: "段考",
  MOCK_EXAM: "模擬考",
  ENTRANCE_EXAM: "升學考試",
  SCHOOL_EVENT: "學校活動",
  DEADLINE: "截止日",
  OTHER: "其他",
};

const calendarEventOptions = Object.entries(calendarEventLabels);

function parsedImportIssues(value?: string) {
  if (!value) return [];

  try {
    const issues = JSON.parse(value);
    return Array.isArray(issues) ? issues.filter((issue) => typeof issue === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

export default async function ClassAdminPage({ searchParams }: ClassAdminPageProps) {
  const params = await searchParams;
  const created = params?.created === "1";
  const eventCreated = params?.event === "1";
  const imported = params?.imported === "1";
  const error = params?.error;
  const code = params?.code;
  const appliedCount = Number.parseInt(params?.count ?? "0", 10);
  const importedRows = Number.parseInt(params?.rows ?? "0", 10);
  const importedStudents = Number.parseInt(params?.students ?? "0", 10);
  const duplicateRows = Number.parseInt(params?.duplicates ?? "0", 10);
  const importIssues = parsedImportIssues(params?.issues);
  const timeZone = await getRequestTimeZone();
  const today = getCurrentDay(timeZone);
  const session = await getCurrentSession();
  const currentUser =
    session?.role === "CLASS_ADMIN"
      ? await prisma.user.findUnique({
          where: {
            id: session.userId,
          },
          include: {
            managedClasses: {
              include: {
                members: {
                  include: {
                    student: {
                      include: {
                        user: true,
                      },
                    },
                  },
                },
                calendarImports: {
                  orderBy: { createdAt: "desc" },
                  take: 8,
                },
              },
            },
          },
        })
      : null;
  const activeClassroom = currentUser?.managedClasses[0];

  return (
    <main className="page">
      <section className="section">
        <div className="shell narrow-shell">
          <Link className="back-link" href="/">
            回首頁
          </Link>
          <span className="eyebrow">老師端</span>
          <h1 className="page-title">班級共用設定</h1>
          <p className="lead">
            建立阿蓮國中的班級代碼，讓學生加入班級；老師也可以把段考、模擬考、校內活動套用到全班學生行事曆。
          </p>

          {created && code && (
            <div className="notice">
              班級已建立，班級代碼：<strong>{code}</strong>
            </div>
          )}

          {eventCreated && (
            <div className="notice">
              已套用班級事件到 {Number.isFinite(appliedCount) ? appliedCount : 0} 位學生。
            </div>
          )}

          {imported && (
            <div className="notice">
              已匯入 {Number.isFinite(importedRows) ? importedRows : 0} 筆班級事件，套用到{" "}
              {Number.isFinite(importedStudents) ? importedStudents : 0} 位學生，共建立{" "}
              {Number.isFinite(appliedCount) ? appliedCount : 0} 筆行事曆資料。
              {Number.isFinite(duplicateRows) && duplicateRows > 0 ? ` 已略過 ${duplicateRows} 筆既有事件。` : ""}
            </div>
          )}

          {error === "email-required" && <div className="error-notice">請填寫 Email，之後才能從登入頁回到帳號。</div>}
          {error === "account-exists" && (
            <div className="error-notice">這個 Email 已有帳號，請改用 <Link href="/login?role=CLASS_ADMIN">班級管理者登入頁</Link>。</div>
          )}

          {error === "class-code-used" && (
            <div className="error-notice">
              班級代碼 {code ? <strong>{code}</strong> : null} 已被使用，請換一個代碼。
            </div>
          )}

          {error === "class-admin-required" && <div className="error-notice">請先建立或登入班級管理者資料。</div>}

          {error === "class-not-found" && <div className="error-notice">找不到可管理的班級。</div>}

          {error === "no-class-members" && <div className="error-notice">班上目前沒有學生，還不能套用班級事件。</div>}

          {error === "import-validation" && (
            <div className="error-notice">
              <strong>檔案未匯入，請修正以下問題：</strong>
              <ul>
                {(importIssues.length > 0 ? importIssues : ["匯入檔案驗證失敗。請下載範本並確認欄位格式。"]).map(
                  (issue) => (
                    <li key={issue}>{issue}</li>
                  ),
                )}
              </ul>
            </div>
          )}

          {currentUser && activeClassroom ? (
            <>
              <div className="session-card">
                <div>
                  <strong>目前班級</strong>
                  <p>
                    {currentUser.displayName}，管理 {activeClassroom.name}，班級代碼 {activeClassroom.code}，目前{" "}
                    {activeClassroom.members.length} 位學生
                  </p>
                </div>
                <form action={signOut}>
                  <button className="button secondary" type="submit">
                    登出
                  </button>
                </form>
              </div>

              <section className="panel event-panel">
                <div className="panel-header">
                  <div>
                    <h2>班級共用考試 / 活動</h2>
                    <p className="panel-copy">
                      會套用到目前班級全部 {activeClassroom.members.length} 位學生，學生與家長端週/月行事曆會同步顯示。
                    </p>
                  </div>
                  <span>
                    {today.date}，{timeZone}
                  </span>
                </div>

                <form className="form-card" action={createClassCalendarEvent}>
                  <input name="classroomId" type="hidden" value={activeClassroom.id} />
                  <label>
                    類型
                    <select name="type" defaultValue="SECTION_EXAM">
                      {calendarEventOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    標題
                    <input name="title" placeholder="例如：第一次段考、校慶、畢旅報名截止" required />
                  </label>
                  <label>
                    科目
                    <input name="subjectName" placeholder="可留空；例如：數學、英文" />
                  </label>
                  <div className="field-row">
                    <label>
                      開始日期
                      <input name="startDate" type="date" defaultValue={today.date} required />
                    </label>
                    <label>
                      結束日期
                      <input name="endDate" type="date" />
                    </label>
                  </div>
                  <label>
                    備註
                    <input name="note" placeholder="例如：考試範圍、攜帶物品、報名資訊" />
                  </label>
                  <button className="button primary" type="submit">
                    套用到全班學生
                  </button>
                </form>
              </section>

              <section className="panel event-panel">
                <div className="panel-header">
                  <div>
                    <h2>CSV / Excel 批次匯入</h2>
                    <p className="panel-copy">
                      一次最多 500 筆、檔案上限 2 MB。支援 UTF-8 CSV 與 XLSX；任何一列有誤時整批不會寫入。
                    </p>
                  </div>
                  <Link className="button secondary" href="/class-admin/calendar-event-template">
                    下載 CSV 範本
                  </Link>
                </div>

                <ClassCalendarImport classroomId={activeClassroom.id} />
              </section>

              <section className="panel">
                <div className="panel-header">
                  <h2>匯入歷史</h2>
                  <span>{activeClassroom.calendarImports.length} 筆</span>
                </div>
                <div className="task-list compact-list">
                  {activeClassroom.calendarImports.map((item) => (
                    <div className="task" key={item.id}>
                      <span className="task-dot" aria-hidden="true" />
                      <div>
                        <strong>{item.fileName}</strong>
                        <span>
                          {item.createdAt.toLocaleString("zh-TW", { timeZone })} · 匯入 {item.importedRows}/{item.totalRows} 筆
                          {item.duplicateRows > 0 ? ` · 略過 ${item.duplicateRows} 筆` : ""} · {item.studentCount} 位學生
                        </span>
                      </div>
                    </div>
                  ))}
                  {activeClassroom.calendarImports.length === 0 && <div className="empty-state">尚未有批次匯入紀錄。</div>}
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <h2>班級學生</h2>
                  <span>{activeClassroom.members.length} 位</span>
                </div>
                <div className="task-list compact-list">
                  {activeClassroom.members.map((member) => (
                    <div className="task" key={member.id}>
                      <span className="task-dot" aria-hidden="true" />
                      <div>
                        <strong>{member.student.user.displayName}</strong>
                        <span>{member.seatNumber ? `座號 ${member.seatNumber}` : "未填座號"}</span>
                      </div>
                    </div>
                  ))}
                  {activeClassroom.members.length === 0 && <div className="empty-state">尚未有學生加入班級。</div>}
                </div>
              </section>
            </>
          ) : (
            <form className="form-card" action={createClassroom}>
              <h2>建立班級管理者資料</h2>
              <p className="panel-copy">這裡只建立新帳號。已有管理者帳號請前往 <Link href="/login?role=CLASS_ADMIN">登入頁</Link>。</p>
              <label>
                老師姓名
                <input name="displayName" placeholder="例如：701 導師" required />
              </label>

              <label>
                老師 Email
                <input name="email" type="email" autoComplete="email" placeholder="管理者使用的 Email" required />
              </label>

              <label>
                年級
                <select name="grade" defaultValue="7">
                  <option value="7">國一 / 七年級</option>
                  <option value="8">國二 / 八年級</option>
                  <option value="9">國三 / 九年級</option>
                </select>
              </label>

              <label>
                班級名稱
                <input name="className" placeholder="例如：701、國三 1 班" required />
              </label>

              <label>
                自訂班級代碼
                <input name="classCode" placeholder="可空白，系統會自動產生" />
              </label>

              <button className="button primary" type="submit">
                建立班級
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
