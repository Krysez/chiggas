const fs = require('fs');
const path = require('path');

const { STEAM_DIR } = require('../lib/paths');

const bridgeFile = path.join(STEAM_DIR, 'steam-leaderboards-pass-96a.js');
const source = fs.readFileSync(bridgeFile, 'utf8');

const checks = [
  ['exportsInstall', /module\.exports\s*=\s*\{[\s\S]*\binstall\b/.test(source)],
  ['registersCapabilitiesIpc', source.includes('chiggas-steam-leaderboards-pass-96a-capabilities')],
  ['registersSubmitScoreIpc', source.includes('chiggas-steam-leaderboards-pass-96a-submit-score')],
  ['recordsFallbackTrace', source.includes('steam_leaderboard_foundation_score_recorded_to_stats_fallback')],
  ['keepsRealSubmissionGuarded', source.includes('realLeaderboardSubmissionArmed: false')]
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
const result = {
  ok: failed.length === 0,
  bridgeFile,
  checks: Object.fromEntries(checks),
  failed
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exitCode = 1;
}
