function exposeAchievementApis() {
  // CHIGGAS_STEAM_ACHIEVEMENTS_PRELOAD_BRIDGE_PASS_32_START
  try {
    const { contextBridge, ipcRenderer } = require('electron');
  
    const achievementApiNamesPass32 = Object.freeze([
      'FIRST_GAME_STARTED',
      'FIRST_CHIGGA_SOLDIER_RECRUITED',
      'FIRST_MUNCH',
      'FIRST_WEAPON_PICKUP',
      'FIRST_SHOT_FIRED',
      'FIRST_ENEMY_DEFEATED',
      'TEN_ENEMIES_DEFEATED',
      'HUNDRED_ENEMIES_DEFEATED',
      'FIRST_SURVIVAL_MINUTE',
      'FIVE_MINUTE_RUN',
      'FIRST_SPEED_BOOST',
      'FIRST_LEGENDARY_TRYON',
      'FULL_LEGENDARY_FIT',
      'FIRST_STORE_VISIT',
      'ALL_BASE_CHIGGAS_UNLOCKED',
      'ALL_LEGENDARY_WEAR_UNLOCKED',
      'FIRST_DEATH',
      'REVENGE_RUN',
      'MITIEST_SURVIVOR'
    ]);
  
    const chiggasSteamAchievementsPass32 = Object.freeze({
      pass: 'steam_desktop_wrapper_pass_32',
      appId: 4788490,
      achievementApiNames: achievementApiNamesPass32,
      unlock(achievementName, metadata = {}) {
        return ipcRenderer.invoke('chiggas-steam-achievements-pass-32-unlock', String(achievementName || ''), metadata || {});
      },
      getStatus() {
        return ipcRenderer.invoke('chiggas-steam-achievements-pass-32-status');
      },
      list() {
        return ipcRenderer.invoke('chiggas-steam-achievements-pass-32-list');
      }
    });
  
    if (contextBridge && typeof contextBridge.exposeInMainWorld === 'function') {
      contextBridge.exposeInMainWorld('ChiggasSteamAchievements', chiggasSteamAchievementsPass32);
    } else if (typeof window !== 'undefined') {
      window.ChiggasSteamAchievements = chiggasSteamAchievementsPass32;
    }
  } catch (error) {
    console.warn('[Chiggas Steam] Pass 32 preload achievement bridge failed to expose:', String(error && error.message ? error.message : error));
  }
  // CHIGGAS_STEAM_ACHIEVEMENTS_PRELOAD_BRIDGE_PASS_32_END
  
  // CHIGGAS_STEAM_DESKTOP_WRAPPER_PASS_36_ROSEBUD_HELPER_START
  try {
    const { contextBridge, ipcRenderer } = require('electron');
  
    const PASS_36 = 'steam_desktop_wrapper_pass_36';
    const APP_ID_36 = 4788490;
    const ACHIEVEMENT_API_NAMES_PASS_36 = Object.freeze([
      'FIRST_GAME_STARTED',
      'FIRST_CHIGGA_SOLDIER_RECRUITED',
      'FIRST_MUNCH',
      'FIRST_WEAPON_PICKUP',
      'FIRST_SHOT_FIRED',
      'FIRST_ENEMY_DEFEATED',
      'TEN_ENEMIES_DEFEATED',
      'HUNDRED_ENEMIES_DEFEATED',
      'FIRST_SURVIVAL_MINUTE',
      'FIVE_MINUTE_RUN',
      'FIRST_SPEED_BOOST',
      'FIRST_LEGENDARY_TRYON',
      'FULL_LEGENDARY_FIT',
      'FIRST_STORE_VISIT',
      'ALL_BASE_CHIGGAS_UNLOCKED',
      'ALL_LEGENDARY_WEAR_UNLOCKED',
      'FIRST_DEATH',
      'REVENGE_RUN',
      'MITIEST_SURVIVOR'
    ]);
  
    const sessionUnlocksPass36 = new Set();
  
    function cleanAchievementName(value) {
      return String(value || '').trim().toUpperCase();
    }
  
    function safeMetadata(metadata, defaults) {
      const input = metadata && typeof metadata === 'object' ? metadata : {};
      const base = defaults && typeof defaults === 'object' ? defaults : {};
      const result = {
        source: 'rosebud_helper_pass_36',
        ...base,
        ...input
      };
  
      const allowed = {};
      for (const key of ['source', 'scene', 'event', 'reason', 'testMode']) {
        if (Object.prototype.hasOwnProperty.call(result, key) && result[key] !== undefined && result[key] !== null) {
          allowed[key] = String(result[key]).slice(0, 160);
        }
      }
      return allowed;
    }
  
    function bridgeInvoke(channel, ...args) {
      if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function') {
        return Promise.resolve({
          ok: false,
          pass: PASS_36,
          appId: APP_ID_36,
          status: 'steam_achievement_helper_ipc_renderer_invoke_unavailable',
          attemptedUnlock: false,
          storeShouldShow: 'TEST BUY'
        });
      }
      return ipcRenderer.invoke(channel, ...args);
    }
  
    const helperPass36 = Object.freeze({
      pass: PASS_36,
      appId: APP_ID_36,
      achievementApiNames: ACHIEVEMENT_API_NAMES_PASS_36,
  
      unlock(achievementName, metadata = {}) {
        const apiName = cleanAchievementName(achievementName);
        if (!apiName) {
          return Promise.resolve({
            ok: true,
            pass: PASS_36,
            appId: APP_ID_36,
            status: 'steam_achievement_helper_blocked_empty_achievement_name',
            achievement: apiName,
            attemptedUnlock: false,
            storeShouldShow: 'TEST BUY'
          });
        }
  
        return bridgeInvoke(
          'chiggas-steam-achievements-pass-32-unlock',
          apiName,
          safeMetadata(metadata, { event: apiName.toLowerCase() })
        );
      },
  
      unlockOnce(achievementName, metadata = {}) {
        const apiName = cleanAchievementName(achievementName);
        if (!apiName) {
          return this.unlock(apiName, metadata);
        }
  
        if (sessionUnlocksPass36.has(apiName)) {
          return Promise.resolve({
            ok: true,
            pass: PASS_36,
            appId: APP_ID_36,
            status: 'steam_achievement_helper_session_duplicate_blocked',
            achievement: apiName,
            attemptedUnlock: false,
            storeShouldShow: 'TEST BUY'
          });
        }
  
        sessionUnlocksPass36.add(apiName);
        return this.unlock(apiName, metadata).catch((error) => {
          sessionUnlocksPass36.delete(apiName);
          return {
            ok: false,
            pass: PASS_36,
            appId: APP_ID_36,
            status: 'steam_achievement_helper_unlock_failed_before_bridge_response',
            achievement: apiName,
            attemptedUnlock: false,
            error: String(error && error.message ? error.message : error),
            storeShouldShow: 'TEST BUY'
          };
        });
      },
  
      firstGameStarted(metadata = {}) {
        return this.unlockOnce('FIRST_GAME_STARTED', safeMetadata(metadata, {
          scene: 'GameScene',
          event: 'first_game_started'
        }));
      },
  
      firstStoreVisit(metadata = {}) {
        return this.unlockOnce('FIRST_STORE_VISIT', safeMetadata(metadata, {
          scene: 'LegendaryStoreScene',
          event: 'first_store_visit'
        }));
      },
  
      firstDeath(metadata = {}) {
        return this.unlockOnce('FIRST_DEATH', safeMetadata(metadata, {
          scene: 'GameScene',
          event: 'first_death'
        }));
      },
  
      firstMunch(metadata = {}) {
        return this.unlockOnce('FIRST_MUNCH', safeMetadata(metadata, {
          scene: 'GameScene',
          event: 'first_munch'
        }));
      },
  
      firstShotFired(metadata = {}) {
        return this.unlockOnce('FIRST_SHOT_FIRED', safeMetadata(metadata, {
          scene: 'GameScene',
          event: 'first_shot_fired'
        }));
      },
  
      firstChiggaSoldierRecruited(metadata = {}) {
        return this.unlockOnce('FIRST_CHIGGA_SOLDIER_RECRUITED', safeMetadata(metadata, {
          scene: 'GameScene',
          event: 'first_chigga_soldier_recruited'
        }));
      },
  
      getStatus() {
        return bridgeInvoke('chiggas-steam-achievements-pass-32-status').then((status) => ({
          ...(status || {}),
          helperPass: PASS_36,
          helperReady: true,
          helperAliases: ['window.ChiggasAchievementHelper', 'window.ChiggasAchievements'],
          storeShouldShow: 'TEST BUY'
        }));
      },
  
      list() {
        return bridgeInvoke('chiggas-steam-achievements-pass-32-list');
      }
    });
  
    if (contextBridge && typeof contextBridge.exposeInMainWorld === 'function') {
      contextBridge.exposeInMainWorld('ChiggasAchievementHelper', helperPass36);
      contextBridge.exposeInMainWorld('ChiggasAchievements', helperPass36);
    } else if (typeof window !== 'undefined') {
      window.ChiggasAchievementHelper = helperPass36;
      window.ChiggasAchievements = helperPass36;
    }
  } catch (error) {
    console.warn('[steam_desktop_wrapper_pass_36] safe Rosebud achievement helper failed to expose:', String(error && error.message ? error.message : error));
  }
  // CHIGGAS_STEAM_DESKTOP_WRAPPER_PASS_36_ROSEBUD_HELPER_END
}

module.exports = {
  exposeAchievementApis
};
