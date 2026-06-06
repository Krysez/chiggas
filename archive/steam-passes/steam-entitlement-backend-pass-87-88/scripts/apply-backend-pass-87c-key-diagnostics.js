const fs = require('fs');
const path = require('path');

const PASS = 'steam_inventory_entitlement_backend_pass_87c';
const ROOT = process.cwd();
const SERVER_PATH = path.join(ROOT, 'server.js');
const PACKAGE_PATH = path.join(ROOT, 'package.json');

function out(payload, code = 0) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(code);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

try {
  if (!fs.existsSync(SERVER_PATH)) {
    return out({
      ok: false,
      pass: PASS,
      status: 'backend_pass_87c_apply_failed',
      error: 'server.js not found. Run from C:\\ChiggaStreamWrapper\\steam-entitlement-backend.'
    }, 1);
  }

  if (!fs.existsSync(PACKAGE_PATH)) {
    return out({
      ok: false,
      pass: PASS,
      status: 'backend_pass_87c_apply_failed',
      error: 'package.json not found. Run from C:\\ChiggaStreamWrapper\\steam-entitlement-backend.'
    }, 1);
  }

  const backupRoot = path.join(ROOT, `backup-${PASS}-${Date.now()}`);
  fs.mkdirSync(backupRoot, { recursive: true });
  fs.copyFileSync(SERVER_PATH, path.join(backupRoot, 'server.js'));
  fs.copyFileSync(PACKAGE_PATH, path.join(backupRoot, 'package.json'));

  let pkg = JSON.parse(read(PACKAGE_PATH));
  pkg.dependencies = pkg.dependencies || {};
  pkg.dependencies.dotenv = pkg.dependencies.dotenv || '^16.4.7';
  write(PACKAGE_PATH, JSON.stringify(pkg, null, 2) + '\n');

  let server = read(SERVER_PATH);

  if (!server.includes("require('dotenv').config()") && !server.includes('require("dotenv").config()')) {
    server = "require('dotenv').config();\n" + server;
  }

  server = server.replace(
    /const STEAM_PUBLISHER_WEB_API_KEY\s*=\s*process\.env\.STEAM_PUBLISHER_WEB_API_KEY\s*\|\|\s*'';/,
    "const STEAM_PUBLISHER_WEB_API_KEY = String(process.env.STEAM_PUBLISHER_WEB_API_KEY || '').trim();"
  );

  if (!server.includes("String(process.env.STEAM_PUBLISHER_WEB_API_KEY || '').trim()")) {
    return out({
      ok: false,
      pass: PASS,
      status: 'backend_pass_87c_apply_failed',
      error: 'Could not patch STEAM_PUBLISHER_WEB_API_KEY line. server.js structure did not match expected Pass 87/87A source.'
    }, 1);
  }

  if (!server.includes('function maskPublisherKeyForHealth()')) {
    const insertAfter = "function envReady() {\n  return Boolean(STEAM_PUBLISHER_WEB_API_KEY && STEAM_PUBLISHER_WEB_API_KEY.length >= 20);\n}\n";
    const helper = `
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
`;
    if (!server.includes(insertAfter)) {
      return out({
        ok: false,
        pass: PASS,
        status: 'backend_pass_87c_apply_failed',
        error: 'Could not find envReady helper anchor in server.js.'
      }, 1);
    }
    server = server.replace(insertAfter, insertAfter + helper);
  }

  if (!server.includes('publisherKeyDiagnostics')) {
    server = server.replace(
      /publisherKeyConfigured:\s*Boolean\(STEAM_PUBLISHER_WEB_API_KEY\),/,
      "publisherKeyConfigured: Boolean(STEAM_PUBLISHER_WEB_API_KEY),\n    publisherKeyDiagnostics: maskPublisherKeyForHealth(),"
    );
  }

  write(SERVER_PATH, server);

  out({
    ok: true,
    pass: PASS,
    status: 'backend_pass_87c_key_trim_and_health_diagnostics_applied',
    root: ROOT,
    backupRoot,
    changed: {
      dotenvDependencyPresent: true,
      dotenvLoaderPresent: true,
      publisherKeyTrimmed: true,
      healthShowsSafeKeyDiagnostics: true
    },
    nextCommands: [
      'npm install',
      'node scripts\\check-backend-pass-87c-key-diagnostics.js',
      'npm start'
    ]
  });
} catch (error) {
  out({
    ok: false,
    pass: PASS,
    status: 'backend_pass_87c_apply_exception',
    error: error.message || String(error)
  }, 1);
}