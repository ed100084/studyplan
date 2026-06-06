import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { createStudent, signOut } from "../onboarding/actions";

type StudentPageProps = {
  searchParams?: Promise<{
    created?: string;
    error?: string;
    existing?: string;
    joined?: string;
  }>;
};

export default async function StudentPage({ searchParams }: StudentPageProps) {
  const params = await searchParams;
  const created = params?.created === "1";
  const existing = params?.existing === "1";
  const joined = params?.joined === "1";
  const error = params?.error;
  const session = await getCurrentSession();
  const currentUser =
    session?.role === "STUDENT"
      ? await prisma.user.findUnique({
          where: {
            id: session.userId,
          },
          include: {
            studentProfile: {
              include: {
                classMemberships: {
                  include: {
                    classroom: true,
                  },
                },
              },
            },
          },
        })
      : null;

  return (
    <main className="page">
      <section className="section">
        <div className="shell narrow-shell">
          <Link className="back-link" href="/">
            回首頁
          </Link>
          <span className="eyebrow">學生入口</span>
          <h1 className="page-title">建立學生資料</h1>
          <p className="lead">
            第一版先建立學生基本資料，之後會接上今日任務、完成回報與自動重排。
          </p>

          {created && (
            <div className="notice">
              學生資料已建立。{joined ? "已加入班級。" : "尚未加入班級，可稍後輸入班級代碼。"}
            </div>
          )}

          {existing && (
            <div className="notice">
              這個 Email 已有學生資料，已切換到既有學生。{joined ? "目前已加入班級。" : "目前尚未加入班級。"}
            </div>
          )}

          {error === "email-used" && (
            <div className="error-notice">
              這個 Email 已被其他角色使用。請改用另一個 Email，或先登出後再操作。
            </div>
          )}

          {currentUser?.studentProfile && (
            <div className="session-card">
              <div>
                <strong>目前學生</strong>
                <p>
                  {currentUser.displayName}，國{currentUser.studentProfile.grade - 6}
                  {currentUser.studentProfile.classMemberships[0]
                    ? `，已加入 ${currentUser.studentProfile.classMemberships[0].classroom.name}`
                    : "，尚未加入班級"}
                </p>
              </div>
              <form action={signOut}>
                <button className="button secondary" type="submit">
                  登出
                </button>
              </form>
            </div>
          )}

          <form className="form-card" action={createStudent}>
            <label>
              學生姓名或暱稱
              <input name="displayName" placeholder="例如：小明" required />
            </label>

            <label>
              Email
              <input name="email" type="email" placeholder="可選填，家長綁定時會用到" />
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
              座號
              <input name="seatNumber" type="number" min="1" max="99" placeholder="可選填" />
            </label>

            <label>
              班級代碼
              <input name="classCode" placeholder="例如：ALJ701A1B2，可稍後再填" />
            </label>

            <button className="button primary" type="submit">
              建立學生資料
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
