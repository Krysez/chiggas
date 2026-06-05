const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installFirstLegendaryTryonPreload() {
  // CHIGGAS_STEAM_PASS_68_FIRST_LEGENDARY_TRYON_PRELOAD_BEGIN
      (() => {
        const PASS = 'steam_desktop_wrapper_pass_68';
        const APP_ID = 4788490;
        const ACHIEVEMENT = 'FIRST_LEGENDARY_TRYON';
        const STORE_SHOULD_SHOW = 'TEST BUY';
        const TRACE_FILE = 'steam-achievement-first-legendary-tryon-pass-68.json';
        const LOG_FILE = 'steam-achievement-first-legendary-tryon-pass-68.log';
        const CHANNEL = 'chiggas-steam-achievements-pass-32-unlock';
        const EVENT_NAME = 'chiggas-steam-pass-68-first-legendary-tryon';
        let fs = null, path = null, ipcRenderer = null, appRoot = null, attempted = false;
        let history = [];
        function now() { try { return new Date().toISOString(); } catch (_) { return String(Date.now()); } }
        function init() {
          try { if (!fs) fs = require('fs'); if (!path) path = require('path'); if (!appRoot) appRoot = typeof STEAM_ROOT !== 'undefined' ? STEAM_ROOT : process.cwd(); } catch (_) {}
          try { if (!ipcRenderer) { const electron = require('electron'); ipcRenderer = electron && electron.ipcRenderer; } } catch (_) {}
        }
        function writeTrace(entry) {
          init();
          const full = {
            ok: Boolean(entry.ok), pass: PASS, appId: APP_ID, status: entry.status || 'steam_achievement_pass_68_trace_event', achievement: ACHIEVEMENT,
            triggerInstalled: true, triggerMode: 'setEquipped_legendary_skin_custom_event_pass32_ipc', attemptedUnlock: Boolean(entry.attemptedUnlock),
            activationResult: entry.activationResult ?? null, bridgeStatus: entry.bridgeStatus || null, bridgeChannel: entry.bridgeChannel || null,
            bridgeResultAchievement: entry.bridgeResultAchievement || null, bridgeResultKnownAchievement: entry.bridgeResultKnownAchievement ?? null,
            skinId: entry.skinId || null, skinName: entry.skinName || null, skinType: entry.skinType || null, rarity: entry.rarity || null, unlockType: entry.unlockType || null,
            eventName: entry.eventName || null, reason: entry.reason || null, metadata: entry.metadata || null, error: entry.error || null,
            time: now(), url: (typeof location !== 'undefined' && location.href) || null, title: (typeof document !== 'undefined' && document.title) || null, storeShouldShow: STORE_SHOULD_SHOW
          };
          history.push(full); if (history.length > 20) history = history.slice(-20);
          const payload = { ...full, historyCount: history.length, history };
          try { if (fs && path && appRoot) { fs.writeFileSync(path.join(appRoot, TRACE_FILE), JSON.stringify(payload, null, 2) + '\n', 'utf8'); fs.appendFileSync(path.join(appRoot, LOG_FILE), JSON.stringify(full) + '\n', 'utf8'); } } catch (_) {}
          return payload;
        }
        async function unlock(rawDetail, eventName) {
          const detail = rawDetail && typeof rawDetail === 'object' ? rawDetail : {};
          if (detail.achievement && detail.achievement !== ACHIEVEMENT) return;
          if (attempted) return;
          attempted = true;
          const metadata = {
            source: detail.source || 'SkinRegistry_setEquipped_legendary_skin', scene: detail.scene || 'SkinRegistry',
            event: detail.event || 'first_legendary_tryon_equipped_legendary_skin', reason: detail.reason || 'setEquipped_selected_legendary_skin',
            skinId: detail.skinId || null, skinName: detail.skinName || null, skinType: detail.skinType || null, rarity: detail.rarity || null, unlockType: detail.unlockType || null,
            storeShouldShow: STORE_SHOULD_SHOW, pass: PASS, hook: 'set_equipped_legendary_skin_68'
          };
          writeTrace({ ok: false, status: 'steam_achievement_pass_68_first_legendary_tryon_event_received_waiting_for_ipc', attemptedUnlock: false, eventName, reason: 'custom_event_received', skinId: metadata.skinId, skinName: metadata.skinName, skinType: metadata.skinType, rarity: metadata.rarity, unlockType: metadata.unlockType, metadata });
          init();
          if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function') return writeTrace({ ok: false, status: 'steam_achievement_pass_68_ipc_unavailable', attemptedUnlock: true, eventName, reason: 'ipc_unavailable', metadata, error: 'ipcRenderer.invoke unavailable' });
          try {
            const result = await ipcRenderer.invoke(CHANNEL, ACHIEVEMENT, metadata);
            return writeTrace({ ok: Boolean(result && result.ok), status: result && result.status ? result.status : 'steam_achievement_pass_68_ipc_result', attemptedUnlock: true, activationResult: result && Object.prototype.hasOwnProperty.call(result, 'activationResult') ? result.activationResult : null, bridgeStatus: result && result.status ? result.status : null, bridgeChannel: CHANNEL, bridgeResultAchievement: result && result.achievement ? result.achievement : null, bridgeResultKnownAchievement: result && Object.prototype.hasOwnProperty.call(result, 'knownAchievement') ? result.knownAchievement : null, eventName, reason: 'pass32_achievement_ipc_result_68_fixed', skinId: metadata.skinId, skinName: metadata.skinName, skinType: metadata.skinType, rarity: metadata.rarity, unlockType: metadata.unlockType, metadata, error: result && result.error ? result.error : null });
          } catch (error) {
            return writeTrace({ ok: false, status: 'steam_achievement_pass_68_ipc_exception', attemptedUnlock: true, bridgeChannel: CHANNEL, eventName, reason: 'ipc_exception', metadata, error: String(error && error.message ? error.message : error) });
          }
        }
        try {
          window.addEventListener(EVENT_NAME, ev => unlock(ev && ev.detail, EVENT_NAME));
          window.addEventListener('chiggas-steam-achievement-unlock-request', ev => { if (ev && ev.detail && ev.detail.achievement === ACHIEVEMENT) unlock(ev.detail, 'chiggas-steam-achievement-unlock-request'); });
          writeTrace({ ok: true, status: 'steam_achievement_pass_68_first_legendary_tryon_listener_registered', attemptedUnlock: false, reason: 'preload_registered' });
        } catch (error) { writeTrace({ ok: false, status: 'steam_achievement_pass_68_listener_failed', attemptedUnlock: false, reason: 'listener_failed', error: String(error && error.message ? error.message : error) }); }
      })();
      // CHIGGAS_STEAM_PASS_68_FIRST_LEGENDARY_TRYON_PRELOAD_END
}

module.exports = {
  installFirstLegendaryTryonPreload
};
