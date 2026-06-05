const path = require('path');
const {
  ROOT,
  GAME_DIR,
  STEAM_DIR,
  ANDROID_DIR,
  STEAM_INTEGRATIONS_DIR
} = require('../lib/paths');
const { exists } = require('../lib/file-utils');

const required = [
  ['root package', path.join(ROOT, 'package.json')],
  ['game index', path.join(GAME_DIR, 'index.html')],
  ['game main', path.join(GAME_DIR, 'main.js')],
  ['game config', path.join(GAME_DIR, 'config.js')],
  ['game GameScene', path.join(GAME_DIR, 'scenes', 'GameScene.js')],
  ['steam package', path.join(STEAM_DIR, 'package.json')],
  ['steam main', path.join(STEAM_DIR, 'main.js')],
  ['steam preload', path.join(STEAM_DIR, 'preload.js')],
  ['steam input manifest', path.join(STEAM_INTEGRATIONS_DIR, 'input', 'game_actions_4788490.vdf')],
  ['steam achievements map', path.join(STEAM_INTEGRATIONS_DIR, 'achievements', 'achievements_map_v1.json')],
  ['android package', path.join(ANDROID_DIR, 'package.json')],
  ['android capacitor config', path.join(ANDROID_DIR, 'capacitor.config.json')],
  ['android manifest', path.join(ANDROID_DIR, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')],
  ['android MainActivity', path.join(ANDROID_DIR, 'android', 'app', 'src', 'main', 'java', 'com', 'krysez', 'chiggas', 'MainActivity.java')],
  ['android billing bridge', path.join(ANDROID_DIR, 'android', 'app', 'src', 'main', 'java', 'com', 'krysez', 'chiggas', 'GooglePlayBillingBridge.java')]
];

const checks = required.map(([label, file]) => ({ label, file, exists: exists(file) }));
const missing = checks.filter(check => !check.exists);
const localGeneratedChecks = [
  ['root node_modules', path.join(ROOT, 'node_modules')],
  ['android node_modules', path.join(ANDROID_DIR, 'node_modules')],
  ['android app build', path.join(ANDROID_DIR, 'android', 'app', 'build')],
  ['android gradle cache', path.join(ANDROID_DIR, 'android', '.gradle')]
].map(([label, file]) => ({ label, file, exists: exists(file), allowed: true }));

const ok = missing.length === 0;

console.log(JSON.stringify({
  ok,
  status: ok ? 'unified_project_source_ready' : 'unified_project_check_failed',
  checks,
  missing,
  localGeneratedChecks
}, null, 2));

process.exit(ok ? 0 : 1);
