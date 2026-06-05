const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installRuntimeSceneObserverMain() {
  // CHIGGAS_STEAM_DESKTOP_WRAPPER_PASS_38_RUNTIME_SCENE_OBSERVER_MAIN_START
    (function installChiggasPass38RuntimeSceneObserverMain() {
      try {
        const fs = require('fs');
        const path = require('path');
        const electron = require('electron');
        const ipcMain = electron && electron.ipcMain;
        if (!ipcMain) return;
    
        const channel = 'chiggas-achievements-runtime-observer-pass-38-trace';
        const appRoot = STEAM_ROOT;
        const tracePath = path.join(appRoot, 'steam-achievement-runtime-scene-observer-pass-38.json');
        const logPath = path.join(appRoot, 'steam-achievement-runtime-scene-observer-pass-38.log');
    
        try { ipcMain.removeHandler(channel); } catch (_) {}
    
        ipcMain.handle(channel, async function chiggasPass38RuntimeObserverTraceHandler(_event, payload) {
          const safePayload = payload && typeof payload === 'object' ? payload : {};
          const now = new Date().toISOString();
          const prior = (() => {
            try { return JSON.parse(fs.readFileSync(tracePath, 'utf8')); } catch (_) { return null; }
          })();
    
          const history = Array.isArray(prior && prior.history) ? prior.history.slice(-75) : [];
          history.push({
            time: now,
            event: safePayload.event || 'runtime_scene_observer_snapshot',
            activeScenes: Array.isArray(safePayload.activeScenes) ? safePayload.activeScenes : [],
            visibleScenes: Array.isArray(safePayload.visibleScenes) ? safePayload.visibleScenes : [],
            sceneKeys: Array.isArray(safePayload.sceneKeys) ? safePayload.sceneKeys : [],
            candidates: Array.isArray(safePayload.candidates) ? safePayload.candidates : [],
            url: safePayload.url || null,
            title: safePayload.title || null,
            note: safePayload.note || null
          });
    
          const trace = {
            ok: true,
            pass: 'steam_desktop_wrapper_pass_38',
            appId: 4788490,
            status: 'steam_achievement_pass_38_runtime_scene_observer_trace_updated',
            observerInstalled: true,
            attemptedUnlock: false,
            storeShouldShow: 'TEST BUY',
            updatedAt: now,
            latest: history[history.length - 1] || null,
            history
          };
    
          fs.writeFileSync(tracePath, JSON.stringify(trace, null, 2), 'utf8');
          fs.appendFileSync(logPath, JSON.stringify(trace.latest) + '\n', 'utf8');
          return { ok: true, tracePath, updatedAt: now };
        });
      } catch (error) {
        try {
          const fs = require('fs');
          const path = require('path');
          fs.writeFileSync(path.join(STEAM_ROOT, 'steam-achievement-runtime-scene-observer-pass-38-main-error.json'), JSON.stringify({
            ok: false,
            pass: 'steam_desktop_wrapper_pass_38',
            status: 'runtime_scene_observer_main_install_failed',
            error: String(error && error.message ? error.message : error),
            updatedAt: new Date().toISOString(),
            attemptedUnlock: false,
            storeShouldShow: 'TEST BUY'
          }, null, 2), 'utf8');
        } catch (_) {}
      }
    })();
    // CHIGGAS_STEAM_DESKTOP_WRAPPER_PASS_38_RUNTIME_SCENE_OBSERVER_MAIN_END
}

module.exports = {
  installRuntimeSceneObserverMain
};
