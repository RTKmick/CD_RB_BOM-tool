/**
 * 訂料追蹤代理：共用邏輯（供本機 server.js 與 Vercel Serverless 使用）
 */

function requireEnvKeys(keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) {
    return {
      ok: false,
      error: 'missing_env',
      missing,
      hint: '請在部署平台設定環境變數，或本機複製 .env.example → .env',
    };
  }
  return null;
}

function mmddyyyyToDate(s) {
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

async function fetchWithDebug(url, options) {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json') || contentType.includes('text/json');
  const rawBody = await res.text().catch(() => '');
  let body = rawBody;
  if (isJson) {
    try {
      body = JSON.parse(rawBody);
    } catch (_) {
      body = rawBody;
    }
  }

  const headers = {};
  const keep = [
    'content-type',
    'server',
    'date',
    'via',
    'x-cache',
    'x-akamai-request-id',
    'x-akamai-session-info',
    'x-akamai-transformed',
    'x-cdn',
    'cf-ray',
    'set-cookie',
  ];
  res.headers.forEach((v, k) => {
    const lk = String(k).toLowerCase();
    if (keep.includes(lk) || lk.startsWith('x-') || lk.startsWith('cf-')) headers[lk] = v;
  });

  return {
    status: res.status,
    ok: res.ok,
    body,
    debug: {
      contentType,
      headers,
      bodyPreview: typeof rawBody === 'string' ? rawBody.slice(0, 800) : '',
    },
  };
}

/**
 * @param {URLSearchParams} searchParams
 * @returns {Promise<{ status: number, body: object }>}
 */
async function handleMouserByDateRange(searchParams) {
  const miss = requireEnvKeys(['MOUSER_API_KEY']);
  if (miss) return { status: 500, body: miss };

  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  if (!mmddyyyyToDate(startDate) || !mmddyyyyToDate(endDate)) {
    return {
      status: 400,
      body: { ok: false, error: 'invalid_date', expected: 'mm/dd/yyyy', startDate, endDate },
    };
  }

  const apiKey = process.env.MOUSER_API_KEY;
  const mouserVersion = String(process.env.MOUSER_API_VERSION || '1.0').trim() || '1.0';
  const url =
    'https://api.mouser.com/api/v' +
    encodeURIComponent(mouserVersion) +
    '/orderhistory/ByDateRange' +
    '?apiKey=' +
    encodeURIComponent(apiKey) +
    '&startDate=' +
    encodeURIComponent(startDate) +
    '&endDate=' +
    encodeURIComponent(endDate);

  const debug = searchParams.get('debug') === '1';
  const r = debug
    ? await fetchWithDebug(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CD_RB_BOM-tool/1.0 (order-proxy)',
        },
      })
    : await fetchJson(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CD_RB_BOM-tool/1.0 (order-proxy)',
        },
      });

  if (!r.ok) {
    const isHtml = typeof r.body === 'string' && /<html/i.test(r.body);
    const safeUrl = url.replace(/apiKey=[^&]+/i, 'apiKey=***');
    return {
      status: r.status,
      body: {
        ok: false,
        upstream: 'mouser',
        status: r.status,
        error: isHtml ? 'blocked_by_waf' : 'upstream_error',
        hint: isHtml
          ? 'Mouser API 回傳 403 HTML（疑似 Akamai/WAF 擋下）。請確認此 apiKey 是否為 Order History 專用，或改用可被允許的網路/環境（公司固定出口 IP/VPN）。'
          : undefined,
        request: debug ? { url: safeUrl, version: mouserVersion } : undefined,
        debug: debug ? r.debug : undefined,
        body: r.body,
      },
    };
  }

  const enrich = searchParams.get('enrichDetails') === '1';
  if (enrich && r.body && typeof r.body === 'object') {
    try {
      await enrichMouserOrderHistoryItems(r.body);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[order-proxy] enrichMouserOrderHistoryItems:', e && e.message ? e.message : e);
    }
  }

  return { status: 200, body: r.body };
}

/**
 * ByDateRange 多為摘要；Mouser 另有 GET orderhistory/webOrderNumber 取單筆明細（品項等）。
 * 見 https://www.mouser.com/api-orderhistory/ 與 API Explorer OrderHistory。
 */
async function handleMouserByWebOrderNumber(searchParams) {
  const miss = requireEnvKeys(['MOUSER_API_KEY']);
  if (miss) return { status: 500, body: miss };
  const webOrderNumber = String(searchParams.get('webOrderNumber') || '').trim();
  if (!webOrderNumber) {
    return { status: 400, body: { ok: false, error: 'missing_webOrderNumber' } };
  }
  const apiKey = process.env.MOUSER_API_KEY;
  const mouserVersion = String(process.env.MOUSER_API_VERSION || '1.0').trim() || '1.0';
  const url =
    'https://api.mouser.com/api/v' +
    encodeURIComponent(mouserVersion) +
    '/orderhistory/webOrderNumber' +
    '?apiKey=' +
    encodeURIComponent(apiKey) +
    '&webOrderNumber=' +
    encodeURIComponent(webOrderNumber);
  const r = await fetchJson(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'CD_RB_BOM-tool/1.0 (order-proxy)',
    },
  });
  if (!r.ok) {
    return { status: r.status, body: { ok: false, upstream: 'mouser', step: 'webOrderNumber', status: r.status, body: r.body } };
  }
  return { status: 200, body: r.body };
}

async function enrichMouserOrderHistoryItems(body) {
  const items = Array.isArray(body.OrderHistoryItems)
    ? body.OrderHistoryItems
    : Array.isArray(body.orderHistoryItems)
      ? body.orderHistoryItems
      : [];
  if (!items.length) return;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const wn =
      it.WebOrderNumber ||
      it['Web訂單號'] ||
      it['網路訂單號碼'] ||
      it['網絡訂單號'] ||
      '';
    if (!wn) continue;
    const sp = new URLSearchParams();
    sp.set('webOrderNumber', String(wn));
    const out = await handleMouserByWebOrderNumber(sp);
    if (out.status !== 200 || !out.body || typeof out.body !== 'object') continue;
    const d = out.body;
    const lines = d.OrderLineItems || d.orderLineItems || d.LineItems || d.OrderLines;
    if (Array.isArray(lines) && lines.length) {
      it.OrderLineItems = lines;
    }
    const fillKeys = [
      'OrderTotal',
      'TotalAmount',
      'CurrencyTotal',
      'CurrencyCode',
      'Currency',
      'ShipDate',
      'ShippedDate',
      'ShipToDate',
      'ShipToTrackingNumber',
      'TrackingNumber',
      'Tracking',
    ];
    fillKeys.forEach((k) => {
      if (it[k] == null || it[k] === '') {
        if (d[k] != null && d[k] !== '') it[k] = d[k];
      }
    });
  }
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

/**
 * @param {URLSearchParams} searchParams
 * @returns {Promise<{ status: number, body: object }>}
 */
async function handleDigikeyOrders(searchParams) {
  const miss = requireEnvKeys(['DIGIKEY_CLIENT_ID', 'DIGIKEY_CLIENT_SECRET', 'DIGIKEY_ACCOUNT_ID']);
  if (miss) return { status: 500, body: miss };

  const shared = searchParams.get('Shared') || 'false';
  const startDate = searchParams.get('StartDate') || '';
  const endDate = searchParams.get('EndDate') || '';
  const pageNumber = searchParams.get('PageNumber') || '1';
  const pageSize = searchParams.get('PageSize') || '50';

  if (Number.isNaN(new Date(startDate).getTime()) || Number.isNaN(new Date(endDate).getTime())) {
    return {
      status: 400,
      body: {
        ok: false,
        error: 'invalid_date',
        expected: 'ISO date-time',
        StartDate: startDate,
        EndDate: endDate,
      },
    };
  }

  let token;
  try {
    token = await digikeyGetAccessToken();
  } catch (e) {
    return {
      status: e.status || 502,
      body: { ok: false, upstream: 'digikey', step: 'token', status: e.status, body: e.body },
    };
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

  if (!r.ok) {
    return { status: r.status, body: { ok: false, upstream: 'digikey', step: 'orders', status: r.status, body: r.body } };
  }
  return { status: 200, body: r.body };
}

module.exports = {
  handleMouserByDateRange,
  handleMouserByWebOrderNumber,
  handleDigikeyOrders,
};
