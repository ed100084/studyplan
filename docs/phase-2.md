# Phase 2 開發紀錄

## 目標

建立三種角色的第一版入口：

- 學生
- 家長
- 班級管理者

這階段先不做正式登入，先使用無密碼 onboarding 流程，讓資料能寫入 Supabase 並驗證角色流程。

## 目前版次

`0.6.1`

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

目前已建立簡易 cookie session：

- cookie：`studyplan_session`
- 內容：`role:userId`
- 有效期：30 天

用途：

- 建立角色資料後，頁面可顯示目前使用者。
- 學生、家長、班級管理者頁面可提供登出。

注意：

- 這不是正式登入機制。
- cookie 只用於 MVP onboarding 流程。
- 後續接 Supabase Auth 時，會替換這個簡易 session。

## 表單錯誤處理

已處理：

- 重複 Email 不再造成 500。
- 同角色重複 Email 會切換到既有資料。
- 不同角色 Email 衝突會顯示錯誤。
- 班級代碼重複會顯示錯誤。

## 暫定限制

- 尚未建立正式登入與密碼驗證。
- 尚未建立 session / cookie。
- Email 目前只作為識別與家長綁定用途。
- 班級代碼若重複，下一版會補錯誤處理。

## 下一步

- 建立角色 dashboard。
- 新增班級列表與學生加入狀態。
- 補表單錯誤訊息，不讓 Prisma error 直接進 error page。
