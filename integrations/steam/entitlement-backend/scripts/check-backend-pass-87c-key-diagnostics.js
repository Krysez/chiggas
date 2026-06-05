const fs = require('fs');
const path = require('path');

const PASS = 'steam_inventory_entitlement_backend_pass_87c';
const ROOT = process.cwd();
const SERVER_PATH = path.join(ROOT, 'server.js');
const ENV_PATH = path.join(ROOT, '.env');

require('dotenv').config();

const rawEnvValue = process.env.STEAM_PUBLISHER_WEB_API_KEY || '';
const trimmed = String(rawEnvValue).trim();

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (_) { return ''; }
}

const envText = read(ENV_PATH);
const server = read(SERVER_PATH);

const checks = {
  cwd: ROOT,
  envFileExists: fs.existsSync(ENV_PATH),
  envHasPublisherKeyLine: /STEAM_PUBLISHER_WEB_API_KEY\s*=/.test(envText),
  nodeSeesPublisherKey: Boolean(rawEnvValue),
  rawKeyLength: rawEnvValue.length,
  trimmedKeyLength: trimmed.length,
  trimmedKeyLengthAtLeast20: trimmed.length >= 20,
  trimmedKeyLooksHex: /^[0-9a-f]+$/i.test(trimmed),
  serverTrimsPublisherKey: server.includes("String(process.env.STEAM_PUBLISHER_WEB_API_KEY || '').trim()"),
  serverHasHealthDiagnostics: server.includes('publisherKeyDiagnostics'),
  packageJsonExists: fs.existsSync(path.join(ROOT, 'package.json')),
  serverJsExists: fs.existsSync(SERVER_PATH)
};

const ok = checks.envFileExists &&
  checks.envHasPublisherKeyLine &&
  checks.nodeSeesPublisherKey &&
  checks.trimmedKeyLengthAtLeast20 &&
  checks.serverTrimsPublisherKey &&
  checks.serverHasHealthDiagnostics;

console.log(JSON.stringify({
  ok,
  pass: PASS,
  status: ok ? 'backend_pass_87c_key_diagnostics_check_passed' : 'backend_pass_87c_key_diagnostics_check_failed',
  root: ROOT,
  checks,
  safeKeyPreview: trimmed ? {
    startsWith: trimmed.slice(0, 4),
    endsWith: trimmed.slice(-4),
    length: trimmed.length
  } : null,
  note: 'Do not paste the full Publisher Web API key into chat. Rotate it in Steamworks before final release because it was previously exposed.'
}, null, 2));

process.exit(ok ? 0 : 1);