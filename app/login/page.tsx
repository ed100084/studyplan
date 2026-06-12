import Link from "next/link";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { login, signOut } from "../onboarding/actions";

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
          <p className="lead">登入與建立資料已分開。請選擇原本建立帳號時的角色，並輸入相同 Email。</p>

          {params?.error === "missing-fields" && <div className="error-notice">請選擇角色並輸入 Email。</div>}
          {params?.error === "account-not-found" && (
            <div className="error-notice">找不到符合這個角色與 Email 的帳號，請確認角色或改用建立資料。</div>
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
            <form className="form-card narrow-form" action={login}>
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
              <p className="panel-copy">目前試用版以 Email 辨識帳號，正式對外使用前應升級為密碼或 Email 驗證碼登入。</p>
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
