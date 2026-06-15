import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { changePassword } from "./actions";

type SecurityPageProps = {
  searchParams?: Promise<{ error?: string; updated?: string }>;
};

const roleLabels: Record<UserRole, string> = {
  STUDENT: "學生",
  GUARDIAN: "家長",
  CLASS_ADMIN: "班級管理者",
  TEACHER: "老師",
  SYSTEM_ADMIN: "系統管理者",
};

function workspacePath(role: UserRole) {
  if (role === UserRole.STUDENT) return "/student";
  if (role === UserRole.GUARDIAN) return "/guardian";
  if (role === UserRole.CLASS_ADMIN) return "/class-admin";
  if (role === UserRole.SYSTEM_ADMIN) return "/system-admin/users";
  return "/";
}

export default async function SecurityPage({ searchParams }: SecurityPageProps) {
  const params = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");

  return (
    <main className="page">
      <section className="section">
        <div className="shell narrow-shell">
          <Link className="back-link" href={workspacePath(user.role)}>回工作區</Link>
          <span className="eyebrow">帳號安全</span>
          <h1 className="page-title">變更密碼</h1>
          <p className="lead">{user.displayName}，{roleLabels[user.role]}帳號。變更後其他裝置上的既有登入會立即失效。</p>

          {params?.updated === "1" && <div className="notice">密碼已更新。</div>}
          {params?.error === "current-password" && <div className="error-notice">目前密碼不正確。</div>}
          {params?.error === "password-invalid" && <div className="error-notice">新密碼長度必須為 8 到 128 個字元。</div>}
          {params?.error === "password-mismatch" && <div className="error-notice">兩次輸入的新密碼不一致。</div>}

          <form className="form-card narrow-form" action={changePassword}>
            <label>
              目前密碼
              <input name="currentPassword" type="password" autoComplete="current-password" required />
            </label>
            <label>
              新密碼
              <input name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
            </label>
            <label>
              再次輸入新密碼
              <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
            </label>
            <button className="button primary" type="submit">更新密碼</button>
          </form>
        </div>
      </section>
    </main>
  );
}
