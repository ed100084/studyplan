# 版次規則

StudyPlan 以 `package.json` 的 `version` 作為唯一版次來源。

首頁會讀取 `package.json` 並顯示目前版次。

## 更新規則

- `0.x.0`：功能階段或資料模型有明顯變動。
- `0.x.y`：小修正、文字調整、樣式調整或文件更新。
- 正式上線後再進入 `1.0.0`。

## 每次更版必要動作

1. 更新 `package.json` 的 `version`。
2. 更新 `CHANGELOG.md`。
3. 確認首頁顯示新版次。
4. 執行 build 驗證。
5. 提交並推送到 GitHub，讓 Vercel 自動部署。

