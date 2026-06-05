require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const PASS = 'steam_inventory_entitlement_backend_pass_87';
const DEFAULT_APP_ID = 4788490;

const PORT = Number(process.env.PORT || 8080);
const STEAM_APP_ID = Number(process.env.STEAM_APP_ID || DEFAULT_APP_ID);
const STEAM_AUTH_IDENTITY = process.env.STEAM_AUTH_IDENTITY || 'chiggas_inventory';
const STEAM_PUBLISHER_WEB_API_KEY = String(process.env.STEAM_PUBLISHER_WEB_API_KEY || '').trim();
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const STEAM_AUTH_ENDPOINT = process.env.STEAM_AUTH_ENDPOINT || 'https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1/';
const STEAM_INVENTORY_ENDPOINT = process.env.STEAM_INVENTORY_ENDPOINT || 'https://partner.steam-api.com/IInventoryService/GetInventory/v1/';

const app = express();

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
}));

app.use(express.json({ limit: '256kb' }));

function nowIso() {
  return new Date().toISOString();
}

function isHexTicket(value) {
  return typeof value === 'string' && value.length >= 32 && /^[0-9a-f]+$/i.test(value);
}

function envReady() {
  return Boolean(STEAM_PUBLISHER_WEB_API_KEY && STEAM_PUBLISHER_WEB_API_KEY.length >= 20);
}

function maskPublisherKeyForHealth() {
  if (!STEAM_PUBLISHER_WEB_API_KEY) return null;
  const key = STEAM_PUBLISHER_WEB_API_KEY;
  return {
    length: key.length,
    startsWith: key.slice(0, 4),
    endsWith: key.slice(-4),
    looksHex: /^[0-9a-f]+$/i.test(key),
    expectedMinLength: 20,
    readyByLength: key.length >= 20
  };
}

function buildUrl(base, params) {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url;
}

async function fetchJson(url, label) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`${label} returned non-JSON response: HTTP ${res.status}`);
  }

  if (!res.ok) {
    const msg = data?.response?.error || data?.error || JSON.stringify(data).slice(0, 300);
    throw new Error(`${label} failed: HTTP ${res.status} ${msg}`);
  }

  return data;
}

function parseSteamAuthResponse(data) {
  const response = data?.response || {};
  const params = response.params || response;

  const result = params.result || response.result || null;
  const steamid = params.steamid || response.steamid || null;
  const ownersteamid = params.ownersteamid || response.ownersteamid || null;

  const ok = Boolean(steamid) && (!result || String(result).toUpperCase() === 'OK');

  return {
    ok,
    result,
    steamid: steamid ? String(steamid) : null,
    ownersteamid: ownersteamid ? String(ownersteamid) : null,
    rawShape: {
      hasResponse: Boolean(data?.response),
      responseKeys: Object.keys(response || {}),
      paramsKeys: Object.keys(params || {})
    }
  };
}

function parseItemJson(itemJson) {
  if (!itemJson) return [];

  if (Array.isArray(itemJson)) {
    return itemJson.flatMap(parseItemJson);
  }

  if (typeof itemJson === 'object') {
    return [itemJson];
  }

  if (typeof itemJson === 'string') {
    try {
      const parsed = JSON.parse(itemJson);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return [parsed];
    } catch (_) {
      return [];
    }
  }

  return [];
}

function parseInventoryResponse(data) {
  const response = data?.response || {};
  const itemJson = response.item_json ?? response.items ?? response.inventory ?? [];
  const rawItems = parseItemJson(itemJson);

  const ownedItems = rawItems.map((item, index) => {
    const itemdefid = item.itemdefid ?? item.itemDefId ?? item.definition ?? item.definitionId ?? item.defid ?? null;
    const itemid = item.itemid ?? item.itemId ?? item.id ?? null;
    const quantity = Number(item.quantity ?? item.qty ?? item.amount ?? 1);

    return {
      index,
      itemdefid: itemdefid === undefined || itemdefid === null ? null : String(itemdefid),
      itemid: itemid === undefined || itemid === null ? null : String(itemid),
      quantity: Number.isFinite(quantity) ? quantity : 1,
      state: item.state || null,
      raw: item
    };
  }).filter(item => item.itemdefid && item.quantity > 0 && item.state !== 'removed');

  return {
    ok: response.success !== false,
    error: response.error || null,
    rawItemCount: rawItems.length,
    ownedItemCount: ownedItems.length,
    ownedItems,
    ownedItemDefIds: Array.from(new Set(ownedItems.map(item => item.itemdefid))).sort((a, b) => Number(a) - Number(b))
  };
}

async function authenticateTicket(ticketHex, identity = STEAM_AUTH_IDENTITY) {
  const url = buildUrl(STEAM_AUTH_ENDPOINT, {
    key: STEAM_PUBLISHER_WEB_API_KEY,
    appid: STEAM_APP_ID,
    ticket: ticketHex,
    identity
  });

  const data = await fetchJson(url, 'AuthenticateUserTicket');
  const auth = parseSteamAuthResponse(data);

  if (!auth.ok) {
    throw new Error(`Steam ticket authentication failed: ${JSON.stringify(auth).slice(0, 300)}`);
  }

  return auth;
}

async function getInventory(steamid) {
  const url = buildUrl(STEAM_INVENTORY_ENDPOINT, {
    key: STEAM_PUBLISHER_WEB_API_KEY,
    appid: STEAM_APP_ID,
    steamid
  });

  const data = await fetchJson(url, 'GetInventory');
  const inventory = parseInventoryResponse(data);

  if (!inventory.ok) {
    throw new Error(`Steam inventory request failed: ${inventory.error || 'unknown error'}`);
  }

  return inventory;
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    pass: PASS,
    status: 'healthy',
    time: nowIso(),
    appId: STEAM_APP_ID,
    authIdentity: STEAM_AUTH_IDENTITY,
    envReady: envReady(),
    publisherKeyConfigured: Boolean(STEAM_PUBLISHER_WEB_API_KEY),
    publisherKeyDiagnostics: maskPublisherKeyForHealth(),
    allowedOrigin: ALLOWED_ORIGIN,
    endpoints: {
      auth: STEAM_AUTH_ENDPOINT,
      inventory: STEAM_INVENTORY_ENDPOINT
    }
  });
});

app.post('/steam/authenticate', async (req, res) => {
  try {
    if (!envReady()) {
      return res.status(503).json({
        ok: false,
        pass: PASS,
        status: 'steam_publisher_key_not_configured'
      });
    }

    const ticketHex = String(req.body?.ticketHex || req.body?.ticket || '').trim();
    const identity = String(req.body?.identity || STEAM_AUTH_IDENTITY).trim();

    if (!isHexTicket(ticketHex)) {
      return res.status(400).json({
        ok: false,
        pass: PASS,
        status: 'invalid_or_missing_ticket_hex'
      });
    }

    const auth = await authenticateTicket(ticketHex, identity);

    res.json({
      ok: true,
      pass: PASS,
      status: 'steam_ticket_authenticated',
      appId: STEAM_APP_ID,
      identity,
      steamid: auth.steamid,
      ownersteamid: auth.ownersteamid,
      time: nowIso()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      pass: PASS,
      status: 'steam_authenticate_failed',
      error: error.message || String(error)
    });
  }
});

app.post('/steam/inventory/owned', async (req, res) => {
  try {
    if (!envReady()) {
      return res.status(503).json({
        ok: false,
        pass: PASS,
        status: 'steam_publisher_key_not_configured'
      });
    }

    const ticketHex = String(req.body?.ticketHex || req.body?.ticket || '').trim();
    const identity = String(req.body?.identity || STEAM_AUTH_IDENTITY).trim();

    if (!isHexTicket(ticketHex)) {
      return res.status(400).json({
        ok: false,
        pass: PASS,
        status: 'invalid_or_missing_ticket_hex'
      });
    }

    const auth = await authenticateTicket(ticketHex, identity);
    const inventory = await getInventory(auth.steamid);

    res.json({
      ok: true,
      pass: PASS,
      status: 'steam_inventory_owned_items_verified',
      appId: STEAM_APP_ID,
      identity,
      steamid: auth.steamid,
      ownersteamid: auth.ownersteamid,
      ownedItemCount: inventory.ownedItemCount,
      ownedItemDefIds: inventory.ownedItemDefIds,
      ownedItems: inventory.ownedItems.map(item => ({
        itemdefid: item.itemdefid,
        itemid: item.itemid,
        quantity: item.quantity,
        state: item.state
      })),
      time: nowIso()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      pass: PASS,
      status: 'steam_inventory_owned_items_failed',
      error: error.message || String(error)
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    pass: PASS,
    status: 'not_found'
  });
});

app.listen(PORT, () => {
  console.log(JSON.stringify({
    ok: true,
    pass: PASS,
    status: 'steam_entitlement_backend_listening',
    port: PORT,
    appId: STEAM_APP_ID,
    authIdentity: STEAM_AUTH_IDENTITY,
    envReady: envReady(),
    publisherKeyConfigured: Boolean(STEAM_PUBLISHER_WEB_API_KEY),
    allowedOrigin: ALLOWED_ORIGIN
  }, null, 2));
});