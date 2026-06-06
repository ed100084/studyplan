# Phase 1 開發紀錄

## 狀態

Phase 1 已完成。

目前版次：`0.3.0`

## 已完成

- Next.js + TypeScript 專案骨架
- Vercel GitHub 自動部署
- 首頁顯示目前版次
- Tailwind CSS v4 PostCSS 設定
- Prisma + PostgreSQL schema
- Prisma Client helper
- 本機 PostgreSQL Docker Compose 設定
- Prisma 初始 migration
- 阿蓮國中 114 學年教材版本 seed script
- `.env.example`
- Phase 1 文件與資料庫文件

## 本機資料庫

本機 PostgreSQL 使用 Docker Compose：

```bash
docker compose up -d db
```

連線字串：

```env
DATABASE_URL="postgresql://studyplan:studyplan@localhost:55432/studyplan?schema=public"
```

## Migration

初始 migration：

```text
prisma/migrations/20260606105828_init/migration.sql
```

執行指令：

```bash
npm run db:migrate -- --name init
```

## Seed 驗證

已匯入：

- 學校：1
- 學年：1
- 年級：3
- 科目：10
- 教材版本：30

資料來源：

- `data/alian-textbook-versions-114.json`

## 已驗證

```bash
node --check prisma/seed.js
npm audit
npm run db:validate
npm run db:generate
npm run db:seed
npm run build
```

## Prisma 版本

目前固定使用：

- `prisma@6.19.3`
- `@prisma/client@6.19.3`

理由：

- Prisma 7 已改用新的 datasource/config 模式。
- Phase 1 先用 Prisma 6 的傳統 `DATABASE_URL` 模式，降低早期開發成本。
- 後續若要升級 Prisma 7，另開升級任務處理。

## 尚未納入 Phase 1

以下項目移到後續階段：

- Supabase 正式專案建立與雲端 `DATABASE_URL`
- Vercel production database environment variables
- 登入流程
- 學生、家長、班級管理者頁面
- 實際排程引擎

