# Phase 2 開發紀錄

## 目標

建立三種角色的第一版入口：

- 學生
- 家長
- 班級管理者

最初使用無密碼 onboarding 驗證角色流程；`2.1.0` 起已加入密碼登入與簽章 session。

## 目前版次

`2.1.0`

## 已建立頁面

- `/student`
- `/guardian`
- `/class-admin`

## 已建立 server actions

檔案：

- `app/onboarding/actions.ts`

功能：

- 建立班級管理者與班級
- 建立學生資料
- 學生可用班級代碼加入班級
- 建立家長資料
- 家長可用學生 Email 綁定學生

## Session

目前已建立簽章 cookie session：

- cookie：`studyplan_session`
- 內容：版本、角色、使用者 ID、到期時間與 HMAC-SHA256 簽章
- 有效期：30 天

用途：

- 建立角色資料後，頁面可顯示目前使用者。
- 學生、家長、班級管理者頁面可提供登出。

密碼使用 Node.js `scrypt` 加鹽雜湊；正式環境必須設定 `SESSION_SECRET`。詳細內容見 [authentication.md](authentication.md)。

## 表單錯誤處理

已處理：

- 重複 Email 不再造成 500。
- 同角色重複 Email 會切換到既有資料。
- 不同角色 Email 衝突會顯示錯誤。
- 班級代碼重複會顯示錯誤。

## 暫定限制

- 尚未建立 Email 驗證與忘記密碼流程。
- 尚未建立持久化登入 rate limit。
- 升級前建立的無密碼帳號需要管理者重設或重建。

## 下一步

- 建立班級考試範圍、老師進度與班級弱點統計。
- 建立 Email 驗證的密碼重設流程。
- 補登入與主要角色流程的端到端測試。
