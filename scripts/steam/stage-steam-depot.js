const fs = require('fs');
const path = require('path');
const { STEAM_DIR } = require('../lib/paths');
const { exists } = require('../lib/file-utils');

const source = path.join(STEAM_DIR, 'dist', 'win-unpacked');
const target = path.join(STEAM_DIR, 'steam_depot_build', 'windows');

function copyRecursive(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

if (!exists(source)) {
  console.error(`Missing Electron Builder output: ${source}`);
  console.error('Run `npm run steam:pack:win` before staging the Steam depot.');
  process.exit(1);
}

if (exists(target)) {
  fs.rmSync(target, { recursive: true, force: true });
}

copyRecursive(source, target);

console.log(JSON.stringify({
  ok: true,
  status: 'steam_depot_staged',
  source,
  target
}, null, 2));
