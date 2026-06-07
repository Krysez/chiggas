const fs = require('fs');
const path = require('path');
const { ROOT, STEAM_DIR, ANDROID_DIR, STEAM_INTEGRATIONS_DIR } = require('../lib/paths');
const { exists } = require('../lib/file-utils');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function scriptExists(pkg, name) {
  return Boolean(pkg.scripts && pkg.scripts[name]);
}

const rootPackage = readJson(path.join(ROOT, 'package.json'));
const steamPackage = readJson(path.join(STEAM_DIR, 'package.json'));
const androidPackage = readJson(path.join(ANDROID_DIR, 'package.json'));

const steamTemplate = path.join(
  STEAM_INTEGRATIONS_DIR,
  'steamworks',
  'templates',
  'app_build_4788490_template.vdf'
);
const steamTemplateText = exists(steamTemplate) ? fs.readFileSync(steamTemplate, 'utf8') : '';
const steamVdfWriter = path.join(ROOT, 'scripts', 'steam', 'write-steampipe-vdf.js');
const steamVdfWriterText = exists(steamVdfWriter) ? fs.readFileSync(steamVdfWriter, 'utf8') : '';

const checks = [
  {
    label: 'root release check script',
    ok: ['release:check', 'release:versions', 'release:artifacts', 'steam:backend:check'].every((name) => scriptExists(rootPackage, name))
  },
  {
    label: 'root Steam build scripts',
    ok: ['steam:pack:win', 'steam:dist:win', 'steam:depot:stage', 'steam:vdf:write', 'steam:demo:depot:stage', 'steam:demo:vdf:write'].every((name) => scriptExists(rootPackage, name))
  },
  {
    label: 'root Android build scripts',
    ok: ['android:cap:copy', 'android:test', 'android:assemble:debug', 'android:assemble:release', 'android:bundle:release'].every((name) => scriptExists(rootPackage, name))
  },
  {
    label: 'Steam package build metadata',
    ok: Boolean(steamPackage.build && steamPackage.build.appId && steamPackage.build.productName && steamPackage.build.files)
  },
  {
    label: 'SteamPipe template present',
    ok: exists(steamTemplate)
  },
  {
    label: 'SteamPipe template app id',
    ok: steamTemplateText.includes('"AppID" "4788490"')
  },
  {
    label: 'SteamPipe main app and depot ids',
    ok: steamVdfWriterText.includes("appId: '4788490'") && steamVdfWriterText.includes("depotId: '4788491'")
  },
  {
    label: 'SteamPipe demo app and depot ids',
    ok: steamVdfWriterText.includes("appId: '4827370'") && steamVdfWriterText.includes("depotId: '4827371'")
  },
  {
    label: 'Android release script',
    ok: scriptExists(androidPackage, 'android:assemble:release')
  },
  {
    label: 'Android bundle script',
    ok: scriptExists(androidPackage, 'android:bundle:release')
  },
  {
    label: 'Android app identity',
    ok: exists(path.join(ANDROID_DIR, 'android', 'app', 'build.gradle'))
  }
];

const failed = checks.filter((check) => !check.ok);
const warnings = [];

console.log(JSON.stringify({
  ok: failed.length === 0,
  status: failed.length === 0 ? 'release_readiness_ready' : 'release_readiness_failed',
  checks,
  warnings
}, null, 2));

process.exit(failed.length === 0 ? 0 : 1);
