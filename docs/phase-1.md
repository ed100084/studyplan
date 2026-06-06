# Phase 1 開發紀錄

## 目前狀態

已完成：

- Next.js + TypeScript 專案骨架
- Tailwind CSS v4 PostCSS 設定
- 首頁顯示目前版次
- Prisma + PostgreSQL schema
- Prisma Client helper
- 阿蓮國中 114 學年教材版本 seed script
- `.env.example`
- build 與 dependency audit 驗證

## 版次

目前版次：`0.2.0`

版次來源：`package.json`

首頁會讀取 `package.json` 並顯示版次。

## Prisma 版本

目前固定使用：

- `prisma@6.19.3`
- `@prisma/client@6.19.3`

理由：

- Prisma 7 已改用新的 datasource/config 模式。
- 第一階段先用 Prisma 6 的傳統 `DATABASE_URL` 模式，降低早期開發成本。
- 後續若要升級 Prisma 7，再另開升級任務處理。

## 已驗證

```bash
node --check prisma/seed.js
npm audit
npm run db:validate
npm run db:generate
npm run build
```

## 尚未完成

- 建立實際 PostgreSQL / Supabase database
- 執行 migration
- 執行 seed
- 建立登入流程
- 建立學生、家長、班級管理者頁面

