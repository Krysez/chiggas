const { pageWatchdogInstaller } = require('./watchdog-page-installer-preload');

function installLeaderboardWatchdogPreload() {
  // ---- CHIGGAS_LEADERBOARD_WATCHDOG_SUBMIT_PASS_96F_PRELOAD BEGIN ----
    ;(() => {
      if (globalThis.__CHIGGAS_LEADERBOARD_WATCHDOG_SUBMIT_PASS_96F_PRELOAD__) return;
      globalThis.__CHIGGAS_LEADERBOARD_WATCHDOG_SUBMIT_PASS_96F_PRELOAD__ = true;
    
      const PASS = 'steam_desktop_wrapper_pass_96f';
      const SUBMIT_CHANNEL = 'chiggas-leaderboard-watchdog-pass-96f-submit';
      const READ_CHANNEL = 'chiggas-leaderboard-watchdog-pass-96f-read-trace';
      const RESET_CHANNEL = 'chiggas-leaderboard-watchdog-pass-96f-reset-trace';
      const REQUEST = 'chiggas-leaderboard-watchdog-pass-96f-request';
      const RESULT = 'chiggas-leaderboard-watchdog-pass-96f-result';
    
      let electron = null;
      try { electron = require('electron'); } catch (_) { electron = null; }
      const ipcRenderer = electron && electron.ipcRenderer;
      const contextBridge = electron && electron.contextBridge;
      const pending = new Map();
      let lastSubmitResult = null;
    

    
      function injectPageWatchdog() {
        try {
          if (document.getElementById('chiggas-leaderboard-watchdog-pass-96f-script')) return true;
          const script = document.createElement('script');
          script.id = 'chiggas-leaderboard-watchdog-pass-96f-script';
          script.textContent = '(' + pageWatchdogInstaller.toString() + ')();';
          (document.documentElement || document.head || document.body).appendChild(script);
          script.remove();
          return true;
        } catch (err) {
          lastSubmitResult = { ok: false, pass: PASS, status: 'inject_failed', error: String(err && err.message || err) };
          return false;
        }
      }
    
      async function invokeMain(payload) {
        if (!ipcRenderer || !ipcRenderer.invoke) return { ok: false, pass: PASS, status: 'ipcRenderer_unavailable' };
        try { return await ipcRenderer.invoke(SUBMIT_CHANNEL, payload || {}); }
        catch (err) { return { ok: false, pass: PASS, status: 'ipc_submit_failed', error: String(err && err.message || err) }; }
      }
    
      if (typeof window !== 'undefined') {
        window.addEventListener('message', async function(event) {
          if (event.source !== window) return;
          const data = event.data || {};
          if (!data || data.type !== 'chiggas-leaderboard-watchdog-pass-96f-page-submit') return;
          const result = await invokeMain(data.payload || {});
          lastSubmitResult = result;
          window.postMessage({ type: 'chiggas-leaderboard-watchdog-pass-96f-preload-submit-result', requestId: data.requestId, result: result }, '*');
        });
    
        window.addEventListener('message', function(event) {
          if (event.source !== window) return;
          const data = event.data || {};
          if (!data || data.type !== RESULT) return;
          const resolver = pending.get(data.requestId);
          if (resolver) {
            pending.delete(data.requestId);
            resolver(data.payload);
          }
        });
      }
    
      function pageRequest(action, reason, options) {
        injectPageWatchdog();
        options = options || {};
        const requestId = 'pass96f-api-' + Date.now() + '-' + Math.random().toString(16).slice(2);
        return new Promise(function(resolve) {
          pending.set(requestId, resolve);
          try {
            window.postMessage({ type: REQUEST, requestId: requestId, action: action, reason: reason || action, force: !!options.force, options: options.options || {} }, '*');
          } catch (err) {
            pending.delete(requestId);
            resolve({ ok: false, pass: PASS, status: 'post_message_failed', error: String(err && err.message || err) });
          }
          setTimeout(function() {
            if (pending.has(requestId)) {
              pending.delete(requestId);
              resolve({ ok: false, pass: PASS, status: 'page_request_timeout', action: action });
            }
          }, 16000);
        });
      }
    
      const api = {
        pass: PASS,
        install: function() { return { ok: injectPageWatchdog(), pass: PASS, status: 'watchdog_page_script_installed' }; },
        getCapabilities: function() { return { ok: true, pass: PASS, liveSteamSubmissionArmed: true, autoSubmitEnabled: true, watchdogEnabled: true, wrapperOnly: true }; },
        start: function(options) { return pageRequest('startWatchdog', 'manual_start_watchdog', { options: options || {} }); },
        stop: function() { return pageRequest('stopWatchdog', 'manual_stop_watchdog'); },
        snapshot: function(reason) { return pageRequest('snapshot', reason || 'manual_snapshot'); },
        submitNow: function(reason, force) { return pageRequest('submitNow', reason || 'manual_submit_now', { force: force !== false }); },
        installHooks: function() { return pageRequest('installHooks', 'manual_install_hooks'); },
        status: function() { return pageRequest('status', 'manual_status'); },
        readTrace: function() { return ipcRenderer && ipcRenderer.invoke ? ipcRenderer.invoke(READ_CHANNEL) : Promise.resolve({ ok: false, pass: PASS, status: 'ipcRenderer_unavailable' }); },
        resetTrace: function() { return ipcRenderer && ipcRenderer.invoke ? ipcRenderer.invoke(RESET_CHANNEL) : Promise.resolve({ ok: false, pass: PASS, status: 'ipcRenderer_unavailable' }); },
        getLastSubmitResult: function() { return lastSubmitResult; }
      };
    
      try {
        if (contextBridge && contextBridge.exposeInMainWorld) contextBridge.exposeInMainWorld('ChiggasLeaderboardsWatchdog', api);
        else if (typeof window !== 'undefined') window.ChiggasLeaderboardsWatchdog = api;
      } catch (_) {
        try { if (typeof window !== 'undefined') window.ChiggasLeaderboardsWatchdog = api; } catch (_) {}
      }
    
      try {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectPageWatchdog, { once: true });
        else injectPageWatchdog();
      } catch (_) {}
    })();
    // ---- CHIGGAS_LEADERBOARD_WATCHDOG_SUBMIT_PASS_96F_PRELOAD END ----
}

module.exports = {
  installLeaderboardWatchdogPreload
};
