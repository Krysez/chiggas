'use strict';

/**
 * Chiggas: Survival of the Mitiest
 * Steam Desktop Wrapper Pass 96B
 * Trusted Steam Leaderboard Web API helper.
 *
 * This file is intentionally server/back-end only. It uses the Steam publisher
 * Web API key and must never be bundled into the public renderer/game client.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const querystring = require('querystring');

const DEFAULT_APP_ID = 4788490;
const PARTNER_HOST = 'partner.steam-api.com';

const REQUIRED_LEADERBOARDS = [
  {
    apiName: 'MITIEST_SURVIVOR_SCORE',
    sortMethod: 'Descending',
    displayType: 'Numeric',
    scoreMethod: 'KeepBest'
  },
  {
    apiName: 'LONGEST_SURVIVAL_SECONDS',
    sortMethod: 'Descending',
    displayType: 'Seconds',
    scoreMethod: 'KeepBest'
  },
  {
    apiName: 'ENEMIES_DEFEATED_TOTAL',
    sortMethod: 'Descending',
    displayType: 'Numeric',
    scoreMethod: 'KeepBest'
  }
];

function loadDotEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
    return true;
  } catch (_) {
    return false;
  }
}

function loadPossibleEnvFiles(rootDir = process.cwd()) {
  const candidates = [
    path.join(rootDir, '.env'),
    path.join(rootDir, 'backend.env'),
    path.join(rootDir, 'steam-backend.env'),
    path.join(rootDir, 'steam_backend.env'),
    path.join(rootDir, 'backend', '.env'),
    path.join(rootDir, 'server', '.env')
  ];
  return candidates.filter(loadDotEnvFile);
}

function getAppId() {
  return Number(
    process.env.STEAM_APP_ID ||
    process.env.STEAM_APPID ||
    process.env.APP_ID ||
    process.env.CHIGGAS_STEAM_APP_ID ||
    DEFAULT_APP_ID
  );
}

function getPublisherKey() {
  const candidates = [
    'STEAM_PUBLISHER_WEB_API_KEY',
    'STEAM_WEB_API_PUBLISHER_KEY',
    'STEAM_API_PUBLISHER_KEY',
    'STEAM_PUBLISHER_KEY',
    'STEAM_WEBAPI_PUBLISHER_KEY',
    'STEAM_WEB_API_KEY',
    'STEAM_API_KEY'
  ];

  for (const name of candidates) {
    const value = process.env[name];
    if (value && String(value).trim()) {
      return { name, value: String(value).trim() };
    }
  }
  return { name: null, value: null };
}

function publicEnvStatus() {
  const loadedEnvFiles = loadPossibleEnvFiles(process.cwd());
  const publisherKey = getPublisherKey();
  return {
    appId: getAppId(),
    envFilesLoaded: loadedEnvFiles.map((p) => path.relative(process.cwd(), p) || p),
    publisherKeyConfigured: Boolean(publisherKey.value),
    publisherKeyVariable: publisherKey.name,
    requiredLeaderboards: REQUIRED_LEADERBOARDS.map((b) => b.apiName)
  };
}

function steamRequest(method, endpointPath, params = {}) {
  const body = method === 'POST' ? querystring.stringify(params) : null;
  const query = method === 'GET' ? `?${querystring.stringify(params)}` : '';

  const options = {
    host: PARTNER_HOST,
    path: `${endpointPath}${query}`,
    method,
    headers: {
      'Accept': 'application/json'
    }
  };

  if (body !== null) {
    options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    options.headers['Content-Length'] = Buffer.byteLength(body);
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch (parseError) {
          return reject(new Error(`Steam Web API returned non-JSON response (${res.statusCode}): ${data.slice(0, 300)}`));
        }

        const result = {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          statusCode: res.statusCode,
          headers: {
            eresult: res.headers['x-eresult'],
            errorMessage: res.headers['x-error_message']
          },
          body: parsed
        };

        if (!result.ok) {
          const message = result.headers.errorMessage || JSON.stringify(parsed).slice(0, 500);
          const err = new Error(`Steam Web API HTTP ${res.statusCode}: ${message}`);
          err.result = result;
          return reject(err);
        }

        resolve(result);
      });
    });

    req.on('error', reject);
    if (body !== null) req.write(body);
    req.end();
  });
}

async function getLeaderboardsForGame() {
  loadPossibleEnvFiles(process.cwd());
  const publisherKey = getPublisherKey();
  if (!publisherKey.value) {
    throw new Error('Missing Steam publisher Web API key. Set STEAM_PUBLISHER_WEB_API_KEY or STEAM_WEB_API_PUBLISHER_KEY in your environment/.env file.');
  }

  const result = await steamRequest('GET', '/ISteamLeaderboards/GetLeaderboardsForGame/v2/', {
    key: publisherKey.value,
    appid: getAppId(),
    format: 'json'
  });

  return result.body;
}

function extractLeaderboards(apiBody) {
  const candidates = [
    apiBody && apiBody.response && apiBody.response.leaderboards,
    apiBody && apiBody.response && apiBody.response.leaderboard,
    apiBody && apiBody.leaderboards,
    apiBody && apiBody.leaderboard
  ];
  const found = candidates.find(Array.isArray);
  return found || [];
}

function normalizeLeaderboardRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const name = record.name || record.leaderboardname || record.display_name || record.displayName;
  const id = record.leaderboardid || record.leaderboardId || record.id || record.lbid;
  return {
    raw: record,
    name: name ? String(name) : null,
    id: id !== undefined && id !== null ? String(id) : null,
    sortMethod: record.sortmethod || record.sortMethod || record.sort_method || null,
    displayType: record.displaytype || record.displayType || record.display_type || null,
    onlyTrustedWrites: record.onlytrustedwrites ?? record.onlyTrustedWrites ?? record.only_trusted_writes ?? null,
    onlyFriendsReads: record.onlyfriendsreads ?? record.onlyFriendsReads ?? record.only_friends_reads ?? null
  };
}

async function getLeaderboardMap() {
  const body = await getLeaderboardsForGame();
  const records = extractLeaderboards(body).map(normalizeLeaderboardRecord).filter(Boolean);
  const byName = new Map(records.filter((r) => r.name).map((r) => [r.name, r]));
  return { body, records, byName };
}

async function verifyRequiredLeaderboards() {
  const map = await getLeaderboardMap();
  const checks = REQUIRED_LEADERBOARDS.map((required) => {
    const found = map.byName.get(required.apiName);
    return {
      apiName: required.apiName,
      found: Boolean(found),
      leaderboardId: found ? found.id : null,
      configuredSortMethod: found ? found.sortMethod : null,
      expectedSortMethod: required.sortMethod,
      configuredDisplayType: found ? found.displayType : null,
      expectedDisplayType: required.displayType,
      onlyTrustedWrites: found ? found.onlyTrustedWrites : null,
      onlyFriendsReads: found ? found.onlyFriendsReads : null
    };
  });

  return {
    ok: checks.every((c) => c.found && c.leaderboardId),
    appId: getAppId(),
    countReturned: map.records.length,
    checks,
    records: map.records
  };
}

async function findLeaderboardId(apiName) {
  const map = await getLeaderboardMap();
  const found = map.byName.get(apiName);
  if (!found || !found.id) {
    throw new Error(`Leaderboard not found or missing ID: ${apiName}`);
  }
  return found.id;
}

async function setLeaderboardScore({ apiName, steamId, score, scoreMethod = 'KeepBest', details }) {
  loadPossibleEnvFiles(process.cwd());
  const publisherKey = getPublisherKey();
  if (!publisherKey.value) {
    throw new Error('Missing Steam publisher Web API key. Set STEAM_PUBLISHER_WEB_API_KEY or STEAM_WEB_API_PUBLISHER_KEY in your environment/.env file.');
  }
  if (!apiName) throw new Error('apiName is required.');
  if (!/^\d{17}$/.test(String(steamId || ''))) throw new Error(`Invalid steamId64: ${steamId}`);
  if (!Number.isInteger(Number(score))) throw new Error(`Score must be an integer. Received: ${score}`);
  if (!['KeepBest', 'ForceUpdate'].includes(scoreMethod)) throw new Error('scoreMethod must be KeepBest or ForceUpdate.');

  const leaderboardId = await findLeaderboardId(apiName);
  const params = {
    key: publisherKey.value,
    appid: getAppId(),
    leaderboardid: leaderboardId,
    steamid: String(steamId),
    score: String(Math.trunc(Number(score))),
    scoremethod: scoreMethod,
    format: 'json'
  };
  if (details !== undefined && details !== null) params.details = String(details);

  const result = await steamRequest('POST', '/ISteamLeaderboards/SetLeaderboardScore/v1/', params);
  return {
    ok: true,
    appId: getAppId(),
    apiName,
    leaderboardId,
    steamId: String(steamId),
    score: Math.trunc(Number(score)),
    scoreMethod,
    body: result.body,
    headers: result.headers
  };
}

async function getLeaderboardEntries({ apiName, rangeStart = 0, rangeEnd = 10, steamId, dataRequest = 'RequestGlobal' }) {
  loadPossibleEnvFiles(process.cwd());
  const publisherKey = getPublisherKey();
  if (!publisherKey.value) {
    throw new Error('Missing Steam publisher Web API key. Set STEAM_PUBLISHER_WEB_API_KEY or STEAM_WEB_API_PUBLISHER_KEY in your environment/.env file.');
  }
  const leaderboardId = await findLeaderboardId(apiName);
  const params = {
    key: publisherKey.value,
    appid: getAppId(),
    leaderboardid: leaderboardId,
    rangestart: String(rangeStart),
    rangeend: String(rangeEnd),
    datarequest: dataRequest,
    format: 'json'
  };
  if (steamId) params.steamid = String(steamId);

  const result = await steamRequest('GET', '/ISteamLeaderboards/GetLeaderboardEntries/v1/', params);
  return {
    ok: true,
    appId: getAppId(),
    apiName,
    leaderboardId,
    body: result.body,
    headers: result.headers
  };
}

module.exports = {
  DEFAULT_APP_ID,
  REQUIRED_LEADERBOARDS,
  loadPossibleEnvFiles,
  getAppId,
  getPublisherKey,
  publicEnvStatus,
  getLeaderboardsForGame,
  extractLeaderboards,
  normalizeLeaderboardRecord,
  verifyRequiredLeaderboards,
  setLeaderboardScore,
  getLeaderboardEntries
};
