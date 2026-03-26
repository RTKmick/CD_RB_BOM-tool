## Mouser API Guide（由 `api-guide.pdf` 整理）

此文件內容整理自 `api-guide.pdf`（已閱讀完整 38 頁），方便在專案內快速查閱重點。

### API 使用流程（摘要）
- **建立 My Mouser 帳號**（若已有可略過）。
- **產生 API Key**：在 My Mouser 帳號的 APIs 頁面建立。
- **使用 API Explorer** 測試端點（需啟用 JavaScript；不是 sandbox，會對真實帳號生效）。
- 依端點需求建立 **GET/POST** 請求（POST 通常需要 request body）。

### API Explorer 操作要點
- 端點依 Tag 分類（例如 Cart、Order、OrderHistory）。
- 參數分三種：
  - **Query parameters**：在 URL `?a=b&c=d`
  - **Path parameters**：例如 `/api/v{version}/...` 的 `version`
  - **Request body**：POST 的 JSON/XML
- 參考值型別：String / UUID / Number / Integer / Boolean / Enum / Null

### 版本與 HTTPS
- 僅支援 **HTTPS**
- API Explorer 文件中提到版本目前常用 `1.0`（依端點 `/api/v{version}/...`）

### Cart API（文件列出 8 個端點）
常見重點：
- 建立/取得 Cart、插入/更新/移除 Cart items、排程出貨等。
- 若 CartKey 空白，插入 items 時會自動產生新的 CartKey。
- 每次 request 限制與 cart item 數量限制（文件提到單次最多 100 items、cart 總量上限等）。

### Order History API（訂料追蹤，詳見 `api-guide.pdf` 與 [API Explorer](https://api.mouser.com/api/docs/ui/index) Tag：OrderHistory）
- **`GET /orderhistory/ByDateRange`**：依日期區間列出訂單；回傳常為**摘要**（欄位較少屬正常）。
- **`GET /orderhistory/webOrderNumber`**：Query：`webOrderNumber` + `apiKey` → 依 **Web Order Number** 取**單筆明細**（品項等多在此）。
- **`GET /orderhistory/salesOrderNumber`**：Query：`salesOrderNumber` + `apiKey` → 依 **Sales Order Number** 取單筆明細（與上列二擇一或互補，依帳號／訂單型態而定）。
- Mouser 常見慣例：HTTP **200** 時仍可能在 body 內含 **`Errors`** 陣列，需一併檢查（見 PDF「Fault Tolerance」）。
- 本專案：`enrichDetails=1` 時會先 **webOrderNumber**，若仍無品項再 **salesOrderNumber**，合併進 `OrderHistoryItems` 各筆。

### Order API（文件列出 5 個端點）
常見重點：
- `/order/options/query`：取得可用 shipping/payment 等資訊（request body 可選）。
- `/order/currencies`、`/order/countries`：取得幣別與國家/州資訊。
- `/order`：提交訂單（`SubmitOrder=true` 才會真的下單）。
- `/order/{orderNumber}`：依訂單號取得明細。

### 錯誤與容錯（Fault Tolerance）
- 文件提到：**請求錯誤**可能仍回 `200`，錯誤會放在 response body（Errors）。
- 列出常見 Errors Code（摘要）：
  - `InternalError`、`EmptyCart`、`Invalid`、`Required`、`MinLength`、`MaxLength`、`InvalidFormat`、`InvalidCharacters`、`NotAvailable`、`NotAllowed`、`NotFound`…等

### 常見 FAQ（摘要）
- Unauthorized / Authorization denied：確認 API Key、移除空白字元、帳號可能因違規被停用等。
- 無法下單：cart 空、cart item errored、SubmitOrder 未設 true 等。

### 參考連結
- Mouser API Explorer / Docs：[Mouser API Documentation](https://api.mouser.com/api/docs/ui/index)

