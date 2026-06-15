import Link from "next/link";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { signOut } from "../onboarding/actions";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    role?: string;
  }>;
};

const loginRoles = [UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CLASS_ADMIN] as const;
type LoginRole = (typeof loginRoles)[number];

const roleLabels: Record<LoginRole, string> = {
  STUDENT: "學生",
  GUARDIAN: "家長",
  CLASS_ADMIN: "班級管理者",
};

const rolePaths: Record<LoginRole, string> = {
  STUDENT: "/student",
  GUARDIAN: "/guardian",
  CLASS_ADMIN: "/class-admin",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const requestedRole = loginRoles.find((role) => role === params?.role) ?? UserRole.STUDENT;
  const session = await getCurrentSession();
  const currentUser = session ? await prisma.user.findUnique({ where: { id: session.userId } }) : null;
  const currentRole = session && loginRoles.find((role) => role === session.role);

  return (
    <main className="page">
      <section className="section">
        <div className="shell narrow-shell">
          <Link className="back-link" href="/">回首頁</Link>
          <span className="eyebrow">帳號登入</span>
          <h1 className="page-title">登入 StudyPlan</h1>
          <p className="lead">請選擇帳號角色，並使用建立帳號時設定的 Email 與密碼登入。</p>

          {params?.error === "missing-fields" && <div className="error-notice">請選擇角色並輸入 Email 與密碼。</div>}
          {params?.error === "invalid-credentials" && (
            <div className="error-notice">角色、Email 或密碼不正確。</div>
          )}
          {params?.error === "password-not-set" && (
            <div className="error-notice">這是升級前建立的帳號，尚未設定密碼，請由管理者協助重設後再登入。</div>
          )}
          {params?.error === "database-unavailable" && (
            <div className="error-notice">登入服務暫時無法連接資料庫，請稍後再試一次。</div>
          )}

          {currentUser && session ? (
            <div className="session-card">
              <div>
                <strong>目前已登入：{currentUser.displayName}</strong>
                <p>{currentRole ? roleLabels[currentRole] : "系統內部"}帳號</p>
              </div>
              <div className="inline-actions">
                <Link className="button primary" href={currentRole ? rolePaths[currentRole] : "/"}>前往工作區</Link>
                <form action={signOut}>
                  <button className="button secondary" type="submit">登出</button>
                </form>
              </div>
            </div>
          ) : (
            <form className="form-card narrow-form" action="/api/login" method="post">
              <h2>既有帳號登入</h2>
              <label>
                帳號角色
                <select name="role" defaultValue={requestedRole} required>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                Email
                <input name="email" type="email" autoComplete="email" placeholder="輸入建立帳號時使用的 Email" required />
              </label>
              <label>
                密碼
                <input name="password" type="password" autoComplete="current-password" minLength={8} maxLength={128} required />
              </label>
              <button className="button primary" type="submit">登入</button>
            </form>
          )}

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>還沒有帳號？</h2>
                <p className="panel-copy">請前往對應角色頁建立資料，建立完成後會自動登入。</p>
              </div>
            </div>
            <div className="inline-actions">
              <Link className="button secondary" href="/student">建立學生資料</Link>
              <Link className="button secondary" href="/guardian">建立家長資料</Link>
              <Link className="button secondary" href="/class-admin">建立班級</Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
