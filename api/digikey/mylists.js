/**
 * Vercel Serverless：DigiKey MyLists（清單名稱）
 * 路由：GET /api/digikey/mylists?limit=50&maxPages=20
 */
const { handleDigikeyMyLists } = require('../../lib/orderProxyCore');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-DIGIKEY-Client-Id, X-DIGIKEY-Account-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
}

module.exports = async function digikeyMylistsHandler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  try {
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url, `http://${host}`);
    const out = await handleDigikeyMyLists(url.searchParams);
    return res.status(out.status).json(out.body);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: 'server_error',
      message: e && e.message ? e.message : String(e),
    });
  }
};
