/**
 * 訂料追蹤：本機後端代理（選用）
 * - 雲端請改部署 Vercel（api/ 目錄），金鑰設在平台環境變數，見 README
 *
 * 用法：複製 .env.example → .env 後執行 node server.js
 */

const http = require('http');
const { URL } = require('url');
const { handleMouserByDateRange, handleDigikeyOrders } = require('./lib/orderProxyCore');

function loadDotEnv() {
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;
    let raw = fs.readFileSync(envPath, 'utf8');
    if (raw.includes('\u0000')) {
      raw = fs.readFileSync(envPath, 'utf16le');
    }
    raw.split(/\r?\n/).forEach((line) => {
      const l = line.trim();
      if (!l || l.startsWith('#')) return;
      const idx = l.indexOf('=');
      if (idx === -1) return;
      const key = l.slice(0, idx).trim();
      let val = l.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    });
  } catch (_) {
    // ignore
  }
}

loadDotEnv();

const PORT = Number(process.env.PORT || 8787);
const STARTED_AT = new Date().toISOString();

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-DIGIKEY-Client-Id, X-DIGIKEY-Account-Id',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-DIGIKEY-Client-Id, X-DIGIKEY-Account-Id',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Max-Age': '86400',
      });
      return res.end();
    }

    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

    if (reqUrl.pathname === '/health') return sendJson(res, 200, { ok: true });
    if (reqUrl.pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, service: 'order-proxy' });
    }
    if (reqUrl.pathname === '/version') {
      return sendJson(res, 200, {
        ok: true,
        startedAt: STARTED_AT,
        port: PORT,
        mode: 'local-node',
        features: {
          mouserDebugQuery: 'debug=1',
          mouserVersionEnv: 'MOUSER_API_VERSION',
          dotenvUtf16: true,
        },
      });
    }

    if (reqUrl.pathname === '/api/mouser/orderhistory/byDateRange') {
      const out = await handleMouserByDateRange(reqUrl.searchParams);
      return sendJson(res, out.status, out.body);
    }

    if (reqUrl.pathname === '/api/digikey/orders') {
      const out = await handleDigikeyOrders(reqUrl.searchParams);
      return sendJson(res, out.status, out.body);
    }

    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end('Not found');
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error', message: e && e.message ? e.message : String(e) });
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[order-proxy] listening on http://localhost:${PORT}`);
});
