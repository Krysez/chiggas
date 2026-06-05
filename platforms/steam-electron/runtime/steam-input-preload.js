const { createControllerDiagnostics } = require('./controller-diagnostics-preload');
const { createSteamInputPromptHelpers } = require('./steam-input-prompts-preload');

function createSteamInputPreloadRuntime(ipcRenderer, WRAPPER_VERSION) {
  let activeActionSet = 'menu';

  const {
    normalizeActionSet,
    syncGetPromptForAction,
    syncGetGlyphForAction
  } = createSteamInputPromptHelpers(WRAPPER_VERSION, () => activeActionSet);

  const {
    getBrowserGamepadStatus,
    getControllerDiagnosticNow,
    startControllerConsoleWatch,
    runControllerActivationTest
  } = createControllerDiagnostics(WRAPPER_VERSION);

  let lastNativeActionState = null;
  let nativeActionPollStarted = false;
  let nativeActionPollTimer = null;

    async function getUnifiedInputStatus() {
        const nativeStatus = await ipcRenderer.invoke('chiggas-steam-input:getNativeInputStatus').catch(error => ({
          ok: false,
          status: 'native_input_status_error',
          error: error?.message || String(error),
          controllerCount: 0
        }));
      
        const browserStatus = getBrowserGamepadStatus();
      
        return {
          ok: true,
          pass: WRAPPER_VERSION,
          steamworksIntegrated: !!nativeStatus?.steamworksIntegrated,
          steamInputApiDetected: !!nativeStatus?.steamInputApiDetected,
          steamInputIntegrated: !!nativeStatus?.steamInputIntegrated,
          nativeControllerCount: nativeStatus?.controllerCount ?? nativeStatus?.count ?? 0,
          browserControllerCount: browserStatus?.browserControllerCount ?? browserStatus?.controllerCount ?? 0,
          nativeStatus,
          browserStatus,
          status: (browserStatus?.controllerCount || 0) > 0
            ? 'browser_gamepad_detected'
            : ((nativeStatus?.controllerCount || 0) > 0 ? 'native_steam_input_controller_detected' : 'no_controller_detected')
        };
      }
      
      function getCachedNativeActionState() {
        return lastNativeActionState || {
          ok: false,
          pass: WRAPPER_VERSION,
          status: 'native_action_state_not_polled_yet',
          actionSet: activeActionSet,
          controllerCount: 0,
          connected: false,
          axes: {},
          buttons: {}
        };
      }
      
      async function pollNativeActionStateNow(actionSet = activeActionSet) {
        const requestedSet = normalizeActionSet(actionSet || activeActionSet);
        try {
          const state = await ipcRenderer.invoke('chiggas-steam-input:getActionState', { actionSet: requestedSet });
          lastNativeActionState = {
            ...(state || {}),
            polledAt: Date.now(),
            pass: WRAPPER_VERSION
          };
        } catch (error) {
          lastNativeActionState = {
            ok: false,
            pass: WRAPPER_VERSION,
            actionSet: requestedSet,
            controllerCount: 0,
            connected: false,
            axes: {},
            buttons: {},
            status: 'native_action_state_poll_failed',
            error: error?.message || String(error),
            polledAt: Date.now()
          };
        }
        return lastNativeActionState;
      }
      
      function startNativeActionPolling(intervalMs = 33) {
        if (nativeActionPollStarted) return { ok: true, status: 'native_action_polling_already_started', intervalMs, lastNativeActionState };
        nativeActionPollStarted = true;
        const delay = Math.max(16, Math.min(250, Number(intervalMs) || 33));
      
        pollNativeActionStateNow(activeActionSet).catch(() => {});
        nativeActionPollTimer = setInterval(() => {
          pollNativeActionStateNow(activeActionSet).catch(() => {});
        }, delay);
      
        return { ok: true, status: 'native_action_polling_started', intervalMs: delay };
      }
      
      function stopNativeActionPolling() {
        if (nativeActionPollTimer) clearInterval(nativeActionPollTimer);
        nativeActionPollTimer = null;
        nativeActionPollStarted = false;
        return { ok: true, status: 'native_action_polling_stopped' };
      }
  
  

  const steamInputBridge = {
      version: WRAPPER_VERSION,
      isSteamDesktopWrapper: true,
      steamworksIntegrated: 'query window.ChiggasSteam.getCapabilities()',
      steamInputIntegrated: 'query window.ChiggasSteamInput.getCapabilities()',
      getCapabilities: () => ipcRenderer.invoke('chiggas-steam-input:getCapabilities'),
      getNativeInputStatus: () => ipcRenderer.invoke('chiggas-steam-input:getNativeInputStatus'),
      detectSteamInput: () => ipcRenderer.invoke('chiggas-steam-input:getNativeInputStatus'),
      getConnectedControllers: () => ipcRenderer.invoke('chiggas-steam-input:getConnectedControllers'),
      getControllerEnvironmentReport: () => ipcRenderer.invoke('chiggas-steam-input:getControllerEnvironmentReport'),
      getBrowserGamepadStatus,
      getBrowserGamepads: getBrowserGamepadStatus,
      runControllerActivationTest,
      activateControllerTest: runControllerActivationTest,
      getUnifiedInputStatus,
      startNativeActionPolling,
      stopNativeActionPolling,
      pollNativeActionStateNow,
      getActionState: pollNativeActionStateNow,
      getLastActionState: getCachedNativeActionState,
      getControllerDiagnosticNow,
      controllerNow: getControllerDiagnosticNow,
      startControllerConsoleWatch,
      watchControllers: startControllerConsoleWatch,
      setActionSet: (actionSet) => {
        activeActionSet = normalizeActionSet(actionSet);
        ipcRenderer.invoke('chiggas-steam-input:setActionSet', activeActionSet).catch(() => {});
        pollNativeActionStateNow(activeActionSet).catch(() => {});
        return { ok: true, actionSet: activeActionSet, status: 'action_set_updated' };
      },
      getPromptForAction: (payload) => syncGetPromptForAction(payload),
      getGlyphForAction: (actionSetOrPayload, actionName = '') => syncGetGlyphForAction(actionSetOrPayload, actionName),
      showBindingPanel: () => ipcRenderer.invoke('chiggas-steam-input:showBindingPanel'),
      getDebugReport: () => ipcRenderer.invoke('chiggas-steam-input:getDebugReport')
    };

  const controllerDebugBridge = {
    version: WRAPPER_VERSION,
    now: getControllerDiagnosticNow,
    environment: () => ipcRenderer.invoke('chiggas-steam-input:getControllerEnvironmentReport'),
    watch: startControllerConsoleWatch,
    getStatus: getControllerDiagnosticNow,
    note: 'Run window.ChiggasControllerDebug.now() for immediate status or window.ChiggasControllerDebug.watch(8000) for console samples.'
  };

  return {
    steamInputBridge,
    controllerDebugBridge,
    startNativeActionPolling
  };
}

module.exports = {
  createSteamInputPreloadRuntime
};
