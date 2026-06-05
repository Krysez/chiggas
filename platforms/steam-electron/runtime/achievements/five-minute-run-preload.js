const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installFiveMinuteRunPreload() {
  // CHIGGAS STEAM ACHIEVEMENT PASS 75 FIVE_MINUTE_RUN PRELOAD BEGIN
    (() => {
      const PASS = 'steam_desktop_wrapper_pass_75';
      const APP_ID = 4788490;
      const ACHIEVEMENT = 'FIVE_MINUTE_RUN';
      const STORE_SHOULD_SHOW = 'TEST BUY';
      const TRACE_FILE = 'steam-achievement-five-minute-run-pass-75.json';
      const LOG_FILE = 'steam-achievement-five-minute-run-pass-75.log';
      const CHANNEL = 'chiggas-steam-achievements-pass-32-unlock';
      const EVENT_NAME = 'chiggas-steam-pass-75-five-minute-run';
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
          ok: Boolean(entry.ok), pass: PASS, appId: APP_ID, status: entry.status || 'steam_achievement_pass_75_trace_event', achievement: ACHIEVEMENT,
          triggerInstalled: true, triggerMode: 'elapsedTime_300_seconds_custom_event_pass32_ipc', attemptedUnlock: Boolean(entry.attemptedUnlock),
          activationResult: entry.activationResult ?? null, bridgeStatus: entry.bridgeStatus || null, bridgeChannel: entry.bridgeChannel || null,
          bridgeResultAchievement: entry.bridgeResultAchievement || null, bridgeResultKnownAchievement: entry.bridgeResultKnownAchievement ?? null,
          elapsedTime: entry.elapsedTime ?? null, threshold: entry.threshold ?? 300, isDead: entry.isDead ?? null, stageIndex: entry.stageIndex ?? null,
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
          source: detail.source || 'GameScene_elapsedTime_five_minute_run', scene: detail.scene || 'GameScene',
          event: detail.event || 'five_minute_run_elapsed_time_threshold', reason: detail.reason || 'elapsedTime_reached_300_seconds',
          elapsedTime: detail.elapsedTime ?? null, threshold: detail.threshold ?? 300, isDead: detail.isDead ?? null, stageIndex: detail.stageIndex ?? null,
          storeShouldShow: STORE_SHOULD_SHOW, pass: PASS, hook: 'elapsed_time_300_seconds_75'
        };
        writeTrace({ ok: false, status: 'steam_achievement_pass_75_five_minute_run_event_received_waiting_for_ipc', attemptedUnlock: false, eventName, reason: 'custom_event_received', elapsedTime: metadata.elapsedTime, threshold: metadata.threshold, isDead: metadata.isDead, stageIndex: metadata.stageIndex, metadata });
        init();
        if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function') return writeTrace({ ok: false, status: 'steam_achievement_pass_75_ipc_unavailable', attemptedUnlock: true, eventName, reason: 'ipc_unavailable', metadata, error: 'ipcRenderer.invoke unavailable' });
        try {
          const result = await ipcRenderer.invoke(CHANNEL, ACHIEVEMENT, metadata);
          return writeTrace({ ok: Boolean(result && result.ok), status: result && result.status ? result.status : 'steam_achievement_pass_75_ipc_result', attemptedUnlock: true, activationResult: result && Object.prototype.hasOwnProperty.call(result, 'activationResult') ? result.activationResult : null, bridgeStatus: result && result.status ? result.status : null, bridgeChannel: CHANNEL, bridgeResultAchievement: result && result.achievement ? result.achievement : null, bridgeResultKnownAchievement: result && Object.prototype.hasOwnProperty.call(result, 'knownAchievement') ? result.knownAchievement : null, eventName, reason: 'pass32_achievement_ipc_result_75_fixed', elapsedTime: metadata.elapsedTime, threshold: metadata.threshold, isDead: metadata.isDead, stageIndex: metadata.stageIndex, metadata, error: result && result.error ? result.error : null });
        } catch (error) {
          return writeTrace({ ok: false, status: 'steam_achievement_pass_75_ipc_exception', attemptedUnlock: true, bridgeChannel: CHANNEL, eventName, reason: 'ipc_exception', metadata, error: String(error && error.message ? error.message : error) });
        }
      }
      try {
        window.addEventListener(EVENT_NAME, ev => unlock(ev && ev.detail, EVENT_NAME));
        window.addEventListener('chiggas-steam-achievement-unlock-request', ev => { if (ev && ev.detail && ev.detail.achievement === ACHIEVEMENT) unlock(ev.detail, 'chiggas-steam-achievement-unlock-request'); });
        writeTrace({ ok: true, status: 'steam_achievement_pass_75_five_minute_run_listener_registered', attemptedUnlock: false, reason: 'preload_registered' });
      } catch (error) { writeTrace({ ok: false, status: 'steam_achievement_pass_75_listener_failed', attemptedUnlock: false, reason: 'listener_failed', error: String(error && error.message ? error.message : error) }); }
    })();
    // CHIGGAS STEAM ACHIEVEMENT PASS 75 FIVE_MINUTE_RUN PRELOAD END
}

module.exports = {
  installFiveMinuteRunPreload
};
