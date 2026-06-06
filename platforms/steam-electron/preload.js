const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const DEMO_MARKER_FILE = 'chiggas-demo-mode.flag';

function hasDemoModeMarker() {
  const dirs = [
    path.dirname(process.execPath || ''),
    process.resourcesPath || '',
    __dirname
  ].filter(Boolean);

  try {
    return dirs.some((dir) => fs.existsSync(path.join(dir, DEMO_MARKER_FILE)));
  } catch (_error) {
    return false;
  }
}

try {
  const baseSteamAppId = '4788490';
  const launchedSteamAppId = process.env.SteamAppId || process.env.SteamGameId || process.env.STEAM_APP_ID || '';
  contextBridge.exposeInMainWorld('ChiggasDemoRuntime', {
    enabled: process.env.CHIGGAS_DEMO_MODE === '1' ||
      process.env.STEAM_DEMO === '1' ||
      hasDemoModeMarker() ||
      (!!launchedSteamAppId && String(launchedSteamAppId) !== baseSteamAppId),
    mode: 'score_attack',
    durationSeconds: 480
  });
} catch (error) {
  console.warn('[Chiggas] Demo runtime preload exposure failed:', error);
}

// CHIGGAS_STEAM_BRIDGE_PRELOAD_RUNTIME_BEGIN
try {
  require('./runtime/steam-bridge-preload').exposeSteamBridgePreload(contextBridge, ipcRenderer);
} catch (error) {
  console.warn('[Chiggas] Steam bridge preload runtime failed to expose:', error);
}
// CHIGGAS_STEAM_BRIDGE_PRELOAD_RUNTIME_END

// CHIGGAS_STEAM_ACHIEVEMENTS_PRELOAD_RUNTIME_API_BEGIN
try {
  require('./runtime/achievements-preload').exposeAchievementApis();
} catch (error) {
  console.warn('[Chiggas] Steam achievements preload API runtime failed to expose:', error);
}
// CHIGGAS_STEAM_ACHIEVEMENTS_PRELOAD_RUNTIME_API_END

// CHIGGAS_STEAM_ACHIEVEMENTS_PRELOAD_OBSERVERS_RUNTIME_BEGIN
try {
  require('./runtime/achievements-preload-observers').installAchievementObserverPreloadListeners();
} catch (error) {
  console.warn('[Chiggas] Steam achievements preload observer runtime failed to install:', error);
}
// CHIGGAS_STEAM_ACHIEVEMENTS_PRELOAD_OBSERVERS_RUNTIME_END
// CHIGGAS_STEAM_ACHIEVEMENTS_PRELOAD_DIRECT_RUNTIME_BEGIN
try {
  require('./runtime/achievements-preload-direct').installDirectAchievementPreloadListeners();
} catch (error) {
  console.warn('[Chiggas] Steam achievements direct preload runtime failed to install:', error);
}
// CHIGGAS_STEAM_ACHIEVEMENTS_PRELOAD_DIRECT_RUNTIME_END

// CHIGGAS_STEAM_ACHIEVEMENTS_PRELOAD_PROGRESSION_RUNTIME_BEGIN
try {
  require('./runtime/achievements-preload-progression').installProgressionAchievementPreloadListeners();
} catch (error) {
  console.warn('[Chiggas] Steam achievements progression preload runtime failed to install:', error);
}
// CHIGGAS_STEAM_ACHIEVEMENTS_PRELOAD_PROGRESSION_RUNTIME_END


// CHIGGAS_STEAM_ITEM_STORE_PRELOAD_RUNTIME_BEGIN
try {
  require('./runtime/item-store-preload').exposeSteamItemStoreExternalBridge(contextBridge, ipcRenderer);
} catch (error) {
  console.warn('[Chiggas] Steam Item Store preload runtime failed to install:', error);
}
// CHIGGAS_STEAM_ITEM_STORE_PRELOAD_RUNTIME_END



// CHIGGAS_STEAM_LEADERBOARDS_PRELOAD_RUNTIME_BEGIN
try {
  require('./runtime/leaderboards-preload').installLeaderboardPreloadRuntime();
} catch (error) {
  console.warn('[Chiggas] Steam leaderboards preload runtime failed to install:', error);
}
// CHIGGAS_STEAM_LEADERBOARDS_PRELOAD_RUNTIME_END
