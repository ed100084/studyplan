# StudyPlan

## Current Status

Version: 2.6.3

- Monthly calendar cells now show short, time-sorted item labels so each day is easier to scan.
- Calendar date selection now updates the visible day detail immediately on the current page for already loaded week/month dates.
- The selected-day chart timeline now includes morning fixed events and tutoring sessions instead of starting at after-school hours.
- Student and guardian dashboards are split into Today, Calendar, Learning, and Settings tabs.
- Weekly and monthly calendars use compact grids, and selecting a date opens that day's detail panel.
- Empty states now include direct CTAs that jump to the right creation form.
- Server-rendered dates default to Asia/Taipei, so today's tasks do not shift to UTC.

## 目前進度

目前版本：2.6.3

- 學生與家長頁已支援點選週曆或月曆任一天，直接查看該日詳細行程。
- 當日詳細行程會用垂直圖表式時間軸呈現固定行程、補習、讀書任務、考試與事件。
- 成績紀錄已改為依科目彙整，可展開查看每次成績，避免畫面拉成很長一排。
- 首頁主要操作順序已調整為「當日/選取日詳細行程 → 週曆 → 月曆 → 進度與管理 → 輸入表單」。
- 補習排程支援日期區間，並可從排程清單修改或刪除整個排程。
- 固定作息支援日期區間，可處理學期期間、放假或第八節造成的臨時放學時間差異。
- 新增補習或固定作息時，星期可複選，一次建立多個星期的同時段安排。

阿蓮國中學生讀書規劃網站。

這個系統目標是讓學生每天打開後，立刻知道今天要讀什麼；如果進度落後，系統會依照作息、補習、作業與考試範圍自動重排。

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
- 學生每日任務與完成回報
- 作業、補習、自習分開排程
- 未完成任務自動重排
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
