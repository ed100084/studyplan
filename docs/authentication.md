# 登入與 session

## 現行設計

- 支援學生、家長、班級管理者以角色、Email、密碼登入。
- 密碼使用 Node.js `scrypt` 加鹽雜湊，資料庫只保存 `passwordHash`。
- `studyplan_session` cookie 使用 HMAC-SHA256 簽章，包含角色、使用者 ID 與到期時間。
- Cookie 為 `HttpOnly`、`SameSite=Lax`，正式環境加上 `Secure`，有效期 30 天。
- Server Components、Server Actions 與 Route Handlers 仍須各自驗證角色及資料擁有權，不能只依賴路由攔截。

## 環境變數

正式環境必須設定至少 32 個字元的隨機值：

```env
SESSION_SECRET="replace-with-a-long-random-secret"
```

更換 `SESSION_SECRET` 會讓所有既有 session 立即失效。

## 資料庫升級

部署 `2.1.0` 前執行：

```bash
npm run db:deploy
```

Migration 會加入 nullable 的 `User.passwordHash`，以避免破壞既有資料。所有新帳號都必須設定 8 到 128 個字元的密碼。

## 舊帳號

`2.1.0` 以前建立的帳號沒有密碼，公開登入會顯示需要管理者協助。系統不提供只靠 Email 的帳號認領，避免任何知道 Email 的人接管帳號。

正式對外前仍需補上：

- 經 Email 驗證的忘記密碼與重設流程
- 登入嘗試的持久化 rate limit
- 管理者操作與密碼重設稽核紀錄
