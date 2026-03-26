/**
 * 訂料代理連線檢查：GET /api/health → { ok: true }
 * 瀏覽器請用 https 頁面測 https 代理；勿用 GitHub Pages 連 http://localhost（會被阻擋）。
 */
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-DIGIKEY-Client-Id, X-DIGIKEY-Account-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
}

module.exports = async function healthHandler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  return res.status(200).json({ ok: true, service: 'order-proxy' });
};
