// EVB_List
const CONFIG = {
    GAS_URL: "https://script.google.com/macros/s/AKfycbyn_JmQayzBYuM6leOHekuauIiSmXfP_fEvS7Auk-IGFxe2yULtzlf7ch3SysU-OuWbUQ/exec",

    /**
     * 程式改版號（單一來源）：請只改這裡；index.html 會自動更新分頁標題與左上角版本文字。
     */
    APP_RELEASE_LABEL: "潤鉑BOM+PCB_R1.3.7",

    /**
     * 訂料追蹤（Mouser / DigiKey）：後端代理基底網址（勿結尾斜線）
     * - 留空：本機 localhost / file 預設 http://localhost:8787；*.vercel.app 時用同網域
     * - GitHub Pages：必填 Vercel 代理，例 "https://你的專案.vercel.app"
     */
    ORDER_PROXY_BASE_URL: "",

    /** 未設定代理基底網址時，訂料追蹤按鈕顯示的說明（可自行改短句） */
    ORDER_PROXY_SETUP_HINT:
        "訂料追蹤需連到已部署的代理：請在「本檔」將 ORDER_PROXY_BASE_URL 設為 Vercel 網址（https://… 勿結尾 /）。說明見 README。"
};
