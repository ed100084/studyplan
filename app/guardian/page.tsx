import Link from "next/link";
import { createGuardian } from "../onboarding/actions";

type GuardianPageProps = {
  searchParams?: Promise<{
    created?: string;
    linked?: string;
  }>;
};

export default async function GuardianPage({ searchParams }: GuardianPageProps) {
  const params = await searchParams;
  const created = params?.created === "1";
  const linked = params?.linked === "1";

  return (
    <main className="page">
      <section className="section">
        <div className="shell narrow-shell">
          <Link className="back-link" href="/">
            回首頁
          </Link>
          <span className="eyebrow">家長入口</span>
          <h1 className="page-title">建立家長資料</h1>
          <p className="lead">
            家長端會負責補習、作息與成績輸入。第一版先建立資料並可用學生 Email 綁定。
          </p>

          {created && (
            <div className="notice">
              家長資料已建立。{linked ? "已綁定學生。" : "尚未綁定學生，可等學生填 Email 後再補。"}
            </div>
          )}

          <form className="form-card" action={createGuardian}>
            <label>
              家長姓名或稱呼
              <input name="displayName" placeholder="例如：王媽媽" required />
            </label>

            <label>
              家長 Email
              <input name="email" type="email" placeholder="可選填" />
            </label>

            <label>
              學生 Email
              <input name="studentEmail" type="email" placeholder="學生建立資料時填的 Email，可選填" />
            </label>

            <button className="button primary" type="submit">
              建立家長資料
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

