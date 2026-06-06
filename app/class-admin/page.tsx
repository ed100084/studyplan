import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { createClassroom, signOut } from "../onboarding/actions";

type ClassAdminPageProps = {
  searchParams?: Promise<{
    created?: string;
    code?: string;
  }>;
};

export default async function ClassAdminPage({ searchParams }: ClassAdminPageProps) {
  const params = await searchParams;
  const created = params?.created === "1";
  const code = params?.code;
  const session = await getCurrentSession();
  const currentUser =
    session?.role === "CLASS_ADMIN"
      ? await prisma.user.findUnique({
          where: {
            id: session.userId,
          },
          include: {
            managedClasses: {
              include: {
                members: true,
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
          <span className="eyebrow">班級管理者入口</span>
          <h1 className="page-title">建立班級</h1>
          <p className="lead">
            班級管理者先建立班級代碼，學生加入後會套用阿蓮國中 114 學年的教材版本資料。
          </p>

          {created && code && (
            <div className="notice">
              班級已建立，班級代碼：<strong>{code}</strong>
            </div>
          )}

          {currentUser && currentUser.managedClasses.length > 0 && (
            <div className="session-card">
              <div>
                <strong>目前班級管理者</strong>
                <p>
                  {currentUser.displayName}，管理 {currentUser.managedClasses[0].name}，
                  班級代碼 {currentUser.managedClasses[0].code}，
                  已加入學生 {currentUser.managedClasses[0].members.length} 人
                </p>
              </div>
              <form action={signOut}>
                <button className="button secondary" type="submit">
                  登出
                </button>
              </form>
            </div>
          )}

          <form className="form-card" action={createClassroom}>
            <label>
              管理者姓名
              <input name="displayName" placeholder="例如：201 班導師" required />
            </label>

            <label>
              管理者 Email
              <input name="email" type="email" placeholder="可選填" />
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
              班級名稱
              <input name="className" placeholder="例如：701、201、九年一班" required />
            </label>

            <label>
              自訂班級代碼
              <input name="classCode" placeholder="可選填；空白會自動產生" />
            </label>

            <button className="button primary" type="submit">
              建立班級
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
