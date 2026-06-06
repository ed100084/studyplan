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
    text: "每天看到今日任務，快速回報完成、部分完成或需要重排。",
  },
  {
    title: "家長",
    text: "協助輸入補習、作息與成績，掌握孩子本週是否穩定。",
  },
  {
    title: "班級管理者",
    text: "設定段考日期、考試範圍與班級共用進度，減少學生重複輸入。",
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
            </div>
            <span className="nav-pill">阿蓮國中 114 學年試用規劃</span>
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
                <a className="button primary" href="#roles">
                  查看角色分工
                </a>
                <a
                  className="button secondary"
                  href="https://github.com/ed100084/studyplan/blob/main/docs/requirements.md"
                >
                  需求文件
                </a>
              </div>
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
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
