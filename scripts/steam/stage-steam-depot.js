const fs = require('fs');
const path = require('path');
const { STEAM_DIR } = require('../lib/paths');
const { exists } = require('../lib/file-utils');

const demoBuild = process.env.CHIGGAS_STEAM_DEMO_BUILD === '1' || process.env.STEAM_DEMO === '1';
const targetName = demoBuild ? 'demo' : 'main';
const source = path.join(STEAM_DIR, 'dist', demoBuild ? 'win-demo-unpacked' : 'win-unpacked');
const target = path.join(STEAM_DIR, 'steam_depot_build', targetName, 'windows');

function normalizeRel(rel) {
  return rel.replace(/\\/g, '/');
}

function shouldExclude(rel, entry) {
  const normalized = normalizeRel(rel);
  const base = path.basename(normalized);
  if (entry.isDirectory()) return false;

  return normalized.endsWith('.log')
    || /^pass\d+[a-z0-9-]*.*(trace|history).*\.jsonl?$/i.test(base)
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
  console.error(demoBuild
    ? 'Run `npm run steam:demo:stage` before staging the Steam demo depot.'
    : 'Run `npm run steam:pack:win` before staging the Steam depot.');
  process.exit(1);
}

if (exists(target)) {
  fs.rmSync(target, { recursive: true, force: true });
}

copyRecursive(source, target);

console.log(JSON.stringify({
  ok: true,
  status: demoBuild ? 'steam_demo_depot_staged' : 'steam_depot_staged',
  demoBuild,
  targetName,
  source,
  target
}, null, 2));
