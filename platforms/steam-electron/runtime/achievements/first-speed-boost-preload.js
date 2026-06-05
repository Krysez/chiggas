const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installFirstSpeedBoostPreload() {
  // CHIGGAS_STEAM_PASS_53_FIRST_SPEED_BOOST_PRELOAD_BEGIN
      (() => {
        const PASS = 'steam_desktop_wrapper_pass_53';
        const APP_ID = 4788490;
        const ACHIEVEMENT = 'FIRST_SPEED_BOOST';
        const STORE_SHOULD_SHOW = 'TEST BUY';
        const TRACE_FILE = 'steam-achievement-first-speed-boost-pass-53.json';
        const LOG_FILE = 'steam-achievement-first-speed-boost-pass-53.log';
        const BRIDGE_CHANNEL = 'chiggas-steam-achievements-pass-32-unlock';
        let fs = null;
        let path = null;
        let ipcRenderer = null;
        let appRoot = null;
        let attempted = false;
        let history = [];
      
        function safeNow() { try { return new Date().toISOString(); } catch (_) { return String(Date.now()); } }
        function getElectron() {
          if (ipcRenderer) return ipcRenderer;
          try {
            const electron = require('electron');
            ipcRenderer = electron && electron.ipcRenderer;
            return ipcRenderer;
          } catch (_) { return null; }
        }
        function getFsPath() {
          if (fs && path && appRoot) return true;
          try {
            fs = require('fs');
            path = require('path');
            appRoot = typeof STEAM_ROOT !== 'undefined' ? STEAM_ROOT : process.cwd();
            return true;
          } catch (_) { return false; }
        }
        function tracePath() { return getFsPath() ? path.join(appRoot, TRACE_FILE) : null; }
        function logPath() { return getFsPath() ? path.join(appRoot, LOG_FILE) : null; }
        function writeTrace(entry) {
          const full = {
            ok: Boolean(entry.ok),
            pass: PASS,
            appId: APP_ID,
            status: entry.status || 'steam_achievement_pass_53_first_speed_boost_trace_event',
            achievement: ACHIEVEMENT,
            triggerInstalled: true,
            triggerMode: 'playSpeedGush_side_effect_custom_event_pass32_ipc',
            attemptedUnlock: Boolean(entry.attemptedUnlock),
            activationResult: entry.activationResult ?? null,
            bridgeStatus: entry.bridgeStatus || null,
            bridgeChannel: entry.bridgeChannel || null,
            bridgeResultAchievement: entry.bridgeResultAchievement || null,
            bridgeResultKnownAchievement: entry.bridgeResultKnownAchievement ?? null,
            speedMultiplier: entry.speedMultiplier ?? null,
            eventName: entry.eventName || null,
            reason: entry.reason || null,
            metadata: entry.metadata || null,
            error: entry.error || null,
            time: safeNow(),
            url: (typeof location !== 'undefined' && location.href) || null,
            title: (typeof document !== 'undefined' && document.title) || null,
            storeShouldShow: STORE_SHOULD_SHOW
          };
          history.push(full);
          if (history.length > 20) history = history.slice(-20);
          const payload = { ...full, historyCount: history.length, history };
          try {
            const p = tracePath();
            const l = logPath();
            if (p && fs) fs.writeFileSync(p, JSON.stringify(payload, null, 2) + '\n', 'utf8');
            if (l && fs) fs.appendFileSync(l, JSON.stringify(full) + '\n', 'utf8');
          } catch (_) {}
          return payload;
        }
      
        async function unlockFromDetail(rawDetail, eventName) {
          const detail = rawDetail && typeof rawDetail === 'object' ? rawDetail : {};
          if (detail.achievement && detail.achievement !== ACHIEVEMENT) return;
          if (attempted) return;
          attempted = true;
          const metadata = {
            source: detail.source || 'GameScene_playSpeedGush_side_effect',
            scene: detail.scene || 'GameScene',
            event: detail.event || 'first_speed_boost_wind_gush',
            reason: detail.reason || 'playSpeedGush_called',
            speedMultiplier: detail.speedMultiplier ?? null,
            storeShouldShow: STORE_SHOULD_SHOW,
            pass: PASS,
            hook: 'playSpeedGush_side_effect_53'
          };
      
          writeTrace({
            ok: false,
            status: 'steam_achievement_pass_53_first_speed_boost_event_received_waiting_for_ipc',
            attemptedUnlock: false,
            eventName,
            reason: 'custom_event_received',
            speedMultiplier: metadata.speedMultiplier,
            metadata
          });
      
          const ipc = getElectron();
          if (!ipc || typeof ipc.invoke !== 'function') {
            return writeTrace({
              ok: false,
              status: 'steam_achievement_pass_53_first_speed_boost_ipc_unavailable',
              attemptedUnlock: true,
              eventName,
              reason: 'ipc_unavailable',
              speedMultiplier: metadata.speedMultiplier,
              metadata,
              error: 'ipcRenderer.invoke unavailable'
            });
          }
      
          try {
            const result = await ipc.invoke(BRIDGE_CHANNEL, ACHIEVEMENT, metadata);
            return writeTrace({
              ok: Boolean(result && result.ok),
              status: result && result.status ? result.status : 'steam_achievement_pass_53_first_speed_boost_ipc_result',
              attemptedUnlock: true,
              activationResult: result && Object.prototype.hasOwnProperty.call(result, 'activationResult') ? result.activationResult : null,
              bridgeStatus: result && result.status ? result.status : null,
              bridgeChannel: BRIDGE_CHANNEL,
              bridgeResultAchievement: result && result.achievement ? result.achievement : null,
              bridgeResultKnownAchievement: result && Object.prototype.hasOwnProperty.call(result, 'knownAchievement') ? result.knownAchievement : null,
              eventName,
              reason: 'pass32_achievement_ipc_result_53_fixed',
              speedMultiplier: metadata.speedMultiplier,
              metadata,
              error: result && result.error ? result.error : null
            });
          } catch (error) {
            return writeTrace({
              ok: false,
              status: 'steam_achievement_pass_53_first_speed_boost_ipc_exception',
              attemptedUnlock: true,
              bridgeChannel: BRIDGE_CHANNEL,
              eventName,
              reason: 'ipc_exception',
              speedMultiplier: metadata.speedMultiplier,
              metadata,
              error: String(error && error.message ? error.message : error)
            });
          }
        }
      
        try {
          window.addEventListener('chiggas-steam-achievement-unlock-request', (event) => {
            unlockFromDetail(event && event.detail, 'chiggas-steam-achievement-unlock-request');
          });
          window.addEventListener('chiggas-first-speed-boost', (event) => {
            unlockFromDetail(event && event.detail, 'chiggas-first-speed-boost');
          });
          writeTrace({
            ok: true,
            status: 'steam_achievement_pass_53_first_speed_boost_event_bridge_registered',
            attemptedUnlock: false,
            reason: 'preload_registered'
          });
        } catch (error) {
          writeTrace({
            ok: false,
            status: 'steam_achievement_pass_53_first_speed_boost_event_bridge_register_failed',
            attemptedUnlock: false,
            reason: 'preload_register_failed',
            error: String(error && error.message ? error.message : error)
          });
        }
      })();
      // CHIGGAS_STEAM_PASS_53_FIRST_SPEED_BOOST_PRELOAD_END
}

module.exports = {
  installFirstSpeedBoostPreload
};
