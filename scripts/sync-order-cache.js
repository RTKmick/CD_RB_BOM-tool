/**
 * 訂單靜態快取：寫入 data/order-cache/*.json（供 GitHub Pages 讀取）
 * 本機：複製 .env.example → .env 後執行 node scripts/sync-order-cache.js
 * CI：由 .github/workflows/sync-order-cache.yml 以 Secrets 注入環境變數
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { handleMouserByDateRange, handleDigikeyOrders } = require('../lib/orderProxyCore');

function loadDotEnv() {
  try {
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

function toMMDDYYYY(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return mm + '/' + dd + '/' + yyyy;
}

function getLast60DaysRange() {
  const end = new Date();
  const start = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  return { start, end };
}

async function main() {
  loadDotEnv();
  const outDir = path.join(__dirname, '..', 'data', 'order-cache');
  fs.mkdirSync(outDir, { recursive: true });

  const range = getLast60DaysRange();
  const mouserParams = new URLSearchParams();
  mouserParams.set('startDate', toMMDDYYYY(range.start));
  mouserParams.set('endDate', toMMDDYYYY(range.end));

  const digiParams = new URLSearchParams();
  digiParams.set('Shared', 'false');
  digiParams.set('StartDate', range.start.toISOString());
  digiParams.set('EndDate', range.end.toISOString());
  digiParams.set('PageNumber', '1');
  digiParams.set('PageSize', '50');

  const mouserOut = await handleMouserByDateRange(mouserParams);
  const digiOut = await handleDigikeyOrders(digiParams);

  const meta = {
    generatedAt: new Date().toISOString(),
    range: {
      startDate: mouserParams.get('startDate'),
      endDate: mouserParams.get('endDate'),
      digiStartIso: digiParams.get('StartDate'),
      digiEndIso: digiParams.get('EndDate'),
    },
    mouser: { httpStatus: mouserOut.status, ok: mouserOut.status === 200 },
    digikey: { httpStatus: digiOut.status, ok: digiOut.status === 200 },
  };

  fs.writeFileSync(path.join(outDir, 'mouser.json'), JSON.stringify(mouserOut.body, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'digikey.json'), JSON.stringify(digiOut.body, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

  // eslint-disable-next-line no-console
  console.log('[sync-order-cache] wrote', outDir, 'meta.generatedAt=', meta.generatedAt);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
