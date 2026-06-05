/* steam_desktop_wrapper_pass_96a
   Fullscreen launch repair + leaderboard foundation.
   Safe by design:
   - Does not touch GameScene.js.
   - Does not grant purchases or entitlements.
   - Does not submit real Steam leaderboard scores yet unless a future native/server method is wired.
   - Uses Steam stats fallback only for local/foundation testing.
*/

const fs = require('fs');
const path = require('path');

const PASS = 'steam_desktop_wrapper_pass_96a';
const APP_ID = 4788490;

let installed = false;
let cachedSteam = null;

function tracePath() {
  return path.join(process.cwd(), 'pass96a-leaderboard-trace.json');
}

function writeTrace(data) {
  const payload = {
    pass: PASS,
    time: new Date().toISOString(),
    ...data
  };
  try {
    fs.writeFileSync(tracePath(), JSON.stringify(payload, null, 2), 'utf8');
  } catch (_) {}
  return payload;
}

function normalizeScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(2147483647, Math.floor(n)));
}

const BOARDS = {
  MITIEST_SURVIVOR_SCORE: {
    statName: 'LB_MITIEST_SURVIVOR_SCORE_BEST',
    sort: 'Descending',
    display: 'Numeric',
    method: 'KeepBest'
  },
  LONGEST_SURVIVAL_SECONDS: {
    statName: 'LB_LONGEST_SURVIVAL_SECONDS_BEST',
    sort: 'Descending',
    display: 'Seconds',
    method: 'KeepBest'
  },
  ENEMIES_DEFEATED_TOTAL: {
    statName: 'LB_ENEMIES_DEFEATED_TOTAL_BEST',
    sort: 'Descending',
    display: 'Numeric',
    method: 'KeepBest'
  }
};

function getSteam() {
  if (cachedSteam) return cachedSteam;
  if (global.ChiggasSteamClient) {
    cachedSteam = global.ChiggasSteamClient;
    return cachedSteam;
  }
  if (global.chiggasSteamClient) {
    cachedSteam = global.chiggasSteamClient;
    return cachedSteam;
  }

  try {
    const steamworks = require('steamworks.js');
    const maybeClient = steamworks.init ? steamworks.init(APP_ID) : null;

    // Newer steamworks.js exposes namespaces directly on the module after init().
    // Older usage examples return a client object from init().
    cachedSteam = maybeClient && typeof maybeClient === 'object' ? maybeClient : steamworks;

    if (!global.ChiggasSteamClient) {
      global.ChiggasSteamClient = cachedSteam;
    }

    return cachedSteam;
  } catch (err) {
    writeTrace({
      ok: false,
      status: 'steamworks_unavailable',
      error: String(err && err.message ? err.message : err)
    });
    return null;
  }
}

function hasNativeLeaderboardApi(steam) {
  if (!steam || typeof steam !== 'object') return false;
  return Boolean(
    steam.leaderboard ||
    steam.leaderboards ||
    (steam.userStats && (
      steam.userStats.findLeaderboard ||
      steam.userStats.findOrCreateLeaderboard ||
      steam.userStats.uploadLeaderboardScore
    ))
  );
}

function getCapabilities() {
  const steam = getSteam();
  const statsFallbackAvailable = Boolean(steam && steam.stats && typeof steam.stats.setInt === 'function');

  const capabilities = {
    ok: true,
    pass: PASS,
    appId: APP_ID,
    steamworksIntegrated: Boolean(steam),
    nativeLeaderboardApi: hasNativeLeaderboardApi(steam),
    statsFallbackAvailable,
    realLeaderboardSubmissionArmed: false,
    reason: hasNativeLeaderboardApi(steam)
      ? 'native_leaderboard_api_detected_but_not_wired_in_pass_96a'
      : 'steamworks_js_leaderboard_methods_not_detected_foundation_only',
    boards: Object.keys(BOARDS).map((name) => ({
      name,
      statFallbackName: BOARDS[name].statName,
      sort: BOARDS[name].sort,
      display: BOARDS[name].display,
      method: BOARDS[name].method
    }))
  };

  writeTrace({
    ok: true,
    status: 'steam_leaderboard_pass_96a_capabilities_checked',
    capabilities
  });

  return capabilities;
}

function submitScoreFoundation(boardName, score, details) {
  const board = String(boardName || '').trim();
  const value = normalizeScore(score);

  if (!BOARDS[board]) {
    return writeTrace({
      ok: false,
      status: 'unknown_leaderboard_board',
      boardName,
      score
    });
  }

  if (value === null) {
    return writeTrace({
      ok: false,
      status: 'invalid_leaderboard_score',
      boardName: board,
      score
    });
  }

  const steam = getSteam();
  const boardConfig = BOARDS[board];

  const result = {
    ok: true,
    status: 'steam_leaderboard_foundation_score_recorded_to_stats_fallback',
    boardName: board,
    score: value,
    details: details || null,
    nativeLeaderboardApi: hasNativeLeaderboardApi(steam),
    realLeaderboardSubmissionArmed: false,
    statFallbackAttempted: false,
    statFallbackStored: false,
    previousStatValue: null,
    newStatValue: value
  };

  // Pass 96A intentionally does NOT upload to true Steam Leaderboards.
  // The current steamworks.js wrapper used by this project does not expose those leaderboard methods.
  // This fallback stores a best-value Steam stat so the renderer/gameplay bridge can be tested safely.
  try {
    if (steam && steam.stats && typeof steam.stats.setInt === 'function') {
      result.statFallbackAttempted = true;

      if (typeof steam.stats.getInt === 'function') {
        const prev = steam.stats.getInt(boardConfig.statName);
        if (typeof prev === 'number') result.previousStatValue = prev;
      }

      const current = typeof result.previousStatValue === 'number' ? result.previousStatValue : 0;
      const keepBestValue = Math.max(current, value);

      result.newStatValue = keepBestValue;
      result.statFallbackSetResult = steam.stats.setInt(boardConfig.statName, keepBestValue);

      if (typeof steam.stats.store === 'function') {
        result.statFallbackStored = steam.stats.store();
      }

      result.status = 'steam_leaderboard_pass_96a_stats_fallback_keep_best_stored';
    } else {
      result.ok = false;
      result.status = 'steam_stats_fallback_unavailable';
    }
  } catch (err) {
    result.ok = false;
    result.status = 'steam_stats_fallback_error';
    result.error = String(err && err.message ? err.message : err);
  }

  return writeTrace(result);
}

function readLocalTrace() {
  try {
    return JSON.parse(fs.readFileSync(tracePath(), 'utf8'));
  } catch (_) {
    return {
      ok: false,
      pass: PASS,
      status: 'pass96a_trace_not_found'
    };
  }
}

function forceWindowFullscreen(win) {
  if (!win || win.isDestroyed()) return;

  try { win.setMenuBarVisibility(false); } catch (_) {}
  try { win.setAutoHideMenuBar(true); } catch (_) {}
  try { win.maximize(); } catch (_) {}
  try { win.setFullScreen(true); } catch (_) {}
  try { win.show(); } catch (_) {}
  try { win.focus(); } catch (_) {}
}

function applyFullscreenToAllWindows() {
  try {
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows ? BrowserWindow.getAllWindows() : [];
    for (const win of windows) forceWindowFullscreen(win);
  } catch (_) {}
}

function install() {
  if (installed) return;
  installed = true;

  const { app, BrowserWindow, ipcMain } = require('electron');

  try {
    app.commandLine.appendSwitch('start-fullscreen');
  } catch (_) {}

  try {
    app.on('browser-window-created', (_event, win) => {
      setTimeout(() => forceWindowFullscreen(win), 50);
      setTimeout(() => forceWindowFullscreen(win), 250);
      setTimeout(() => forceWindowFullscreen(win), 1000);

      try {
        win.once('ready-to-show', () => forceWindowFullscreen(win));
      } catch (_) {}

      try {
        win.webContents.once('did-finish-load', () => {
          forceWindowFullscreen(win);
          writeTrace({
            ok: true,
            status: 'steam_desktop_wrapper_pass_96a_fullscreen_forced',
            fullscreen: typeof win.isFullScreen === 'function' ? win.isFullScreen() : null,
            maximized: typeof win.isMaximized === 'function' ? win.isMaximized() : null,
            minimized: typeof win.isMinimized === 'function' ? win.isMinimized() : null
          });
        });
      } catch (_) {}
    });
  } catch (_) {}

  try {
    app.whenReady().then(() => {
      setTimeout(applyFullscreenToAllWindows, 50);
      setTimeout(applyFullscreenToAllWindows, 250);
      setTimeout(applyFullscreenToAllWindows, 1000);
    });
  } catch (_) {}

  try {
    ipcMain.handle('chiggas-steam-leaderboards-pass-96a-capabilities', async () => getCapabilities());
    ipcMain.handle('chiggas-steam-leaderboards-pass-96a-submit-score', async (_event, payload) => {
      payload = payload || {};
      return submitScoreFoundation(payload.boardName, payload.score, payload.details);
    });
    ipcMain.handle('chiggas-steam-leaderboards-pass-96a-read-trace', async () => readLocalTrace());
  } catch (err) {
    writeTrace({
      ok: false,
      status: 'steam_leaderboard_pass_96a_ipc_registration_error',
      error: String(err && err.message ? err.message : err)
    });
  }
}

module.exports = {
  install,
  getCapabilities,
  submitScoreFoundation,
  readLocalTrace
};
