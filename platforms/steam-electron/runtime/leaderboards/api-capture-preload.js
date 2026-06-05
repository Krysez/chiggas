const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installLeaderboardApiAndCapturePreload() {
  // steam_desktop_wrapper_pass_96a_preload_marker
    (function () {
      try {
        const { ipcRenderer, contextBridge } = require('electron');
    
        const api = {
          getCapabilities: function () {
            return ipcRenderer.invoke('chiggas-steam-leaderboards-pass-96a-capabilities');
          },
          submitScore: function (boardName, score, details) {
            return ipcRenderer.invoke('chiggas-steam-leaderboards-pass-96a-submit-score', {
              boardName: boardName,
              score: score,
              details: details || null
            });
          },
          readTrace: function () {
            return ipcRenderer.invoke('chiggas-steam-leaderboards-pass-96a-read-trace');
          }
        };
    
        try {
          if (contextBridge && process.contextIsolated) {
            contextBridge.exposeInMainWorld('ChiggasSteamLeaderboards', api);
          } else {
            window.ChiggasSteamLeaderboards = api;
          }
        } catch (_) {
          window.ChiggasSteamLeaderboards = api;
        }
    
        window.addEventListener('DOMContentLoaded', function () {
          try {
            window.ChiggasSteamLeaderboardsPass96AReady = true;
          } catch (_) {}
        });
      } catch (err) {
        try {
          window.ChiggasSteamLeaderboardsPass96AError = String(err && err.message ? err.message : err);
        } catch (_) {}
      }
    })();
    // /steam_desktop_wrapper_pass_96a_preload_marker
    
    
    // steam_desktop_wrapper_pass_96c_preload_marker
    try {
      require(require('path').join(STEAM_ROOT, 'steam-leaderboard-capture-pass-96c.js')).installPreload();
    } catch (err) {
      try { window.ChiggasLeaderboardCapturePass96CError = String(err && err.message ? err.message : err); } catch (_) {}
      console.error('[Pass96C] leaderboard capture preload install failed:', err && err.message ? err.message : err);
    }
    // /steam_desktop_wrapper_pass_96c_preload_marker
}

module.exports = {
  installLeaderboardApiAndCapturePreload
};
