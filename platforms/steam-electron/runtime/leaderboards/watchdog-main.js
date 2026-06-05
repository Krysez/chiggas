const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installLeaderboardWatchdogMain() {
  // ---- CHIGGAS_LEADERBOARD_WATCHDOG_SUBMIT_PASS_96F_MAIN BEGIN ----
    ;(() => {
      if (global.__CHIGGAS_LEADERBOARD_WATCHDOG_SUBMIT_PASS_96F_MAIN__) return;
      global.__CHIGGAS_LEADERBOARD_WATCHDOG_SUBMIT_PASS_96F_MAIN__ = true;
    
      const PASS = 'steam_desktop_wrapper_pass_96f';
      const SUBMIT_CHANNEL = 'chiggas-leaderboard-watchdog-pass-96f-submit';
      const READ_CHANNEL = 'chiggas-leaderboard-watchdog-pass-96f-read-trace';
      const RESET_CHANNEL = 'chiggas-leaderboard-watchdog-pass-96f-reset-trace';
      const APP_ID = 4788490;
    
      let electron;
      try { electron = require('electron'); } catch (err) { return; }
      const ipcMain = electron && electron.ipcMain;
      if (!ipcMain || !ipcMain.handle) return;
    
      const fs = require('fs');
      const path = require('path');
      const traceFile = path.join(STEAM_ROOT, 'pass96f-leaderboard-watchdog-submit-trace.json');
      const helperPath = path.join(STEAM_ROOT, 'steam-leaderboards-backend-pass-96b.js');
      const identityTracePath = path.join(STEAM_ROOT, 'steam-leaderboard-pass-96b-local-steamid.json');
    
      function readJson(file) {
        try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
      }
    
      function readTrace() {
        return readJson(traceFile) || {
          pass: PASS,
          liveSteamSubmissionArmed: true,
          autoSubmitEnabled: true,
          watchdogEnabled: false,
          requests: [],
          submissions: [],
          submittedValueSignatures: {}
        };
      }
    
      function writeTrace(trace) {
        try { fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2), 'utf8'); } catch (_) {}
      }
    
      function normalizeSteamId(value) {
        if (value === undefined || value === null) return null;
        if (typeof value === 'string') return /^\d{17}$/.test(value) ? value : null;
        if (typeof value === 'bigint') return normalizeSteamId(value.toString());
        if (typeof value === 'number') return normalizeSteamId(String(Math.trunc(value)));
        if (typeof value === 'object') {
          const keys = ['steamId64', 'steamid64', 'steamID64', 'id', 'steamId', 'steamid', 'accountId'];
          for (const key of keys) {
            if (value[key] !== undefined && value[key] !== null) {
              const normalized = normalizeSteamId(value[key]);
              if (normalized) return normalized;
            }
          }
          try {
            if (typeof value.toString === 'function') {
              const s = value.toString();
              if (/^\d{17}$/.test(s)) return s;
            }
          } catch (_) {}
        }
        return null;
      }
    
      function getSteamId64() {
        const env = process.env.STEAM_TEST_STEAMID ||
          process.env.CHIGGAS_TEST_STEAMID ||
          process.env.STEAM_ID_64 ||
          process.env.STEAM_LEADERBOARD_TEST_STEAM_ID64;
        const envId = normalizeSteamId(env);
        if (envId) return { steamId64: envId, source: 'environment' };
    
        const identity = readJson(identityTracePath);
        const traceId = normalizeSteamId(identity && identity.steamId64);
        if (traceId) return { steamId64: traceId, source: 'pass96b_identity_trace' };
    
        try {
          const steamworks = require('steamworks.js');
          const client = steamworks.init ? steamworks.init(APP_ID) : null;
          const rawSteamId = client && client.localplayer && client.localplayer.getSteamId ? client.localplayer.getSteamId() : null;
          const steamId64 = normalizeSteamId(rawSteamId);
          if (steamId64) return { steamId64, source: 'steamworks_localplayer' };
        } catch (_) {}
    
        return { steamId64: null, source: null };
      }
    
      function asInt(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        return Math.max(0, Math.trunc(n));
      }
    
      function getScoreObject(payload, apiName) {
        const candidates = [
          payload && payload.scores && payload.scores[apiName],
          payload && payload.mappedScores && payload.mappedScores[apiName]
        ];
        for (const c of candidates) {
          if (c && typeof c === 'object') return c;
          if (typeof c === 'number') return { value: c, scoreMethod: 'KeepBest' };
        }
        return null;
      }
    
      function normalizeScores(payload) {
        const boards = ['MITIEST_SURVIVOR_SCORE', 'LONGEST_SURVIVAL_SECONDS', 'ENEMIES_DEFEATED_TOTAL'];
        const mappedScores = {};
        const readyBoards = [];
        for (const apiName of boards) {
          const raw = getScoreObject(payload, apiName);
          const value = raw ? asInt(raw.value !== undefined ? raw.value : raw.score) : null;
          mappedScores[apiName] = {
            apiName,
            value,
            sourceKey: raw && raw.sourceKey || null,
            scoreMethod: raw && raw.scoreMethod || 'KeepBest',
            readyForSubmit: value !== null
          };
          if (value !== null) readyBoards.push(apiName);
        }
        return { mappedScores, readyBoards };
      }
    
      function valueSignature(runSignature, mappedScores) {
        const score = mappedScores.MITIEST_SURVIVOR_SCORE && mappedScores.MITIEST_SURVIVOR_SCORE.value;
        const seconds = mappedScores.LONGEST_SURVIVAL_SECONDS && mappedScores.LONGEST_SURVIVAL_SECONDS.value;
        const kills = mappedScores.ENEMIES_DEFEATED_TOTAL && mappedScores.ENEMIES_DEFEATED_TOTAL.value;
        return String(runSignature) + '|score=' + String(score) + '|seconds=' + String(seconds) + '|kills=' + String(kills);
      }
    
      function appendTrace(kind, data) {
        const trace = readTrace();
        trace.pass = PASS;
        trace.liveSteamSubmissionArmed = true;
        trace.autoSubmitEnabled = true;
        trace.watchdogEnabled = true;
        trace.updatedAt = new Date().toISOString();
        trace.requests = Array.isArray(trace.requests) ? trace.requests : [];
        trace.submissions = Array.isArray(trace.submissions) ? trace.submissions : [];
        trace.submittedValueSignatures = trace.submittedValueSignatures && typeof trace.submittedValueSignatures === 'object' ? trace.submittedValueSignatures : {};
        if (kind === 'request') {
          trace.lastRequest = data;
          trace.requests.push(data);
          if (trace.requests.length > 50) trace.requests = trace.requests.slice(-50);
        } else if (kind === 'submission') {
          trace.lastSubmission = data;
          trace.submissions.push(data);
          if (trace.submissions.length > 50) trace.submissions = trace.submissions.slice(-50);
          if (data && data.valueSignature && data.ok) trace.submittedValueSignatures[data.valueSignature] = data.completedAt || trace.updatedAt;
        }
        writeTrace(trace);
        return trace;
      }
    
      async function submitMappedScores(payload) {
        const receivedAt = new Date().toISOString();
        const normalized = normalizeScores(payload || {});
        const runSignature = String((payload && payload.runSignature) || 'run-' + receivedAt);
        const sig = valueSignature(runSignature, normalized.mappedScores);
        const requestRecord = {
          receivedAt,
          pass: PASS,
          reason: payload && payload.reason || 'watchdog_submit',
          source: payload && payload.source || 'unknown',
          runSignature,
          valueSignature: sig,
          sceneSourcePath: payload && payload.sceneSourcePath || null,
          mappedScores: normalized.mappedScores,
          readyBoards: normalized.readyBoards,
          manual: !!(payload && payload.manual),
          force: !!(payload && payload.force),
          watchdog: !!(payload && payload.watchdog),
          deathSignal: payload && payload.deathSignal || null
        };
        appendTrace('request', requestRecord);
    
        const result = {
          ok: false,
          pass: PASS,
          status: 'steam_leaderboard_pass_96f_submit_not_started',
          receivedAt,
          completedAt: null,
          liveSteamSubmissionArmed: true,
          autoSubmitEnabled: true,
          watchdogEnabled: true,
          runSignature,
          valueSignature: sig,
          reason: requestRecord.reason,
          steamId64: null,
          steamIdSource: null,
          mappedScores: normalized.mappedScores,
          readyBoards: normalized.readyBoards,
          submissions: [],
          readbacks: [],
          duplicateIgnored: false,
          error: null,
          notes: [
            'Watchdog wrapper-side leaderboard submit. No GameScene.js source edits.',
            'Uses the trusted backend helper from Pass 96B.'
          ]
        };
    
        try {
          if (normalized.readyBoards.length !== 3) {
            throw new Error('Incomplete mapped scores. Ready boards: ' + normalized.readyBoards.join(', '));
          }
    
          const scoreValues = Object.values(normalized.mappedScores).map((b) => b.value || 0);
          if (!scoreValues.some((v) => v > 0)) throw new Error('Refusing to submit all-zero leaderboard values.');
    
          const trace = readTrace();
          const alreadySubmitted = trace.submittedValueSignatures && trace.submittedValueSignatures[sig];
          if (alreadySubmitted && !(payload && payload.force)) {
            result.ok = true;
            result.status = 'steam_leaderboard_pass_96f_duplicate_value_signature_ignored';
            result.duplicateIgnored = true;
            result.completedAt = new Date().toISOString();
            appendTrace('submission', result);
            return result;
          }
    
          if (!fs.existsSync(helperPath)) throw new Error('Missing steam-leaderboards-backend-pass-96b.js. Pass 96B must remain installed.');
          const helper = require(helperPath);
          const identity = getSteamId64();
          if (!identity.steamId64) throw new Error('Could not detect SteamID64. Run npm run steam:pass96b:identity while Steam is running.');
          result.steamId64 = identity.steamId64;
          result.steamIdSource = identity.source;
    
          const boards = Object.values(normalized.mappedScores);
          for (const board of boards) {
            const submit = await helper.setLeaderboardScore({
              apiName: board.apiName,
              steamId: identity.steamId64,
              score: board.value,
              scoreMethod: board.scoreMethod || 'KeepBest'
            });
            result.submissions.push(submit);
            try {
              const readback = await helper.getLeaderboardEntries({
                apiName: board.apiName,
                rangeStart: 0,
                rangeEnd: 10,
                steamId: identity.steamId64,
                dataRequest: 'RequestAroundUser'
              });
              result.readbacks.push(readback);
            } catch (readErr) {
              result.readbacks.push({ ok: false, apiName: board.apiName, error: String(readErr && readErr.message || readErr) });
            }
          }
    
          result.ok = result.submissions.length === 3 && result.submissions.every((s) => s && s.ok);
          result.status = result.ok ? 'steam_leaderboard_pass_96f_watchdog_scores_submitted' : 'steam_leaderboard_pass_96f_watchdog_submit_incomplete';
          result.completedAt = new Date().toISOString();
        } catch (err) {
          result.ok = false;
          result.status = 'steam_leaderboard_pass_96f_submit_error';
          result.error = String(err && err.message || err);
          if (err && err.result) result.steamApiError = err.result;
          result.completedAt = new Date().toISOString();
        }
    
        appendTrace('submission', result);
        return result;
      }
    
      try { ipcMain.handle(SUBMIT_CHANNEL, async (_event, payload) => submitMappedScores(payload || {})); } catch (_) {}
    
      try {
        ipcMain.handle(READ_CHANNEL, async () => {
          const trace = readTrace();
          return Object.assign({ ok: true, status: 'steam_leaderboard_pass_96f_trace_read' }, trace);
        });
      } catch (_) {}
    
      try {
        ipcMain.handle(RESET_CHANNEL, async () => {
          try { fs.unlinkSync(traceFile); } catch (_) {}
          return { ok: true, pass: PASS, status: 'steam_leaderboard_pass_96f_trace_reset', traceFile };
        });
      } catch (_) {}
    })();
    // ---- CHIGGAS_LEADERBOARD_WATCHDOG_SUBMIT_PASS_96F_MAIN END ----
}

module.exports = {
  installLeaderboardWatchdogMain
};
