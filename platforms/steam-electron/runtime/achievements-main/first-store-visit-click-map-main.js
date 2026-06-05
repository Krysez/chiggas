const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installFirstStoreVisitClickMapMain() {
  // CHIGGAS_STEAM_DESKTOP_WRAPPER_PASS_44_FIRST_STORE_VISIT_CLICK_MAPPER_MAIN_START
    (function installChiggasPass44FirstStoreVisitClickMapTrace() {
      try {
        const fs = require('fs');
        const path = require('path');
        const electron = require('electron');
        const ipcMain = electron && electron.ipcMain;
        if (!ipcMain || typeof ipcMain.handle !== 'function') return;
    
        const channel = 'chiggas-first-store-visit-click-map-pass-44-trace';
        const appRoot = STEAM_ROOT;
        const tracePath = path.join(appRoot, 'steam-achievement-first-store-visit-click-map-pass-44.json');
        const logPath = path.join(appRoot, 'steam-achievement-first-store-visit-click-map-pass-44.log');
    
        try { ipcMain.removeHandler(channel); } catch (_) {}
    
        ipcMain.handle(channel, async function chiggasPass44StoreVisitClickMapTraceHandler(_event, payload) {
          const safePayload = payload && typeof payload === 'object' ? payload : {};
          const now = new Date().toISOString();
          let prior = null;
          try { prior = JSON.parse(fs.readFileSync(tracePath, 'utf8')); } catch (_) {}
          const history = Array.isArray(prior && prior.history) ? prior.history.slice(-240) : [];
          const entry = {
            time: now,
            event: String(safePayload.event || 'store_visit_click_map').slice(0, 180),
            interactionIndex: Number(safePayload.interactionIndex || 0),
            inputType: safePayload.inputType || null,
            phase: safePayload.phase || null,
            button: safePayload.button === undefined ? null : safePayload.button,
            key: safePayload.key || null,
            clientX: safePayload.clientX === undefined ? null : Number(safePayload.clientX),
            clientY: safePayload.clientY === undefined ? null : Number(safePayload.clientY),
            canvasX: safePayload.canvasX === undefined ? null : Number(safePayload.canvasX),
            canvasY: safePayload.canvasY === undefined ? null : Number(safePayload.canvasY),
            canvasXPct: safePayload.canvasXPct === undefined ? null : Number(safePayload.canvasXPct),
            canvasYPct: safePayload.canvasYPct === undefined ? null : Number(safePayload.canvasYPct),
            canvasRect: safePayload.canvasRect || null,
            viewport: safePayload.viewport || null,
            target: safePayload.target || null,
            activeElement: safePayload.activeElement || null,
            url: safePayload.url || null,
            title: safePayload.title || null,
            elapsedMs: safePayload.elapsedMs === undefined ? null : Number(safePayload.elapsedMs),
            note: safePayload.note || null,
            attemptedUnlock: false,
            storeShouldShow: 'TEST BUY'
          };
          history.push(entry);
          const interactions = history.filter((h) => h.event === 'store_visit_user_interaction').slice(-80);
          const pointerInteractions = interactions.filter((h) => h.inputType && String(h.inputType).indexOf('pointer') >= 0).slice(-40);
          const clickInteractions = interactions.filter((h) => h.inputType === 'click' || h.phase === 'click').slice(-40);
          const trace = {
            ok: interactions.length > 0,
            pass: 'steam_desktop_wrapper_pass_44',
            appId: 4788490,
            status: interactions.length > 0 ? 'steam_achievement_pass_44_store_visit_click_map_interactions_recorded' : 'steam_achievement_pass_44_store_visit_click_map_trace_updated',
            achievement: 'FIRST_STORE_VISIT',
            triggerInstalled: true,
            triggerMode: 'runtime_store_visit_input_mapper_no_unlock',
            attemptedUnlock: false,
            activationResult: null,
            bridgeStatus: null,
            latest: entry,
            interactionCount: interactions.length,
            latestInteractions: interactions.slice(-20),
            latestPointerInteractions: pointerInteractions.slice(-20),
            latestClickInteractions: clickInteractions.slice(-20),
            updatedAt: now,
            gameScenePatched: false,
            legendaryStoreScenePatched: false,
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
          fs.writeFileSync(path.join(STEAM_ROOT, 'steam-achievement-first-store-visit-click-map-pass-44-main-error.json'), JSON.stringify({
            ok: false,
            pass: 'steam_desktop_wrapper_pass_44',
            appId: 4788490,
            status: 'steam_achievement_pass_44_main_trace_handler_install_failed',
            error: String(error && error.message ? error.message : error),
            attemptedUnlock: false,
            storeShouldShow: 'TEST BUY',
            updatedAt: new Date().toISOString()
          }, null, 2), 'utf8');
        } catch (_) {}
      }
    })();
    // CHIGGAS_STEAM_DESKTOP_WRAPPER_PASS_44_FIRST_STORE_VISIT_CLICK_MAPPER_MAIN_END
}

module.exports = {
  installFirstStoreVisitClickMapMain
};
