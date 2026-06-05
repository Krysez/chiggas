const fs = require('fs');
const os = require('os');
const path = require('path');
const { GAME_DIR, ANDROID_DIR, ANDROID_WWW_DIR, ANDROID_PUBLIC_DIR } = require('../lib/paths');
const { copyDir, copyMissingFiles, ensureDir, exists, removeDir } = require('../lib/file-utils');

function main() {
  if (!exists(GAME_DIR)) throw new Error(`Missing game directory: ${GAME_DIR}`);
  if (!exists(ANDROID_DIR)) throw new Error(`Missing Android platform directory: ${ANDROID_DIR}`);

  copyDir(GAME_DIR, ANDROID_WWW_DIR);

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
  const restored = copyMissingFiles(preservedPublicRoot, ANDROID_PUBLIC_DIR);
  removeDir(preservedPublicRoot);

  console.log(JSON.stringify({
    ok: true,
    status: 'android_game_synced',
    source: GAME_DIR,
    webDir: ANDROID_WWW_DIR,
    nativePublicDir: ANDROID_PUBLIC_DIR,
    preservedPublicHelpers: preserved,
    restoredPublicHelpers: restored
  }, null, 2));
}

main();
