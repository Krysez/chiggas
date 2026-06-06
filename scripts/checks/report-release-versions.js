const fs = require('fs');
const path = require('path');
const { ROOT, STEAM_DIR, ANDROID_DIR } = require('../lib/paths');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function matchRequired(text, regex, label) {
  const match = text.match(regex);
  if (!match) throw new Error(`Unable to read ${label}`);
  return match[1];
}

const rootPackage = readJson(path.join(ROOT, 'package.json'));
const steamPackage = readJson(path.join(STEAM_DIR, 'package.json'));
const androidPackage = readJson(path.join(ANDROID_DIR, 'package.json'));
const androidBuildGradle = fs.readFileSync(path.join(ANDROID_DIR, 'android', 'app', 'build.gradle'), 'utf8');

const androidVersionCode = Number(matchRequired(androidBuildGradle, /versionCode\s+(\d+)/, 'Android versionCode'));
const androidVersionName = matchRequired(androidBuildGradle, /versionName\s+"([^"]+)"/, 'Android versionName');

console.log(JSON.stringify({
  ok: true,
  status: 'release_versions_report',
  root: {
    package: 'package.json',
    version: rootPackage.version
  },
  steam: {
    package: 'platforms/steam-electron/package.json',
    version: steamPackage.version,
    productName: steamPackage.build?.productName || null,
    artifactName: steamPackage.build?.win?.artifactName || null
  },
  android: {
    package: 'platforms/android-capacitor/package.json',
    packageVersion: androidPackage.version,
    buildFile: 'platforms/android-capacitor/android/app/build.gradle',
    versionCode: androidVersionCode,
    versionName: androidVersionName,
    applicationId: matchRequired(androidBuildGradle, /applicationId\s+"([^"]+)"/, 'Android applicationId')
  },
  notes: [
    'Google Play requires versionCode to increase for every uploaded release.',
    'Steam builds can reuse app versioning, but a clear Steam package version keeps artifacts easier to identify.'
  ]
}, null, 2));
