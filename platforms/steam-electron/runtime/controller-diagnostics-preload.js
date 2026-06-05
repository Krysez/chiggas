function createControllerDiagnostics(WRAPPER_VERSION) {
    function getBrowserGamepadStatus() {
        const hasNavigatorApi = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function';
        const rawPads = hasNavigatorApi ? Array.from(navigator.getGamepads() || []).filter(Boolean) : [];
        const gamepads = rawPads.map((pad, index) => ({
          index: pad.index ?? index,
          id: pad.id || `Gamepad ${index}`,
          connected: !!pad.connected,
          mapping: pad.mapping || '',
          axes: Array.from(pad.axes || []).map(value => Number(Number(value || 0).toFixed(4))),
          buttons: Array.from(pad.buttons || []).map((button, buttonIndex) => ({
            index: buttonIndex,
            pressed: !!button?.pressed,
            touched: !!button?.touched,
            value: Number(Number(button?.value || 0).toFixed(4))
          }))
        }));
      
        return {
          ok: true,
          pass: WRAPPER_VERSION,
          hasNavigatorGamepads: hasNavigatorApi,
          browserGamepadFallbackAvailable: hasNavigatorApi,
          controllerCount: gamepads.length,
          gamepads,
          status: hasNavigatorApi
            ? (gamepads.length > 0 ? 'browser_gamepad_detected' : 'browser_gamepad_api_available_no_controllers')
            : 'browser_gamepad_api_unavailable'
        };
      }
      
      
      function getControllerDiagnosticNow() {
        const browserStatus = getBrowserGamepadStatus();
        return {
          ok: true,
          pass: WRAPPER_VERSION,
          browserControllerCount: browserStatus.controllerCount,
          controllerCount: browserStatus.controllerCount,
          hasNavigatorGamepads: browserStatus.hasNavigatorGamepads,
          status: browserStatus.status,
          gamepads: browserStatus.gamepads,
          instruction: 'If this stays at 0 with Steam Input enabled, disable Steam Input for this app in Steam Controller Settings and retest raw browser/XInput gamepad mode.'
        };
      }
      
      function startControllerConsoleWatch(durationMs = 8000) {
        const duration = Math.max(1000, Math.min(30000, Number(durationMs) || 8000));
        const startedAt = Date.now();
        const samples = [];
        console.log('[Chiggas Controller Watch] started. Focus the game window, press controller buttons, and move both sticks.');
      
        return new Promise(resolve => {
          const timer = setInterval(() => {
            const status = getControllerDiagnosticNow();
            const pressed = status.gamepads.flatMap(pad => (pad.buttons || []).filter(button => button.pressed || button.value > 0.05).map(button => `${pad.index}:${button.index}`));
            const sample = {
              elapsedMs: Date.now() - startedAt,
              controllerCount: status.controllerCount,
              gamepads: status.gamepads.map(pad => ({ index: pad.index, id: pad.id, mapping: pad.mapping, axes: pad.axes, pressed }))
            };
            samples.push(sample);
            console.log('[Chiggas Controller Watch]', sample);
      
            if (Date.now() - startedAt >= duration) {
              clearInterval(timer);
              const finalStatus = getControllerDiagnosticNow();
              const result = {
                ok: true,
                pass: WRAPPER_VERSION,
                status: finalStatus.controllerCount > 0 ? 'controller_detected' : 'no_controller_detected',
                browserControllerCount: finalStatus.controllerCount,
                finalStatus,
                samples
              };
              console.log('[Chiggas Controller Watch] complete', result);
              resolve(result);
            }
          }, 500);
        });
      }
      
      function runControllerActivationTest(durationMs = 6000) {
        const duration = Math.max(1000, Math.min(15000, Number(durationMs) || 6000));
        const startedAt = Date.now();
        const samples = [];
      
        return new Promise(resolve => {
          const timer = setInterval(() => {
            const status = getBrowserGamepadStatus();
            samples.push({
              elapsedMs: Date.now() - startedAt,
              controllerCount: status.controllerCount,
              gamepads: status.gamepads.map(pad => ({
                index: pad.index,
                id: pad.id,
                mapping: pad.mapping,
                pressedButtons: pad.buttons.filter(button => button.pressed || button.value > 0.05).map(button => button.index),
                axes: pad.axes
              }))
            });
      
            if (status.controllerCount > 0 || Date.now() - startedAt >= duration) {
              clearInterval(timer);
              resolve({
                ok: true,
                pass: WRAPPER_VERSION,
                status: status.controllerCount > 0 ? 'controller_detected_during_activation_test' : 'no_controller_detected_during_activation_test',
                instruction: 'While this test is running, press several face buttons and move both sticks on the controller with the Electron game window focused.',
                finalStatus: status,
                samples
              });
            }
          }, 250);
        });
      }
  

  return {
    getBrowserGamepadStatus,
    getControllerDiagnosticNow,
    startControllerConsoleWatch,
    runControllerActivationTest
  };
}

module.exports = {
  createControllerDiagnostics
};
