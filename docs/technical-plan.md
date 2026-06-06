# 技術規劃

## 建議架構

- 前端：Next.js + React + TypeScript
- UI：Tailwind CSS，後續可加入 shadcn/ui
- 後端：Next.js Route Handlers 或 Server Actions
- 資料庫：PostgreSQL
- ORM：Prisma
- 部署：Vercel
- 型態：手機優先 PWA

## 主要模組

### 帳號與角色

- 學生
- 家長
- 老師或班級管理者
- 系統管理者

### 學校與教材資料

- 學校
- 學年度
- 年級
- 科目
- 出版社版本
- 章節

### 班級共用設定

- 班級代碼
- 段考日期
- 各科考試範圍
- 老師目前進度
- 班級共同作業

### 個人作息

- 到家時間
- 睡覺時間
- 晚餐、洗澡、自由時間
- 補習時間
- 通勤時間
- 補習後疲勞程度

### 排程引擎

- 產生每日任務
- 避開固定行程
- 依優先權安排作業、複習、自習
- 未完成後自動重排

### 學習紀錄

- 任務完成狀態
- 花費時間
- 難度自評
- 成績
- 錯題與弱點
- 複習排程

## 初始資料表

- `users`
- `students`
- `guardians`
- `guardian_students`
- `classes`
- `class_members`
- `academic_years`
- `subjects`
- `textbook_versions`
- `chapters`
- `exams`
- `exam_scopes`
- `fixed_events`
- `tutoring_sessions`
- `homework_items`
- `study_tasks`
- `task_logs`
- `scores`
- `weak_points`
- `review_items`

## 排程引擎規則

排程引擎完整規格已移至 [docs/scheduler-spec.md](scheduler-spec.md)，涵蓋輸入輸出契約、時段帶設計、容量模型與硬參數、搶占與降級規則、schema 變更建議與測試案例。

本節不再維護規則細節，以 scheduler-spec.md 為唯一依據。

## 建議目錄

```text
app/
  student/
  guardian/
  class-admin/
  api/
components/
lib/
  scheduler/
  auth/
  permissions/
prisma/
  schema.prisma
data/
  alian-textbook-versions-114.json
docs/
```

