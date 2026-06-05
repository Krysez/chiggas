const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installFirstGameStartedInteractionMain() {
  // CHIGGAS_STEAM_DESKTOP_WRAPPER_PASS_42_FIRST_GAME_STARTED_THIRD_INTERACTION_IPC_MAIN_START
    (function installChiggasPass42FirstGameStartedThirdInteractionTrace() {
      try {
        const fs = require('fs');
        const path = require('path');
        const electron = require('electron');
        const ipcMain = electron && electron.ipcMain;
        if (!ipcMain || typeof ipcMain.handle !== 'function') return;
    
        const channel = 'chiggas-first-game-started-third-interaction-pass-42-trace';
        const appRoot = STEAM_ROOT;
        const tracePath = path.join(appRoot, 'steam-achievement-first-game-started-third-interaction-pass-42.json');
        const logPath = path.join(appRoot, 'steam-achievement-first-game-started-third-interaction-pass-42.log');
    
        try { ipcMain.removeHandler(channel); } catch (_) {}
    
        ipcMain.handle(channel, async function chiggasPass42ThirdInteractionTraceHandler(_event, payload) {
          const safePayload = payload && typeof payload === 'object' ? payload : {};
          const now = new Date().toISOString();
          let prior = null;
          try { prior = JSON.parse(fs.readFileSync(tracePath, 'utf8')); } catch (_) {}
          const history = Array.isArray(prior && prior.history) ? prior.history.slice(-180) : [];
          const entry = {
            time: now,
            event: String(safePayload.event || 'third_interaction_ipc_trigger_trace').slice(0, 180),
            achievement: String(safePayload.achievement || 'FIRST_GAME_STARTED').slice(0, 100),
            attemptedUnlock: Boolean(safePayload.attemptedUnlock),
            activationResult: safePayload.activationResult === undefined ? null : safePayload.activationResult,
            bridgeStatus: safePayload.bridgeStatus || null,
            inputType: safePayload.inputType || null,
            reason: safePayload.reason || null,
            qualifyingInteractionCount: Number(safePayload.qualifyingInteractionCount || 0),
            firstInteractionAt: safePayload.firstInteractionAt || null,
            secondInteractionAt: safePayload.secondInteractionAt || null,
            thirdInteractionAt: safePayload.thirdInteractionAt || null,
            canvasFound: Boolean(safePayload.canvasFound),
            url: safePayload.url || null,
            title: safePayload.title || null,
            error: safePayload.error || null,
            metadata: safePayload.metadata || null
          };
          history.push(entry);
          const latestAttempt = [...history].reverse().find((h) => h.attemptedUnlock) || null;
          const trace = {
            ok: Boolean(latestAttempt && latestAttempt.activationResult === true),
            pass: 'steam_desktop_wrapper_pass_42',
            appId: 4788490,
            status: latestAttempt ? 'steam_achievement_pass_42_first_game_started_third_interaction_attempt_recorded' : 'steam_achievement_pass_42_first_game_started_third_interaction_trace_updated',
            achievement: 'FIRST_GAME_STARTED',
            triggerInstalled: true,
            triggerMode: 'third_qualifying_interaction_after_canvas_direct_ipc',
            intendedFlow: 'title_start_click_then_popup_open_then_difficulty_or_control_start_confirmation',
            attemptedUnlock: Boolean(latestAttempt),
            activationResult: latestAttempt ? latestAttempt.activationResult : null,
            bridgeStatus: latestAttempt ? latestAttempt.bridgeStatus : null,
            qualifyingInteractionCount: latestAttempt ? latestAttempt.qualifyingInteractionCount : Number(safePayload.qualifyingInteractionCount || 0),
            firstInteractionAt: latestAttempt ? latestAttempt.firstInteractionAt : (safePayload.firstInteractionAt || null),
            secondInteractionAt: latestAttempt ? latestAttempt.secondInteractionAt : (safePayload.secondInteractionAt || null),
            thirdInteractionAt: latestAttempt ? latestAttempt.thirdInteractionAt : (safePayload.thirdInteractionAt || null),
            latest: entry,
            latestAttempt,
            updatedAt: now,
            storeShouldShow: 'TEST BUY',
            history
          };
          fs.writeFileSync(tracePath, JSON.stringify(trace, null, 2), 'utf8');
          fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf8');
          return { ok: true, tracePath, updatedAt: now };
        });
      } catch (error) {
        try {
          const fs = require('fs');
          const path = require('path');
          fs.writeFileSync(path.join(STEAM_ROOT, 'steam-achievement-first-game-started-third-interaction-pass-42-main-error.json'), JSON.stringify({
            ok: false,
            pass: 'steam_desktop_wrapper_pass_42',
            appId: 4788490,
            status: 'steam_achievement_pass_42_main_trace_handler_install_failed',
            error: String(error && error.message ? error.message : error),
            attemptedUnlock: false,
            storeShouldShow: 'TEST BUY',
            updatedAt: new Date().toISOString()
          }, null, 2), 'utf8');
        } catch (_) {}
      }
    })();
    // CHIGGAS_STEAM_DESKTOP_WRAPPER_PASS_42_FIRST_GAME_STARTED_THIRD_INTERACTION_IPC_MAIN_END
}

module.exports = {
  installFirstGameStartedInteractionMain
};
