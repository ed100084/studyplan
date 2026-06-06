# 部署規劃

## 建議平台

- 網站與 API：Vercel
- 資料庫、登入與圖片：Supabase
- GitHub repository：`ed100084/studyplan`

## Vercel 專案設定

建議在 Vercel Dashboard 匯入 GitHub repository：

1. 開啟 Vercel Dashboard。
2. 選擇 Add New Project。
3. 匯入 `ed100084/studyplan`。
4. Framework Preset 選擇 Next.js。
5. Build Command 使用預設 `next build`。
6. Install Command 使用預設 `npm install`。
7. Output Directory 保持預設。
8. Deploy。

完成後，Vercel 會自動啟用 GitHub 整合：

- push 到 `main` 會觸發 Production Deployment。
- pull request 會觸發 Preview Deployment。

## Region

`vercel.json` 目前設定：

```json
{
  "regions": ["sin1"]
}
```

理由：

- 目標使用者在台灣。
- 後續 Supabase database 建議選 Singapore 或 Tokyo。
- 若資料庫選 Singapore，Vercel Functions 放在 `sin1` 可以降低 API 到資料庫的延遲。

若未來資料庫改選 Tokyo，可再評估改為 `hnd1`。

## 本機 CLI 部署

若要用 Vercel CLI 操作：

```bash
npx vercel login
npx vercel link
npx vercel git connect
npx vercel --prod
```

目前本機偵測到既有 Vercel token 無效，需要重新登入後才能用 CLI 建立或連接專案。

