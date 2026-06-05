const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installLeaderboardProbeMain() {
  // ---- CHIGGAS_LEADERBOARD_PROBE_PASS_96C2A_MAIN BEGIN ----
    ;(() => {
      if (global.__CHIGGAS_LEADERBOARD_PROBE_PASS_96C2A_MAIN__) return;
      global.__CHIGGAS_LEADERBOARD_PROBE_PASS_96C2A_MAIN__ = true;
    
      const PASS = 'steam_desktop_wrapper_pass_96c2a';
      const CHANNEL = 'chiggas-leaderboard-probe-pass-96c2a-write';
    
      let electron;
      try { electron = require('electron'); } catch (err) { return; }
      const ipcMain = electron && electron.ipcMain;
      if (!ipcMain || !ipcMain.handle) return;
    
      const fs = require('fs');
      const path = require('path');
      const traceFile = path.join(STEAM_ROOT, 'pass96c2a-leaderboard-probe-trace.json');
    
      function readTrace() {
        try { return JSON.parse(fs.readFileSync(traceFile, 'utf8')); }
        catch (_) { return { pass: PASS, captureOnly: true, liveSteamSubmissionArmed: false, probes: [] }; }
      }
    
      function writeTrace(trace) {
        fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2), 'utf8');
      }
    
      try {
        ipcMain.handle(CHANNEL, async (_event, payload) => {
          const receivedAt = new Date().toISOString();
          const trace = readTrace();
          trace.pass = PASS;
          trace.captureOnly = true;
          trace.liveSteamSubmissionArmed = false;
          trace.updatedAt = receivedAt;
          trace.previousProbeAt = trace.lastProbe ? trace.lastProbe.receivedAt : null;
    
          const cleanPayload = payload && typeof payload === 'object'
            ? payload
            : { rawPayloadType: typeof payload };
          const entry = Object.assign({ receivedAt }, cleanPayload);
    
          trace.lastProbe = entry;
          trace.probes = Array.isArray(trace.probes) ? trace.probes : [];
          trace.probes.push(entry);
          if (trace.probes.length > 20) trace.probes = trace.probes.slice(-20);
          writeTrace(trace);
    
          return {
            ok: true,
            pass: PASS,
            status: 'steam_leaderboard_pass_96c2a_probe_written',
            captureOnly: true,
            liveSteamSubmissionArmed: false,
            updatedAt: receivedAt,
            lastProbe: entry,
            previousProbeAt: trace.previousProbeAt
          };
        });
      } catch (err) {
        // Existing handler may already be registered after hot reload. Keep app safe.
      }
    })();
    // ---- CHIGGAS_LEADERBOARD_PROBE_PASS_96C2A_MAIN END ----
}

module.exports = {
  installLeaderboardProbeMain
};
