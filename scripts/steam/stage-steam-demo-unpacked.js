const fs = require('fs');
const path = require('path');
const { ROOT } = require('../lib/paths');

const sourceDir = path.join(ROOT, 'platforms', 'steam-electron', 'dist', 'win-unpacked');
const demoDir = path.join(ROOT, 'platforms', 'steam-electron', 'dist', 'win-demo-unpacked');
const markerFile = path.join(demoDir, 'chiggas-demo-mode.flag');
const exeName = 'Chiggas - Survival of the Mitiest.exe';
const demoExeName = 'Chiggas - Survival of the Mitiest DEMO.exe';

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

const exePath = path.join(demoDir, exeName);
const demoExePath = path.join(demoDir, demoExeName);
if (fs.existsSync(exePath)) {
  fs.copyFileSync(exePath, demoExePath);
}

console.log(JSON.stringify({
  ok: true,
  status: 'steam_demo_unpacked_staged',
  sourceDir,
  demoDir,
  markerFile,
  demoExePath: fs.existsSync(demoExePath) ? demoExePath : null
}, null, 2));
