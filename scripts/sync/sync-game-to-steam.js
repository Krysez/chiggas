const path = require('path');
const { GAME_DIR, STEAM_DIR, STEAM_GAME_DIR, STEAM_INTEGRATIONS_DIR } = require('../lib/paths');
const { copyDir, exists } = require('../lib/file-utils');

function main() {
  if (!exists(GAME_DIR)) throw new Error(`Missing game directory: ${GAME_DIR}`);
  if (!exists(STEAM_DIR)) throw new Error(`Missing Steam platform directory: ${STEAM_DIR}`);

  copyDir(GAME_DIR, STEAM_GAME_DIR);

  const integrationCopies = [
    ['input', 'steam_input'],
    ['achievements', 'steam_achievements'],
    ['steamworks', 'steamworks']
  ];

  const copiedIntegrations = [];
  for (const [sourceName, destName] of integrationCopies) {
    const source = path.join(STEAM_INTEGRATIONS_DIR, sourceName);
    const destination = path.join(STEAM_DIR, destName);
    if (exists(source)) {
      copyDir(source, destination);
      copiedIntegrations.push(destName);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    status: 'steam_game_synced',
    source: GAME_DIR,
    destination: STEAM_GAME_DIR,
    copiedIntegrations
  }, null, 2));
}

main();
