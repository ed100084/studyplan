# Changelog

## 1.1.0

- Added partial-completion forms for planned tasks with actual minutes, difficulty, and blocker reason.
- Added a bulk action to move all unplaced tasks to tomorrow.
- Improved scheduler unplaced-task explanations with concrete capacity reasons.
- Unplaced task carryover keeps a RESCHEDULED task log for audit history.

## 1.0.0

- Added edit actions for fixed routine events, tutoring sessions, and study tasks.
- Student and guardian pages now show per-item collapsed edit forms.
- Guardians can edit schedule records for the currently selected linked student.
- Task edits support subject, title, type, planned date, estimated minutes, priority, and notes.
- Routine and tutoring edits immediately refresh the generated daily schedule.

## 0.9.0

- Added correction actions for fixed routine events, tutoring sessions, and study tasks.
- Student and guardian pages can delete incorrect schedule records.
- Planned tasks can now be marked done, skipped, or rescheduled.
- Rescheduled tasks are moved to the next day while keeping a RESCHEDULED task log.
- Guardian task actions preserve the selected linked student.

## 0.8.0

- 新增今日自動排程引擎 `lib/scheduler/today.ts`。
- 依固定作息、補習時段與通勤時間扣除不可讀書時段。
- 依任務優先度與預估分鐘數安排今天讀書段，任務間保留 10 分鐘休息。
- 補習疲勞程度為高時，降低補習後可安排的讀書容量。
- 學生端與家長端新增「系統自動排程」區塊，並標示今天排不下的任務。

## 0.7.1

- 將家長連結學生由「學生 Email」改為「學生連結碼」。
- 學生端新增家長可用的學生連結碼顯示。
- 家長端新增多位孩子連結與切換，不再只顯示第一位學生。
- 家長替特定孩子代填補習、作息、作業後，會留在該孩子頁面。
- 新增 `StudentProfile.linkCode` 資料欄位與 migration。

## 0.7.0

- 啟動第二階段排程核心 MVP。
- 新增固定作息、補習時段、讀書任務的 Server Actions。
- 學生端新增今日時間軸、今日任務、補習/作息/任務輸入表單。
- 家長端新增代填補習、作息、作業與代勾完成。
- 補上排程介面的響應式 dashboard 樣式。

## 0.6.1

- 修正學生資料建立時重複 Email 會造成 500 的問題。
- 同角色重複 Email 會切換到既有資料。
- 不同角色 Email 衝突會顯示表單錯誤。
- 班級代碼重複會顯示表單錯誤。

## 0.6.0

- 新增簡易 session cookie。
- 建立角色資料後會保留目前使用者狀態。
- 學生、家長、班級管理者頁面顯示目前使用者摘要。
- 新增登出動作。

## 0.5.0

- 開始 Phase 2 帳號與角色開發。
- 新增學生、家長、班級管理者三種 onboarding 頁面。
- 新增 onboarding server actions，資料可寫入 Supabase。
- 首頁新增三角色入口。

## 0.4.0

- 新增雲端資料庫部署準備文件。
- Prisma datasource 新增 `DIRECT_URL`，支援正式環境 migration 與 runtime 連線分離。
- 新增 `db:deploy` 指令，用於雲端資料庫套用已提交 migrations。

## 0.3.0

- 完成 Phase 1 專案基礎。
- 新增本機 PostgreSQL Docker Compose 設定。
- 建立並套用 Prisma 初始 migration。
- 完成阿蓮國中 114 學年教材版本 seed 驗證。
- 補齊本機資料庫開發文件。

## 0.2.0

- 首頁顯示目前版次。
- 建立版次更新規則。
- 開始 Phase 1 專案基礎開發。

## 0.1.0

- 建立 StudyPlan 初始規劃文件。
- 建立最小可部署 Next.js 首頁。
- 建立 Vercel 部署設定。
