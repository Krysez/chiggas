const fs = require('fs');
const path = require('path');
const { STEAM_DIR } = require('../lib/paths');
const { exists } = require('../lib/file-utils');

const requiredFiles = [
  'package.json',
  'main.js',
  'preload.js',
  'game/index.html',
  'game/main.js',
  'game/scenes/GameScene.js',
  'steamworksBridgeCore.js',
  'steam-cloud-save-export-pass-98a.js',
  'steam-leaderboards-pass-96a.js',
  'steam-leaderboards-backend-pass-96b.js',
  'steam-leaderboard-capture-pass-96c.js',
  'runtime/achievements/all-base-chiggas-preload.js',
  'runtime/achievements/all-legendary-wear-preload.js',
  'runtime/achievements/direct-combat-milestones-preload.js',
  'runtime/achievements/direct-survival-legendary-preload.js',
  'runtime/achievements/direct-weapon-actions-preload.js',
  'runtime/achievements/first-death-preload.js',
  'runtime/achievements/first-enemy-defeated-preload.js',
  'runtime/achievements/first-game-started-interaction-preload.js',
  'runtime/achievements/first-legendary-tryon-preload.js',
  'runtime/achievements/five-minute-run-preload.js',
  'runtime/achievements/first-munch-counter-preload.js',
  'runtime/achievements/first-munch-preload.js',
  'runtime/achievements/first-shot-fired-preload.js',
  'runtime/achievements/first-soldier-recruited-preload.js',
  'runtime/achievements/first-speed-boost-preload.js',
  'runtime/achievements/first-store-visit-click-map-preload.js',
  'runtime/achievements/first-store-visit-coordinate-preload.js',
  'runtime/achievements/first-survival-minute-preload.js',
  'runtime/achievements/first-weapon-pickup-event-preload.js',
  'runtime/achievements/first-weapon-pickup-map-preload.js',
  'runtime/achievements/full-legendary-fit-preload.js',
  'runtime/achievements/mitiest-survivor-preload.js',
  'runtime/achievements/revenge-run-preload.js',
  'runtime/achievements/runtime-scene-observer-preload.js',
  'runtime/achievements/ten-enemies-defeated-preload.js',
  'runtime/achievements-main/first-game-started-interaction-main.js',
  'runtime/achievements-main/first-store-visit-click-map-main.js',
  'runtime/achievements-main/keyboard-test-main.js',
  'runtime/achievements-main/runtime-scene-observer-main.js',
  'runtime/achievements-main.js',
  'runtime/achievements-preload-direct.js',
  'runtime/achievements-preload-observers.js',
  'runtime/achievements-preload-progression.js',
  'runtime/achievements-preload.js',
  'runtime/cloud-save-main.js',
  'runtime/controller-diagnostics-preload.js',
  'runtime/fullscreen-main.js',
  'runtime/item-store/dynamic-url-handler-main.js',
  'runtime/item-store/hardwire-handler-main.js',
  'runtime/item-store/windows-open-chain-main.js',
  'runtime/item-store-legacy-blockers.js',
  'runtime/item-store-main.js',
  'runtime/item-store-preload.js',
  'runtime/leaderboards-main.js',
  'runtime/leaderboards/api-capture-main.js',
  'runtime/leaderboards/api-capture-preload.js',
  'runtime/leaderboards/auto-submit-main.js',
  'runtime/leaderboards/auto-submit-page-installer-preload.js',
  'runtime/leaderboards/auto-submit-preload.js',
  'runtime/leaderboards/probe-main.js',
  'runtime/leaderboards/probe-page-installer-preload.js',
  'runtime/leaderboards/probe-preload.js',
  'runtime/leaderboards/watchdog-main.js',
  'runtime/leaderboards/watchdog-page-installer-preload.js',
  'runtime/leaderboards/watchdog-preload.js',
  'runtime/leaderboards-preload.js',
  'runtime/steam-bridge-main.js',
  'runtime/steam-bridge-preload.js',
  'runtime/steam-input-preload.js',
  'runtime/steam-input-prompts-preload.js',
  'scripts/chiggas-steam-achievement-bridge-pass-32.js',
  'scripts/chiggas-steam-achievement-keyboard-test-harness-pass-33.js',
  'scripts/chiggas-steam-first-run-launch-hook-pass-30.js',
  'steam_input/game_actions_4788490.vdf',
  'steam_achievements/achievements_map_v1.json'
];

function read(file) {
  return fs.readFileSync(path.join(STEAM_DIR, file), 'utf8');
}

function resolveLocalRequire(fromFile, spec) {
  const base = path.resolve(path.dirname(path.join(STEAM_DIR, fromFile)), spec);
  const candidates = [base, `${base}.js`, path.join(base, 'index.js')];
  return candidates.find(exists) || null;
}

function collectLocalRequires(file) {
  const text = read(file);
  const out = [];
  const re = /require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;
  let match;
  while ((match = re.exec(text))) out.push({ fromFile: file, spec: match[1] });
  return out;
}

function main() {
  const fileChecks = requiredFiles.map(file => ({
    file,
    exists: exists(path.join(STEAM_DIR, file))
  }));

  const missingRequiredFiles = fileChecks.filter(check => !check.exists);
  const filesToScanForRequires = [
    'main.js',
    'preload.js',
    ...requiredFiles.filter(file => file.startsWith('runtime/') && file.endsWith('.js'))
  ];

  const localRequires = Array.from(
    new Map(
      filesToScanForRequires
        .flatMap(collectLocalRequires)
        .map(item => [`${item.fromFile}:${item.spec}`, item])
    ).values()
  ).sort((a, b) => `${a.fromFile}:${a.spec}`.localeCompare(`${b.fromFile}:${b.spec}`));

  const requireChecks = localRequires.map(({ fromFile, spec }) => ({
    fromFile,
    spec,
    resolved: resolveLocalRequire(fromFile, spec)
  }));

  const missingRequiredRequires = requireChecks.filter(check => !check.resolved);

  const pkg = JSON.parse(read('package.json'));
  const scriptCount = Object.keys(pkg.scripts || {}).length;
  const stableScriptNames = Object.keys(pkg.scripts || {}).sort();

  const ok = missingRequiredFiles.length === 0 && missingRequiredRequires.length === 0;
  console.log(JSON.stringify({
    ok,
    status: ok ? 'steam_electron_runtime_source_ready' : 'steam_electron_runtime_source_incomplete',
    scriptCount,
    stableScriptNames,
    fileChecks,
    missingRequiredFiles,
    missingRequiredRequires
  }, null, 2));

  process.exit(ok ? 0 : 1);
}

main();
