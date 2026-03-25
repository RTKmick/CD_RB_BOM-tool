#=======================
git add -A
git commit -m "整合，Rev1.2"
git push origin main
#
#
#=======================

# BOM-tool 整合系統

BOM 旗艦備料與 PCB 成本查詢等工具的整合網頁，以單一頁面搭配頂部分頁切換不同功能。

---

## 功能說明

| 分頁 | 說明 |
|------|------|
| **BOM 旗艦備料** | 上傳 BOM 檔（.xlsx / .xls / .csv），智慧雙重備料（SMT 拋料、一般備品），勾選後匯出 Mouser / DigiKey / Element14 格式；並依規則標示「狀態」（含 `Main IC (Consigned)`） |
| **PCB 成本查詢** | 潤鉑 PCB 整合管理：EVB_List 查詢、DUT+PROBE_B 查詢（依廠商或 Part Number） |

所有功能均維持原有邏輯，僅整合至同一頁以分頁切換，互不影響。

---

## BOM：Main IC (Consigned) 判定規則（摘要）
- 廠商為 `InvenSense` 或 `TDK-INVENSENSE`：視為 `Main IC (Consigned)`。
- 廠商為 `TDK`：依料號前綴判定 `Main IC (Consigned)`。
- 若該列的 `Part Reference / Part Ref` 以 `DUT` 開頭：視為 `Main IC (Consigned)`；狀態列顯示 `Main IC (Consigned)`。
  - （此類列在主表區預設不納入備料/不勾選，用於對應主表與替代料區隔邏輯。）

## 使用方式

1. 用瀏覽器開啟 **`index.html`**（若 PCB 成本查詢需連後端，請依環境部署或使用本機伺服器）。
2. 頂部為分頁列：點選 **「BOM 旗艦備料」** 或 **「PCB 成本查詢」** 即可切換功能。
3. 各分頁內操作與原本獨立頁面相同。

---

## 訂料追蹤（Mouser / DigiKey）
此分頁透過 **本機後端代理** 查詢訂單，避免在前端/Repo 暴露 API Key、OAuth Client Secret。

### 參考文件
- [Mouser API Documentation](https://api.mouser.com/api/docs/ui/index?_gl=1*1jlxzn3*_gcl_aw*R0NMLjE3NzQ0NTI1MDQuQ2owS0NRandpNDZpQmhEeUFSSXNBRTNuVnJhcER4UmZBU0xROEJDV3VsMFlDcVloTHVCUl9rdDlPT3VmY2lmeDRHZGlLWGJCbmpQQXdUY2FBdnlPRUFMd193Y0I.*_gcl_au*MTgyMzk2NTc0Ny4xNzcwODE4ODExLjY0NjcyODk4OC4xNzc0NDUyNDE4LjE3NzQ0NTI0MTg.*_ga*OTU2NTA5MDQ3LjE3MzIzNjkzMTg.*_ga_15W4STQT4T*czE3NzQ0NTI0MDQkbzE0NiRnMSR0MTc3NDQ1MzM0NiRqMTIkbDAkaDA.)

### 1) 設定金鑰（只放本機，不提交 GitHub）
1. 複製 `.env.example` 為 `.env`
2. 編輯 `.env`，填入：
   - `MOUSER_API_KEY`
   - `DIGIKEY_CLIENT_ID`
   - `DIGIKEY_CLIENT_SECRET`
   - `DIGIKEY_ACCOUNT_ID`

### 2) 啟動本機代理
在專案根目錄執行：

```bash
node server.js
```

預設會在 `http://localhost:8787` 監聽。

### 3) 使用分頁查詢
1. 開啟 `index.html`
2. 點 **「訂料追蹤」** → 選 **MOUSER** 或 **Digikey**
3. 預設查詢最近 30 天

> 若你需要把代理改成其他位址，可在 `config.js` 設定 `ORDER_PROXY_BASE_URL`。

---

## 日後新增網頁（分頁）方式

若要加入更多不同功能的網頁，只需兩步，無須改動分頁切換的 JavaScript。

### 1. 新增分頁按鈕

在 `<nav class="main-tabs">` 內加入一個按鈕，`data-tab` 為自訂 ID（英文）：

```html
<button type="button" class="tab" data-tab="新功能id">
  <i class="fas fa-圖示名稱"></i> 新功能名稱
</button>
```

### 2. 新增對應內容面板

在頁面中加入一個與 `data-tab` 同名的面板（id 為 `panel-` + 該 ID）：

```html
<div id="panel-新功能id" class="tab-panel">
  <!-- 新功能的 HTML 放這裡 -->
</div>
```

### 3. 樣式注意

新功能若需自訂 CSS，請用該面板的 id 包起來，避免影響其他分頁，例如：

```css
#panel-新功能id .你的類名 { ... }
```

分頁切換邏輯會依 `data-tab` 與 `id="panel-xxx"` 自動對應，無須再寫 JavaScript。

---

## 依賴與檔案

- **config.js**：PCB 成本查詢的後端 API 網址等設定（若僅用 BOM 功能可選用）。
- **xlsx-js-style**（CDN）：BOM 匯出 Excel 用。
- **Font Awesome**（CDN）：分頁與按鈕圖示。

| 檔案 | 說明 |
|------|------|
| `index.html` | 整合入口，含分頁與 BOM、PCB 兩大功能 |
| `PCB_Cost_Query.html` | 原 PCB 成本查詢獨立頁（可單獨開啟或當備援） |
| `config.js` | 後端 API 等設定 |

---

## 專案別名

BOM_Tool / BOM-tool
