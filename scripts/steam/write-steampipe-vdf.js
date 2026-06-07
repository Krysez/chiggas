const fs = require('fs');
const path = require('path');
const { ROOT, STEAM_INTEGRATIONS_DIR } = require('../lib/paths');

const template = path.join(
  STEAM_INTEGRATIONS_DIR,
  'steamworks',
  'templates',
  'app_build_4788490_template.vdf'
);
const outputDir = path.join(STEAM_INTEGRATIONS_DIR, 'steamworks', 'generated');

const TARGETS = {
  main: {
    appId: '4788490',
    depotId: '4788491',
    descPrefix: 'Chiggas main build'
  },
  demo: {
    appId: '4827370',
    depotId: '4827371',
    descPrefix: 'Chiggas Steam Fest demo build'
  }
};

const targetName = (process.env.CHIGGAS_STEAM_TARGET || process.env.STEAM_TARGET || 'main').toLowerCase();
const target = TARGETS[targetName];

if (!target) {
  console.error(`Unknown Steam target "${targetName}". Use "main" or "demo".`);
  process.exit(1);
}

const appId = process.env.CHIGGAS_STEAM_APP_ID || process.env.STEAM_APP_ID || target.appId;
const depotId = process.env.CHIGGAS_STEAM_WINDOWS_DEPOT_ID || process.env.STEAM_WINDOWS_DEPOT_ID || target.depotId;
const output = path.join(outputDir, `app_build_${appId}.vdf`);
const desc = process.env.CHIGGAS_STEAM_BUILD_DESC || `${target.descPrefix} ${new Date().toISOString().slice(0, 10)}`;
const setLive = process.env.CHIGGAS_STEAM_SET_LIVE || '';
const preview = process.env.CHIGGAS_STEAM_PREVIEW || '0';

if (!/^\d+$/.test(appId)) {
  console.error('Missing numeric App ID. Set CHIGGAS_STEAM_APP_ID or use CHIGGAS_STEAM_TARGET=main/demo.');
  process.exit(1);
}

if (!/^\d+$/.test(depotId)) {
  console.error('Missing numeric depot ID. Set CHIGGAS_STEAM_WINDOWS_DEPOT_ID or use CHIGGAS_STEAM_TARGET=main/demo.');
  process.exit(1);
}

const contentRoot = path.relative(outputDir, path.join(ROOT, 'platforms', 'steam-electron', 'steam_depot_build', targetName, 'windows')).replace(/\//g, '\\');
const buildOutput = path.relative(outputDir, path.join(ROOT, 'platforms', 'steam-electron', 'steam_build_output')).replace(/\//g, '\\');

const text = fs.readFileSync(template, 'utf8')
  .replace('"AppID" "4788490"', `"AppID" "${appId}"`)
  .replace('"Desc" "Chiggas Steam depot test build"', `"Desc" "${desc.replace(/"/g, "'")}"`)
  .replace('"Preview" "0"', `"Preview" "${preview}"`)
  .replace('"SetLive" ""', `"SetLive" "${setLive.replace(/"/g, "'")}"`)
  .replace('"ContentRoot" "..\\\\steam_depot_build\\\\windows"', `"ContentRoot" "${contentRoot}"`)
  .replace('"BuildOutput" "..\\\\steam_build_output"', `"BuildOutput" "${buildOutput}"`)
  .replace('"REPLACE_WITH_WINDOWS_DEPOT_ID"', `"${depotId}"`);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(output, text, 'utf8');

console.log(JSON.stringify({
  ok: true,
  status: 'steampipe_vdf_written',
  target: targetName,
  appId,
  depotId,
  output,
  contentRoot,
  buildOutput
}, null, 2));
