import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bootstrapSystemAdmin } from "../actions";

type SetupPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function SystemAdminSetupPage({ searchParams }: SetupPageProps) {
  const params = await searchParams;
  const existingAdmin = await prisma.user.findFirst({ where: { role: UserRole.SYSTEM_ADMIN }, select: { id: true } });
  if (existingAdmin) redirect("/system-admin/login");

  const configured = (process.env.SYSTEM_ADMIN_BOOTSTRAP_SECRET?.length ?? 0) >= 32;

  return (
    <main className="page">
      <section className="section">
        <div className="shell narrow-shell">
          <Link className="back-link" href="/">回首頁</Link>
          <span className="eyebrow">一次性初始化</span>
          <h1 className="page-title">建立系統管理者</h1>
          <p className="lead">只在系統尚未有管理者時開放。建立完成後，請從 Vercel 移除 bootstrap secret。</p>

          {!configured && <div className="error-notice">尚未設定至少 32 個字元的 SYSTEM_ADMIN_BOOTSTRAP_SECRET。</div>}
          {params?.error === "bootstrap-secret" && <div className="error-notice">初始化密鑰不正確或尚未設定。</div>}
          {params?.error === "email-required" && <div className="error-notice">請填寫 Email。</div>}
          {params?.error === "password-invalid" && <div className="error-notice">密碼長度必須為 8 到 128 個字元。</div>}
          {params?.error === "password-mismatch" && <div className="error-notice">兩次輸入的密碼不一致。</div>}
          {params?.error === "account-exists" && <div className="error-notice">這個 Email 已經被使用。</div>}

          <form className="form-card narrow-form" action={bootstrapSystemAdmin}>
            <label>
              顯示名稱
              <input name="displayName" placeholder="例如：StudyPlan 管理者" required />
            </label>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              密碼
              <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
            </label>
            <label>
              再次輸入密碼
              <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
            </label>
            <label>
              初始化密鑰
              <input name="bootstrapSecret" type="password" autoComplete="off" required />
            </label>
            <button className="button primary" type="submit" disabled={!configured}>建立系統管理者</button>
          </form>
        </div>
      </section>
    </main>
  );
}
