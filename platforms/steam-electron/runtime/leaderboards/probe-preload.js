const { pageProbeInstaller } = require('./probe-page-installer-preload');

function installLeaderboardProbePreload() {
  // ---- CHIGGAS_LEADERBOARD_PROBE_PASS_96C2A_PRELOAD BEGIN ----
    ;(() => {
      if (globalThis.__CHIGGAS_LEADERBOARD_PROBE_PASS_96C2A_PRELOAD__) return;
      globalThis.__CHIGGAS_LEADERBOARD_PROBE_PASS_96C2A_PRELOAD__ = true;
    
      const PASS = 'steam_desktop_wrapper_pass_96c2a';
      const CHANNEL = 'chiggas-leaderboard-probe-pass-96c2a-write';
      const REQUEST = 'chiggas-leaderboard-probe-pass-96c2a-request';
      const RESULT = 'chiggas-leaderboard-probe-pass-96c2a-result';
    
      let electron = null;
      try { electron = require('electron'); } catch (_) { electron = null; }
      const ipcRenderer = electron && electron.ipcRenderer;
      const contextBridge = electron && electron.contextBridge;
      const pending = new Map();
      let lastProbe = null;
    

    
      function injectPageProbe() {
        try {
          if (document.getElementById('chiggas-leaderboard-probe-pass-96c2a-script')) return true;
          const script = document.createElement('script');
          script.id = 'chiggas-leaderboard-probe-pass-96c2a-script';
          script.textContent = '(' + pageProbeInstaller.toString() + ')();';
          (document.documentElement || document.head || document.body).appendChild(script);
          script.remove();
          return true;
        } catch (err) {
          lastProbe = { ok: false, pass: PASS, status: 'inject_failed', error: String(err && err.message || err) };
          return false;
        }
      }
    
      if (typeof window !== 'undefined') {
        window.addEventListener('message', async function(event) {
          if (event.source !== window) return;
          const data = event.data || {};
          if (!data || data.type !== RESULT) return;
          const payload = data.payload || {};
          lastProbe = payload;
          let writeResult = null;
          try {
            if (ipcRenderer && ipcRenderer.invoke) writeResult = await ipcRenderer.invoke(CHANNEL, payload);
          } catch (err) {
            writeResult = { ok: false, pass: PASS, status: 'ipc_write_failed', error: String(err && err.message || err) };
          }
          const resolver = pending.get(data.requestId);
          if (resolver) {
            pending.delete(data.requestId);
            resolver({ ok: !!(writeResult && writeResult.ok), pass: PASS, status: writeResult && writeResult.status || 'probe_completed_without_ipc_result', writeResult: writeResult, probe: payload });
          }
        });
      }
    
      function probe(reason) {
        injectPageProbe();
        const requestId = 'pass96c2a-' + Date.now() + '-' + Math.random().toString(16).slice(2);
        return new Promise(function(resolve) {
          pending.set(requestId, resolve);
          try {
            window.postMessage({ type: REQUEST, reason: reason || 'manual_probe', requestId: requestId }, '*');
          } catch (err) {
            pending.delete(requestId);
            resolve({ ok: false, pass: PASS, status: 'post_message_failed', error: String(err && err.message || err) });
          }
          setTimeout(function() {
            if (pending.has(requestId)) {
              pending.delete(requestId);
              resolve({ ok: false, pass: PASS, status: 'probe_timeout', lastProbe: lastProbe });
            }
          }, 3000);
        });
      }
    
      const api = {
        pass: PASS,
        install: function() { return { ok: injectPageProbe(), pass: PASS, status: 'probe_installed' }; },
        probe: probe,
        snapshot: probe,
        getLastProbe: function() { return lastProbe; },
        getCapabilities: function() {
          return { ok: true, pass: PASS, captureOnly: true, liveSteamSubmissionArmed: false, pageProbeInstalled: !!(typeof window !== 'undefined' && window.ChiggasLeaderboardPageProbe) };
        }
      };
    
      try {
        if (contextBridge && contextBridge.exposeInMainWorld) contextBridge.exposeInMainWorld('ChiggasLeaderboardProbe', api);
        else if (typeof window !== 'undefined') window.ChiggasLeaderboardProbe = api;
      } catch (_) {
        try { if (typeof window !== 'undefined') window.ChiggasLeaderboardProbe = api; } catch (_) {}
      }
    
      try {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectPageProbe, { once: true });
        else injectPageProbe();
      } catch (_) {}
    })();
    // ---- CHIGGAS_LEADERBOARD_PROBE_PASS_96C2A_PRELOAD END ----
}

module.exports = {
  installLeaderboardProbePreload
};
