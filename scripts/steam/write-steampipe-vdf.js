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
const output = path.join(outputDir, 'app_build_4788490.vdf');

const DEFAULT_WINDOWS_DEPOT_ID = '4788491';
const depotId = process.env.CHIGGAS_STEAM_WINDOWS_DEPOT_ID || process.env.STEAM_WINDOWS_DEPOT_ID || DEFAULT_WINDOWS_DEPOT_ID;
const desc = process.env.CHIGGAS_STEAM_BUILD_DESC || `Chiggas build ${new Date().toISOString().slice(0, 10)}`;
const setLive = process.env.CHIGGAS_STEAM_SET_LIVE || '';
const preview = process.env.CHIGGAS_STEAM_PREVIEW || '0';

if (!/^\d+$/.test(depotId)) {
  console.error('Missing numeric depot ID. Set CHIGGAS_STEAM_WINDOWS_DEPOT_ID or update DEFAULT_WINDOWS_DEPOT_ID.');
  process.exit(1);
}

const contentRoot = path.relative(outputDir, path.join(ROOT, 'platforms', 'steam-electron', 'steam_depot_build', 'windows')).replace(/\//g, '\\');
const buildOutput = path.relative(outputDir, path.join(ROOT, 'platforms', 'steam-electron', 'steam_build_output')).replace(/\//g, '\\');

const text = fs.readFileSync(template, 'utf8')
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
  depotId,
  output,
  contentRoot,
  buildOutput
}, null, 2));
