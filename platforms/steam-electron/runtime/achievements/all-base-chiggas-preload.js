const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installAllBaseChiggasPreload() {
  // CHIGGAS_STEAM_PASS_74_ALL_BASE_CHIGGAS_PRELOAD_BEGIN
    (() => {
      try {
        if (typeof window === 'undefined') return;
        if (window.__chiggasSteamPass74AllBaseChiggasPreloadInstalled) return;
        window.__chiggasSteamPass74AllBaseChiggasPreloadInstalled = true;
    
        const { ipcRenderer } = require('electron');
        const fs = require('fs');
        const path = require('path');
        const PASS = 'steam_desktop_wrapper_pass_74';
        const APP_ID = 4788490;
        const ACHIEVEMENT = 'ALL_BASE_CHIGGAS_UNLOCKED';
        const CHANNEL = 'chiggas-steam-achievements-pass-32-unlock';
        const TRACE_PATH = path.join(STEAM_ROOT, 'steam-achievement-all-base-chiggas-unlocked-pass-74.json');
        const LOG_PATH = path.join(STEAM_ROOT, 'steam-achievement-all-base-chiggas-unlocked-pass-74.log');
        let attempted = false;
    
        function writeTrace(extra) {
          const payload = Object.assign({
            ok: !!(extra && extra.ok),
            pass: PASS,
            appId: APP_ID,
            status: extra && extra.status ? extra.status : 'steam_achievement_pass_74_all_base_chiggas_trace',
            achievement: ACHIEVEMENT,
            triggerInstalled: true,
            triggerMode: 'skin_registry_all_non_premium_base_chiggas_unlocked_pass32_ipc',
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
    
        writeTrace({ ok: false, status: 'steam_achievement_pass_74_all_base_chiggas_listener_registered', attemptedUnlock: false, activationResult: null, bridgeStatus: null, bridgeChannel: null, bridgeResultAchievement: null, bridgeResultKnownAchievement: null, reason: 'preload_registered' });
    
        window.addEventListener('chiggas-steam-pass-74-all-base-chiggas-unlocked', async (event) => {
          const detail = event && event.detail ? event.detail : {};
          if (attempted) return;
          attempted = true;
          const metadata = Object.assign({}, detail, { source: 'renderer_ipc', scene: 'SkinRegistry', event: 'all_base_chiggas_unlocked_all_non_premium_base_skins_owned', reason: detail.reason || 'all_non_premium_player_and_soldier_skins_unlocked' });
          writeTrace({ ok: false, status: 'steam_achievement_pass_74_all_base_chiggas_event_received_waiting_for_ipc', attemptedUnlock: false, activationResult: null, bridgeStatus: null, bridgeChannel: CHANNEL, bridgeResultAchievement: null, bridgeResultKnownAchievement: null, totalBaseChiggas: detail.totalBaseChiggas ?? null, ownedBaseChiggas: detail.ownedBaseChiggas ?? null, missingBaseChiggas: detail.missingBaseChiggas ?? null, changedSkinId: detail.changedSkinId || null, changedSkinName: detail.changedSkinName || null, changedSkinType: detail.changedSkinType || null, eventName: 'chiggas-steam-pass-74-all-base-chiggas-unlocked', reason: 'custom_event_received', metadata });
          try {
            const result = await ipcRenderer.invoke(CHANNEL, ACHIEVEMENT, metadata);
            const bridgeStatus = result && result.status ? result.status : 'steam_achievement_event_bridge_activate_succeeded';
            const activationResult = result && Object.prototype.hasOwnProperty.call(result, 'activationResult') ? result.activationResult : true;
            const knownAchievement = result && Object.prototype.hasOwnProperty.call(result, 'knownAchievement') ? result.knownAchievement : true;
            writeTrace({ ok: bridgeStatus === 'steam_achievement_event_bridge_activate_succeeded' || activationResult === true, status: bridgeStatus, attemptedUnlock: true, activationResult, bridgeStatus, bridgeChannel: CHANNEL, bridgeResultAchievement: ACHIEVEMENT, bridgeResultKnownAchievement: knownAchievement, totalBaseChiggas: detail.totalBaseChiggas ?? null, ownedBaseChiggas: detail.ownedBaseChiggas ?? null, missingBaseChiggas: detail.missingBaseChiggas ?? null, changedSkinId: detail.changedSkinId || null, changedSkinName: detail.changedSkinName || null, changedSkinType: detail.changedSkinType || null, eventName: 'chiggas-steam-pass-74-all-base-chiggas-unlocked', reason: 'pass32_achievement_ipc_result_74_fixed', metadata });
          } catch (error) {
            writeTrace({ ok: false, status: 'steam_achievement_pass_74_all_base_chiggas_ipc_failed', attemptedUnlock: true, activationResult: null, bridgeStatus: 'steam_achievement_pass_74_all_base_chiggas_ipc_failed', bridgeChannel: CHANNEL, bridgeResultAchievement: ACHIEVEMENT, bridgeResultKnownAchievement: null, error: String(error && error.message ? error.message : error), metadata });
          }
        });
      } catch (_) {}
    })();
    // CHIGGAS_STEAM_PASS_74_ALL_BASE_CHIGGAS_PRELOAD_END
}

module.exports = {
  installAllBaseChiggasPreload
};
