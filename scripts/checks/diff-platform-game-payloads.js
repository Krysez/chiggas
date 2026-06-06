const { GAME_DIR, STEAM_GAME_DIR, ANDROID_WWW_DIR, ANDROID_PUBLIC_DIR } = require('../lib/paths');
const { exists, hashFile, listFiles } = require('../lib/file-utils');

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

function comparableFiles(root, options = {}) {
  const androidProjection = options.androidProjection === true;
  return listFiles(root, {
    exclude: (rel, entry) => {
      const normalized = rel.replace(/\\/g, '/');
      return entry.isDirectory() && ['node_modules'].includes(entry.name) ||
        normalized === 'vendor/phaser/phaser.esm.js' ||
        normalized === 'cordova.js' ||
        normalized === 'cordova_plugins.js' ||
        (androidProjection && ANDROID_EXCLUDED_FILES.has(entry.name));
    }
  });
}

function comparableHash(file, options = {}) {
  if (options.androidProjection && file.rel.replace(/\\/g, '/') === 'index.html') {
    const crypto = require('crypto');
    const fs = require('fs');
    return crypto.createHash('sha256').update(stripAndroidOnlyHtml(fs.readFileSync(file.full, 'utf8'))).digest('hex');
  }

  return hashFile(file.full);
}

function diffAgainst(label, root, options = {}) {
  if (!exists(root)) {
    return { label, root, ok: false, status: 'missing_payload', same: 0, different: [], missing: [], extra: [] };
  }

  const sourceFiles = comparableFiles(GAME_DIR, options);
  const targetFiles = comparableFiles(root, options);
  const targetFileByRel = new Map(targetFiles.map(file => [file.rel, file]));
  const sourceByRel = new Map(sourceFiles.map(file => [file.rel, file.full]));
  const different = [];
  const missing = [];
  let same = 0;

  for (const file of sourceFiles) {
    const target = targetFileByRel.get(file.rel);
    if (!target) missing.push(file.rel);
    else if (comparableHash(file, options) === comparableHash(target, options)) same += 1;
    else different.push(file.rel);
  }

  const extra = targetFiles.filter(file => !sourceByRel.has(file.rel)).map(file => file.rel);
  const ok = different.length === 0 && missing.length === 0 && extra.length === 0;
  return { label, root, ok, status: ok ? 'payload_matches_game' : 'payload_differs', same, different, missing, extra };
}

function main() {
  const results = [
    diffAgainst('steam', STEAM_GAME_DIR),
    diffAgainst('android-www', ANDROID_WWW_DIR, { androidProjection: true }),
    diffAgainst('android-public', ANDROID_PUBLIC_DIR, { androidProjection: true })
  ];
  const ok = results.every(result => result.ok);
  console.log(JSON.stringify({ ok, status: ok ? 'platform_payloads_match' : 'platform_payloads_differ', results }, null, 2));
  process.exit(ok ? 0 : 1);
}

main();
