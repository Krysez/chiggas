
// CHIGGAS_STEAM_PASS_99A1_ENV_FILE_LOADER_BEGIN
function __chiggasPass99A1LoadEnvFile() {
  const envFiles = [
    require('path').join(process.cwd(), '.env'),
    require('path').join(process.cwd(), '..', '.env'),
    require('path').join(process.cwd(), 'steam-entitlement-backend.env')
  ];

  const loaded = [];

  for (const file of envFiles) {
    try {
      if (!require('fs').existsSync(file)) continue;

      const text = require('fs').readFileSync(file, 'utf8');
      const lines = text.split(/\r?\n/);

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const idx = line.indexOf('=');
        if (idx <= 0) continue;

        const key = line.slice(0, idx).trim();
        let value = line.slice(idx + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        if (key && typeof process.env[key] === 'undefined') {
          process.env[key] = value;
        }
      }

      loaded.push(file);
    } catch (error) {
      console.warn('[Chiggas Pass 99A1] Could not load env file:', file, error);
    }
  }

  process.env.CHIGGAS_PASS_99A1_ENV_FILES_LOADED = loaded.join(';');
  return loaded;
}
__chiggasPass99A1LoadEnvFile();
// CHIGGAS_STEAM_PASS_99A1_ENV_FILE_LOADER_END

// Steam Desktop Wrapper Pass 99A
// Steam Wallet MicroTxn backend foundation for Chiggas: Survival of the Mitiest.
// Runs as a standalone backend add-on. Does not use sandbox APIs.
// Required env: STEAM_PUBLISHER_WEB_API_KEY
// Optional env: PORT=8791, STEAM_APP_ID=4788490

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');



/* CHIGGAS_STEAM_PASS_99H1_SAFE_ITEMDEF_RESOLVER */
function chiggasPass99H1SafeItemDefId(ctx) {
  try {
    if (ctx && typeof ctx === 'object') {
      return String(
        ctx.itemDefId ||
        ctx.itemDefID ||
        ctx.itemdefid ||
        ctx.itemid ||
        ctx.itemId ||
        ctx.steamItemDefId ||
        ctx.steam_itemdefid ||
        ''
      ).trim();
    }
  } catch (_) {}

  try {
    if (typeof order !== 'undefined' && order) {
      return String(order.itemDefId || order.itemDefID || order.itemdefid || order.itemid || order.itemId || '').trim();
    }
  } catch (_) {}

  try {
    if (typeof itemDefId !== 'undefined' && itemDefId) return String(itemDefId).trim();
  } catch (_) {}

  try {
    if (typeof itemid !== 'undefined' && itemid) return String(itemid).trim();
  } catch (_) {}

  try {
    if (typeof itemId !== 'undefined' && itemId) return String(itemId).trim();
  } catch (_) {}

  return '';
}

function chiggasPass99H1SafeDescription(ctx, fallback) {
  const id = chiggasPass99H1SafeItemDefId(ctx);
  try {
    return chiggasPass99HResolveTxnName(id, fallback);
  } catch (_) {
    const clean = String(fallback || '').trim();
    if (clean && !/^chigga_wear$/i.test(clean) && !/^chigga\s+wear\s*$/i.test(clean)) return clean.slice(0, 128);
    return ('Chiggas Legendary Wear ' + id).slice(0, 128);
  }
}

/* CHIGGAS_STEAM_PASS_99H_BACKEND_ITEM_NAME_OVERRIDES */
const CHIGGAS_STEAM_PASS_99H_BACKEND_ITEM_NAMES = {
  "1001": "Chigga B-Ball Team Black",
  "1004": "Chigga Wear - Purple Velour Vandal"
};

function chiggasPass99HCleanTxnName(value) {
  const name = String(value || '').trim();
  if (!name) return null;
  if (/^chigga_wear$/i.test(name)) return null;
  if (/^chigga\s+wear\s*$/i.test(name)) return null;
  if (/^itemdef/i.test(name)) return null;
  if (/^Chiggas?\s+Legendary\s+Wear\s+\d+$/i.test(name)) return null;
  return name.slice(0, 128);
}

function chiggasPass99HResolveTxnName(itemDefId, fallback) {
  const id = String(itemDefId || '').trim();
  return chiggasPass99HCleanTxnName(CHIGGAS_STEAM_PASS_99H_BACKEND_ITEM_NAMES[id]) ||
    chiggasPass99HCleanTxnName(fallback) ||
    ('Chiggas Legendary Wear ' + id).slice(0, 128);
}

const PASS = 'steam_desktop_wrapper_pass_99a';
const APP_ID = Number(process.env.STEAM_APP_ID || 4788490);
const PORT = Number(process.env.PORT || process.env.MICROTXN_PORT || 8791);
const PUBLISHER_KEY = process.env.STEAM_PUBLISHER_WEB_API_KEY || process.env.STEAM_WEB_API_KEY || '';
const ROOT = process.cwd();
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'steam-microtxn-orders-pass-99a.json');

function nowIso() { return new Date().toISOString(); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}
function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}
function loadOrders() {
  return readJson(ORDERS_FILE, { pass: PASS, updatedAt: nowIso(), orders: [] });
}
function saveOrders(db) {
  db.pass = PASS;
  db.updatedAt = nowIso();
  writeJson(ORDERS_FILE, db);
}
function upsertOrder(order) {
  const db = loadOrders();
  const idx = db.orders.findIndex(o => String(o.orderId) === String(order.orderId));
  if (idx >= 0) db.orders[idx] = { ...db.orders[idx], ...order, updatedAt: nowIso() };
  else db.orders.push({ ...order, createdAt: nowIso(), updatedAt: nowIso() });
  saveOrders(db);
}
function getOrder(orderId) {
  const db = loadOrders();
  return db.orders.find(o => String(o.orderId) === String(orderId)) || null;
}
function makeOrderId() {
  // uint64-compatible decimal string, under 19 digits.
  const t = BigInt(Date.now());
  const r = BigInt(crypto.randomInt(100000, 999999));
  return String(t * 1000000n + r);
}
function cents(value, fallback = 99) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}
function json(res, code, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(payload);
}
function readBody(req) {
  return new Promise(resolve => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { return resolve(JSON.parse(raw)); } catch (_) {}
      try { return resolve(Object.fromEntries(new URLSearchParams(raw))); } catch (_) {}
      resolve({ raw });
    });
  });
}
function steamApi(pathname, params, method = 'POST') {
  // CHIGGAS_STEAM_PASS_99B2_QUERYTXN_GET_FIX
  return new Promise((resolve) => {
    const body = new URLSearchParams(params).toString();
    const requestPath = method === 'GET'
      ? pathname + (pathname.includes('?') ? '&' : '?') + body
      : pathname;

    const options = {
      hostname: 'partner.steam-api.com',
      path: requestPath,
      method,
      headers: method === 'POST' ? {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      } : {}
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', d => { raw += d; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (_) {}
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed || raw
        });
      });
    });

    req.on('error', error => resolve({
      ok: false,
      statusCode: 0,
      error: String(error && error.message ? error.message : error)
    }));

    if (method === 'POST') req.write(body);
    req.end();
  });
}

function loadCatalog() {
  const candidates = [
    path.join(ROOT, 'steam-microtxn-catalog-pass-99a.json'),
    path.join(ROOT, 'steam-product-map.json'),
    path.join(ROOT, 'steam_product_map.json'),
    path.join(ROOT, '..', 'steam-product-map.json'),
    path.join(ROOT, '..', 'steam_product_map.json')
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const raw = readJson(file, null);
    if (!raw) continue;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.items)) return raw.items;
    if (Array.isArray(raw.products)) return raw.products;
  }

  return [
    {
      skinId: 'manual_test_99_cent_item',
      itemDefId: 1000,
      name: 'Manual Test Legendary Wear',
      description: 'Manual Test Legendary Wear',
      amountCents: 99,
      currency: 'USD'
    }
  ];
}
function findCatalogItem(body) {
  const catalog = loadCatalog();
  const skinId = String(body.skinId || body.productId || body.sku || '').trim();
  const itemDefId = String(body.itemDefId || body.itemid || body.itemId || '').trim();

  let item = null;
  if (skinId) item = catalog.find(i => String(i.skinId || i.productId || i.sku) === skinId);
  if (!item && itemDefId) item = catalog.find(i => String(i.itemDefId || i.itemid || i.itemId) === itemDefId);

  if (item) return item;

  if (itemDefId || skinId || body.description) {
    return {
      skinId: skinId || `item_${itemDefId || 'manual'}`,
      itemDefId: Number(itemDefId || body.itemid || 1000),
      name: String(body.name || body.description || skinId || `Item ${itemDefId || 'manual'}`),
      description: String(body.description || body.name || skinId || `Item ${itemDefId || 'manual'}`),
      amountCents: cents(body.amountCents || body.amount || 99),
      currency: String(body.currency || 'USD').toUpperCase()
    };
  }

  return null;
}

async function initTxn(body) {
  if (!PUBLISHER_KEY) {
    return { ok: false, status: 'publisher_key_missing', error: 'STEAM_PUBLISHER_WEB_API_KEY is not configured.' };
  }

  const steamId64 = String(body.steamId64 || body.steamid || body.steamId || '').trim();
  if (!steamId64) {
    return { ok: false, status: 'steamid_missing', error: 'steamId64 is required.' };
  }

  const item = findCatalogItem(body);
  if (!item) {
    return { ok: false, status: 'item_not_found', error: 'No catalog item matched the request.' };
  }

  const orderId = String(body.orderId || makeOrderId());
  const amount = cents(body.amountCents || item.amountCents || 99);
  const currency = String(body.currency || item.currency || 'USD').toUpperCase();
  const itemid = String(item.itemDefId || item.itemid || item.itemId || body.itemid || 1000);

const walletNameOverrides = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'chiggas-steam-item-name-overrides.json'), 'utf8'));
  } catch (_) {
    return {};
  }
})();

const mappedName = String(walletNameOverrides[itemid] || '').trim();
const fallbackDescription = String(item.description || item.name || body.name || body.description || `Chiggas Item ${itemid}`).trim();

const description = (
  mappedName &&
  !/^steamItemDefId/i.test(mappedName) &&
  !/^chigga_wear$/i.test(mappedName) &&
  !/^chigga\s+wear\s*$/i.test(mappedName) &&
  !/^Chiggas?\s+Legendary\s+Wear\s*\d*$/i.test(mappedName)
    ? mappedName
    : fallbackDescription
).slice(0, 128);

  const params = {
    key: PUBLISHER_KEY,
    orderid: orderId,
    steamid: steamId64,
    appid: String(APP_ID),
    itemcount: '1',
    language: String(body.language || 'en'),
    currency,
    usersession: 'client',
    'itemid[0]': itemid,
    'qty[0]': String(body.qty || 1),
    'amount[0]': String(amount),
    'description[0]': description
  };

  const steam = await steamApi('/ISteamMicroTxn/InitTxn/v3/', params, 'POST');

  const order = {
    pass: PASS,
    orderId,
    steamId64,
    appId: APP_ID,
    skinId: item.skinId || null,
    itemDefId: itemid,
    description,
    amountCents: amount,
    currency,
    status: steam.ok ? 'init_txn_called' : 'init_txn_failed',
    initTxn: steam,
    sandbox: false
  };

  upsertOrder(order);
  return { ok: steam.ok, status: steam.ok ? 'init_txn_completed' : 'init_txn_failed', order, steam };
}

async function finalizeTxn(body) {
  if (!PUBLISHER_KEY) {
    return { ok: false, status: 'publisher_key_missing', error: 'STEAM_PUBLISHER_WEB_API_KEY is not configured.' };
  }

  const orderId = String(body.orderId || body.orderid || '').trim();
  if (!orderId) return { ok: false, status: 'orderid_missing', error: 'orderId is required.' };

  const params = { key: PUBLISHER_KEY, orderid: orderId, appid: String(APP_ID) };
  const steam = await steamApi('/ISteamMicroTxn/FinalizeTxn/v2/', params, 'POST');

  const existing = getOrder(orderId) || { orderId, appId: APP_ID };
  upsertOrder({
    ...existing,
    status: steam.ok ? 'finalize_txn_called' : 'finalize_txn_failed',
    finalizeTxn: steam,
    finalizedAt: nowIso()
  });

  return { ok: steam.ok, status: steam.ok ? 'finalize_txn_completed' : 'finalize_txn_failed', order: getOrder(orderId), steam };
}

async function queryTxn(query) {
  if (!PUBLISHER_KEY) {
    return { ok: false, status: 'publisher_key_missing', error: 'STEAM_PUBLISHER_WEB_API_KEY is not configured.' };
  }

  const orderId = String(query.get('orderId') || query.get('orderid') || '').trim();
  const transId = String(query.get('transId') || query.get('transid') || '').trim();

  if (!orderId && !transId) {
    return { ok: false, status: 'id_missing', error: 'orderId or transId is required.' };
  }

  const params = { key: PUBLISHER_KEY, appid: String(APP_ID) };
  if (orderId) params.orderid = orderId;
  if (transId) params.transid = transId;

  const steam = await steamApi('/ISteamMicroTxn/QueryTxn/v2/', params, 'GET'); // CHIGGAS_STEAM_PASS_99B2_QUERYTXN_GET_FIX
  return { ok: steam.ok, status: steam.ok ? 'query_txn_completed' : 'query_txn_failed', steam };
}

async function getReport(query) {
  if (!PUBLISHER_KEY) {
    return { ok: false, status: 'publisher_key_missing', error: 'STEAM_PUBLISHER_WEB_API_KEY is not configured.' };
  }

  const type = String(query.get('type') || 'GAMESALES');
  const time = String(query.get('time') || query.get('startTime') || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const params = {
    key: PUBLISHER_KEY,
    appid: String(APP_ID),
    type,
    time
  };

  const steam = await steamApi('/ISteamMicroTxn/GetReport/v5/', params, 'GET'); // CHIGGAS_STEAM_PASS_99B3_GETREPORT_GET_FIX
  return {
    ok: steam.ok,
    status: steam.ok ? 'get_report_completed' : 'get_report_failed',
    request: { appId: APP_ID, type, time, sandbox: false },
    steam
  };
}

async function route(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, { ok: true });

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health' || url.pathname === '/steam/mtx/health') {
    return json(res, 200, {
      ok: true,
      pass: PASS,
      status: 'steam_microtxn_backend_foundation_ready',
      appId: APP_ID,
      publisherKeyConfigured: !!PUBLISHER_KEY,
    envFilesLoaded: process.env.CHIGGAS_PASS_99A1_ENV_FILES_LOADED || '',
      envFilesLoaded: process.env.CHIGGAS_PASS_99A1_ENV_FILES_LOADED || '',
      root: ROOT,
      ordersFile: ORDERS_FILE,
      catalogCount: loadCatalog().length,
      sandbox: false,
      endpoints: [
        'GET /steam/mtx/catalog',
        'POST /steam/mtx/init',
        'POST /steam/mtx/finalize',
        'GET /steam/mtx/query?orderId=',
        'GET /steam/mtx/report?type=GAMESALES&time='
      ]
    });
  }

  if (url.pathname === '/steam/mtx/catalog') {
    return json(res, 200, { ok: true, pass: PASS, appId: APP_ID, catalog: loadCatalog() });
  }

  if (url.pathname === '/steam/mtx/orders') {
    return json(res, 200, loadOrders());
  }

  if (url.pathname === '/steam/mtx/init' && req.method === 'POST') {
    const body = await readBody(req);
    const result = await initTxn(body);
    return json(res, result.ok ? 200 : 400, { pass: PASS, ...result });
  }

  if (url.pathname === '/steam/mtx/finalize' && req.method === 'POST') {
    const body = await readBody(req);
    const result = await finalizeTxn(body);
    return json(res, result.ok ? 200 : 400, { pass: PASS, ...result });
  }

  if (url.pathname === '/steam/mtx/query') {
    const result = await queryTxn(url.searchParams);
    return json(res, result.ok ? 200 : 400, { pass: PASS, ...result });
  }

  if (url.pathname === '/steam/mtx/report') {
    const result = await getReport(url.searchParams);
    return json(res, result.ok ? 200 : 400, { pass: PASS, ...result });
  }

  return json(res, 404, { ok: false, pass: PASS, status: 'not_found', path: url.pathname });
}

const server = http.createServer((req, res) => {
  route(req, res).catch(error => {
    json(res, 500, {
      ok: false,
      pass: PASS,
      status: 'server_error',
      error: String(error && error.stack ? error.stack : error)
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  ensureDir(DATA_DIR);
  console.log(JSON.stringify({
    ok: true,
    pass: PASS,
    status: 'steam_microtxn_backend_listening',
    port: PORT,
    appId: APP_ID,
    publisherKeyConfigured: !!PUBLISHER_KEY,
    root: ROOT,
    ordersFile: ORDERS_FILE,
    sandbox: false
  }, null, 2));
});
