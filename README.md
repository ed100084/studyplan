# StudyPlan

## Current Status

Version: 2.8.0

- Signed-in dashboards now use a compact header so useful daily information appears higher on the page.
- Study tasks now use a priority/backlog list model instead of minute-level scheduling.
- CSV imports can define daily study tasks without start/end times; imported task dates drive the calendar.
- Calendar export now includes a Google Calendar `.ics` download for the selected month.
- The Today view shows a priority list with complete/partial-complete actions instead of a generated study timetable.
- Weekly and monthly calendar cells show the tasks assigned to each date, and clicking a date shows the same date-scoped task list.
- Selected-day details keep fixed routines and tutoring as timeline context, but study tasks are shown as a list, not as fixed time blocks.
- New CSV imports replace old unfinished imported tasks while keeping manual tasks and completed history.
- Student and guardian dashboards are split into Today, Calendar, Learning, and Settings tabs.
- Empty states now include direct CTAs that jump to the right creation form.
- Server-rendered dates default to Asia/Taipei, so today's tasks do not shift to UTC.

## 目前進度

目前版本：2.8.0

- 讀書任務已改為「CSV 指定日期 + 優先序清單」模型，不再綁定當天完成時間。
- 今日頁顯示今日優先清單，可直接標記完成或部分完成，不再產生分鐘級讀書時間表。
- 週曆與月曆依照 CSV 的任務日期顯示每日任務；點選某一天時，詳情會顯示同一天的科目、範圍/標題、類型、分鐘、優先度與備註。
- 匯出資料新增 Google 行事曆 `.ics`，可把選取月份的讀書任務、補習、考試與事件匯入 Google Calendar。
- 選取日期詳情仍會顯示固定作息、補習與事件作為時間背景，但讀書任務只以清單呈現，不做時間衝突判定。
- CSV 匯入支援 `subject,title,type,minutes,priority,weekHint,note`；新匯入會取代舊的未完成匯入任務，手動任務與已完成紀錄保留。
- 成績紀錄已改為依科目彙整，可展開查看每次成績，避免畫面拉成很長一排。
- 補習排程支援日期區間，並可從排程清單修改或刪除整個排程。
- 固定作息支援日期區間，可處理學期期間、放假或第八節造成的臨時放學時間差異。
- 新增補習或固定作息時，星期可複選，一次建立多個星期的同時段安排。

阿蓮國中學生讀書規劃網站。

這個系統目標是讓學生每天打開後，立刻知道今天要讀什麼；讀書任務由 CSV 或手動輸入形成每日清單，固定作息與補習只作為可讀時間與行程背景。

## 第一版範圍

- 學校：高雄市立阿蓮國中
- 學年：114 學年
- 年級：國一、國二、國三
- 使用情境：段考規劃、國三會考長期規劃
- 主要角色：學生、家長、老師或班級管理者

## 核心功能

- 阿蓮國中教材版本預設
- 班級共用段考日期與考試範圍
- 家長協助輸入補習與作息
- 補習可設定開始與結束日期，支援暑期班、考前短期班等期間限定安排
- 補習與固定作息建立時可複選星期
- 學生每日任務清單與完成回報
- CSV 匯入每日讀書任務與 backlog 欄位
- 固定作息、補習與讀書任務分開呈現
- 未完成任務保留在清單模型中，可依優先度與落後週次上浮
- 基本進度、成績與弱點追蹤
- 密碼登入與簽章 session
- 帳號自行變更密碼與系統管理者重設流程
- 系統管理者可替學生、家長與班級管理者更換登入 Email
- 系統管理者初始化可在明確確認後，清除占用相同 Email 的既有帳號並重建

## 文件

- [產品需求](docs/requirements.md)
- [技術規劃](docs/technical-plan.md)
- [MVP 任務清單](docs/mvp-tasks.md)
- [Phase 5 排程引擎規格](docs/scheduler-spec.md)
- [Phase 1 開發紀錄](docs/phase-1.md)
- [Phase 2 開發紀錄](docs/phase-2.md)
- [部署規劃](docs/deployment.md)
- [版次規則](docs/versioning.md)
- [資料庫](docs/database.md)
- [雲端資料庫](docs/cloud-database.md)
- [登入與 session](docs/authentication.md)
- [密碼重設管理](docs/password-reset.md)
- [阿蓮國中 114 學年教材版本公告附件](docs/assets/alian-textbook-versions-114.png)
