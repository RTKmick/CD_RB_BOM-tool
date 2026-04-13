// EVB_List
const CONFIG = {
    GAS_URL: "https://script.google.com/macros/s/AKfycbyn_JmQayzBYuM6leOHekuauIiSmXfP_fEvS7Auk-IGFxe2yULtzlf7ch3SysU-OuWbUQ/exec",

    /**
     * 程式改版號：執行時以此為準（分頁標題、左上角版號）。
     * 若 config.js 未載入，會 fallback 到 index.html 內 <!-- RELEASE: ... --> 與 .app-version 內文，改版請三處一併更新以免誤會。
     */
    APP_RELEASE_LABEL: "潤鉑BOM+PCB_R1.5.5",

    /**
     * 訂料追蹤（Mouser / DigiKey）：即時模式須可連線的後端代理（勿結尾斜線）
     * - 留空：localhost / 127.0.0.1 → http://localhost:8787；*.vercel.app → 目前網域
     * - GitHub Pages → 自動依倉庫名推測 https://倉庫-slug.vercel.app；若該網址在 Vercel 從未部署會「無法連線」——請至 Vercel 匯入本 repo 並 Deploy，然後把新分頁可開 /api/health 的 https 網址填在下方（專案名與倉庫不同時必填）
     * 例：ORDER_PROXY_BASE_URL: "https://你的專案.vercel.app",
     */
    ORDER_PROXY_BASE_URL: "",

    /**
     * 專案 ↔ 訂單 對照表雲端同步（Google Apps Script Web App）
     * - 填入你部署後的 Web App URL（/exec）
     * - 留空則只用 localStorage（同一台電腦/同一瀏覽器）
     */
    ORDER_PROJECT_MAP_GAS_URL: "https://script.google.com/macros/s/AKfycbzFfyo89NcbOd8KQy3F_hSz6Tsx3CQhWkKCqHGnJA3tuBL0Ix2qWQmCMDj2hZgM7Zcy/exec",

    /**
     * 訂單資料來源：true=只讀 data/order-cache/*.json；false=即時打 Vercel/本機代理。
     * 省略時：*.github.io 預設 true，其餘預設 false。例：// ORDER_USE_STATIC_CACHE: false,
     */

    /** 無法取得代理網址時（極少見）顯示；一般 GitHub Pages 已自動推測，無須改 */
    ORDER_PROXY_SETUP_HINT:
        "訂料追蹤要連到後端（Vercel）。請確認已用同一個 GitHub repo 部署 Vercel，或到本檔手動填 ORDER_PROXY_BASE_URL（勿結尾 /）。詳見 README。"
};
