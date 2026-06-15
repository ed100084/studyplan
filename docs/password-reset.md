# 密碼重設管理

## 權限原則

- 學生、家長、班級管理者與系統管理者可在 `/account/security` 修改自己的密碼。
- 班級管理者不能重設家長或學生密碼，避免班級權限被用來接管個人帳號。
- 只有 `SYSTEM_ADMIN` 能在 `/system-admin/users` 重設學生、家長與班級管理者密碼。
- 系統管理者不能透過重設介面修改其他系統管理者密碼；系統管理者需自行在帳號安全頁變更。

## 建立第一位系統管理者

1. 在 Vercel Production 設定至少 32 個字元的 `SYSTEM_ADMIN_BOOTSTRAP_SECRET`。
2. 開啟 `/system-admin/setup`。
3. 輸入管理者姓名、Email、密碼與 bootstrap secret。
4. 建立成功後，從 Vercel 移除 `SYSTEM_ADMIN_BOOTSTRAP_SECRET`。

系統已有 `SYSTEM_ADMIN` 後，setup 頁會直接導向系統管理者登入頁，不能建立第二個帳號。

## 重設家長或班級管理者密碼

1. 從 `/system-admin/login` 登入。
2. 在 `/system-admin/users` 依姓名或 Email 搜尋使用者。
3. 輸入兩次新密碼並提交。
4. 將暫時密碼透過可信任管道交給本人。
5. 使用者登入後，到 `/account/security` 改成自己的密碼。

每次重設都會：

- 更新加鹽 `scrypt` 密碼雜湊
- 遞增 `authVersion` 並撤銷舊 session
- 記錄執行管理者、目標帳號與時間
