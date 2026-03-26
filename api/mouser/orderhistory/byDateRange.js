/**
 * Vercel Serverless：Mouser Order History by date range
 * 路由：GET /api/mouser/orderhistory/byDateRange?startDate=mm/dd/yyyy&endDate=mm/dd/yyyy
 */
const { handleMouserByDateRange } = require('../../../lib/orderProxyCore');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-DIGIKEY-Client-Id, X-DIGIKEY-Account-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
}

module.exports = async function mouserByDateRangeHandler(req, res) {
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
    const out = await handleMouserByDateRange(url.searchParams);
    return res.status(out.status).json(out.body);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: 'server_error',
      message: e && e.message ? e.message : String(e),
    });
  }
};
