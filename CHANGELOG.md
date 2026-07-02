# Changelog

## 2.8.2

- Changed the Today task editor to stay collapsed by default on student and guardian dashboards.
- Moved Prisma seed configuration into `prisma.config.ts` to avoid the deprecated `package.json#prisma` setting.

## 2.8.1

- CI/CD version bump to verify Vercel deployment pipeline end-to-end.

## 2.8.0

- Added a Google Calendar `.ics` export for the selected month.
- Study tasks export as all-day events so students can see what to study without fixed completion times.
- Tutoring sessions export as timed events, while exams, deadlines, and school events export as all-day events.
- Routine fixed events such as meals and hygiene are intentionally excluded from the Google Calendar export.

## 2.7.0

- Changed study tasks from minute-level timetable scheduling to a CSV/date-driven priority list model.
- Today views now show priority task lists with complete and partial-complete actions instead of generated study time blocks.
- Weekly and monthly calendar day details now show the tasks assigned to that exact date, matching the visible calendar cells.
- CSV imports now support backlog fields including `weekHint`, ignore task start/end times for scheduling, and replace old unfinished imported tasks.
- Selected-day details keep fixed routines, tutoring, exams, and events as context while study tasks remain list-based and conflict-free.

## 2.6.4

- Signed-in student and guardian dashboards now hide the large marketing header so daily content starts higher on the page.
- Student account and guardian link-code cards use compact spacing above the dashboard tabs.

## 2.6.3

- Monthly calendar cells now show up to three short item labels sorted by time.
- Fixed events, tutoring sessions, calendar events, and tasks use distinct compact colors in month cells, with a `+N` overflow marker.

## 2.6.2

- Calendar date clicks now update the day-detail panel client-side for already loaded week/month dates instead of triggering a full server navigation.
- Student and guardian calendar date cells keep a normal fallback link and immediately highlight the selected date after client-side selection.

## 2.6.1

- Fixed the selected-day chart timeline so morning fixed events and tutoring sessions are included.
- The chart now defaults to a full-day 07:00-22:30 range and scales its height based on the visible time span.

## 2.6.0

- Changed student and guardian dashboards into Today, Calendar, Learning, and Settings tabs to reduce the single long scroll.
- Compact weekly and monthly calendars now keep navigation in the calendar tab while opening selected-day details from date cells.
- Empty states link directly to the relevant creation forms, including across dashboard tabs.
- Server-rendered timezone defaults to Asia/Taipei before client sync.
- Set the document language to `zh-TW` and hide empty day-detail metric cards when there is no data.

## 2.5.2

- Student and guardian creation forms for tutoring sessions now allow selecting multiple weekdays at once.
- Student and guardian creation forms for fixed events now allow selecting multiple weekdays at once.
- Server actions create one schedule record per selected weekday while preserving the existing single-record edit flow.

## 2.5.1

- Changed score history into per-subject summary cards with expandable score details.
- Rebuilt the selected-day schedule chart as a vertical time grid with proportional event blocks.
- Added clearer visual colors for fixed events, tutoring, study blocks, and breaks in the daily chart.

## 2.5.0

- Added optional start and end dates to fixed events.
- Student and guardian fixed-event forms now support date ranges for term schedules, holidays, and temporary extended school hours.
- Today schedules, weekly/monthly calendars, selected-day details, saved schedule runs, and exam-review planning now count fixed events only when active on that date.

## 2.4.1

- Changed selected-day schedule details from a list-only timeline to a proportional chart-style time bar.
- Made score history render as wrapping cards so multiple subject scores no longer stretch into one long row.

## 2.4.0

- Added a selected-day detail panel for student and guardian calendars with schedule timeline, fixed events, tutoring, exams, and tasks.
- Weekly and monthly calendar days are now clickable and preserve the selected date in the URL.
- Reordered student and guardian dashboards so daily details and calendars appear before management and input sections.

## 2.3.3

- Added full tutoring schedule lists to student and guardian pages.
- Tutoring schedules can now be edited or deleted even when they are not active today.

## 2.3.2

- Added a global form submit guard that disables submit buttons and shows a processing label after submission.
- Existing completion and error notices continue to appear after the server action finishes.

## 2.3.1

- Added previous/current/next navigation for student and guardian weekly calendars.
- Added previous/current/next navigation for student and guardian monthly calendars.
- Calendar views can now be opened directly with `week` and `month` URL parameters.

## 2.3.0

- Added optional start and end dates to tutoring sessions for short-term classes.
- Student and guardian tutoring forms now support date ranges when creating or editing tutoring sessions.
- Today schedules, weekly/monthly calendars, saved schedule runs, and exam-review planning now count tutoring sessions only on dates where they are active.
- Added a Prisma migration and regression coverage for date-bounded tutoring sessions.

## 2.2.2

- Added system-admin Email updates for student, guardian, and class-admin accounts.
- Email changes validate format, block duplicate addresses, normalize casing, and revoke the target account's old sessions.

## 2.2.1

- System-admin bootstrap can explicitly replace an existing account that uses the same Email.
- Replacement requires both an opt-in checkbox and an exact confirmation phrase before deleting the old account and related data.
- Existing-account deletion and system-admin creation run in one database transaction.

## 2.2.0

- Added `/account/security` so signed-in students, guardians, class admins, and system admins can change their own passwords.
- Added one-time `/system-admin/setup` bootstrap flow and a separate `/system-admin/login` entry.
- Added `/system-admin/users` for authorized password resets of student, guardian, and class-admin accounts.
- Password changes and administrative resets now increment `User.authVersion`, immediately invalidating all older sessions.
- Added password-reset audit records with the acting system administrator, target user, and timestamp.
- Added focused tests for bootstrap-secret comparison and resettable-role restrictions.

## 2.1.0

- Added password authentication for student, guardian, and class-admin accounts using Node.js `scrypt` password hashing.
- Replaced forgeable role/user cookies with signed, expiring HMAC session tokens.
- Added a required production `SESSION_SECRET` and secure production cookie settings.
- Vercel deployments now apply committed Prisma migrations before building the application.
- Legacy accounts without a password are blocked from public login until an administrator resets or recreates them.
- Added authentication security tests covering password verification, incorrect passwords, session tampering, expiration, and legacy cookies.
- Replaced the removed Next.js `next lint` command with ESLint 9 flat configuration.

## 2.0.1

- Fixed intermittent guardian and student login failures caused by Supabase Supavisor prepared-statement collisions.
- Prisma runtime connections now automatically enable pooler-compatible parameters for Supabase pooled URLs.
- Login database failures now return to the login page with a retryable error instead of exposing a server error.
- Added guardian-login and pooled-database regression tests.

## 2.0.0

- Added student and guardian score entry with subject, date, source attribution, recent history, and a five-score average.
- Added weak-point tracking with subject, wrong-answer count, reason, and an option to create a scheduled weak-point study task immediately.
- Added a weekly learning summary showing weighted task completion rate, completed tasks, credited study minutes, and recent score average.
- Guardians can manage learning results only for linked students, with server-side relationship authorization on every write and delete action.
- Added focused tests for weekly completion calculations, rescheduled-task handling, empty weeks, and score averages.

## 1.9.2

- Fixed student login navigation by replacing the login Server Action with a standard `POST /api/login` route.
- Login responses now set the session cookie and return an explicit `303` redirect in the same response.
- Added an automated test for the student redirect and session-cookie contract.

## 1.9.1

- Added a dedicated `/login` page with explicit student, guardian, and class-admin role selection.
- Registration pages now only create new accounts and no longer sign in automatically when an Email already exists.
- Added clear login links on the homepage and all three role registration forms.
- New registrations now require an Email so users can return through the login page.
- Restricted the public login flow to the three supported user-facing roles.

## 1.9.0

- Added saved daily schedule versions for students and guardians, including source, revision number, capacity metrics, and schedule snapshots.
- Added revision history for exam review plans when plans are created, manually redistributed, or adjusted after task progress.
- Added CSV/XLSX import preview with duplicate detection against existing teacher-created class events.
- Class calendar imports now revalidate preview data before writing, skip existing events, and keep import history with row and student counts.
- Added the `ScheduleRun`, `ExamReviewPlanRevision`, and `ClassCalendarImport` data models and migration.

## 1.8.0

- Added exam countdown and multi-day review plans for students and guardians.
- Review plans generate traceable `EXAM_SPRINT` tasks before the exam date.
- Task distribution avoids school-event dates and uses remaining capacity after recurring routines and tutoring.
- Completing, partially completing, or skipping a generated task automatically redistributes the remaining review minutes.
- Added plan progress, upcoming sessions, unallocated-minute warnings, manual redistribution, and plan deletion.
- Teacher-created class calendar events are now read-only for students and guardians.
- Added the `ExamReviewPlan` data model and migration.

## 1.7.0

- Added CSV and XLSX bulk import for class-admin exams, deadlines, and school activities.
- Added a downloadable UTF-8 CSV template.
- Added all-or-nothing row validation with clear import issue summaries.
- Uses focused spreadsheet parsers with no known npm audit vulnerabilities.

## 1.6.0

- Added class-admin shared calendar events for class-wide exams, school activities, deadlines, and other dates.
- Class admins can apply one event to every student currently in the managed class.
- Rebuilt the class-admin page with clean Traditional Chinese copy and a student roster panel.
- Class-wide events reuse existing student calendar event rendering in student and guardian weekly/monthly calendars.

## 1.5.0

- Added student-specific calendar events for exams, school activities, deadlines, and other dates.
- Student and guardian pages can add and delete calendar events for the relevant student.
- Weekly and monthly calendars now show event counts and key event labels alongside tasks, tutoring, and routines.
- Added a database migration for `CalendarEvent` records.

## 1.4.1

- Added browser time zone detection and a persistent time zone cookie.
- Student and guardian daily, weekly, and monthly calendar calculations now use the user's time zone with Asia/Taipei as fallback.
- Task date creation, editing, and carryover actions now calculate local dates from the user's time zone.
- Student and guardian pages show the active time zone next to today's date.

## 1.4.0

- Added a monthly calendar summary to student and guardian pages.
- Monthly cards show recurring tutoring and routine counts, daily task counts, and estimated study minutes.
- Student and guardian schedule queries now cover the current week and current month together so cross-month weeks do not lose data.
- Added responsive monthly calendar styling.

## 1.3.0

- Added a weekly calendar summary to student and guardian pages.
- Student and guardian views now load the current Taipei week while keeping today's task and timeline sections scoped to today.
- Weekly cards summarize tutoring sessions, fixed routine events, task counts, completion counts, and estimated study minutes by day.
- Added responsive weekly calendar styling for desktop and mobile.

## 1.2.0

- Added split-task scheduling for large tasks that can fit across multiple free slots.
- Split study segments now show their part number in the generated schedule.
- Tasks are only split when the full task can still fit today; otherwise shorter later tasks can still use remaining slots.
- Updated unplaced-task explanations for the new split scheduling behavior.

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
