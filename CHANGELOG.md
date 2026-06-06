# Changelog

## 0.5.0

- 開始 Phase 2 帳號與角色開發。
- 新增學生、家長、班級管理者三種 onboarding 頁面。
- 新增 onboarding server actions，資料可寫入 Supabase。
- 首頁新增三角色入口。

## 0.4.0

- 新增雲端資料庫部署準備文件。
- Prisma datasource 新增 `DIRECT_URL`，支援正式環境 migration 與 runtime 連線分離。
- 新增 `db:deploy` 指令，用於雲端資料庫套用已提交 migrations。

## 0.3.0

- 完成 Phase 1 專案基礎。
- 新增本機 PostgreSQL Docker Compose 設定。
- 建立並套用 Prisma 初始 migration。
- 完成阿蓮國中 114 學年教材版本 seed 驗證。
- 補齊本機資料庫開發文件。

## 0.2.0

- 首頁顯示目前版次。
- 建立版次更新規則。
- 開始 Phase 1 專案基礎開發。

## 0.1.0

- 建立 StudyPlan 初始規劃文件。
- 建立最小可部署 Next.js 首頁。
- 建立 Vercel 部署設定。
