const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installRevengeRunPreload() {
  // CHIGGAS_STEAM_PASS_66C_REVENGE_RUN_PRELOAD_BEGIN
      (() => {
        const PASS = 'steam_desktop_wrapper_pass_66c';
        const APP_ID = 4788490;
        const ACHIEVEMENT = 'REVENGE_RUN';
        const CHANNEL = 'chiggas-steam-achievements-pass-32-unlock';
        const STORE_SHOULD_SHOW = 'TEST BUY';
        let ipcRenderer = null;
        let fs = null;
        let path = null;
        try {
          ({ ipcRenderer } = require('electron'));
          fs = require('fs');
          path = require('path');
        } catch (_) {}
      
        const tracePath = fs && path ? path.join(STEAM_ROOT, 'steam-achievement-revenge-run-pass-66c.json') : null;
        const logPath = fs && path ? path.join(STEAM_ROOT, 'steam-achievement-revenge-run-pass-66c.log') : null;
      
        function safeReadJson(file) {
          try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
        }
      
        function writeTrace(update) {
          if (!fs || !tracePath) return;
          const previous = safeReadJson(tracePath);
          const history = Array.isArray(previous?.history) ? previous.history.slice(-20) : [];
          const payload = Object.assign({
            ok: !!update.ok,
            pass: PASS,
            appId: APP_ID,
            achievement: ACHIEVEMENT,
            triggerInstalled: true,
            triggerMode: 'death_flag_local_storage_then_next_gamescene_start_pass32_ipc',
            storeShouldShow: STORE_SHOULD_SHOW,
            time: new Date().toISOString(),
            url: typeof location !== 'undefined' ? location.href : null,
            title: typeof document !== 'undefined' ? document.title : null
          }, update);
          payload.history = history.concat([Object.assign({}, payload, { history: undefined })]);
          try { fs.writeFileSync(tracePath, JSON.stringify(payload, null, 2) + '\n', 'utf8'); } catch (_) {}
          try { fs.appendFileSync(logPath, JSON.stringify(payload) + '\n', 'utf8'); } catch (_) {}
        }
      
        writeTrace({
          ok: true,
          status: 'steam_achievement_pass_66c_revenge_run_listener_registered',
          attemptedUnlock: false,
          activationResult: null,
          bridgeStatus: null,
          bridgeChannel: null,
          bridgeResultAchievement: null,
          bridgeResultKnownAchievement: null,
          deathSeen: null,
          deathSeenAt: null,
          eventName: null,
          reason: 'preload_registered'
        });
      
        if (typeof window === 'undefined' || window.__chiggasSteamPass66CRevengeRunListenerInstalled) return;
        window.__chiggasSteamPass66CRevengeRunListenerInstalled = true;
      
        window.addEventListener('chiggas-steam-pass-66c-revenge-run', async (event) => {
          const detail = event && event.detail ? event.detail : {};
          if (window.__chiggasSteamPass66CRevengeRunAttempted) return;
          window.__chiggasSteamPass66CRevengeRunAttempted = true;
      
          writeTrace({
            ok: false,
            status: 'steam_achievement_pass_66c_revenge_run_event_received_waiting_for_ipc',
            attemptedUnlock: false,
            activationResult: null,
            bridgeStatus: null,
            bridgeChannel: null,
            bridgeResultAchievement: null,
            bridgeResultKnownAchievement: null,
            deathSeen: !!detail.deathSeen,
            deathSeenAt: detail.deathSeenAt || null,
            eventName: 'chiggas-steam-pass-66c-revenge-run',
            reason: 'custom_event_received',
            metadata: detail.metadata || null
          });
      
          try {
            if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function') throw new Error('ipcRenderer.invoke unavailable');
            const metadata = Object.assign({
              source: 'renderer_ipc',
              scene: 'GameScene',
              event: 'revenge_run_new_run_after_death',
              reason: 'local_storage_death_flag_seen_on_new_run_start'
            }, detail.metadata || {});
            const result = await ipcRenderer.invoke(CHANNEL, ACHIEVEMENT, metadata);
            writeTrace({
              ok: !!(result && result.ok !== false),
              status: result && result.status ? result.status : 'steam_achievement_pass_66c_revenge_run_ipc_completed',
              attemptedUnlock: true,
              activationResult: result && Object.prototype.hasOwnProperty.call(result, 'activationResult') ? result.activationResult : null,
              bridgeStatus: result && result.status ? result.status : null,
              bridgeChannel: CHANNEL,
              bridgeResultAchievement: result && result.achievement ? result.achievement : ACHIEVEMENT,
              bridgeResultKnownAchievement: result && Object.prototype.hasOwnProperty.call(result, 'knownAchievement') ? result.knownAchievement : null,
              deathSeen: !!detail.deathSeen,
              deathSeenAt: detail.deathSeenAt || null,
              eventName: 'chiggas-steam-pass-66c-revenge-run',
              reason: 'pass32_achievement_ipc_result_66c_fixed',
              metadata
            });
          } catch (error) {
            writeTrace({
              ok: false,
              status: 'steam_achievement_pass_66c_revenge_run_ipc_failed',
              attemptedUnlock: true,
              activationResult: null,
              bridgeStatus: null,
              bridgeChannel: CHANNEL,
              bridgeResultAchievement: null,
              bridgeResultKnownAchievement: null,
              deathSeen: !!detail.deathSeen,
              deathSeenAt: detail.deathSeenAt || null,
              eventName: 'chiggas-steam-pass-66c-revenge-run',
              reason: 'ipc_error',
              error: String(error && error.message ? error.message : error),
              metadata: detail.metadata || null
            });
          }
        });
      })();
      // CHIGGAS_STEAM_PASS_66C_REVENGE_RUN_PRELOAD_END
}

module.exports = {
  installRevengeRunPreload
};
