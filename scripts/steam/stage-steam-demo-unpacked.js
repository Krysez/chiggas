const fs = require('fs');
const path = require('path');
const { ROOT } = require('../lib/paths');

const sourceDir = path.join(ROOT, 'platforms', 'steam-electron', 'dist', 'win-unpacked');
const demoDir = path.join(ROOT, 'platforms', 'steam-electron', 'dist', 'win-demo-unpacked');
const markerFile = path.join(demoDir, 'chiggas-demo-mode.flag');

if (!fs.existsSync(sourceDir)) {
  console.error(JSON.stringify({
    ok: false,
    status: 'steam_unpacked_build_missing',
    sourceDir
  }, null, 2));
  process.exit(1);
}

fs.rmSync(demoDir, { recursive: true, force: true });
fs.cpSync(sourceDir, demoDir, { recursive: true });
fs.writeFileSync(markerFile, 'Steam Fest score attack demo mode\n', 'utf8');

console.log(JSON.stringify({
  ok: true,
  status: 'steam_demo_unpacked_staged',
  sourceDir,
  demoDir,
  markerFile
}, null, 2));
