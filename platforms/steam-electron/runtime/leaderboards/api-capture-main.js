const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installLeaderboardApiAndCaptureMain() {
  // steam_desktop_wrapper_pass_96a_install_marker
    try {
      require('../../steam-leaderboards-pass-96a').install();
    } catch (err) {
      console.error('[Pass96A] install failed:', err && err.message ? err.message : err);
    }
    // /steam_desktop_wrapper_pass_96a_install_marker
    
    
    // steam_desktop_wrapper_pass_96c_install_marker
    try {
      require(require('path').join(STEAM_ROOT, 'steam-leaderboard-capture-pass-96c.js')).installMain();
    } catch (err) {
      console.error('[Pass96C] leaderboard capture main install failed:', err && err.message ? err.message : err);
    }
    // /steam_desktop_wrapper_pass_96c_install_marker
}

module.exports = {
  installLeaderboardApiAndCaptureMain
};
