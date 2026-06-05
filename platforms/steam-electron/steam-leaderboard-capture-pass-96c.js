'use strict';

/**
 * Chiggas: Survival of the Mitiest
 * Steam Desktop Wrapper Pass 96C
 * Safe gameplay leaderboard event capture.
 *
 * This pass intentionally does NOT submit scores to Steam.
 * It only captures candidate run totals from the renderer/gameplay context and
 * writes traces so the next pass can wire the correct fields safely.
 */

const fs = require('fs');
const path = require('path');

const PASS = 'steam_desktop_wrapper_pass_96c';
const ROOT = process.cwd();
const TRACE_FILE = path.join(ROOT, 'pass96c-leaderboard-capture-trace.json');
const HISTORY_FILE = path.join(ROOT, 'pass96c-leaderboard-capture-history.jsonl');

const BOARDS = {
  MITIEST_SURVIVOR_SCORE: {
    display: 'Numeric',
    scoreMethod: 'KeepBest',
    candidateKeys: [
      'mitiestSurvivorScore', 'mitiestScore', 'survivorScore', 'survivalScore',
      'finalScore', 'totalScore', 'runScore', 'score', 'playerScore', 'currentScore'
    ]
  },
  LONGEST_SURVIVAL_SECONDS: {
    display: 'Seconds',
    scoreMethod: 'KeepBest',
    candidateKeys: [
      'survivalSeconds', 'secondsSurvived', 'timeSurvivedSeconds', 'runSeconds',
      'elapsedSeconds', 'elapsedTime', 'survivalTime', 'timeSurvived', 'runTime', 'gameTime'
    ]
  },
  ENEMIES_DEFEATED_TOTAL: {
    display: 'Numeric',
    scoreMethod: 'KeepBest',
    candidateKeys: [
      'enemiesDefeatedTotal', 'enemiesDefeated', 'enemiesKilled', 'killCount',
      'enemyKillCount', 'kills', 'totalKills', 'defeatedEnemies', 'chiggasDefeated'
    ]
  }
};

function safeNow() {
  return new Date().toISOString();
}

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
}

function safeReadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function appendJsonl(file, data) {
  try {
    ensureDir(path.dirname(file));
    fs.appendFileSync(file, JSON.stringify(data) + '\n', 'utf8');
  } catch (_) {}
}

function normalizeInt(value) {
  if (typeof value === 'string' && value.trim() !== '') value = Number(value);
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const n = Math.trunc(value);
  if (n < 0) return 0;
  if (n > 2147483647) return 2147483647;
  return n;
}

function firstNumberFrom(snapshot, keys) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const direct = snapshot.values || {};
  for (const key of keys) {
    const value = normalizeInt(direct[key]);
    if (value !== null) return { key, value };
  }
  const numericFields = snapshot.numericFields || {};
  for (const key of keys) {
    const value = normalizeInt(numericFields[key]);
    if (value !== null) return { key, value };
  }
  return null;
}

function normalizeScoresFromCapture(capture) {
  const snapshot = capture && capture.snapshot ? capture.snapshot : null;
  const scores = {};
  for (const [boardName, config] of Object.entries(BOARDS)) {
    const found = firstNumberFrom(snapshot, config.candidateKeys);
    scores[boardName] = {
      value: found ? found.value : null,
      sourceKey: found ? found.key : null,
      display: config.display,
      scoreMethod: config.scoreMethod,
      readyForSubmit: Boolean(found && Number.isInteger(found.value))
    };
  }
  return scores;
}

function publicCapabilities() {
  return {
    ok: true,
    pass: PASS,
    traceFile: TRACE_FILE,
    historyFile: HISTORY_FILE,
    boards: Object.keys(BOARDS),
    liveSteamSubmissionArmed: false,
    captureOnly: true,
    note: 'Pass 96C captures gameplay values only. It does not submit leaderboard scores.'
  };
}

function writeCapture(rawCapture) {
  const previous = safeReadJson(TRACE_FILE, null);
  const capture = {
    pass: PASS,
    captureOnly: true,
    liveSteamSubmissionArmed: false,
    receivedAt: safeNow(),
    source: rawCapture && rawCapture.source ? rawCapture.source : 'renderer',
    reason: rawCapture && rawCapture.reason ? rawCapture.reason : 'unspecified',
    eventName: rawCapture && rawCapture.eventName ? rawCapture.eventName : null,
    snapshot: rawCapture && rawCapture.snapshot ? rawCapture.snapshot : null,
    rendererState: rawCapture && rawCapture.rendererState ? rawCapture.rendererState : null
  };

  capture.normalizedScores = normalizeScoresFromCapture(capture);

  const trace = {
    ok: true,
    pass: PASS,
    status: 'steam_leaderboard_pass_96c_capture_written',
    updatedAt: safeNow(),
    captureOnly: true,
    liveSteamSubmissionArmed: false,
    lastCapture: capture,
    previousCaptureAt: previous && previous.lastCapture ? previous.lastCapture.receivedAt : null
  };

  writeJson(TRACE_FILE, trace);
  appendJsonl(HISTORY_FILE, capture);
  return trace;
}

function readTrace() {
  return safeReadJson(TRACE_FILE, {
    ok: false,
    pass: PASS,
    status: 'steam_leaderboard_pass_96c_trace_not_found',
    traceFile: TRACE_FILE,
    captureOnly: true,
    liveSteamSubmissionArmed: false
  });
}

function resetTrace() {
  const removed = [];
  for (const file of [TRACE_FILE, HISTORY_FILE]) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        removed.push(file);
      }
    } catch (_) {}
  }
  return {
    ok: true,
    pass: PASS,
    status: 'steam_leaderboard_pass_96c_trace_reset',
    removed
  };
}

function installMain() {
  const { ipcMain } = require('electron');

  try {
    ipcMain.handle('chiggas-steam-leaderboards-pass-96c-capabilities', async () => publicCapabilities());
    ipcMain.handle('chiggas-steam-leaderboards-pass-96c-capture', async (_event, payload) => writeCapture(payload || {}));
    ipcMain.handle('chiggas-steam-leaderboards-pass-96c-read-trace', async () => readTrace());
    ipcMain.handle('chiggas-steam-leaderboards-pass-96c-reset-trace', async () => resetTrace());
  } catch (err) {
    writeCapture({
      source: 'main',
      reason: 'ipc_registration_error',
      snapshot: {
        values: {},
        error: String(err && err.message ? err.message : err)
      }
    });
  }
}

function getPageScript() {
  return String.raw`(function () {
  if (window.__ChiggasLeaderboardCapturePass96CInstalled) return;
  window.__ChiggasLeaderboardCapturePass96CInstalled = true;

  var PASS = 'steam_desktop_wrapper_pass_96c';
  var MESSAGE_SOURCE = 'chiggas-pass96c-leaderboard-capture';
  var REQUEST_EVENT = 'chiggas-pass96c-request-snapshot';
  var RESET_EVENT = 'chiggas-pass96c-reset-state';

  var state = {
    installedAt: new Date().toISOString(),
    hookAttempts: 0,
    hookedMethods: [],
    lastSnapshot: null,
    lastCaptureReason: null,
    lastCaptureAt: null,
    snapshotCount: 0,
    sceneKeysSeen: [],
    errors: []
  };

  var VALUE_KEYS = {
    score: [
      'mitiestSurvivorScore', 'mitiestScore', 'survivorScore', 'survivalScore',
      'finalScore', 'totalScore', 'runScore', 'score', 'playerScore', 'currentScore'
    ],
    seconds: [
      'survivalSeconds', 'secondsSurvived', 'timeSurvivedSeconds', 'runSeconds',
      'elapsedSeconds', 'elapsedTime', 'survivalTime', 'timeSurvived', 'runTime', 'gameTime'
    ],
    enemies: [
      'enemiesDefeatedTotal', 'enemiesDefeated', 'enemiesKilled', 'killCount',
      'enemyKillCount', 'kills', 'totalKills', 'defeatedEnemies', 'chiggasDefeated'
    ],
    stage: ['stageIndex', 'currentStage', 'stage', 'level', 'currentLevel'],
    player: ['playerStr', 'playerSTR', 'str', 'STR', 'playerHp', 'playerHP', 'hp', 'health']
  };

  var FINAL_METHODS = [
    'handlePlayerDeath', 'showGameOver', 'gameOver', 'endGame', 'endRun',
    'finishRun', 'showDeathScreen', 'createDeathScreen', 'showUnalivedScreen',
    'continueAfterDeath', 'showResults', 'showScoreScreen'
  ];

  function pushError(err) {
    try {
      state.errors.push(String(err && err.message ? err.message : err).slice(0, 300));
      if (state.errors.length > 10) state.errors.shift();
    } catch (_) {}
  }

  function isObj(value) {
    return value && (typeof value === 'object' || typeof value === 'function');
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function normalizeNumber(value) {
    if (typeof value === 'string' && value.trim() !== '') value = Number(value);
    if (!isFiniteNumber(value)) return null;
    if (value < 0) return 0;
    if (value > 2147483647) return 2147483647;
    return Math.floor(value);
  }

  function addUnique(arr, value) {
    if (value == null) return;
    value = String(value);
    if (arr.indexOf(value) === -1) arr.push(value);
  }

  function sceneKey(scene) {
    try {
      return scene && scene.sys && scene.sys.settings && scene.sys.settings.key ? String(scene.sys.settings.key) : null;
    } catch (_) {
      return null;
    }
  }

  function getWindowCandidate(name) {
    try { return window[name]; } catch (_) { return null; }
  }

  function addGameCandidates(out) {
    var names = [
      'game', 'phaserGame', 'PhaserGame', 'chiggasGame', 'ChiggasGame',
      'rosebudGame', 'RosebudGame', '__PHASER_GAME__', '__game', 'appGame'
    ];
    for (var i = 0; i < names.length; i++) {
      var value = getWindowCandidate(names[i]);
      if (isObj(value)) out.push({ name: names[i], game: value });
    }
  }

  function addSceneCandidate(out, name) {
    var value = getWindowCandidate(name);
    if (isObj(value)) out.push({ source: 'window.' + name, scene: value });
  }

  function scenesFromGame(gameCandidate) {
    var results = [];
    var game = gameCandidate && gameCandidate.game;
    if (!isObj(game)) return results;

    try {
      if (game.scene && Array.isArray(game.scene.scenes)) {
        for (var i = 0; i < game.scene.scenes.length; i++) {
          if (isObj(game.scene.scenes[i])) results.push({ source: gameCandidate.name + '.scene.scenes[' + i + ']', scene: game.scene.scenes[i] });
        }
      }
    } catch (err) { pushError(err); }

    try {
      if (game.scene && game.scene.keys && typeof game.scene.keys === 'object') {
        Object.keys(game.scene.keys).forEach(function (key) {
          if (isObj(game.scene.keys[key])) results.push({ source: gameCandidate.name + '.scene.keys.' + key, scene: game.scene.keys[key] });
        });
      }
    } catch (err) { pushError(err); }

    try {
      if (game.scene && typeof game.scene.getScene === 'function') {
        ['GameScene', 'MainScene', 'PlayScene', 'GameplayScene', 'Game', 'Scene'].forEach(function (key) {
          try {
            var scene = game.scene.getScene(key);
            if (isObj(scene)) results.push({ source: gameCandidate.name + '.scene.getScene(' + key + ')', scene: scene });
          } catch (_) {}
        });
      }
    } catch (err) { pushError(err); }

    return results;
  }

  function getSceneCandidates() {
    var scenes = [];
    var games = [];
    addGameCandidates(games);
    for (var i = 0; i < games.length; i++) {
      scenes = scenes.concat(scenesFromGame(games[i]));
    }

    [
      'gameScene', 'GameScene', 'currentScene', 'activeScene', 'mainScene',
      'playScene', 'gameplayScene', 'scene'
    ].forEach(function (name) { addSceneCandidate(scenes, name); });

    var seen = [];
    var deduped = [];
    for (var j = 0; j < scenes.length; j++) {
      var scene = scenes[j].scene;
      if (!isObj(scene)) continue;
      if (seen.indexOf(scene) !== -1) continue;
      seen.push(scene);
      deduped.push(scenes[j]);
      addUnique(state.sceneKeysSeen, sceneKey(scene) || scenes[j].source);
    }
    return deduped;
  }

  function likelyGameScene(item) {
    var key = sceneKey(item.scene) || '';
    var source = item.source || '';
    if (/GameScene|Gameplay|Play/i.test(key)) return true;
    if (/GameScene|Gameplay|Play/i.test(source)) return true;
    return false;
  }

  function chooseBestScene(items) {
    if (!items.length) return null;
    for (var i = 0; i < items.length; i++) {
      if (likelyGameScene(items[i])) return items[i];
    }
    return items[0];
  }

  function readValueFromObject(obj, keys) {
    if (!isObj(obj)) return { key: null, value: null };
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      try {
        var value = normalizeNumber(obj[key]);
        if (value !== null) return { key: key, value: value };
      } catch (_) {}
    }
    return { key: null, value: null };
  }

  function collectNumericFields(obj) {
    var output = {};
    if (!isObj(obj)) return output;
    try {
      Object.keys(obj).slice(0, 220).forEach(function (key) {
        var value;
        try { value = obj[key]; } catch (_) { return; }
        if (isFiniteNumber(value)) {
          output[key] = Math.floor(value);
        }
      });
    } catch (_) {}
    return output;
  }

  function collectStringFields(obj) {
    var output = {};
    if (!isObj(obj)) return output;
    var preferred = ['state', 'status', 'currentState', 'gameState', 'mode', 'screen', 'currentScreen'];
    for (var i = 0; i < preferred.length; i++) {
      try {
        var key = preferred[i];
        var value = obj[key];
        if (typeof value === 'string') output[key] = value.slice(0, 80);
      } catch (_) {}
    }
    return output;
  }

  function collectBooleans(obj) {
    var output = {};
    if (!isObj(obj)) return output;
    var preferred = [
      'isDead', 'gameOver', 'isGameOver', 'runEnded', 'isPaused', 'bossActive',
      'playerDead', 'deathScreenVisible', 'scoreScreenVisible'
    ];
    for (var i = 0; i < preferred.length; i++) {
      try {
        var key = preferred[i];
        if (typeof obj[key] === 'boolean') output[key] = obj[key];
      } catch (_) {}
    }
    return output;
  }

  function buildSnapshot(reason, eventName) {
    var scenes = getSceneCandidates();
    var chosen = chooseBestScene(scenes);
    var scene = chosen && chosen.scene;

    var values = {};
    var groups = Object.keys(VALUE_KEYS);
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      var found = readValueFromObject(scene, VALUE_KEYS[group]);
      if (found.key) values[found.key] = found.value;
    }

    var player = null;
    try { player = scene && (scene.player || scene.chiggaPlayer || scene.mainPlayer || scene.character); } catch (_) {}
    if (isObj(player)) {
      var playerFound = readValueFromObject(player, VALUE_KEYS.player);
      if (playerFound.key) values['player.' + playerFound.key] = playerFound.value;
    }

    var snapshot = {
      pass: PASS,
      createdAt: new Date().toISOString(),
      reason: reason || 'manual_or_poll',
      eventName: eventName || null,
      sceneFound: !!scene,
      sceneSource: chosen ? chosen.source : null,
      sceneKey: sceneKey(scene),
      sceneCandidates: scenes.slice(0, 20).map(function (item) {
        return { source: item.source, key: sceneKey(item.scene) };
      }),
      values: values,
      numericFields: collectNumericFields(scene),
      stringFields: collectStringFields(scene),
      booleanFields: collectBooleans(scene),
      playerNumericFields: collectNumericFields(player),
      page: {
        href: String(location && location.href ? location.href : '').slice(0, 240),
        title: String(document && document.title ? document.title : '').slice(0, 120)
      }
    };

    state.snapshotCount += 1;
    state.lastSnapshot = snapshot;
    return snapshot;
  }

  function sendCapture(reason, eventName) {
    try {
      var snapshot = buildSnapshot(reason, eventName);
      state.lastCaptureReason = reason || null;
      state.lastCaptureAt = new Date().toISOString();
      window.postMessage({
        source: MESSAGE_SOURCE,
        type: 'capture',
        payload: {
          source: 'page',
          reason: reason || 'manual_or_poll',
          eventName: eventName || null,
          snapshot: snapshot,
          rendererState: {
            installedAt: state.installedAt,
            hookAttempts: state.hookAttempts,
            hookedMethods: state.hookedMethods.slice(0),
            sceneKeysSeen: state.sceneKeysSeen.slice(0),
            snapshotCount: state.snapshotCount,
            errors: state.errors.slice(0)
          }
        }
      }, '*');
      return snapshot;
    } catch (err) {
      pushError(err);
      return null;
    }
  }

  function hookSceneMethods() {
    state.hookAttempts += 1;
    var scenes = getSceneCandidates();
    for (var i = 0; i < scenes.length; i++) {
      var scene = scenes[i].scene;
      if (!isObj(scene)) continue;
      for (var j = 0; j < FINAL_METHODS.length; j++) {
        var methodName = FINAL_METHODS[j];
        try {
          if (typeof scene[methodName] !== 'function') continue;
          if (scene[methodName].__pass96cHooked) continue;
          (function (targetScene, name, source) {
            var original = targetScene[name];
            var wrapped = function () {
              sendCapture('before_' + name, name);
              var result = original.apply(this, arguments);
              setTimeout(function () { sendCapture('after_' + name, name); }, 50);
              setTimeout(function () { sendCapture('after_' + name + '_late', name); }, 500);
              return result;
            };
            wrapped.__pass96cHooked = true;
            wrapped.__pass96cOriginal = original;
            targetScene[name] = wrapped;
            addUnique(state.hookedMethods, (sceneKey(targetScene) || source) + '.' + name);
          })(scene, methodName, scenes[i].source);
        } catch (err) { pushError(err); }
      }
    }
  }

  function poll() {
    try {
      hookSceneMethods();
      var snapshot = buildSnapshot('poll', null);
      var flags = snapshot && snapshot.booleanFields ? snapshot.booleanFields : {};
      if (flags.isDead || flags.playerDead || flags.gameOver || flags.isGameOver || flags.runEnded || flags.deathScreenVisible || flags.scoreScreenVisible) {
        sendCapture('poll_detected_final_or_death_state', null);
      }
    } catch (err) { pushError(err); }
  }

  window.addEventListener(REQUEST_EVENT, function (event) {
    try {
      var detail = event && event.detail ? event.detail : {};
      sendCapture(detail.reason || 'manual_snapshot_request', detail.eventName || null);
    } catch (err) { pushError(err); }
  });

  window.addEventListener(RESET_EVENT, function () {
    state.lastSnapshot = null;
    state.lastCaptureReason = null;
    state.lastCaptureAt = null;
    state.snapshotCount = 0;
    state.errors = [];
  });

  window.ChiggasLeaderboardCapturePagePass96C = {
    snapshot: function (reason) { return sendCapture(reason || 'page_console_snapshot', null); },
    getState: function () { return JSON.parse(JSON.stringify(state)); },
    poll: poll
  };

  setTimeout(function () { sendCapture('initial_page_script_ready', null); }, 1000);
  setInterval(poll, 1500);
})();`;
}

function installPreload() {
  const { ipcRenderer, contextBridge } = require('electron');

  function sendToMain(payload) {
    return ipcRenderer.invoke('chiggas-steam-leaderboards-pass-96c-capture', payload || {});
  }

  function injectPageScript() {
    try {
      const script = document.createElement('script');
      script.textContent = getPageScript();
      (document.documentElement || document.head || document.body).appendChild(script);
      try { script.remove(); } catch (_) {}
    } catch (err) {
      sendToMain({
        source: 'preload',
        reason: 'page_script_injection_failed',
        snapshot: { values: {}, error: String(err && err.message ? err.message : err) }
      });
    }
  }

  try {
    window.addEventListener('message', (event) => {
      try {
        if (!event || !event.data || event.data.source !== 'chiggas-pass96c-leaderboard-capture') return;
        if (event.data.type === 'capture') sendToMain(event.data.payload || {});
      } catch (_) {}
    });
  } catch (_) {}

  const api = {
    getCapabilities: function () {
      return ipcRenderer.invoke('chiggas-steam-leaderboards-pass-96c-capabilities');
    },
    snapshot: function (reason) {
      try {
        window.dispatchEvent(new CustomEvent('chiggas-pass96c-request-snapshot', {
          detail: { reason: reason || 'bridge_manual_snapshot' }
        }));
      } catch (_) {}
      return ipcRenderer.invoke('chiggas-steam-leaderboards-pass-96c-read-trace');
    },
    readTrace: function () {
      return ipcRenderer.invoke('chiggas-steam-leaderboards-pass-96c-read-trace');
    },
    resetTrace: function () {
      try { window.dispatchEvent(new CustomEvent('chiggas-pass96c-reset-state')); } catch (_) {}
      return ipcRenderer.invoke('chiggas-steam-leaderboards-pass-96c-reset-trace');
    }
  };

  try {
    if (contextBridge && process.contextIsolated) {
      contextBridge.exposeInMainWorld('ChiggasLeaderboardCapture', api);
    } else {
      window.ChiggasLeaderboardCapture = api;
    }
  } catch (_) {
    try { window.ChiggasLeaderboardCapture = api; } catch (_) {}
  }

  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectPageScript, { once: true });
    } else {
      injectPageScript();
    }
  } catch (_) {
    setTimeout(injectPageScript, 1000);
  }
}

module.exports = {
  PASS,
  BOARDS,
  TRACE_FILE,
  HISTORY_FILE,
  publicCapabilities,
  writeCapture,
  readTrace,
  resetTrace,
  installMain,
  installPreload,
  getPageScript
};
