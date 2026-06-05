const fs = require('fs');
const path = require('path');

const PASS = 'steam_inventory_entitlement_backend_pass_87a';
const ROOT = process.cwd();
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const SERVER_PATH = path.join(ROOT, 'server.js');
const ENV_PATH = path.join(ROOT, '.env');

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (_) { return ''; }
}

let pkg = {};
try { pkg = JSON.parse(read(PACKAGE_PATH)); } catch (_) {}

const server = read(SERVER_PATH);
const env = read(ENV_PATH);

const checks = {
  packageExists: fs.existsSync(PACKAGE_PATH),
  serverExists: fs.existsSync(SERVER_PATH),
  dotenvDependencyPresent: !!pkg.dependencies?.dotenv,
  serverLoadsDotenv: server.includes("require('dotenv').config()") || server.includes('require("dotenv").config()'),
  envFileExists: fs.existsSync(ENV_PATH),
  envHasPublisherKeyLine: /STEAM_PUBLISHER_WEB_API_KEY\s*=/.test(env),
  envPublisherKeyNotPlaceholder: /STEAM_PUBLISHER_WEB_API_KEY\s*=\s*(?!REPLACE|your_real|$).+/i.test(env)
};

const ok = Object.values(checks).every(Boolean);

console.log(JSON.stringify({
  ok,
  pass: PASS,
  status: ok ? 'backend_pass_87a_env_loader_check_passed' : 'backend_pass_87a_env_loader_check_failed',
  root: ROOT,
  checks,
  note: 'If envPublisherKeyNotPlaceholder is false, edit .env and add your real Steamworks Publisher Web API key.'
}, null, 2));

process.exit(ok ? 0 : 1);