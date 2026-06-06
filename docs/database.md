# 資料庫

StudyPlan 使用 PostgreSQL 與 Prisma。

## 本機 PostgreSQL

本機開發使用 Docker Compose：

```bash
docker compose up -d db
docker compose ps
```

服務設定：

- container：`studyplan-db`
- database：`studyplan`
- user：`studyplan`
- local port：`55432`

本機 `DATABASE_URL`：

```env
DATABASE_URL="postgresql://studyplan:studyplan@localhost:55432/studyplan?schema=public"
DIRECT_URL="postgresql://studyplan:studyplan@localhost:55432/studyplan?schema=public"
```

## 主要指令

```bash
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:seed
npm run db:studio
```

## Migration

初始 migration 已建立：

```text
prisma/migrations/20260606105828_init/migration.sql
```

建立或更新 migration：

```bash
npm run db:migrate -- --name <migration-name>
```

## Seed

匯入阿蓮國中 114 學年教材版本資料：

```bash
npm run db:seed
```

目前 seed 會匯入：

- 阿蓮國中
- 114 學年
- 七、八、九年級
- 各科目
- 各年級教材版本

來源資料：

- `data/alian-textbook-versions-114.json`

已驗證筆數：

```json
{
  "schools": 1,
  "years": 1,
  "grades": 3,
  "subjects": 10,
  "textbooks": 30
}
```

## 正式環境

正式環境建議使用 Supabase PostgreSQL。

正式環境需要在 Vercel 設定：

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

Supabase 專案與正式 `DATABASE_URL` 尚未建立，留到後續部署資料庫階段處理。

## 版權注意

章節資料表已建立，但第一版不直接放出版社課本內容。

系統只記錄：

- 出版社
- 科目
- 年級
- 章節名稱
- 老師或班級管理者輸入的進度與範圍

若未來要放題目、詳解或教材原文，需要自建題庫或取得授權。
