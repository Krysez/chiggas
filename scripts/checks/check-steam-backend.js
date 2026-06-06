const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { STEAM_INTEGRATIONS_DIR } = require('../lib/paths');

const backendDir = path.join(STEAM_INTEGRATIONS_DIR, 'entitlement-backend');

const requiredFiles = [
  'package.json',
  'package-lock.json',
  '.env.example',
  'README.md',
  'server.js',
  'steam-microtxn-pass-99a-server.js',
  path.join('scripts', 'health-check.js')
];

const requiredPackageScripts = [
  'start',
  'dev',
  'check',
  'health',
  'steam:mtx:server',
  'steam:mtx:health',
  'steam:mtx:catalog'
];

const requiredEnvExampleKeys = [
  'STEAM_PUBLISHER_WEB_API_KEY',
  'STEAM_APP_ID',
  'STEAM_AUTH_IDENTITY',
  'ALLOWED_ORIGIN',
  'PORT',
  'STEAM_AUTH_ENDPOINT',
  'STEAM_INVENTORY_ENDPOINT'
];

const requiredMicroTxnMarkers = [
  '/steam/mtx/health',
  '/steam/mtx/catalog',
  '/steam/mtx/init',
  '/steam/mtx/finalize',
  '/steam/mtx/query',
  '/steam/mtx/report',
  'InitTxn/v3',
  'FinalizeTxn/v2',
  'QueryTxn/v2',
  'GetReport/v5',
  'STEAM_PUBLISHER_WEB_API_KEY',
  'STEAM_APP_ID',
  '4788490'
];

const requiredInventoryMarkers = [
  '/health',
  '/steam/authenticate',
  '/steam/inventory/owned',
  'AuthenticateUserTicket',
  'GetInventory',
  'STEAM_PUBLISHER_WEB_API_KEY',
  'STEAM_APP_ID',
  '4788490'
];

function read(file) {
  return fs.readFileSync(path.join(backendDir, file), 'utf8');
}

function exists(file) {
  return fs.existsSync(path.join(backendDir, file));
}

function runNodeCheck(file) {
  const result = childProcess.spawnSync(process.execPath, ['--check', path.join(backendDir, file)], {
    cwd: backendDir,
    encoding: 'utf8'
  });

  return {
    file,
    ok: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim()
  };
}

function parseEnvKeys(text) {
  const keys = new Set();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Z0-9_]+)\s*=/);
    if (match) keys.add(match[1]);
  }
  return keys;
}

const checks = [];
const warnings = [];

checks.push({
  name: 'backend directory exists',
  ok: fs.existsSync(backendDir),
  detail: backendDir
});

for (const file of requiredFiles) {
  checks.push({
    name: `required file: ${file}`,
    ok: exists(file),
    detail: path.join(backendDir, file)
  });
}

let packageJson = null;
if (exists('package.json')) {
  packageJson = JSON.parse(read('package.json'));
  checks.push({
    name: 'package name',
    ok: packageJson.name === 'chiggas-steam-entitlement-backend',
    detail: packageJson.name
  });
  checks.push({
    name: 'node engine >=20 documented',
    ok: Boolean(packageJson.engines && packageJson.engines.node && packageJson.engines.node.includes('>=20')),
    detail: packageJson.engines || null
  });

  for (const script of requiredPackageScripts) {
    checks.push({
      name: `backend package script: ${script}`,
      ok: Boolean(packageJson.scripts && packageJson.scripts[script]),
      detail: packageJson.scripts ? packageJson.scripts[script] || null : null
    });
  }

  for (const dep of ['express', 'cors', 'helmet', 'dotenv']) {
    checks.push({
      name: `backend dependency: ${dep}`,
      ok: Boolean(packageJson.dependencies && packageJson.dependencies[dep]),
      detail: packageJson.dependencies ? packageJson.dependencies[dep] || null : null
    });
  }
}

if (exists('.env.example')) {
  const envExample = read('.env.example');
  const envKeys = parseEnvKeys(envExample);

  for (const key of requiredEnvExampleKeys) {
    checks.push({
      name: `.env.example key: ${key}`,
      ok: envKeys.has(key),
      detail: key
    });
  }

  checks.push({
    name: '.env.example uses Steam app id 4788490',
    ok: /^STEAM_APP_ID\s*=\s*4788490\s*$/m.test(envExample),
    detail: 'STEAM_APP_ID=4788490'
  });
}

if (exists('steam-microtxn-pass-99a-server.js')) {
  const microTxnServer = read('steam-microtxn-pass-99a-server.js');
  for (const marker of requiredMicroTxnMarkers) {
    checks.push({
      name: `MicroTxn server marker: ${marker}`,
      ok: microTxnServer.includes(marker),
      detail: marker
    });
  }

  checks.push({
    name: 'MicroTxn server avoids sandbox endpoint',
    ok: !microTxnServer.includes('ISteamMicroTxnSandbox'),
    detail: 'real ISteamMicroTxn partner endpoints'
  });
}

if (exists('server.js')) {
  const inventoryServer = read('server.js');
  for (const marker of requiredInventoryMarkers) {
    checks.push({
      name: `inventory server marker: ${marker}`,
      ok: inventoryServer.includes(marker),
      detail: marker
    });
  }
}

for (const file of ['server.js', 'steam-microtxn-pass-99a-server.js', path.join('scripts', 'health-check.js')]) {
  if (!exists(file)) continue;
  const syntax = runNodeCheck(file);
  checks.push({
    name: `node syntax: ${file}`,
    ok: syntax.ok,
    detail: syntax.ok ? 'syntax ok' : syntax.stderr || syntax.stdout
  });
}

if (!exists('.env')) {
  warnings.push({
    name: 'local .env not present',
    detail: 'Expected on a deployment/test machine, but intentionally ignored by Git.'
  });
}

if (exists('.env')) {
  const env = read('.env');
  const hasRealPublisherKey = /^STEAM_PUBLISHER_WEB_API_KEY\s*=\s*(?!\s*$|REPLACE|your_real|YOUR_REAL|placeholder)/im.test(env);
  if (!hasRealPublisherKey) {
    warnings.push({
      name: 'local publisher key not configured',
      detail: 'Add STEAM_PUBLISHER_WEB_API_KEY to integrations\\steam\\entitlement-backend\\.env before live Wallet testing.'
    });
  }
}

const failed = checks.filter((check) => !check.ok);
const ok = failed.length === 0;

console.log(JSON.stringify({
  ok,
  status: ok ? 'steam_backend_ready' : 'steam_backend_not_ready',
  backendDir,
  checks,
  failed,
  warnings
}, null, 2));

process.exit(ok ? 0 : 1);
