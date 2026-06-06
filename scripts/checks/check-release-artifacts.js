const fs = require('fs');
const path = require('path');
const { ROOT, STEAM_DIR, ANDROID_DIR, STEAM_INTEGRATIONS_DIR } = require('../lib/paths');

const artifacts = [
  {
    label: 'Steam unpacked executable',
    platform: 'steam',
    required: true,
    buildCommand: 'npm run steam:pack:win',
    file: path.join(STEAM_DIR, 'dist', 'win-unpacked', 'Chiggas - Survival of the Mitiest.exe')
  },
  {
    label: 'Steam unpacked app archive',
    platform: 'steam',
    required: true,
    buildCommand: 'npm run steam:pack:win',
    file: path.join(STEAM_DIR, 'dist', 'win-unpacked', 'resources', 'app.asar')
  },
  {
    label: 'SteamPipe staged executable',
    platform: 'steam',
    required: true,
    buildCommand: 'npm run steam:depot:stage',
    file: path.join(STEAM_DIR, 'steam_depot_build', 'windows', 'Chiggas - Survival of the Mitiest.exe')
  },
  {
    label: 'SteamPipe staged app archive',
    platform: 'steam',
    required: true,
    buildCommand: 'npm run steam:depot:stage',
    file: path.join(STEAM_DIR, 'steam_depot_build', 'windows', 'resources', 'app.asar')
  },
  {
    label: 'SteamPipe generated VDF',
    platform: 'steam',
    required: false,
    buildCommand: 'set CHIGGAS_STEAM_WINDOWS_DEPOT_ID, then npm run steam:vdf:write',
    file: path.join(STEAM_INTEGRATIONS_DIR, 'steamworks', 'generated', 'app_build_4788490.vdf')
  },
  {
    label: 'Android debug APK',
    platform: 'android',
    required: true,
    buildCommand: 'npm run android:assemble:debug',
    file: path.join(ANDROID_DIR, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
  },
  {
    label: 'Android unsigned release APK',
    platform: 'android',
    required: true,
    buildCommand: 'npm run android:assemble:release',
    file: path.join(ANDROID_DIR, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk')
  },
  {
    label: 'Android release bundle',
    platform: 'android',
    required: true,
    buildCommand: 'npm run android:bundle:release',
    file: path.join(ANDROID_DIR, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
  }
];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function inspectArtifact(artifact) {
  if (!fs.existsSync(artifact.file)) {
    return {
      ...artifact,
      file: path.relative(ROOT, artifact.file).replace(/\\/g, '/'),
      absoluteFile: artifact.file,
      exists: false,
      sizeBytes: null,
      size: null,
      modifiedAt: null
    };
  }

  const stat = fs.statSync(artifact.file);
  return {
    ...artifact,
    file: path.relative(ROOT, artifact.file).replace(/\\/g, '/'),
    absoluteFile: artifact.file,
    exists: true,
    sizeBytes: stat.size,
    size: formatBytes(stat.size),
    modifiedAt: stat.mtime.toISOString()
  };
}

const results = artifacts.map(inspectArtifact);
const missingRequired = results.filter((artifact) => artifact.required && !artifact.exists);
const missingOptional = results.filter((artifact) => !artifact.required && !artifact.exists);

console.log(JSON.stringify({
  ok: missingRequired.length === 0,
  status: missingRequired.length === 0 ? 'release_artifacts_ready' : 'release_artifacts_missing',
  root: ROOT,
  artifacts: results,
  missingRequired,
  warnings: missingOptional.map((artifact) => ({
    label: artifact.label,
    detail: `Optional generated artifact is missing. ${artifact.buildCommand}`
  }))
}, null, 2));

process.exit(missingRequired.length === 0 ? 0 : 1);
