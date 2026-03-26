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
 * ByDateRange 多為摘要；Mouser Order History 另有單筆明細（見 docs/api-guide.pdf、API Explorer）：
 * - GET orderhistory/webOrderNumber?webOrderNumber=
 * - GET orderhistory/salesOrderNumber?salesOrderNumber=
 */
/** 明細 JSON 可能為單筆訂單在 root，或包在 OrderHistoryItem / OrderHistoryItems[0] */
function pickMouserDetailPayload(d) {
  if (!d || typeof d !== 'object') return null;
  if (d.OrderHistoryItem && typeof d.OrderHistoryItem === 'object') return d.OrderHistoryItem;
  if (Array.isArray(d.OrderHistoryItems) && d.OrderHistoryItems.length === 1) return d.OrderHistoryItems[0];
  if (d.Order && typeof d.Order === 'object') return d.Order;
  return d;
}

/** Mouser 明細品項常把描述／料號放在巢狀 Product，攤平到列上方便前端與快取 JSON 使用 */
function flattenMouserOrderLineItem(li) {
  if (!li || typeof li !== 'object') return;
  const p =
    li.Product ||
    li.product ||
    li.ProductInfo ||
    li.productInfo ||
    li.Part ||
    li.part;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return;
  const keys = [
    'Description',
    'ProductDescription',
    'PartDescription',
    'ProductName',
    'ManufacturerPartNumber',
    'MPN',
    'MfrPartNumber',
    'MouserPartNumber',
    'MouserNumber',
    'MouserPartNo',
    'SKU',
  ];
  keys.forEach((k) => {
    if (li[k] == null || li[k] === '') {
      if (p[k] != null && p[k] !== '') li[k] = p[k];
    }
  });
}

function mergeMouserDetailIntoItem(it, rawDetail) {
  const d = pickMouserDetailPayload(rawDetail);
  if (!d || typeof d !== 'object') return;

  const lines =
    d.OrderLineItems ||
    d.orderLineItems ||
    d.LineItems ||
    d.OrderLines ||
    d.RequestLineItems ||
    d.requestLineItems;
  if (Array.isArray(lines) && lines.length) {
    it.OrderLineItems = lines;
    lines.forEach(flattenMouserOrderLineItem);
  }

  const fillKeys = [
    'CreatedDate',
    'CreateDate',
    'OrderDate',
    'OrderDateTime',
    'TransactionDate',
    'DateCreated',
    'OrderPlacedDate',
    'OpenDate',
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
    'OrderStatusDisplay',
    'StatusDisplay',
  ];
  fillKeys.forEach((k) => {
    if (it[k] == null || it[k] === '') {
      if (d[k] != null && d[k] !== '') it[k] = d[k];
    }
  });

  Object.keys(d).forEach((k) => {
    if (k === 'Errors' || k === 'OrderHistoryItems') return;
    const v = d[k];
    if (v == null || v === '') return;
    if (typeof v === 'object' && !Array.isArray(v)) return;
    if (Array.isArray(v) && k !== 'OrderLineItems' && k !== 'orderLineItems' && k !== 'LineItems' && k !== 'OrderLines') return;
    if (it[k] == null || it[k] === '') {
      it[k] = v;
    }
  });
}

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

async function handleMouserBySalesOrderNumber(searchParams) {
  const miss = requireEnvKeys(['MOUSER_API_KEY']);
  if (miss) return { status: 500, body: miss };
  const salesOrderNumber = String(searchParams.get('salesOrderNumber') || '').trim();
  if (!salesOrderNumber) {
    return { status: 400, body: { ok: false, error: 'missing_salesOrderNumber' } };
  }
  const apiKey = process.env.MOUSER_API_KEY;
  const mouserVersion = String(process.env.MOUSER_API_VERSION || '1.0').trim() || '1.0';
  const url =
    'https://api.mouser.com/api/v' +
    encodeURIComponent(mouserVersion) +
    '/orderhistory/salesOrderNumber' +
    '?apiKey=' +
    encodeURIComponent(apiKey) +
    '&salesOrderNumber=' +
    encodeURIComponent(salesOrderNumber);
  const r = await fetchJson(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'CD_RB_BOM-tool/1.0 (order-proxy)',
    },
  });
  if (!r.ok) {
    return { status: r.status, body: { ok: false, upstream: 'mouser', step: 'salesOrderNumber', status: r.status, body: r.body } };
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

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const wn =
      it.WebOrderNumber ||
      it['Web訂單號'] ||
      it['網路訂單號碼'] ||
      it['網絡訂單號'] ||
      '';
    const so =
      it.SalesOrderNumber ||
      it['銷售訂單號碼'] ||
      it['銷售訂單號'] ||
      it['銷售訂單編號'] ||
      '';

    if (wn) {
      const sp = new URLSearchParams();
      sp.set('webOrderNumber', String(wn));
      const out = await handleMouserByWebOrderNumber(sp);
      if (out.status === 200 && out.body && typeof out.body === 'object') {
        mergeMouserDetailIntoItem(it, out.body);
      }
      await delay(120);
    }

    const linesNow = it.OrderLineItems || it.orderLineItems || [];
    if ((!Array.isArray(linesNow) || !linesNow.length) && so) {
      const sp2 = new URLSearchParams();
      sp2.set('salesOrderNumber', String(so));
      const out2 = await handleMouserBySalesOrderNumber(sp2);
      if (out2.status === 200 && out2.body && typeof out2.body === 'object') {
        mergeMouserDetailIntoItem(it, out2.body);
      }
      await delay(120);
    }
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
  handleMouserBySalesOrderNumber,
  handleDigikeyOrders,
};
