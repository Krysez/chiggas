const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installFullLegendaryFitPreload() {
  // CHIGGAS_STEAM_PASS_70_FULL_LEGENDARY_FIT_PRELOAD_BEGIN
    (() => {
      try {
        if (typeof window === 'undefined') return;
        if (window.__chiggasSteamPass70FullLegendaryFitPreloadInstalled) return;
        window.__chiggasSteamPass70FullLegendaryFitPreloadInstalled = true;
    
        const { ipcRenderer } = require('electron');
        const fs = require('fs');
        const path = require('path');
    
        const PASS = 'steam_desktop_wrapper_pass_70';
        const APP_ID = 4788490;
        const ACHIEVEMENT = 'FULL_LEGENDARY_FIT';
        const CHANNEL = 'chiggas-steam-achievements-pass-32-unlock';
        const TRACE_PATH = path.join(STEAM_ROOT, 'steam-achievement-full-legendary-fit-pass-70.json');
        const LOG_PATH = path.join(STEAM_ROOT, 'steam-achievement-full-legendary-fit-pass-70.log');
    
        function writeTrace(extra) {
          const payload = Object.assign({
            ok: !!(extra && extra.ok),
            pass: PASS,
            appId: APP_ID,
            status: extra && extra.status ? extra.status : 'steam_achievement_pass_70_full_legendary_fit_trace',
            achievement: ACHIEVEMENT,
            triggerInstalled: true,
            triggerMode: 'skin_registry_player_and_soldier_legendary_fit_pass32_ipc',
            storeShouldShow: 'TEST BUY',
            time: new Date().toISOString(),
            url: window.location ? window.location.href : '',
            title: document ? document.title : ''
          }, extra || {});
    
          try {
            const current = fs.existsSync(TRACE_PATH) ? JSON.parse(fs.readFileSync(TRACE_PATH, 'utf8')) : null;
            const history = Array.isArray(current && current.history) ? current.history.slice(-8) : [];
            history.push(payload);
            payload.history = history;
          } catch (_) {}
    
          try { fs.writeFileSync(TRACE_PATH, JSON.stringify(payload, null, 2), 'utf8'); } catch (_) {}
          try { fs.appendFileSync(LOG_PATH, JSON.stringify(payload) + '\n', 'utf8'); } catch (_) {}
        }
    
        writeTrace({
          ok: false,
          status: 'steam_achievement_pass_70_full_legendary_fit_listener_registered',
          attemptedUnlock: false,
          activationResult: null,
          bridgeStatus: null,
          bridgeChannel: null,
          bridgeResultAchievement: null,
          bridgeResultKnownAchievement: null,
          reason: 'preload_registered'
        });
    
        window.addEventListener('chiggas-steam-pass-70-full-legendary-fit', async (event) => {
          const detail = event && event.detail ? event.detail : {};
          const metadata = Object.assign({}, detail, {
            source: 'renderer_ipc',
            scene: 'SkinRegistry',
            event: 'full_legendary_fit_equipped_player_and_soldier_legendary',
            reason: detail.reason || 'player_and_soldier_legendary_skins_equipped'
          });
    
          writeTrace({
            ok: false,
            status: 'steam_achievement_pass_70_full_legendary_fit_event_received_waiting_for_ipc',
            attemptedUnlock: false,
            activationResult: null,
            bridgeStatus: null,
            bridgeChannel: CHANNEL,
            bridgeResultAchievement: null,
            bridgeResultKnownAchievement: null,
            playerSkinId: detail.playerSkinId || null,
            playerSkinName: detail.playerSkinName || null,
            soldierSkinId: detail.soldierSkinId || null,
            soldierSkinName: detail.soldierSkinName || null,
            eventName: 'chiggas-steam-pass-70-full-legendary-fit',
            reason: 'custom_event_received',
            metadata
          });
    
          try {
            const result = await ipcRenderer.invoke(CHANNEL, ACHIEVEMENT, metadata);
            const bridgeStatus = result && result.status ? result.status : 'steam_achievement_event_bridge_activate_succeeded';
            const activationResult = result && Object.prototype.hasOwnProperty.call(result, 'activationResult') ? result.activationResult : true;
            const knownAchievement = result && Object.prototype.hasOwnProperty.call(result, 'knownAchievement') ? result.knownAchievement : true;
    
            writeTrace({
              ok: bridgeStatus === 'steam_achievement_event_bridge_activate_succeeded' || activationResult === true,
              status: bridgeStatus,
              attemptedUnlock: true,
              activationResult,
              bridgeStatus,
              bridgeChannel: CHANNEL,
              bridgeResultAchievement: ACHIEVEMENT,
              bridgeResultKnownAchievement: knownAchievement,
              playerSkinId: detail.playerSkinId || null,
              playerSkinName: detail.playerSkinName || null,
              soldierSkinId: detail.soldierSkinId || null,
              soldierSkinName: detail.soldierSkinName || null,
              eventName: 'chiggas-steam-pass-70-full-legendary-fit',
              reason: 'pass32_achievement_ipc_result_70_fixed',
              metadata
            });
          } catch (error) {
            writeTrace({
              ok: false,
              status: 'steam_achievement_pass_70_full_legendary_fit_ipc_failed',
              attemptedUnlock: true,
              activationResult: null,
              bridgeStatus: 'steam_achievement_pass_70_full_legendary_fit_ipc_failed',
              bridgeChannel: CHANNEL,
              bridgeResultAchievement: ACHIEVEMENT,
              bridgeResultKnownAchievement: null,
              error: String(error && error.message ? error.message : error),
              metadata
            });
          }
        });
      } catch (_) {}
    })();
    // CHIGGAS_STEAM_PASS_70_FULL_LEGENDARY_FIT_PRELOAD_END
}

module.exports = {
  installFullLegendaryFitPreload
};
