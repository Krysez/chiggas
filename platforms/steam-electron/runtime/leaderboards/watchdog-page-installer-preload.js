function pageWatchdogInstaller() {
        if (window.__CHIGGAS_LEADERBOARD_WATCHDOG_PASS_96F_PAGE__) return;
        window.__CHIGGAS_LEADERBOARD_WATCHDOG_PASS_96F_PAGE__ = true;
    
        const PASS = 'steam_desktop_wrapper_pass_96f';
        const REQUEST = 'chiggas-leaderboard-watchdog-pass-96f-request';
        const RESULT = 'chiggas-leaderboard-watchdog-pass-96f-result';
        const PAGE_TO_PRELOAD = 'chiggas-leaderboard-watchdog-pass-96f-page-submit';
        const PRELOAD_TO_PAGE = 'chiggas-leaderboard-watchdog-pass-96f-preload-submit-result';
        const hookedMarker = '__chiggasLeaderboardPass96FHookedMethods';
    
        const state = window.__CHIGGAS_LEADERBOARD_WATCHDOG_PASS_96F_STATE__ = window.__CHIGGAS_LEADERBOARD_WATCHDOG_PASS_96F_STATE__ || {
          pass: PASS,
          installedAt: new Date().toISOString(),
          liveSteamSubmissionArmed: true,
          autoSubmitEnabled: true,
          watchdogEnabled: false,
          intervalMs: 2000,
          minPeriodicIntervalMs: 30000,
          minSurvivalForPeriodic: 20,
          hookAttempts: 0,
          watchdogTicks: 0,
          submitRequests: 0,
          submitResults: 0,
          hookedMethods: [],
          lastSnapshot: null,
          lastGoodSnapshot: null,
          lastSubmitRequest: null,
          lastSubmitResult: null,
          lastSubmitAtMs: 0,
          lastSubmitValueSignature: null,
          watchdogTimerActive: false,
          errors: []
        };
    
        let timer = null;
    
        function safeGet(obj, key) {
          try { return obj ? obj[key] : undefined; } catch (_) { return undefined; }
        }
    
        function asInt(value) {
          const n = Number(value);
          if (!Number.isFinite(n)) return null;
          return Math.max(0, Math.trunc(n));
        }
    
        function getByPath(obj, path) {
          if (!obj || !path) return undefined;
          const parts = String(path).split('.');
          let cur = obj;
          for (let i = 0; i < parts.length; i += 1) {
            cur = safeGet(cur, parts[i]);
            if (cur === undefined || cur === null) return cur;
          }
          return cur;
        }
    
        function firstNumber(scene, paths) {
          for (let i = 0; i < paths.length; i += 1) {
            const path = paths[i];
            const n = asInt(getByPath(scene, path));
            if (n !== null) return { value: n, sourceKey: path };
          }
          return { value: null, sourceKey: null };
        }
    
        function getScene() {
          const direct = safeGet(window, '__chiggasPass94ACurrentGameScene');
          if (direct && typeof direct === 'object') return { scene: direct, sourcePath: 'window.__chiggasPass94ACurrentGameScene' };
    
          const keys = ['game', 'phaserGame', 'PhaserGame', 'GAME', 'rosebudGame', 'RosebudGame', '__game', '__phaserGame'];
          for (let i = 0; i < keys.length; i += 1) {
            const game = safeGet(window, keys[i]);
            const scenes = safeGet(safeGet(game, 'scene'), 'scenes');
            if (Array.isArray(scenes)) {
              for (let j = 0; j < scenes.length; j += 1) {
                const s = scenes[j];
                const key = getByPath(s, 'sys.settings.key') || getByPath(s, 'scene.key') || safeGet(s, 'key');
                const name = s && s.constructor && s.constructor.name;
                if (/GameScene/i.test(String(key || name || ''))) {
                  return { scene: s, sourcePath: 'window.' + keys[i] + '.scene.scenes[' + j + ']' };
                }
              }
            }
          }
          return { scene: null, sourcePath: null };
        }
    
        function getSceneKey(scene) {
          return getByPath(scene, 'sys.settings.key') || getByPath(scene, 'scene.key') || safeGet(scene, 'key') || null;
        }
    
        function truthy(value) {
          return value === true || value === 'true' || value === 1 || value === '1';
        }
    
        function deathSignal(scene) {
          if (!scene) return null;
          const checks = [
            ['scene.isDead', safeGet(scene, 'isDead')],
            ['scene.playerDead', safeGet(scene, 'playerDead')],
            ['scene.gameOver', safeGet(scene, 'gameOver')],
            ['scene.isGameOver', safeGet(scene, 'isGameOver')],
            ['scene.runEnded', safeGet(scene, 'runEnded')],
            ['scene.runComplete', safeGet(scene, 'runComplete')],
            ['scene.resultsShown', safeGet(scene, 'resultsShown')],
            ['scene.deathScreenShown', safeGet(scene, 'deathScreenShown')],
            ['scene._gameOver', safeGet(scene, '_gameOver')],
            ['scene._runEnded', safeGet(scene, '_runEnded')],
            ['player.isDead', getByPath(scene, 'player.isDead')],
            ['player.dead', getByPath(scene, 'player.dead')],
            ['player._dead', getByPath(scene, 'player._dead')],
            ['player.active_false', getByPath(scene, 'player.active') === false]
          ];
          for (let i = 0; i < checks.length; i += 1) {
            if (truthy(checks[i][1])) return checks[i][0];
          }
          const strength = asInt(getByPath(scene, 'player.strength'));
          if (strength !== null && strength <= 0) return 'player.strength<=0';
          const hp = asInt(getByPath(scene, 'player.health'));
          if (hp !== null && hp <= 0) return 'player.health<=0';
          return null;
        }
    
        function collectScores(reason) {
          const found = getScene();
          const scene = found.scene;
          const now = new Date().toISOString();
          if (!scene) {
            return {
              ok: false,
              pass: PASS,
              status: 'game_scene_not_found',
              reason: reason || 'snapshot',
              generatedAt: now,
              source: 'page-context-script',
              liveSteamSubmissionArmed: true,
              autoSubmitEnabled: true,
              watchdogEnabled: state.watchdogEnabled
            };
          }
    
          const score = firstNumber(scene, ['score', 'runStats.score', 'startingScore']);
          const survival = firstNumber(scene, ['runStats.__pass94AActiveSurvivalSeconds', 'runStats.activeSurvivalSeconds', 'runStats.survivalSeconds', '__pass94AActiveSurvivalSeconds', 'survivalSeconds', 'elapsedSeconds', 'elapsedTime']);
          const kills = firstNumber(scene, ['runStats.kills', 'kills', '__chiggasSteamEnemyDefeatedCount', 'player.enemiesDefeated', 'enemiesDefeated', 'defeatedEnemies']);
          const runStartedAt = getByPath(scene, 'runStats.startedAt') || safeGet(scene, 'startTime') || getByPath(scene, 'time.startTime') || null;
          const stageReached = getByPath(scene, 'runStats.stageReached') || safeGet(scene, 'stageIndex') || null;
          const runSignature = 'run-' + String(runStartedAt || 'unknown') + '-stage-' + String(stageReached || 'unknown');
    
          const mappedScores = {
            MITIEST_SURVIVOR_SCORE: {
              apiName: 'MITIEST_SURVIVOR_SCORE',
              value: score.value,
              sourceKey: score.sourceKey,
              display: 'Numeric',
              scoreMethod: 'KeepBest',
              readyForSubmit: score.value !== null
            },
            LONGEST_SURVIVAL_SECONDS: {
              apiName: 'LONGEST_SURVIVAL_SECONDS',
              value: survival.value,
              sourceKey: survival.sourceKey,
              display: 'Seconds',
              scoreMethod: 'KeepBest',
              readyForSubmit: survival.value !== null
            },
            ENEMIES_DEFEATED_TOTAL: {
              apiName: 'ENEMIES_DEFEATED_TOTAL',
              value: kills.value,
              sourceKey: kills.sourceKey,
              display: 'Numeric',
              scoreMethod: 'KeepBest',
              readyForSubmit: kills.value !== null
            }
          };
          const readyBoards = Object.keys(mappedScores).filter(function(k) { return mappedScores[k].readyForSubmit; });
          const values = Object.keys(mappedScores).map(function(k) { return mappedScores[k].value || 0; });
          const readyForSubmit = readyBoards.length === 3 && values.some(function(v) { return v > 0; });
          const sig = runSignature + '|score=' + String(mappedScores.MITIEST_SURVIVOR_SCORE.value) + '|seconds=' + String(mappedScores.LONGEST_SURVIVAL_SECONDS.value) + '|kills=' + String(mappedScores.ENEMIES_DEFEATED_TOTAL.value);
          const signal = deathSignal(scene);
    
          const payload = {
            ok: readyForSubmit,
            pass: PASS,
            status: readyForSubmit ? 'steam_leaderboard_pass_96f_snapshot_ready' : 'steam_leaderboard_pass_96f_snapshot_incomplete',
            reason: reason || 'snapshot',
            generatedAt: now,
            source: 'page-context-script',
            sceneSourcePath: found.sourcePath,
            sceneKey: getSceneKey(scene),
            runSignature: runSignature,
            valueSignature: sig,
            mappedScores: mappedScores,
            scores: mappedScores,
            readyBoards: readyBoards,
            liveSteamSubmissionArmed: true,
            autoSubmitEnabled: true,
            watchdogEnabled: state.watchdogEnabled,
            deathSignal: signal,
            runStats: {
              startedAt: getByPath(scene, 'runStats.startedAt') || null,
              stageReached: getByPath(scene, 'runStats.stageReached') || null,
              bossesDefeated: getByPath(scene, 'runStats.bossesDefeated') || null,
              recruits: getByPath(scene, 'runStats.recruits') || null,
              eaten: getByPath(scene, 'runStats.eaten') || null,
              turfsClaimed: getByPath(scene, 'runStats.turfsClaimed') || null
            },
            debug: {
              playerStrength: getByPath(scene, 'player.strength'),
              playerActive: getByPath(scene, 'player.active'),
              sceneActive: (function() { try { return scene.scene && scene.scene.isActive ? scene.scene.isActive() : undefined; } catch (_) { return undefined; } })(),
              hookedMethods: (scene[hookedMarker] && scene[hookedMarker].slice ? scene[hookedMarker].slice() : [])
            }
          };
          state.lastSnapshot = payload;
          if (payload.ok) state.lastGoodSnapshot = payload;
          return payload;
        }
    
        function requestSubmit(reason, options) {
          options = options || {};
          const snapshot = options.snapshot || collectScores(reason || 'watchdog_submit');
          if (!snapshot.ok && !options.force) {
            state.lastSubmitRequest = snapshot;
            return Promise.resolve({ ok: false, pass: PASS, status: 'page_snapshot_not_ready_for_submit', snapshot: snapshot });
          }
          const nowMs = Date.now();
          if (state.lastSubmitValueSignature === snapshot.valueSignature && !options.force) {
            return Promise.resolve({ ok: true, pass: PASS, status: 'page_duplicate_value_signature_ignored', runSignature: snapshot.runSignature, valueSignature: snapshot.valueSignature, snapshot: snapshot });
          }
          state.lastSubmitValueSignature = snapshot.valueSignature;
          state.lastSubmitAtMs = nowMs;
          state.submitRequests += 1;
          const requestId = 'pass96f-' + nowMs + '-' + Math.random().toString(16).slice(2);
          const message = {
            type: PAGE_TO_PRELOAD,
            requestId: requestId,
            payload: Object.assign({}, snapshot, {
              manual: !!options.manual,
              force: !!options.force,
              watchdog: !!options.watchdog,
              reason: reason || snapshot.reason || 'watchdog_submit'
            })
          };
          state.lastSubmitRequest = message.payload;
          window.postMessage(message, '*');
          return new Promise(function(resolve) {
            function onResult(event) {
              if (event.source !== window) return;
              const data = event.data || {};
              if (data.type !== PRELOAD_TO_PAGE || data.requestId !== requestId) return;
              window.removeEventListener('message', onResult);
              state.lastSubmitResult = data.result;
              state.submitResults += 1;
              resolve(data.result);
            }
            window.addEventListener('message', onResult);
            setTimeout(function() {
              window.removeEventListener('message', onResult);
              resolve({ ok: false, pass: PASS, status: 'page_submit_timeout', requestId: requestId });
            }, 16000);
          });
        }
    
        function hookMethod(scene, name) {
          if (!scene || typeof scene[name] !== 'function') return false;
          scene[hookedMarker] = scene[hookedMarker] || [];
          if (scene[hookedMarker].indexOf(name) >= 0) return true;
          const original = scene[name];
          try {
            scene[name] = function() {
              let result;
              try { result = original.apply(this, arguments); }
              finally {
                const methodName = name;
                setTimeout(function() { requestSubmit('pass96f_auto_hook_' + methodName, { manual: false, force: false, watchdog: true }); }, 1200);
                setTimeout(function() { requestSubmit('pass96f_auto_hook_' + methodName + '_late', { manual: false, force: false, watchdog: true }); }, 3500);
              }
              return result;
            };
            scene[hookedMarker].push(name);
            if (state.hookedMethods.indexOf(name) < 0) state.hookedMethods.push(name);
            return true;
          } catch (err) {
            state.errors.push({ at: new Date().toISOString(), method: name, error: String(err && err.message || err) });
            return false;
          }
        }
    
        function installHooks() {
          state.hookAttempts += 1;
          const found = getScene();
          const scene = found.scene;
          if (!scene) return false;
          const names = {};
          const fixed = [
            'handlePlayerDeath', 'killPlayer', 'playerDied', 'onPlayerDeath', 'die',
            'showDeathScreen', 'createDeathScreen', 'showGameOver', 'showGameOverScreen',
            'showResults', 'showResultScreen', 'showFinalScoreScreen', 'showContinueScreen',
            'endRun', 'finishRun', 'completeRun', 'endGame', 'gameOver'
          ];
          for (let i = 0; i < fixed.length; i += 1) names[fixed[i]] = true;
          let proto = scene;
          for (let depth = 0; proto && depth < 4; depth += 1) {
            try {
              const own = Object.getOwnPropertyNames(proto);
              for (let i = 0; i < own.length; i += 1) {
                const n = own[i];
                if (/death|died|gameover|gameOver|result|finalscore|finalScore|continue|endRun|finishRun|completeRun/i.test(n)) names[n] = true;
              }
            } catch (_) {}
            proto = Object.getPrototypeOf(proto);
          }
          let hooked = false;
          Object.keys(names).forEach(function(name) { hooked = hookMethod(scene, name) || hooked; });
          state.sceneSourcePath = found.sourcePath;
          state.sceneKey = getSceneKey(scene);
          state.lastHookCheckAt = new Date().toISOString();
          return hooked;
        }
    
        function watchdogTick() {
          state.watchdogTicks += 1;
          installHooks();
          const snap = collectScores('pass96f_watchdog_tick');
          const nowMs = Date.now();
          if (!snap.ok) return;
          const score = snap.mappedScores.MITIEST_SURVIVOR_SCORE.value || 0;
          const seconds = snap.mappedScores.LONGEST_SURVIVAL_SECONDS.value || 0;
          const kills = snap.mappedScores.ENEMIES_DEFEATED_TOTAL.value || 0;
          const hasProgress = score > 0 || seconds >= state.minSurvivalForPeriodic || kills > 0;
          if (!hasProgress) return;
    
          if (snap.deathSignal) {
            requestSubmit('pass96f_watchdog_death_signal_' + snap.deathSignal, { manual: false, force: false, watchdog: true, snapshot: snap });
            return;
          }
    
          if (nowMs - state.lastSubmitAtMs >= state.minPeriodicIntervalMs) {
            requestSubmit('pass96f_watchdog_periodic_keepbest', { manual: false, force: false, watchdog: true, snapshot: snap });
          }
        }
    
        function startWatchdog(options) {
          options = options || {};
          if (options.intervalMs) state.intervalMs = Math.max(750, Number(options.intervalMs) || state.intervalMs);
          if (options.minPeriodicIntervalMs) state.minPeriodicIntervalMs = Math.max(5000, Number(options.minPeriodicIntervalMs) || state.minPeriodicIntervalMs);
          if (options.minSurvivalForPeriodic !== undefined) state.minSurvivalForPeriodic = Math.max(0, Number(options.minSurvivalForPeriodic) || 0);
          state.watchdogEnabled = true;
          if (timer) clearInterval(timer);
          installHooks();
          watchdogTick();
          timer = setInterval(watchdogTick, state.intervalMs);
          state.watchdogTimerActive = true;
          state.startedAt = new Date().toISOString();
          return { ok: true, pass: PASS, status: 'pass96f_watchdog_started', state: state };
        }
    
        function stopWatchdog() {
          if (timer) clearInterval(timer);
          timer = null;
          state.watchdogEnabled = false;
          state.watchdogTimerActive = false;
          return { ok: true, pass: PASS, status: 'pass96f_watchdog_stopped', state: state };
        }
    
        window.addEventListener('message', function(event) {
          if (event.source !== window) return;
          const data = event.data || {};
          if (!data || data.type !== REQUEST) return;
          const requestId = data.requestId;
          if (data.action === 'snapshot') {
            const snapshot = collectScores(data.reason || 'manual_snapshot');
            window.postMessage({ type: RESULT, requestId: requestId, payload: { ok: true, pass: PASS, status: 'snapshot_collected', snapshot: snapshot } }, '*');
          } else if (data.action === 'submitNow') {
            requestSubmit(data.reason || 'manual_submit_now', { manual: true, force: !!data.force }).then(function(result) {
              window.postMessage({ type: RESULT, requestId: requestId, payload: result }, '*');
            });
          } else if (data.action === 'startWatchdog') {
            window.postMessage({ type: RESULT, requestId: requestId, payload: startWatchdog(data.options || {}) }, '*');
          } else if (data.action === 'stopWatchdog') {
            window.postMessage({ type: RESULT, requestId: requestId, payload: stopWatchdog() }, '*');
          } else if (data.action === 'installHooks') {
            window.postMessage({ type: RESULT, requestId: requestId, payload: { ok: installHooks(), pass: PASS, status: 'hooks_checked', state: state } }, '*');
          } else if (data.action === 'status') {
            window.postMessage({ type: RESULT, requestId: requestId, payload: { ok: true, pass: PASS, status: 'page_status', state: state } }, '*');
          }
        });
    
        window.addEventListener('message', function(event) {
          if (event.source !== window) return;
          const data = event.data || {};
          if (data.type !== PRELOAD_TO_PAGE) return;
          state.lastSubmitResult = data.result || null;
        });
    
        window.ChiggasLeaderboardsWatchdogPage = {
          pass: PASS,
          start: startWatchdog,
          stop: stopWatchdog,
          installHooks: installHooks,
          snapshot: collectScores,
          submitNow: function(reason, force) { return requestSubmit(reason || 'manual_page_submit', { manual: true, force: !!force }); },
          status: function() { return state; }
        };
    
        startWatchdog({ intervalMs: 2000, minPeriodicIntervalMs: 30000, minSurvivalForPeriodic: 20 });
      }

module.exports = {
  pageWatchdogInstaller
};
