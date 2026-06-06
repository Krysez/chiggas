const fs = require('fs');
const path = require('path');
const { ROOT, STEAM_DIR, ANDROID_DIR, STEAM_INTEGRATIONS_DIR } = require('../lib/paths');
const { exists } = require('../lib/file-utils');

const requiredIgnorePatterns = [
  'node_modules/',
  '**/node_modules/',
  'platforms/steam-electron/dist/',
  'platforms/android-capacitor/android/.gradle/',
  'platforms/android-capacitor/android/app/build/',
  'platforms/android-capacitor/android/local.properties',
  '*.log',
  '.env'
];

const ignoredLocalChecks = [
  ['root node_modules', path.join(ROOT, 'node_modules')],
  ['root dist', path.join(ROOT, 'dist')],
  ['root build', path.join(ROOT, 'build')],
  ['steam node_modules', path.join(STEAM_DIR, 'node_modules')],
  ['steam dist', path.join(STEAM_DIR, 'dist')],
  ['steam out', path.join(STEAM_DIR, 'out')],
  ['steam build', path.join(STEAM_DIR, 'build')],
  ['android node_modules', path.join(ANDROID_DIR, 'node_modules')],
  ['android gradle cache', path.join(ANDROID_DIR, 'android', '.gradle')],
  ['android project build', path.join(ANDROID_DIR, 'android', 'build')],
  ['android app build', path.join(ANDROID_DIR, 'android', 'app', 'build')],
  ['steam backend node_modules', path.join(STEAM_INTEGRATIONS_DIR, 'entitlement-backend', 'node_modules')],
  ['steam backend data', path.join(STEAM_INTEGRATIONS_DIR, 'entitlement-backend', 'data')],
  ['steam backend backups', path.join(STEAM_INTEGRATIONS_DIR, 'entitlement-backend', 'backups')],
];

const requiredIgnoreFiles = [
  ['root gitignore', path.join(ROOT, '.gitignore')],
  ['steam gitignore', path.join(STEAM_DIR, '.gitignore')],
  ['steam backend gitignore', path.join(STEAM_INTEGRATIONS_DIR, 'entitlement-backend', '.gitignore')],
  ['android gitignore', path.join(ANDROID_DIR, 'android', '.gitignore')],
  ['android app gitignore', path.join(ANDROID_DIR, 'android', 'app', '.gitignore')]
];

const rootIgnore = exists(path.join(ROOT, '.gitignore'))
  ? fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8')
  : '';

const ignorePatternChecks = requiredIgnorePatterns.map(pattern => ({
  pattern,
  ok: rootIgnore.includes(pattern)
}));

const ignoreFileChecks = requiredIgnoreFiles.map(([label, file]) => ({
  label,
  file,
  exists: exists(file)
}));

const ignoredLocalGeneratedChecks = ignoredLocalChecks.map(([label, file]) => ({
  label,
  file,
  exists: exists(file),
  allowed: true
}));

const allowedLocalChecks = [
  {
    label: 'android local properties allowed',
    file: path.join(ANDROID_DIR, 'android', 'local.properties'),
    note: 'Machine-specific Android SDK path file; ignored by git and allowed to exist locally.',
    allowed: true,
    exists: exists(path.join(ANDROID_DIR, 'android', 'local.properties'))
  }
];

const ok = ignorePatternChecks.every(check => check.ok)
  && ignoreFileChecks.every(check => check.exists);

console.log(JSON.stringify({
  ok,
  status: ok ? 'source_hygiene_ready' : 'source_hygiene_check_failed',
  ignoreFileChecks,
  ignorePatternChecks,
  ignoredLocalGeneratedChecks,
  allowedLocalChecks,
  failed: {
    missingIgnoreFiles: ignoreFileChecks.filter(check => !check.exists),
    missingRootIgnorePatterns: ignorePatternChecks.filter(check => !check.ok),
    generatedPresent: []
  }
}, null, 2));

process.exit(ok ? 0 : 1);
