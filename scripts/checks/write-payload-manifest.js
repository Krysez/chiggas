const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  ROOT,
  GAME_DIR,
  STEAM_GAME_DIR,
  ANDROID_WWW_DIR,
  ANDROID_PUBLIC_DIR
} = require('../lib/paths');
const { ensureDir, exists, hashFile, listFiles } = require('../lib/file-utils');

function isExcluded(rel, entry) {
  const normalized = rel.replace(/\\/g, '/');
  return (entry && entry.isDirectory() && entry.name === 'node_modules')
    || normalized === 'vendor/phaser/phaser.esm.js'
    || normalized === 'cordova.js'
    || normalized === 'cordova_plugins.js';
}

function payloadManifest(label, root) {
  if (!exists(root)) {
    return {
      label,
      root,
      ok: false,
      status: 'missing_payload',
      fileCount: 0,
      combinedHash: null,
      files: []
    };
  }

  const files = listFiles(root, { exclude: isExcluded })
    .map(file => ({
      path: file.rel.replace(/\\/g, '/'),
      sha256: hashFile(file.full)
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const combinedHash = crypto
    .createHash('sha256')
    .update(files.map(file => `${file.path}\0${file.sha256}`).join('\n'))
    .digest('hex');

  return {
    label,
    root,
    ok: true,
    status: 'payload_manifest_ready',
    fileCount: files.length,
    combinedHash,
    files
  };
}

const payloads = [
  payloadManifest('game', GAME_DIR),
  payloadManifest('steam', STEAM_GAME_DIR),
  payloadManifest('android-www', ANDROID_WWW_DIR),
  payloadManifest('android-public', ANDROID_PUBLIC_DIR)
];

const sourceHash = payloads[0].combinedHash;
const comparisons = payloads.slice(1).map(payload => ({
  label: payload.label,
  matchesGame: payload.combinedHash === sourceHash,
  combinedHash: payload.combinedHash
}));

const ok = payloads.every(payload => payload.ok) && comparisons.every(item => item.matchesGame);
const manifest = {
  ok,
  status: ok ? 'payload_manifest_written' : 'payload_manifest_mismatch',
  generatedAt: new Date().toISOString(),
  exclusions: [
    'vendor/phaser/phaser.esm.js',
    'cordova.js',
    'cordova_plugins.js',
    'node_modules/'
  ],
  payloads,
  comparisons
};

const outputPath = path.join(ROOT, 'docs', 'payload-manifest.json');
ensureDir(path.dirname(outputPath));
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  ok,
  status: manifest.status,
  outputPath,
  generatedAt: manifest.generatedAt,
  payloads: payloads.map(payload => ({
    label: payload.label,
    fileCount: payload.fileCount,
    combinedHash: payload.combinedHash
  })),
  comparisons
}, null, 2));

process.exit(ok ? 0 : 1);
