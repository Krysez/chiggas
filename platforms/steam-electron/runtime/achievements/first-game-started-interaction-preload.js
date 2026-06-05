function installFirstGameStartedInteractionPreload() {
  // CHIGGAS_STEAM_DESKTOP_WRAPPER_PASS_42_FIRST_GAME_STARTED_THIRD_INTERACTION_IPC_PRELOAD_START
    (function installChiggasPass42FirstGameStartedThirdInteractionIpcTrigger() {
      try {
        if (globalThis.__CHIGGAS_PASS_42_FIRST_GAME_STARTED_THIRD_INTERACTION_IPC_INSTALLED__) return;
        globalThis.__CHIGGAS_PASS_42_FIRST_GAME_STARTED_THIRD_INTERACTION_IPC_INSTALLED__ = true;
    
        const electron = require('electron');
        const ipcRenderer = electron && electron.ipcRenderer;
        const traceChannel = 'chiggas-first-game-started-third-interaction-pass-42-trace';
        const bridgeChannel = 'chiggas-steam-achievements-pass-32-unlock';
        const achievement = 'FIRST_GAME_STARTED';
        const installedAt = Date.now();
        const requiredInteractionCount = 3;
        let attempted = false;
        let listenerInstalled = false;
        let canvasSeen = false;
        let qualifyingInteractionCount = 0;
        let firstInteractionAt = null;
        let secondInteractionAt = null;
        let thirdInteractionAt = null;
        let lastQualifyingAt = 0;
        let lastPointerAt = 0;
    
        function safeString(value) {
          try { return value == null ? '' : String(value); } catch (_) { return ''; }
        }
        function nowIso() {
          try { return new Date().toISOString(); } catch (_) { return ''; }
        }
        function canvasFound() {
          try {
            const canvas = document && document.querySelector && document.querySelector('canvas');
            canvasSeen = Boolean(canvas);
            return Boolean(canvas);
          } catch (_) { return false; }
        }
        async function writeTrace(eventName, extra) {
          if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function') return null;
          const payload = Object.assign({
            event: eventName,
            achievement,
            attemptedUnlock: false,
            canvasFound: canvasFound(),
            qualifyingInteractionCount,
            firstInteractionAt,
            secondInteractionAt,
            thirdInteractionAt,
            url: safeString(window.location && window.location.href),
            title: safeString(document && document.title)
          }, extra || {});
          try { return await ipcRenderer.invoke(traceChannel, payload); } catch (_) { return null; }
        }
        function isIgnoredEvent(event, inputType) {
          try {
            if (!event) return false;
            if (event.ctrlKey || event.altKey || event.metaKey) return true;
            const key = safeString(event.key).toLowerCase();
            if (key === 'f12' || key === 'escape' || key === 'shift' || key === 'control' || key === 'alt' || key === 'meta') return true;
            if (inputType === 'keydown' && !(key === 'enter' || key === ' ' || key === 'spacebar')) return true;
          } catch (_) {}
          return false;
        }
        function isDuplicateInput(inputType) {
          const now = Date.now();
          if (inputType === 'pointerdown' || inputType === 'touchstart') {
            lastPointerAt = now;
          }
          if (inputType === 'mousedown' && lastPointerAt && now - lastPointerAt < 450) return true;
          if (lastQualifyingAt && now - lastQualifyingAt < 450) return true;
          lastQualifyingAt = now;
          return false;
        }
        async function attemptUnlock(inputType, reason, rawEvent) {
          if (attempted) return;
          if (isIgnoredEvent(rawEvent, inputType)) return;
          if (isDuplicateInput(inputType)) return;
          const hasCanvas = canvasFound();
          if (!hasCanvas) {
            await writeTrace('first_game_started_third_interaction_ipc_ignored_no_canvas', { inputType, reason, attemptedUnlock: false });
            return;
          }
          const msSinceInstall = Date.now() - installedAt;
          if (msSinceInstall < 750) {
            await writeTrace('first_game_started_third_interaction_ipc_ignored_too_early', { inputType, reason, attemptedUnlock: false });
            return;
          }
    
          qualifyingInteractionCount += 1;
          const currentInteractionAt = nowIso();
          if (qualifyingInteractionCount === 1) firstInteractionAt = currentInteractionAt;
          if (qualifyingInteractionCount === 2) secondInteractionAt = currentInteractionAt;
          if (qualifyingInteractionCount === 3) thirdInteractionAt = currentInteractionAt;
    
          await writeTrace('first_game_started_third_interaction_ipc_qualifying_input_seen', {
            inputType,
            reason,
            attemptedUnlock: false,
            qualifyingInteractionCount,
            firstInteractionAt,
            secondInteractionAt,
            thirdInteractionAt
          });
    
          if (qualifyingInteractionCount < requiredInteractionCount) return;
    
          attempted = true;
          const metadata = {
            source: 'runtime_first_game_started_pass_42',
            scene: 'wrapper_runtime_third_interaction_direct_ipc',
            event: 'first_game_started_after_popup_start_confirmation',
            reason: 'third_qualifying_interaction_after_canvas_direct_ipc',
            inputType: safeString(inputType).slice(0, 40),
            qualifyingInteractionCount,
            intendedFlow: 'title_start_click_then_popup_open_then_difficulty_or_control_start_confirmation'
          };
          await writeTrace('first_game_started_third_interaction_ipc_unlock_attempt_started', { inputType, reason, attemptedUnlock: true, metadata, qualifyingInteractionCount, firstInteractionAt, secondInteractionAt, thirdInteractionAt });
          try {
            const result = await ipcRenderer.invoke(bridgeChannel, achievement, metadata);
            await writeTrace('first_game_started_third_interaction_ipc_unlock_bridge_result', {
              inputType,
              reason,
              attemptedUnlock: Boolean(result && result.attemptedUnlock),
              activationResult: result && Object.prototype.hasOwnProperty.call(result, 'activationResult') ? result.activationResult : null,
              bridgeStatus: result && result.status ? String(result.status) : null,
              metadata,
              qualifyingInteractionCount,
              firstInteractionAt,
              secondInteractionAt,
              thirdInteractionAt,
              error: result && result.error ? String(result.error) : null
            });
          } catch (error) {
            await writeTrace('first_game_started_third_interaction_ipc_unlock_bridge_error', {
              inputType,
              reason,
              attemptedUnlock: true,
              activationResult: null,
              bridgeStatus: 'steam_achievement_pass_42_bridge_invoke_failed',
              metadata,
              qualifyingInteractionCount,
              firstInteractionAt,
              secondInteractionAt,
              thirdInteractionAt,
              error: String(error && error.message ? error.message : error)
            });
          }
        }
        function installListeners() {
          if (listenerInstalled) return;
          listenerInstalled = true;
          writeTrace('first_game_started_third_interaction_ipc_listeners_registered', { attemptedUnlock: false, canvasFound: canvasFound(), requiredInteractionCount });
          const opts = true;
          window.addEventListener('pointerdown', (event) => attemptUnlock('pointerdown', 'qualifying_pointer_interaction_after_canvas', event), opts);
          window.addEventListener('mousedown', (event) => attemptUnlock('mousedown', 'qualifying_mouse_interaction_after_canvas', event), opts);
          window.addEventListener('touchstart', (event) => attemptUnlock('touchstart', 'qualifying_touch_interaction_after_canvas', event), opts);
          window.addEventListener('keydown', (event) => attemptUnlock('keydown', 'qualifying_keyboard_confirm_after_canvas', event), opts);
          let ticks = 0;
          const interval = setInterval(() => {
            ticks += 1;
            const hasCanvas = canvasFound();
            if (hasCanvas && (!canvasSeen || ticks === 1 || ticks % 5 === 0)) {
              writeTrace('first_game_started_third_interaction_ipc_canvas_seen', { attemptedUnlock: false, canvasFound: true, reason: 'observer_tick', requiredInteractionCount });
            }
            if (attempted || ticks >= 180) clearInterval(interval);
          }, 1000);
        }
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', installListeners, { once: true });
        } else {
          setTimeout(installListeners, 0);
        }
      } catch (error) {
        try {
          const electron = require('electron');
          const ipcRenderer = electron && electron.ipcRenderer;
          if (ipcRenderer && typeof ipcRenderer.invoke === 'function') {
            ipcRenderer.invoke('chiggas-first-game-started-third-interaction-pass-42-trace', {
              event: 'first_game_started_third_interaction_ipc_trigger_install_failed',
              achievement: 'FIRST_GAME_STARTED',
              attemptedUnlock: false,
              error: String(error && error.message ? error.message : error),
              storeShouldShow: 'TEST BUY'
            });
          }
        } catch (_) {}
      }
    })();
    // CHIGGAS_STEAM_DESKTOP_WRAPPER_PASS_42_FIRST_GAME_STARTED_THIRD_INTERACTION_IPC_PRELOAD_END
}

module.exports = {
  installFirstGameStartedInteractionPreload
};
