const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installFirstSurvivalMinutePreload() {
  // CHIGGAS_STEAM_PASS_63A_FIRST_SURVIVAL_MINUTE_PRELOAD_BEGIN
      (() => {
        const PASS = 'steam_desktop_wrapper_pass_63a';
        const APP_ID = 4788490;
        const ACHIEVEMENT = 'FIRST_SURVIVAL_MINUTE';
        const STORE_SHOULD_SHOW = 'TEST BUY';
        const TRACE_FILE = 'steam-achievement-first-survival-minute-pass-63a.json';
        const LOG_FILE = 'steam-achievement-first-survival-minute-pass-63a.log';
        const CHANNEL = 'chiggas-steam-achievements-pass-32-unlock';
        let ipcRenderer = null;
        let fs = null;
        let path = null;
        try { ({ ipcRenderer } = require('electron')); } catch (_) {}
        try { fs = require('fs'); path = require('path'); } catch (_) {}
        const root = (() => { try { return STEAM_ROOT || process.cwd(); } catch (_) { return '.'; } })();
        const tracePath = () => path ? path.join(root, TRACE_FILE) : TRACE_FILE;
        const logPath = () => path ? path.join(root, LOG_FILE) : LOG_FILE;
        const history = [];
        let attempted = false;
        function now() { try { return new Date().toISOString(); } catch (_) { return ''; } }
        function writeTrace(extra) {
          const rec = {
            ok: !!extra.ok, pass: PASS, appId: APP_ID, status: extra.status || 'steam_achievement_pass_63a_first_survival_minute_trace',
            achievement: ACHIEVEMENT, triggerInstalled: true, triggerMode: 'elapsedTime_60_seconds_custom_event_pass32_ipc',
            attemptedUnlock: !!extra.attemptedUnlock, activationResult: extra.activationResult ?? null, bridgeStatus: extra.bridgeStatus || null,
            bridgeChannel: extra.bridgeChannel || null, bridgeResultAchievement: extra.bridgeResultAchievement || null, bridgeResultKnownAchievement: extra.bridgeResultKnownAchievement ?? null,
            elapsedTime: extra.elapsedTime ?? null, threshold: 60, eventName: extra.eventName || null, reason: extra.reason || null,
            metadata: extra.metadata || null, error: extra.error || null, time: now(), url: (typeof location !== 'undefined' ? location.href : null),
            title: (typeof document !== 'undefined' ? document.title : null), storeShouldShow: STORE_SHOULD_SHOW
          };
          history.push(rec);
          rec.historyCount = history.length;
          rec.history = history.slice(-5);
          try { if (fs) fs.writeFileSync(tracePath(), JSON.stringify(rec, null, 2) + '\n', 'utf8'); } catch (_) {}
          try { if (fs) fs.appendFileSync(logPath(), JSON.stringify(rec) + '\n', 'utf8'); } catch (_) {}
          return rec;
        }
        writeTrace({ ok: true, status: 'steam_achievement_pass_63a_first_survival_minute_event_bridge_registered', reason: 'preload_registered' });
        async function onEvent(ev) {
          const detail = ev && ev.detail ? ev.detail : {};
          if (attempted) return;
          attempted = true;
          const elapsedTime = Number(detail.elapsedTime || 0);
          const metadata = detail.metadata || { source: 'GameScene_elapsedTime_threshold', scene: 'GameScene', event: 'first_survival_minute_elapsed_time', reason: 'elapsedTime_reached_60_seconds' };
          writeTrace({ ok: false, status: 'steam_achievement_pass_63a_first_survival_minute_event_received_waiting_for_ipc', elapsedTime, eventName: ev.type, reason: 'custom_event_received', metadata });
          try {
            if (!ipcRenderer || !ipcRenderer.invoke) throw new Error('ipcRenderer.invoke unavailable');
            const result = await ipcRenderer.invoke(CHANNEL, ACHIEVEMENT, metadata);
            writeTrace({
              ok: !!(result && result.ok), status: result && result.status ? result.status : 'steam_achievement_pass_63a_first_survival_minute_ipc_result',
              attemptedUnlock: true, activationResult: result ? result.activationResult : null, bridgeStatus: result ? result.status : null, bridgeChannel: CHANNEL,
              bridgeResultAchievement: result ? result.achievement : null, bridgeResultKnownAchievement: result ? result.knownAchievement : null,
              elapsedTime, eventName: ev.type, reason: 'pass32_achievement_ipc_result_63a', metadata, error: result ? result.error : null
            });
          } catch (err) {
            writeTrace({ ok: false, status: 'steam_achievement_pass_63a_first_survival_minute_ipc_error', attemptedUnlock: true, elapsedTime, eventName: ev.type, reason: 'ipc_error', metadata, error: String(err && err.message ? err.message : err) });
          }
        }
        try { window.addEventListener('chiggas-steam-pass-63a-first-survival-minute', onEvent); } catch (_) {}
      })();
      // CHIGGAS_STEAM_PASS_63A_FIRST_SURVIVAL_MINUTE_PRELOAD_END
}

module.exports = {
  installFirstSurvivalMinutePreload
};
