import Link from "next/link";
import packageJson from "../package.json";

const appVersion = packageJson.version;

const tasks = [
  {
    subject: "數學",
    title: "1-2 例題與練習",
    detail: "做 5 題並標記不會的題目",
    time: "30 分",
  },
  {
    subject: "英文",
    title: "Lesson 2 單字",
    detail: "背 30 個單字，睡前快速複習",
    time: "20 分",
  },
  {
    subject: "自然",
    title: "2-1 重點整理",
    detail: "看筆記並完成一段短複習",
    time: "25 分",
  },
];

const roles = [
  {
    title: "學生",
    href: "/student",
    loginHref: "/login?role=STUDENT",
    action: "建立學生資料",
    text: "每天看到今日任務，快速回報完成、部分完成或需要重排。",
  },
  {
    title: "家長",
    href: "/guardian",
    loginHref: "/login?role=GUARDIAN",
    action: "建立家長資料",
    text: "協助輸入補習、作息與成績，掌握孩子本週是否穩定。",
  },
  {
    title: "班級管理者",
    href: "/class-admin",
    loginHref: "/login?role=CLASS_ADMIN",
    action: "建立班級",
    text: "設定班級代碼、段考日期、考試範圍與班級共用進度。",
  },
];

export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <div className="shell">
          <nav className="nav" aria-label="主要導覽">
            <div className="brand">
              <span className="brand-mark">學</span>
              <span>StudyPlan</span>
              <span className="version-badge">v{appVersion}</span>
            </div>
            <div className="inline-actions">
              <span className="nav-pill">阿蓮國中 114 學年試用規劃</span>
              <Link className="button secondary" href="/login">
                登入
              </Link>
            </div>
          </nav>

          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">手機優先的讀書規劃網站</span>
              <h1>每天知道該讀什麼，落後也能重新安排。</h1>
              <p className="lead">
                StudyPlan 依照阿蓮國中教材版本、班級段考範圍、補習時間與家庭作息，
                自動產生學生放學後能執行的讀書計畫。
              </p>
              <div className="actions">
                <Link className="button primary" href="/student">
                  建立學生資料
                </Link>
                <Link className="button secondary" href="/login">
                  登入既有帳號
                </Link>
                <Link className="button secondary" href="/class-admin">
                  建立班級
                </Link>
              </div>
              <p className="version-note">
                目前版次 v{appVersion}。每次功能更版會同步更新版次，方便確認部署版本。
              </p>
            </div>

            <div className="today-card" aria-label="今日任務範例">
              <div className="card-header">
                <div>
                  <p className="card-title">今天讀書 90 分鐘</p>
                  <p className="card-meta">平日標準型，含休息與洗澡預留</p>
                </div>
                <span className="card-meta">段考倒數 18 天</span>
              </div>

              <div className="task-list">
                {tasks.map((task) => (
                  <div className="task" key={task.title}>
                    <span className="task-dot" aria-hidden="true" />
                    <div>
                      <strong>
                        {task.subject}：{task.title}
                      </strong>
                      <span>{task.detail}</span>
                    </div>
                    <span className="time">{task.time}</span>
                  </div>
                ))}
              </div>

              <div className="quick-actions" aria-label="回報按鈕範例">
                <button type="button">完成</button>
                <button type="button">部分完成</button>
                <button type="button">幫我重排</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="roles">
        <div className="shell">
          <h2>三種角色，各看重點</h2>
          <div className="role-grid">
            {roles.map((role) => (
              <article className="role" key={role.title}>
                <h3>{role.title}</h3>
                <p>{role.text}</p>
                <Link className="role-link" href={role.href}>
                  {role.action}
                </Link>
                <Link className="role-link" href={role.loginHref}>
                  登入{role.title}帳號
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

