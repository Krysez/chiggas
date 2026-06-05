const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installKeyboardTestMain() {
  // CHIGGAS_STEAM_DESKTOP_WRAPPER_PASS_33_ACHIEVEMENT_KEYBOARD_TEST_BEGIN
    ;(() => {
      try {
        const { app } = require('electron');
        const pass33KeyboardHarness = require('../../scripts/chiggas-steam-achievement-keyboard-test-harness-pass-33.js');
        const installPass33KeyboardHarness = () => {
          try {
            pass33KeyboardHarness.install({ root: STEAM_ROOT });
          } catch (error) {
            console.warn('[steam_desktop_wrapper_pass_33] keyboard harness install failed:', error && error.message ? error.message : error);
          }
        };
    
        if (app && typeof app.whenReady === 'function') {
          app.whenReady().then(installPass33KeyboardHarness).catch((error) => {
            console.warn('[steam_desktop_wrapper_pass_33] app.whenReady failed:', error && error.message ? error.message : error);
          });
        }
      } catch (error) {
        console.warn('[steam_desktop_wrapper_pass_33] keyboard harness bootstrap failed:', error && error.message ? error.message : error);
      }
    })();
    // CHIGGAS_STEAM_DESKTOP_WRAPPER_PASS_33_ACHIEVEMENT_KEYBOARD_TEST_END
}

module.exports = {
  installKeyboardTestMain
};
