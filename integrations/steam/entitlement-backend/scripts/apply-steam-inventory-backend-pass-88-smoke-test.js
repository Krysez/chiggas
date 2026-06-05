const fs = require('fs');
const path = require('path');

const PASS = 'steam_inventory_backend_pass_88';
const ROOT = process.cwd();
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const TEST_SCRIPT = 'scripts/check-steam-inventory-backend-pass-88-smoke.js';
const SCRIPT_NAME = 'steam:backend:inventory-smoke';

function out(payload, code = 0) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(code);
}

try {
  if (!fs.existsSync(PACKAGE_PATH)) {
    return out({
      ok: false,
      pass: PASS,
      status: 'steam_backend_inventory_pass_88_apply_failed',
      error: 'package.json not found. Run this from C:\\ChiggaStreamWrapper.'
    }, 1);
  }

  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  pkg.scripts = pkg.scripts || {};

  const backupPath = path.join(ROOT, `package.backup-${PASS}-${Date.now()}.json`);
  fs.copyFileSync(PACKAGE_PATH, backupPath);

  pkg.scripts[SCRIPT_NAME] = `node ${TEST_SCRIPT}`;
  fs.writeFileSync(PACKAGE_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  out({
    ok: true,
    pass: PASS,
    status: 'steam_backend_inventory_pass_88_smoke_script_added',
    script: SCRIPT_NAME,
    smokeScript: TEST_SCRIPT,
    packageBackup: backupPath,
    backendUrlDefault: 'http://localhost:8080',
    nextCommand: `npm run ${SCRIPT_NAME}`,
    note: 'Backend must be running in a separate PowerShell window before this test.'
  });
} catch (error) {
  out({
    ok: false,
    pass: PASS,
    status: 'steam_backend_inventory_pass_88_apply_exception',
    error: error.message || String(error)
  }, 1);
}