/**
 * 訂料追蹤：本機後端代理
 * - 避免在前端暴露 Mouser API Key / DigiKey Client Secret
 * - 提供簡單 HTTP API 給 index.html 呼叫
 *
 * 用法：
 * 1) 複製 .env.example → .env，填入金鑰
 * 2) node server.js
 */

const http = require('http');
const { URL } = require('url');

function loadDotEnv() {
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, 'utf8');
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

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-DIGIKEY-Client-Id, X-DIGIKEY-Account-Id',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  });
  res.end(body);
}

function text(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-DIGIKEY-Client-Id, X-DIGIKEY-Account-Id',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  });
  res.end(body);
}

function requireEnv(res, keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) {
    json(res, 500, {
      ok: false,
      error: 'missing_env',
      missing,
      hint: '請複製 .env.example → .env 並填入缺少的環境變數',
    });
    return false;
  }
  return true;
}

function mmddyyyyToDate(s) {
  // expect mm/dd/yyyy
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || '').trim());
  if (!m) return null;
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!mm || !dd || !yyyy) return null;
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json') || contentType.includes('text/json');
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '');
  return { status: res.status, ok: res.ok, body };
}

async function mouserByDateRange(reqUrl, res) {
  if (!requireEnv(res, ['MOUSER_API_KEY'])) return;

  const startDate = reqUrl.searchParams.get('startDate') || '';
  const endDate = reqUrl.searchParams.get('endDate') || '';
  if (!mmddyyyyToDate(startDate) || !mmddyyyyToDate(endDate)) {
    return json(res, 400, { ok: false, error: 'invalid_date', expected: 'mm/dd/yyyy', startDate, endDate });
  }

  const apiKey = process.env.MOUSER_API_KEY;
  const url =
    'https://api.mouser.com/api/v1/orderhistory/ByDateRange' +
    '?apiKey=' +
    encodeURIComponent(apiKey) +
    '&startDate=' +
    encodeURIComponent(startDate) +
    '&endDate=' +
    encodeURIComponent(endDate);

  const r = await fetchJson(url, { method: 'GET' });
  if (!r.ok) return json(res, r.status, { ok: false, upstream: 'mouser', status: r.status, body: r.body });
  return json(res, 200, r.body);
}

async function digikeyGetAccessToken() {
  const url = 'https://api.digikey.com/v1/oauth2/token';
  const form = new URLSearchParams();
  form.set('client_id', process.env.DIGIKEY_CLIENT_ID);
  form.set('client_secret', process.env.DIGIKEY_CLIENT_SECRET);
  form.set('grant_type', 'client_credentials');

  const r = await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!r.ok) {
    const err = new Error('digikey_token_failed');
    err.status = r.status;
    err.body = r.body;
    throw err;
  }
  if (!r.body || !r.body.access_token) {
    const err = new Error('digikey_token_missing');
    err.status = 502;
    err.body = r.body;
    throw err;
  }
  return r.body.access_token;
}

async function digikeyOrders(reqUrl, res) {
  if (!requireEnv(res, ['DIGIKEY_CLIENT_ID', 'DIGIKEY_CLIENT_SECRET', 'DIGIKEY_ACCOUNT_ID'])) return;

  const shared = reqUrl.searchParams.get('Shared') || 'false';
  const startDate = reqUrl.searchParams.get('StartDate') || '';
  const endDate = reqUrl.searchParams.get('EndDate') || '';
  const pageNumber = reqUrl.searchParams.get('PageNumber') || '1';
  const pageSize = reqUrl.searchParams.get('PageSize') || '50';

  // DigiKey expects ISO date-time; we just validate it's parseable.
  if (Number.isNaN(new Date(startDate).getTime()) || Number.isNaN(new Date(endDate).getTime())) {
    return json(res, 400, {
      ok: false,
      error: 'invalid_date',
      expected: 'ISO date-time',
      StartDate: startDate,
      EndDate: endDate,
    });
  }

  let token;
  try {
    token = await digikeyGetAccessToken();
  } catch (e) {
    return json(res, e.status || 502, { ok: false, upstream: 'digikey', step: 'token', status: e.status, body: e.body });
  }

  const url =
    'https://api.digikey.com/orderstatus/v4/orders' +
    '?Shared=' +
    encodeURIComponent(shared) +
    '&StartDate=' +
    encodeURIComponent(startDate) +
    '&EndDate=' +
    encodeURIComponent(endDate) +
    '&PageNumber=' +
    encodeURIComponent(pageNumber) +
    '&PageSize=' +
    encodeURIComponent(pageSize);

  const r = await fetchJson(url, {
    method: 'GET',
    headers: {
      'X-DIGIKEY-Client-Id': process.env.DIGIKEY_CLIENT_ID,
      'X-DIGIKEY-Account-Id': process.env.DIGIKEY_ACCOUNT_ID,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!r.ok) return json(res, r.status, { ok: false, upstream: 'digikey', step: 'orders', status: r.status, body: r.body });
  return json(res, 200, r.body);
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

    if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });

    if (reqUrl.pathname === '/health') return json(res, 200, { ok: true });

    if (reqUrl.pathname === '/api/mouser/orderhistory/byDateRange') {
      return await mouserByDateRange(reqUrl, res);
    }

    if (reqUrl.pathname === '/api/digikey/orders') {
      return await digikeyOrders(reqUrl, res);
    }

    return text(res, 404, 'Not found');
  } catch (e) {
    return json(res, 500, { ok: false, error: 'server_error', message: e && e.message ? e.message : String(e) });
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[order-proxy] listening on http://localhost:${PORT}`);
});

