# 資料庫

StudyPlan 使用 PostgreSQL 與 Prisma。

## 主要指令

```bash
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed
```

## 環境變數

請依照 `.env.example` 建立本機 `.env`：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/studyplan?schema=public"
```

## 初始資料

`prisma/seed.js` 會匯入：

- 阿蓮國中
- 114 學年
- 七、八、九年級
- 各科目
- 各年級教材版本

來源資料放在：

- `data/alian-textbook-versions-114.json`

## 注意

章節資料表已建立，但第一版不直接放出版社課本內容。後續只記錄章節名稱、範圍與學生/老師輸入的進度，避免教材版權問題。

