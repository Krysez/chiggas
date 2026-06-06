const fs = require('fs');
const path = require('path');
const { STEAM_DIR } = require('../lib/paths');
const { exists } = require('../lib/file-utils');

const source = path.join(STEAM_DIR, 'dist', 'win-unpacked');
const target = path.join(STEAM_DIR, 'steam_depot_build', 'windows');

function normalizeRel(rel) {
  return rel.replace(/\\/g, '/');
}

function shouldExclude(rel, entry) {
  const normalized = normalizeRel(rel);
  const base = path.basename(normalized);
  if (entry.isDirectory()) return false;

  return normalized.endsWith('.log')
    || /^pass\d+[a-z0-9-]*(trace|history)[a-z0-9-]*\.jsonl?$/i.test(base)
    || /^steam-achievement-.*trace.*\.(json|log)$/i.test(base)
    || /^chiggas-.*trace.*\.(json|log)$/i.test(base);
}

function copyRecursive(from, to, rel = '') {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const entryRel = rel ? path.join(rel, entry.name) : entry.name;
    if (shouldExclude(entryRel, entry)) continue;

    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(src, dest, entryRel);
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
