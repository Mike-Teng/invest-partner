# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


## How to run

```bash
npm install
npm run dev
```

本機預覽使用 `http://localhost:5173/`，目前 Firebase 登入不接受
`http://127.0.0.1:5173/`。本機使用正式 Firebase 資料；新增、刪除、修正淨值、
更新市價及記錄快照都會寫入正式資料，請勿以這些操作建立測試資料。

## 資金與收益定義

- 累計入金：所有正數資金紀錄的合計，包含再次投入。
- 累計提領：所有負數資金紀錄的絕對值合計，包含領回的本金與收益。
- 淨投入：累計入金 − 累計提領，可能為負數，不代表尚未收回的成本。
- 目前資產：合夥人持有單位 × 目前單位淨值；總資產仍為現金加持倉市值。
- 累計收益：目前資產 + 累計提領 − 累計入金，保留已提領的收益。
- 累計投入收益率：累計收益 ÷ 累計入金。這是非年化、未加權投入時間的比例，
  並非基金淨值漲幅；沒有入金時顯示「不適用」。

例如投入 1,000 元，資產上漲到 1,200 元，不論提領 0、600 或全部 1,200 元，
累計收益均為 200 元，累計投入收益率均為 20%。

提領紀錄中已保存的負單位數有效，重算時必須保留，不能因小於零而用金額重新推算。
全數提領延續整元付款及小於 1 元的差額容許值，扣除該合夥人的全部單位。
僅消除機器浮點運算誤差，不以顯示位數把真實的小額單位歸零。
舊紀錄缺少單位數時才依成交淨值推算；缺少兩者時沿用先前快照／初始淨值推估。
全部單位結清後若仍有至少 0.005 元未分配資產，會提示核對並阻止新增資金紀錄，
避免差額轉嫁給下一位入金者。歷史快照及原始 Firebase 紀錄不會被自動改寫。

## 驗證與部署

```bash
npm test
npm run lint
npm run build
```

`tests/accounting.test.js` 使用離線範例驗證資金會計，不連線 Firebase。
涵蓋部分／全數提領、正負四捨五入尾差、再次入金、舊紀錄補算、多人權益守恆，
以及提領前後收益和收益率一致性。

確認修改與測試結果後，沿用 Git commit / push 到 GitHub，由 Vercel 自動部署。
推送前應包含新的 `src/lib/accounting.js` 與測試檔案；不需修改 Firebase 資料格式。

## 每日自動快照

每日快照實際由 Google Apps Script 專案 `updateStockPrices` 的
`recordDailySnapshot` 時間觸發器產生。網站的「記錄今日快照」是另一個手動入口。
`updateStockPrices` 會從試算表 `Stocks` 更新 Firebase 市價。

舊排程直接依 Firestore 回傳順序計算交易。若賣出先於買入被讀取，
已賣出的股票可能仍計入市值。修正版依交易日期、同日建立時間排序，
並使用網站相同的單位會計分配權益，保留全數提領後的零單位。
新快照會保存 `calculationVersion` 及 `valuationDetails`（JSON 字串），
包含當時股價、匯率、現金、持倉及資金資訊，供後續精確核對。

```bash
npm run build:snapshot
```

上述指令將 `src/lib/accounting.js` 與 `apps-script/snapshot.gs` 組成
`dist/apps-script/snapshot.gs`。在 Apps Script 保留既有 `FIREBASE_CONFIG`
和 `updateStockPrices`，以產出內容取代舊的快照函式及 `parseFields`，
避免保留重複函式。產出檔不包含憑證；服務帳戶私鑰不可提交至 GitHub。

先執行 `previewDailySnapshot`，它只讀取正式資料並輸出試算，不寫入快照。
確認後，既有每日觸發器會繼續呼叫同名的 `recordDailySnapshot`。
網站仍沿用 GitHub → Vercel；此 Apps Script 目前需要另外同步，Git push 不會更新它。

歷史更正必須使用原快照當時的股價與匯率重算，並在寫入前備份與核對原值。
不能把某一天的差額當成所有歷史日期的固定扣除額。
本機 `*.local` 核對資料與工具排除在 Git 之外，不隨網站部署。
