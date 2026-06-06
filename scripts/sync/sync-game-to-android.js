const fs = require('fs');
const os = require('os');
const path = require('path');
const { GAME_DIR, ANDROID_DIR, ANDROID_WWW_DIR, ANDROID_PUBLIC_DIR } = require('../lib/paths');
const { copyDir, copyMissingFiles, ensureDir, exists, removeDir } = require('../lib/file-utils');

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

function scrubAndroidPayload(root) {
  let removedFiles = 0;
  for (const name of ANDROID_EXCLUDED_FILES) {
    const target = path.join(root, name);
    if (exists(target)) {
      fs.rmSync(target, { force: true });
      removedFiles += 1;
    }
  }

  const htmlPath = path.join(root, 'index.html');
  if (exists(htmlPath)) {
    fs.writeFileSync(htmlPath, stripAndroidOnlyHtml(fs.readFileSync(htmlPath, 'utf8')));
  }

  return removedFiles;
}

function main() {
  if (!exists(GAME_DIR)) throw new Error(`Missing game directory: ${GAME_DIR}`);
  if (!exists(ANDROID_DIR)) throw new Error(`Missing Android platform directory: ${ANDROID_DIR}`);

  copyDir(GAME_DIR, ANDROID_WWW_DIR);
  const removedWwwSteamFiles = scrubAndroidPayload(ANDROID_WWW_DIR);

  const preservedPublicRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'chiggas-public-helpers-'));
  const helperNames = ['cordova.js', 'cordova_plugins.js'];
  let preserved = 0;
  if (exists(ANDROID_PUBLIC_DIR)) {
    for (const name of helperNames) {
      const source = path.join(ANDROID_PUBLIC_DIR, name);
      if (exists(source)) {
        ensureDir(preservedPublicRoot);
        fs.copyFileSync(source, path.join(preservedPublicRoot, name));
        preserved += 1;
      }
    }
  }

  copyDir(GAME_DIR, ANDROID_PUBLIC_DIR);
  const removedPublicSteamFiles = scrubAndroidPayload(ANDROID_PUBLIC_DIR);
  const restored = copyMissingFiles(preservedPublicRoot, ANDROID_PUBLIC_DIR);
  removeDir(preservedPublicRoot);

  console.log(JSON.stringify({
    ok: true,
    status: 'android_game_synced',
    source: GAME_DIR,
    webDir: ANDROID_WWW_DIR,
    nativePublicDir: ANDROID_PUBLIC_DIR,
    preservedPublicHelpers: preserved,
    restoredPublicHelpers: restored,
    removedWwwSteamFiles,
    removedPublicSteamFiles
  }, null, 2));
}

main();
