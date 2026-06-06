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

## 排程引擎初版規則

輸入：

- 學生年級
- 班級考試範圍
- 考試日期
- 老師目前進度
- 個人補習
- 個人作息
- 未完成紀錄
- 弱點與錯題

輸出：

- 每日任務清單
- 每個任務的科目、章節、類型與預估時間
- 休息時間
- 若任務無法安排，回傳可理解的原因

任務類型：

- school_homework
- tutoring_homework
- review
- practice
- weak_point
- preview
- exam_sprint

重排規則：

- 明天要交的作業最高優先
- 段考高優先章節移到隔天或週末
- 低優先預習可取消或延後
- 太難的任務拆小並改成基礎觀念
- 補習太累造成未完成，隔天補短任務

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

