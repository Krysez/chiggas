const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..');

function installAchievementBridgeAndLaunchHook() {
  // CHIGGAS_STEAM_ACHIEVEMENT_EVENT_BRIDGE_PASS_32_START
  try {
    const { ipcMain } = require('electron');
    const { createChiggasSteamAchievementBridgePass32 } = require('../scripts/chiggas-steam-achievement-bridge-pass-32.js');
  
    if (!global.__CHIGGAS_STEAM_ACHIEVEMENT_EVENT_BRIDGE_PASS_32__) {
      const achievementBridgePass32 = createChiggasSteamAchievementBridgePass32({ appId: 4788490 });
      global.__CHIGGAS_STEAM_ACHIEVEMENT_EVENT_BRIDGE_PASS_32__ = achievementBridgePass32;
  
      if (ipcMain && typeof ipcMain.handle === 'function') {
        ipcMain.handle('chiggas-steam-achievements-pass-32-unlock', async (_event, achievementName, metadata) => {
          return achievementBridgePass32.unlock(achievementName, {
            ...(metadata || {}),
            source: 'renderer_ipc'
          });
        });
  
        ipcMain.handle('chiggas-steam-achievements-pass-32-status', async () => {
          return achievementBridgePass32.getStatus();
        });
  
        ipcMain.handle('chiggas-steam-achievements-pass-32-list', async () => {
          return achievementBridgePass32.getAchievementList();
        });
      }
  
      achievementBridgePass32.writeTrace({
        ok: true,
        status: 'steam_achievement_event_bridge_ipc_handlers_installed',
        attemptedUnlock: false,
        storeShouldShow: 'TEST BUY'
      });
    }
  } catch (error) {
    console.warn('[Chiggas Steam] Pass 32 achievement event bridge failed to install:', String(error && error.message ? error.message : error));
  }
  // CHIGGAS_STEAM_ACHIEVEMENT_EVENT_BRIDGE_PASS_32_END
  
  // CHIGGAS_STEAM_FIRST_RUN_LAUNCH_HOOK_PASS_30_START
  try {
    require('../scripts/chiggas-steam-first-run-launch-hook-pass-30').installChiggasFirstRunLaunchHookPass30({
      appId: 4788490,
      achievement: 'FIRST_RUN'
    });
  } catch (error) {
    console.warn('[Chiggas Steam] FIRST_RUN Pass 30 launch hook failed to install safely:', error && error.message ? error.message : error);
  }
  // CHIGGAS_STEAM_FIRST_RUN_LAUNCH_HOOK_PASS_30_END
}

function installAchievementTraceHandlers() {
  require('./achievements-main/keyboard-test-main').installKeyboardTestMain();
  require('./achievements-main/runtime-scene-observer-main').installRuntimeSceneObserverMain();
  require('./achievements-main/first-game-started-interaction-main').installFirstGameStartedInteractionMain();
  require('./achievements-main/first-store-visit-click-map-main').installFirstStoreVisitClickMapMain();
}

module.exports = {
  installAchievementBridgeAndLaunchHook,
  installAchievementTraceHandlers
};
