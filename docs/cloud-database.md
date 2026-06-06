# 雲端資料庫

## 建議選項

第一版建議使用 Supabase PostgreSQL。

原因：

- 內建 PostgreSQL
- 後續可接 Supabase Auth
- 後續可用 Supabase Storage 存錯題照片
- 有 Singapore / Tokyo 等亞太區域可選

## Region

目標使用者在台灣，建議 Supabase project 選：

1. Singapore
2. Tokyo

目前 Vercel `vercel.json` 設定 region：

```json
{
  "regions": ["sin1"]
}
```

若 Supabase 選 Singapore，先維持 `sin1`。

## 需要的環境變數

Prisma 使用兩種資料庫連線：

```env
DATABASE_URL="..."
DIRECT_URL="..."
```

用途：

- `DATABASE_URL`：正式網站 runtime 使用。建議使用 Supabase transaction pooler。
- `DIRECT_URL`：Prisma migration 使用。建議使用 direct connection；如果本機或部署環境沒有 IPv6，可用 Supabase session pooler。

Supabase 官方連線建議：

- Direct connection 適合 migrations、pg_dump、管理工具。
- Transaction pooler 適合 serverless / edge runtime。
- Session pooler 可作為 IPv4-only 網路連 direct connection 的替代方案。

參考：

- https://supabase.com/docs/guides/database/connecting-to-postgres

## Vercel 環境變數

設定 production：

```bash
npm exec --yes -- vercel env add DATABASE_URL production
npm exec --yes -- vercel env add DIRECT_URL production
```

也建議設定 preview：

```bash
npm exec --yes -- vercel env add DATABASE_URL preview
npm exec --yes -- vercel env add DIRECT_URL preview
```

設定完成後重新部署：

```bash
npm exec --yes -- vercel --prod
```

## 套用雲端 migration

先在本機 shell 設定雲端連線字串：

```powershell
$env:DATABASE_URL="postgresql://..."
$env:DIRECT_URL="postgresql://..."
npm run db:deploy
npm run db:seed
```

`db:deploy` 會套用已提交的 Prisma migrations，不會建立新的 migration。

## Phase 1 雲端準備狀態

已完成：

- Prisma schema 支援 `DATABASE_URL`
- Prisma schema 支援 `DIRECT_URL`
- 已有 production migration 指令 `npm run db:deploy`
- 已有 seed script `npm run db:seed`
- 已有 Vercel 專案與 GitHub 自動部署

待輸入：

- Supabase `DATABASE_URL`
- Supabase `DIRECT_URL`
- 是否要將相同 DB 用於 preview，或建立獨立 preview DB

