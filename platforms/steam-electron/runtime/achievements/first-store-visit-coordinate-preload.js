const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installFirstStoreVisitCoordinatePreload() {
  // PASS 46 FIRST_STORE_VISIT ACHIEVEMENT IPC FIX START
    (function installChiggasPass46FirstStoreVisitAchievementIpcFix() {
      try {
        if (globalThis.__CHIGGAS_PASS_46_FIRST_STORE_VISIT_ACHIEVEMENT_IPC_FIX_INSTALLED__) return;
        globalThis.__CHIGGAS_PASS_46_FIRST_STORE_VISIT_ACHIEVEMENT_IPC_FIX_INSTALLED__ = true;
    
        const PASS = "steam_desktop_wrapper_pass_46";
        const APP_ID = 4788490;
        const ACHIEVEMENT = "FIRST_STORE_VISIT";
        const STORE_SHOULD_SHOW = "TEST BUY";
        const BRIDGE_CHANNEL = 'chiggas-steam-achievements-pass-32-unlock';
        const TRACE_FILE = 'steam-achievement-first-store-visit-coordinate-pass-46.json';
        const LOG_FILE = 'steam-achievement-first-store-visit-coordinate-pass-46.log';
        const STORE_REGION = Object.freeze({
          minX: 0.82,
          maxX: 0.96,
          minY: 0.02,
          maxY: 0.12,
          learnedX: 0.8718,
          learnedY: 0.0587
        });
    
        const electron = require('electron');
        const ipcRenderer = electron && electron.ipcRenderer;
        const fs = require('fs');
        const path = require('path');
        const appRoot = STEAM_ROOT;
        const tracePath = appRoot ? path.join(appRoot, TRACE_FILE) : null;
        const logPath = appRoot ? path.join(appRoot, LOG_FILE) : null;
        const installedAt = Date.now();
        let installed = false;
        let attempted = false;
        let history = [];
    
        function safeString(value) {
          try { return value == null ? '' : String(value); } catch (_) { return ''; }
        }
        function nowIso() {
          try { return new Date().toISOString(); } catch (_) { return ''; }
        }
        function safeWrite(update) {
          const entry = Object.assign({
            ok: Boolean(update && update.ok),
            pass: PASS,
            appId: APP_ID,
            status: update && update.status ? String(update.status) : 'steam_achievement_pass_46_trace_update',
            achievement: ACHIEVEMENT,
            triggerInstalled: installed,
            triggerMode: 'top_right_store_button_coordinate_pass32_achievement_ipc',
            attemptedUnlock: Boolean(update && update.attemptedUnlock),
            activationResult: update && Object.prototype.hasOwnProperty.call(update, 'activationResult') ? update.activationResult : null,
            bridgeStatus: update && update.bridgeStatus ? String(update.bridgeStatus) : null,
            bridgeChannel: update && update.bridgeChannel ? String(update.bridgeChannel) : null,
            coordinateMatched: Boolean(update && update.coordinateMatched),
            inputType: update && update.inputType ? String(update.inputType) : null,
            reason: update && update.reason ? String(update.reason) : null,
            canvasXPct: update && Object.prototype.hasOwnProperty.call(update, 'canvasXPct') ? update.canvasXPct : null,
            canvasYPct: update && Object.prototype.hasOwnProperty.call(update, 'canvasYPct') ? update.canvasYPct : null,
            clientX: update && Object.prototype.hasOwnProperty.call(update, 'clientX') ? update.clientX : null,
            clientY: update && Object.prototype.hasOwnProperty.call(update, 'clientY') ? update.clientY : null,
            storeRegion: STORE_REGION,
            bridgeResultAchievement: update && update.bridgeResultAchievement ? String(update.bridgeResultAchievement) : null,
            bridgeResultKnownAchievement: update && Object.prototype.hasOwnProperty.call(update || {}, 'bridgeResultKnownAchievement') ? update.bridgeResultKnownAchievement : null,
            error: update && update.error ? String(update.error) : null,
            metadata: update && update.metadata ? update.metadata : null,
            time: nowIso(),
            url: (typeof window !== 'undefined' && window.location) ? safeString(window.location.href) : null,
            title: (typeof document !== 'undefined') ? safeString(document.title) : null,
            storeShouldShow: STORE_SHOULD_SHOW
          }, {});
          history.push(entry);
          if (history.length > 50) history = history.slice(-50);
          const full = Object.assign({}, entry, { historyCount: history.length, history: history.slice(-12) });
          try { if (tracePath) fs.writeFileSync(tracePath, JSON.stringify(full, null, 2) + '\n'); } catch (_) {}
          try { if (logPath) fs.appendFileSync(logPath, JSON.stringify(entry) + '\n'); } catch (_) {}
        }
        function getCanvasPoint(event) {
          try {
            const canvas = document.querySelector('canvas');
            if (!canvas) return null;
            const rect = canvas.getBoundingClientRect();
            if (!rect || !rect.width || !rect.height) return null;
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            return {
              x,
              y,
              pctX: x / rect.width,
              pctY: y / rect.height,
              rect
            };
          } catch (_) { return null; }
        }
        function isStoreCoordinate(point) {
          return !!(point &&
            point.pctX >= STORE_REGION.minX && point.pctX <= STORE_REGION.maxX &&
            point.pctY >= STORE_REGION.minY && point.pctY <= STORE_REGION.maxY);
        }
        function isAchievementBridgeSuccess(result) {
          if (!result || typeof result !== 'object') return false;
          const status = safeString(result.status);
          const resultAchievement = safeString(result.achievement);
          return result.attemptedUnlock === true &&
            resultAchievement === ACHIEVEMENT &&
            (result.activationResult === true || /steam_achievement_event_bridge_activate_succeeded/i.test(status));
        }
        async function unlockAfterStoreClick(trigger) {
          const metadata = {
            source: 'runtime_first_store_visit_pass_46',
            scene: 'wrapper_runtime_store_button_coordinate',
            event: 'first_store_visit_after_top_right_store_button_click',
            reason: 'top_right_store_button_coordinate_pass32_achievement_ipc',
            inputType: safeString(trigger.inputType),
            storeShouldShow: STORE_SHOULD_SHOW
          };
    
          safeWrite({
            ok: false,
            status: 'steam_achievement_pass_46_first_store_visit_coordinate_matched_waiting_to_unlock',
            attemptedUnlock: false,
            coordinateMatched: true,
            inputType: trigger.inputType,
            reason: trigger.reason,
            canvasXPct: trigger.canvasXPct,
            canvasYPct: trigger.canvasYPct,
            clientX: trigger.clientX,
            clientY: trigger.clientY,
            metadata
          });
    
          await new Promise(resolve => setTimeout(resolve, 700));
    
          if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function') {
            safeWrite({
              ok: false,
              status: 'steam_achievement_pass_46_ipc_renderer_unavailable',
              attemptedUnlock: true,
              activationResult: false,
              bridgeStatus: 'steam_achievement_event_bridge_ipc_not_available',
              bridgeChannel: BRIDGE_CHANNEL,
              coordinateMatched: true,
              inputType: trigger.inputType,
              reason: trigger.reason,
              canvasXPct: trigger.canvasXPct,
              canvasYPct: trigger.canvasYPct,
              clientX: trigger.clientX,
              clientY: trigger.clientY,
              error: 'ipcRenderer.invoke is not available',
              metadata
            });
            return;
          }
    
          try {
            const result = await ipcRenderer.invoke(BRIDGE_CHANNEL, ACHIEVEMENT, metadata);
            const success = isAchievementBridgeSuccess(result);
            safeWrite({
              ok: success,
              status: success ? 'steam_achievement_pass_46_first_store_visit_achievement_ipc_unlock_attempt_confirmed' : 'steam_achievement_pass_46_first_store_visit_achievement_ipc_returned_unexpected_result',
              attemptedUnlock: true,
              activationResult: result && Object.prototype.hasOwnProperty.call(result, 'activationResult') ? result.activationResult : null,
              bridgeStatus: result && result.status ? String(result.status) : null,
              bridgeChannel: BRIDGE_CHANNEL,
              coordinateMatched: true,
              inputType: trigger.inputType,
              reason: trigger.reason,
              canvasXPct: trigger.canvasXPct,
              canvasYPct: trigger.canvasYPct,
              clientX: trigger.clientX,
              clientY: trigger.clientY,
              bridgeResultAchievement: result && result.achievement ? String(result.achievement) : null,
              bridgeResultKnownAchievement: result && Object.prototype.hasOwnProperty.call(result, 'knownAchievement') ? result.knownAchievement : null,
              error: success ? null : ('Unexpected Pass 32 bridge result: ' + JSON.stringify(result || null).slice(0, 700)),
              metadata
            });
          } catch (error) {
            safeWrite({
              ok: false,
              status: 'steam_achievement_pass_46_first_store_visit_achievement_ipc_failed',
              attemptedUnlock: true,
              activationResult: false,
              bridgeStatus: 'steam_achievement_event_bridge_call_failed',
              bridgeChannel: BRIDGE_CHANNEL,
              coordinateMatched: true,
              inputType: trigger.inputType,
              reason: trigger.reason,
              canvasXPct: trigger.canvasXPct,
              canvasYPct: trigger.canvasYPct,
              clientX: trigger.clientX,
              clientY: trigger.clientY,
              error: String(error && error.message ? error.message : error),
              metadata
            });
          }
        }
        function handleClick(event) {
          try {
            if (attempted) return;
            if (!event || event.button !== 0) return;
            if (Date.now() - installedAt < 3000) return;
            const point = getCanvasPoint(event);
            if (!isStoreCoordinate(point)) return;
            attempted = true;
            unlockAfterStoreClick({
              inputType: event.type,
              reason: 'top_right_store_button_coordinate_click_after_pass_44_map',
              canvasXPct: Number(point.pctX.toFixed(4)),
              canvasYPct: Number(point.pctY.toFixed(4)),
              clientX: event.clientX,
              clientY: event.clientY
            });
          } catch (error) {
            safeWrite({
              ok: false,
              status: 'steam_achievement_pass_46_first_store_visit_click_handler_failed',
              attemptedUnlock: false,
              activationResult: false,
              bridgeStatus: 'steam_achievement_event_bridge_not_called',
              error: String(error && error.message ? error.message : error)
            });
          }
        }
        function install() {
          if (installed) return;
          installed = true;
          try { window.addEventListener('click', handleClick, true); } catch (_) {}
          safeWrite({
            ok: true,
            status: 'steam_achievement_pass_46_first_store_visit_coordinate_trigger_registered',
            attemptedUnlock: false,
            coordinateMatched: false,
            reason: 'preload_registered',
            bridgeChannel: BRIDGE_CHANNEL
          });
        }
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
          if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
          else install();
        }
      } catch (error) {
        try { console.warn('[Chiggas Steam] Pass 46 FIRST_STORE_VISIT trigger failed to install:', String(error && error.message ? error.message : error)); } catch (_) {}
      }
    })();
    // PASS 46 FIRST_STORE_VISIT ACHIEVEMENT IPC FIX END
}

module.exports = {
  installFirstStoreVisitCoordinatePreload
};
