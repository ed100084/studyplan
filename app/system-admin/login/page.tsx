import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSystemAdmin } from "@/lib/system-admin";

type SystemAdminLoginPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function SystemAdminLoginPage({ searchParams }: SystemAdminLoginPageProps) {
  const params = await searchParams;
  if (await getCurrentSystemAdmin()) redirect("/system-admin/users");

  return (
    <main className="page">
      <section className="section">
        <div className="shell narrow-shell">
          <Link className="back-link" href="/">回首頁</Link>
          <span className="eyebrow">系統管理</span>
          <h1 className="page-title">系統管理者登入</h1>
          <p className="lead">此入口只用於帳號復原與密碼重設，不是班級管理者入口。</p>

          {params?.error === "missing-fields" && <div className="error-notice">請輸入 Email 與密碼。</div>}
          {params?.error === "invalid-credentials" && <div className="error-notice">Email 或密碼不正確。</div>}
          {params?.error === "password-not-set" && <div className="error-notice">此管理者帳號尚未設定密碼。</div>}
          {params?.error === "database-unavailable" && <div className="error-notice">登入服務暫時無法連接資料庫。</div>}

          <form className="form-card narrow-form" action="/api/login" method="post">
            <input name="role" type="hidden" value="SYSTEM_ADMIN" />
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              密碼
              <input name="password" type="password" autoComplete="current-password" minLength={8} maxLength={128} required />
            </label>
            <button className="button primary" type="submit">登入系統管理</button>
          </form>
        </div>
      </section>
    </main>
  );
}
