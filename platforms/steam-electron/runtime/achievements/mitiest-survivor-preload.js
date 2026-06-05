const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installMitiestSurvivorPreload() {
  // CHIGGAS STEAM ACHIEVEMENT PASS 77 MITIEST_SURVIVOR PRELOAD BEGIN
    (() => {
      const PASS = 'steam_desktop_wrapper_pass_77';
      const APP_ID = 4788490;
      const ACHIEVEMENT = 'MITIEST_SURVIVOR';
      const STORE_SHOULD_SHOW = 'TEST BUY';
      const TRACE_FILE = 'steam-achievement-mitiest-survivor-pass-77.json';
      const LOG_FILE = 'steam-achievement-mitiest-survivor-pass-77.log';
      const CHANNEL = 'chiggas-steam-achievements-pass-32-unlock';
      const EVENT_NAME = 'chiggas-steam-pass-77-mitiest-survivor';
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
          ok: Boolean(entry.ok), pass: PASS, appId: APP_ID, status: entry.status || 'steam_achievement_pass_77_trace_event', achievement: ACHIEVEMENT,
          triggerInstalled: true, triggerMode: 'final_victory_video_before_final_score_custom_event_pass32_ipc', attemptedUnlock: Boolean(entry.attemptedUnlock),
          activationResult: entry.activationResult ?? null, bridgeStatus: entry.bridgeStatus || null, bridgeChannel: entry.bridgeChannel || null,
          bridgeResultAchievement: entry.bridgeResultAchievement || null, bridgeResultKnownAchievement: entry.bridgeResultKnownAchievement ?? null,
          stageIndex: entry.stageIndex ?? null, elapsedTime: entry.elapsedTime ?? null, score: entry.score ?? null, timeBonus: entry.timeBonus ?? null, timeStr: entry.timeStr ?? null,
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
          source: detail.source || 'GameScene_final_victory_video_before_final_score', scene: detail.scene || 'GameScene',
          event: detail.event || 'mitiest_survivor_final_stage_victory', reason: detail.reason || 'final_stage_clear_play_victory_video_before_final_score',
          stageIndex: detail.stageIndex ?? null, elapsedTime: detail.elapsedTime ?? null, score: detail.score ?? null, timeBonus: detail.timeBonus ?? null, timeStr: detail.timeStr ?? null,
          storeShouldShow: STORE_SHOULD_SHOW, pass: PASS, hook: 'final_victory_video_before_final_score_77'
        };
        writeTrace({ ok: false, status: 'steam_achievement_pass_77_mitiest_survivor_event_received_waiting_for_ipc', attemptedUnlock: false, eventName, reason: 'custom_event_received', stageIndex: metadata.stageIndex, elapsedTime: metadata.elapsedTime, score: metadata.score, timeBonus: metadata.timeBonus, timeStr: metadata.timeStr, metadata });
        init();
        if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function') return writeTrace({ ok: false, status: 'steam_achievement_pass_77_ipc_unavailable', attemptedUnlock: true, eventName, reason: 'ipc_unavailable', metadata, error: 'ipcRenderer.invoke unavailable' });
        try {
          const result = await ipcRenderer.invoke(CHANNEL, ACHIEVEMENT, metadata);
          return writeTrace({ ok: Boolean(result && result.ok), status: result && result.status ? result.status : 'steam_achievement_pass_77_ipc_result', attemptedUnlock: true, activationResult: result && Object.prototype.hasOwnProperty.call(result, 'activationResult') ? result.activationResult : null, bridgeStatus: result && result.status ? result.status : null, bridgeChannel: CHANNEL, bridgeResultAchievement: result && result.achievement ? result.achievement : null, bridgeResultKnownAchievement: result && Object.prototype.hasOwnProperty.call(result, 'knownAchievement') ? result.knownAchievement : null, eventName, reason: 'pass32_achievement_ipc_result_77_fixed', stageIndex: metadata.stageIndex, elapsedTime: metadata.elapsedTime, score: metadata.score, timeBonus: metadata.timeBonus, timeStr: metadata.timeStr, metadata, error: result && result.error ? result.error : null });
        } catch (error) {
          return writeTrace({ ok: false, status: 'steam_achievement_pass_77_ipc_exception', attemptedUnlock: true, bridgeChannel: CHANNEL, eventName, reason: 'ipc_exception', metadata, error: String(error && error.message ? error.message : error) });
        }
      }
      try {
        window.addEventListener(EVENT_NAME, ev => unlock(ev && ev.detail, EVENT_NAME));
        window.addEventListener('chiggas-steam-achievement-unlock-request', ev => { if (ev && ev.detail && ev.detail.achievement === ACHIEVEMENT) unlock(ev.detail, 'chiggas-steam-achievement-unlock-request'); });
        writeTrace({ ok: true, status: 'steam_achievement_pass_77_mitiest_survivor_listener_registered', attemptedUnlock: false, reason: 'preload_registered' });
      } catch (error) { writeTrace({ ok: false, status: 'steam_achievement_pass_77_listener_failed', attemptedUnlock: false, reason: 'listener_failed', error: String(error && error.message ? error.message : error) }); }
    })();
    // CHIGGAS STEAM ACHIEVEMENT PASS 77 MITIEST_SURVIVOR PRELOAD END
}

module.exports = {
  installMitiestSurvivorPreload
};
