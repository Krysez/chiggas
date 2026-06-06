const PASS = 'steam_inventory_backend_pass_88';
const APP_ID = Number(process.env.STEAM_APP_ID || 4788490);
const BACKEND_URL = String(process.env.STEAM_ENTITLEMENT_BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '');
const IDENTITY = String(process.env.STEAM_AUTH_IDENTITY || 'chiggas_inventory');

function summarizeError(error) {
  return error && error.message ? error.message : String(error);
}

async function readJsonResponse(res) {
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_) {
    body = { rawText: text.slice(0, 500) };
  }

  return {
    ok: res.ok,
    statusCode: res.status,
    body
  };
}

async function postJson(path, payload) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return readJsonResponse(res);
}

async function getJson(path) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  return readJsonResponse(res);
}

function ticketToHex(ticket) {
  if (!ticket || typeof ticket.getBytes !== 'function') {
    throw new Error('Resolved Steam auth ticket does not expose getBytes().');
  }

  const bytes = ticket.getBytes();
  const buffer = Buffer.isBuffer(bytes)
    ? bytes
    : Buffer.from(bytes.buffer || bytes);

  if (!buffer || buffer.length <= 0) {
    throw new Error('Steam auth ticket bytes were empty.');
  }

  return buffer.toString('hex');
}

async function getSteamTicketHex() {
  const steamworks = require('steamworks.js');
  const client = steamworks.init(APP_ID);

  const steamIdObj = client.localplayer.getSteamId();
  const steamUser = {
    name: client.localplayer.getName ? client.localplayer.getName() : null,
    level: client.localplayer.getLevel ? client.localplayer.getLevel() : null,
    steamId64: steamIdObj?.steamId64 ? String(steamIdObj.steamId64) : null,
    accountId: steamIdObj?.accountId ? String(steamIdObj.accountId) : null
  };

  if (!client.auth || typeof client.auth.getAuthTicketForWebApi !== 'function') {
    throw new Error('client.auth.getAuthTicketForWebApi is not available.');
  }

  const ticket = await client.auth.getAuthTicketForWebApi(IDENTITY);
  const ticketHex = ticketToHex(ticket);

  try {
    if (ticket && typeof ticket.cancel === 'function') {
      // Delay cancellation until after backend calls complete. Caller handles cleanup.
    }
  } catch (_) {}

  return { client, ticket, ticketHex, steamUser };
}

async function main() {
  const result = {
    ok: false,
    pass: PASS,
    appId: APP_ID,
    backendUrl: BACKEND_URL,
    identity: IDENTITY,
    status: 'steam_backend_inventory_pass_88_started',
    health: null,
    steamTicket: null,
    authenticate: null,
    inventory: null,
    interpretation: null,
    note: 'This script does not print the Steam auth ticket or Publisher Web API key.'
  };

  let ticket = null;

  try {
    result.health = await getJson('/health');

    if (!result.health.ok || !result.health.body?.envReady) {
      result.status = 'steam_backend_inventory_pass_88_backend_not_ready';
      result.interpretation = 'Backend did not return envReady:true. Keep backend running and confirm Publisher Web API key is loaded.';
      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    const steam = await getSteamTicketHex();
    ticket = steam.ticket;

    result.steamTicket = {
      ok: true,
      steamUser: steam.steamUser,
      ticketByteLength: steam.ticketHex.length / 2,
      ticketHexLength: steam.ticketHex.length,
      ticketNotPrinted: true
    };

    result.authenticate = await postJson('/steam/authenticate', {
      ticketHex: steam.ticketHex,
      identity: IDENTITY
    });

    result.inventory = await postJson('/steam/inventory/owned', {
      ticketHex: steam.ticketHex,
      identity: IDENTITY
    });

    const authOk = !!result.authenticate.ok && !!result.authenticate.body?.ok;
    const inventoryOk = !!result.inventory.ok && !!result.inventory.body?.ok;

    result.ok = authOk && inventoryOk;
    result.status = result.ok
      ? 'steam_backend_inventory_pass_88_smoke_passed'
      : 'steam_backend_inventory_pass_88_smoke_failed';

    if (result.ok) {
      const ownedItemDefIds = result.inventory.body?.ownedItemDefIds || [];
      result.interpretation = ownedItemDefIds.length > 0
        ? 'Backend verified the Steam user and returned owned itemdef IDs. Next pass can wire this backend response into in-game skin entitlements.'
        : 'Backend verified the Steam user and inventory call worked, but no owned itemdef IDs were returned. This is expected if the account does not yet own any uploaded/test itemdefs.';
    } else {
      result.interpretation = 'Backend or Steam Web API call failed. Review authenticate/inventory body error before wiring gameplay.';
    }

    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    result.ok = false;
    result.status = 'steam_backend_inventory_pass_88_exception';
    result.error = summarizeError(error);
    result.interpretation = 'Smoke test could not complete. Confirm Steam is running, backend is running, and this command is run from C:\\ChiggaStreamWrapper.';
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  } finally {
    try {
      if (ticket && typeof ticket.cancel === 'function') ticket.cancel();
    } catch (_) {}
  }
}

main();