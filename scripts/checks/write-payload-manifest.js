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

const ANDROID_EXCLUDED_FILES = new Set([
  'SteamWalletPurchaseBridgePass99C.js',
  'WalletFailedStateFixPass102B.js',
  'WalletNoticeOverlayFixPass102A.js',
  'SteamInputRuntimeInspectorPass101A.js',
  'SteamInputCompatibilityPass101B.js',
  'ControllerReviewCompliancePass100A.js',
  'ControllerReviewCompliancePass100A1.js',
  'ControllerPromptsPass101C.js',
  'ControllerDisconnectPausePass101D.js',
  'ControllerRealPauseCursorPass101E.js',
  'ForceDisconnectPausePass101F.js',
  'StableControllerCursorPass101H.js'
]);

function stripAndroidOnlyHtml(html) {
  return html
    .split(/\r?\n/)
    .filter(line => {
      const text = line.trim();
      if (/CHIGGAS_STEAM_PASS_/i.test(text)) return false;
      return !Array.from(ANDROID_EXCLUDED_FILES).some(name => text.includes(name));
    })
    .join('\n')
    .replace(/\n+$/g, '') + '\n';
}

function isExcluded(rel, entry, options = {}) {
  const normalized = rel.replace(/\\/g, '/');
  const androidProjection = options.androidProjection === true;
  return (entry && entry.isDirectory() && entry.name === 'node_modules')
    || normalized === 'vendor/phaser/phaser.esm.js'
    || normalized === 'cordova.js'
    || normalized === 'cordova_plugins.js'
    || (androidProjection && ANDROID_EXCLUDED_FILES.has(entry.name));
}

function projectedHash(file, options = {}) {
  if (options.androidProjection && file.rel.replace(/\\/g, '/') === 'index.html') {
    return crypto.createHash('sha256').update(stripAndroidOnlyHtml(fs.readFileSync(file.full, 'utf8'))).digest('hex');
  }

  return hashFile(file.full);
}

function payloadManifest(label, root, options = {}) {
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

  const files = listFiles(root, { exclude: (rel, entry) => isExcluded(rel, entry, options) })
    .map(file => ({
      path: file.rel.replace(/\\/g, '/'),
      sha256: projectedHash(file, options)
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
  payloadManifest('android-game-projection', GAME_DIR, { androidProjection: true }),
  payloadManifest('android-www', ANDROID_WWW_DIR, { androidProjection: true }),
  payloadManifest('android-public', ANDROID_PUBLIC_DIR, { androidProjection: true })
];

const sourceHash = payloads[0].combinedHash;
const androidSourceHash = payloads.find(payload => payload.label === 'android-game-projection')?.combinedHash;
const comparisons = payloads.slice(1)
  .filter(payload => payload.label !== 'android-game-projection')
  .map(payload => {
    const expectedHash = payload.label.startsWith('android-') ? androidSourceHash : sourceHash;
    return {
      label: payload.label,
      matchesGame: payload.combinedHash === expectedHash,
      combinedHash: payload.combinedHash
    };
  });

const ok = payloads.every(payload => payload.ok) && comparisons.every(item => item.matchesGame);
const manifest = {
  ok,
  status: ok ? 'payload_manifest_written' : 'payload_manifest_mismatch',
  generatedAt: new Date().toISOString(),
  exclusions: [
    'vendor/phaser/phaser.esm.js',
    'cordova.js',
    'cordova_plugins.js',
    'node_modules/',
    'Android payloads omit Steam-only wallet/input helper scripts and use a stripped index.html.'
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
