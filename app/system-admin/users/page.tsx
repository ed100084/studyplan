import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSystemAdmin, resettableUserRoles } from "@/lib/system-admin";
import { signOut } from "@/app/onboarding/actions";
import { resetUserPassword } from "../actions";

type UsersPageProps = {
  searchParams?: Promise<{
    created?: string;
    error?: string;
    q?: string;
    updated?: string;
  }>;
};

const roleLabels: Record<(typeof resettableUserRoles)[number], string> = {
  STUDENT: "學生",
  GUARDIAN: "家長",
  CLASS_ADMIN: "班級管理者",
};

export default async function SystemAdminUsersPage({ searchParams }: UsersPageProps) {
  const params = await searchParams;
  const admin = await getCurrentSystemAdmin();
  if (!admin) redirect("/system-admin/login");

  const query = params?.q?.trim().slice(0, 100) ?? "";
  const users = await prisma.user.findMany({
    where: {
      role: { in: [...resettableUserRoles] },
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" as const } },
              { displayName: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
    take: 50,
  });

  const audits = await prisma.passwordResetAudit.findMany({
    include: {
      actor: { select: { displayName: true } },
      targetUser: { select: { displayName: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const updatedUser = params?.updated ? users.find((user) => user.id === params.updated) : null;

  return (
    <main className="page">
      <section className="section">
        <div className="shell narrow-shell">
          <Link className="back-link" href="/">回首頁</Link>
          <span className="eyebrow">系統管理</span>
          <h1 className="page-title">使用者密碼重設</h1>
          <p className="lead">搜尋家長、學生或班級管理者，設定新的暫時密碼。重設會撤銷該帳號所有既有登入。</p>

          {params?.created === "1" && <div className="notice">系統管理者已建立。</div>}
          {updatedUser && <div className="notice">已重設 {updatedUser.displayName} 的密碼並撤銷舊 session。</div>}
          {params?.error === "password-invalid" && <div className="error-notice">密碼長度必須為 8 到 128 個字元。</div>}
          {params?.error === "password-mismatch" && <div className="error-notice">兩次輸入的密碼不一致。</div>}
          {params?.error === "user-not-found" && <div className="error-notice">找不到可重設的使用者。</div>}

          <div className="session-card">
            <div>
              <strong>{admin.displayName}</strong>
              <p>{admin.email}，系統管理者</p>
            </div>
            <div className="inline-actions">
              <Link className="button secondary" href="/account/security">變更我的密碼</Link>
              <form action={signOut}>
                <button className="button secondary" type="submit">登出</button>
              </form>
            </div>
          </div>

          <form className="form-card" method="get">
            <label>
              搜尋姓名或 Email
              <input name="q" defaultValue={query} placeholder="例如：家長姓名或 email@example.com" />
            </label>
            <button className="button primary" type="submit">搜尋</button>
          </form>

          <section className="panel">
            <div className="panel-header">
              <h2>可重設帳號</h2>
              <span>最多顯示 50 筆</span>
            </div>
            <div className="task-list">
              {users.map((user) => (
                <div className="task" key={user.id}>
                  <span className="task-dot" aria-hidden="true" />
                  <div>
                    <strong>{user.displayName}</strong>
                    <span>{roleLabels[user.role as (typeof resettableUserRoles)[number]]} · {user.email ?? "未設定 Email"}</span>
                  </div>
                  <form className="form-card compact-form" action={resetUserPassword}>
                    <input name="targetUserId" type="hidden" value={user.id} />
                    <label>
                      新密碼
                      <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
                    </label>
                    <label>
                      再次輸入
                      <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
                    </label>
                    <button className="small-button" type="submit">重設密碼</button>
                  </form>
                </div>
              ))}
              {users.length === 0 && <div className="empty-state">找不到符合條件的使用者。</div>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>重設紀錄</h2>
              <span>最近 20 筆</span>
            </div>
            <div className="task-list compact-list">
              {audits.map((audit) => (
                <div className="task" key={audit.id}>
                  <span className="task-dot" aria-hidden="true" />
                  <div>
                    <strong>{audit.targetUser.displayName}</strong>
                    <span>
                      {roleLabels[audit.targetUser.role as (typeof resettableUserRoles)[number]]} · {audit.targetUser.email ?? "未設定 Email"} ·
                      由 {audit.actor.displayName} 於 {audit.createdAt.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })} 重設
                    </span>
                  </div>
                </div>
              ))}
              {audits.length === 0 && <div className="empty-state">尚未有密碼重設紀錄。</div>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
