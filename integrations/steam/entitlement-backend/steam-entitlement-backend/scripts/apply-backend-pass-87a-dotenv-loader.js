const fs = require('fs');
const path = require('path');

const PASS = 'steam_inventory_entitlement_backend_pass_87a';
const ROOT = process.cwd();
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const SERVER_PATH = path.join(ROOT, 'server.js');

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
  if (!fs.existsSync(PACKAGE_PATH)) {
    return out({
      ok: false,
      pass: PASS,
      status: 'backend_pass_87a_apply_failed',
      error: 'package.json not found. Run this from C:\\ChiggaStreamWrapper\\steam-entitlement-backend.'
    }, 1);
  }

  if (!fs.existsSync(SERVER_PATH)) {
    return out({
      ok: false,
      pass: PASS,
      status: 'backend_pass_87a_apply_failed',
      error: 'server.js not found. Run this from C:\\ChiggaStreamWrapper\\steam-entitlement-backend.'
    }, 1);
  }

  const backupRoot = path.join(ROOT, `backup-${PASS}-${Date.now()}`);
  fs.mkdirSync(backupRoot, { recursive: true });
  fs.copyFileSync(PACKAGE_PATH, path.join(backupRoot, 'package.json'));
  fs.copyFileSync(SERVER_PATH, path.join(backupRoot, 'server.js'));

  const pkg = JSON.parse(read(PACKAGE_PATH));
  pkg.dependencies = pkg.dependencies || {};
  pkg.dependencies.dotenv = pkg.dependencies.dotenv || '^16.4.7';
  write(PACKAGE_PATH, JSON.stringify(pkg, null, 2) + '\n');

  let server = read(SERVER_PATH);
  if (!server.includes("require('dotenv').config()") && !server.includes('require("dotenv").config()')) {
    server = "require('dotenv').config();\n" + server;
  }

  write(SERVER_PATH, server);

  out({
    ok: true,
    pass: PASS,
    status: 'backend_pass_87a_dotenv_loader_applied',
    root: ROOT,
    backupRoot,
    changed: {
      packageAddedDotenv: true,
      serverLoadsDotenv: true
    },
    nextCommands: [
      'npm install',
      'npm start'
    ]
  });
} catch (error) {
  out({
    ok: false,
    pass: PASS,
    status: 'backend_pass_87a_apply_exception',
    error: error.message || String(error)
  }, 1);
}