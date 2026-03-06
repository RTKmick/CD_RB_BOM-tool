# BOM-tool 整合系統

BOM 旗艦備料與 PCB 成本查詢等工具的整合網頁，以單一頁面搭配頂部分頁切換不同功能。

---

## 功能說明

| 分頁 | 說明 |
|------|------|
| **BOM 旗艦備料** | 上傳 BOM 檔（.xlsx / .xls / .csv），智慧雙重備料（SMT 拋料、一般備品），勾選後匯出 Mouser / DigiKey / Element14 格式 |
| **PCB 成本查詢** | 潤鉑 PCB 整合管理：EVB_List 查詢、DUT+PROBE_B 查詢（依廠商或 Part Number） |

所有功能均維持原有邏輯，僅整合至同一頁以分頁切換，互不影響。

---

## 使用方式

1. 用瀏覽器開啟 **`index.html`**（若 PCB 成本查詢需連後端，請依環境部署或使用本機伺服器）。
2. 頂部為分頁列：點選 **「BOM 旗艦備料」** 或 **「PCB 成本查詢」** 即可切換功能。
3. 各分頁內操作與原本獨立頁面相同。

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
