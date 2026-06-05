function pageAutoInstaller() {
        if (window.__CHIGGAS_LEADERBOARD_AUTO_SUBMIT_PASS_96E_PAGE__) return;
        window.__CHIGGAS_LEADERBOARD_AUTO_SUBMIT_PASS_96E_PAGE__ = true;
    
        const PASS = 'steam_desktop_wrapper_pass_96e';
        const REQUEST = 'chiggas-leaderboard-auto-pass-96e-request';
        const RESULT = 'chiggas-leaderboard-auto-pass-96e-result';
        const PAGE_TO_PRELOAD = 'chiggas-leaderboard-auto-pass-96e-page-submit';
        const PRELOAD_TO_PAGE = 'chiggas-leaderboard-auto-pass-96e-preload-submit-result';
        const hookedMarker = '__chiggasLeaderboardPass96EHookedMethods';
        const submittedMarker = '__chiggasLeaderboardPass96ESubmittedSignatures';
        const state = window.__CHIGGAS_LEADERBOARD_AUTO_SUBMIT_PASS_96E_STATE__ = window.__CHIGGAS_LEADERBOARD_AUTO_SUBMIT_PASS_96E_STATE__ || {
          pass: PASS,
          installedAt: new Date().toISOString(),
          liveSteamSubmissionArmed: true,
          autoSubmitEnabled: true,
          hookAttempts: 0,
          hookedMethods: [],
          lastSnapshot: null,
          lastAutoSubmitRequest: null,
          lastAutoSubmitResult: null,
          errors: []
        };
    
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
                if (/GameScene/i.test(String(key || (s && s.constructor && s.constructor.name) || ''))) {
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
              autoSubmitEnabled: true
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
    
          const payload = {
            ok: readyForSubmit,
            pass: PASS,
            status: readyForSubmit ? 'steam_leaderboard_pass_96e_snapshot_ready' : 'steam_leaderboard_pass_96e_snapshot_incomplete',
            reason: reason || 'snapshot',
            generatedAt: now,
            source: 'page-context-script',
            sceneSourcePath: found.sourcePath,
            sceneKey: getSceneKey(scene),
            runSignature: runSignature,
            mappedScores: mappedScores,
            scores: mappedScores,
            readyBoards: readyBoards,
            liveSteamSubmissionArmed: true,
            autoSubmitEnabled: true,
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
              sceneActive: (function() { try { return scene.scene && scene.scene.isActive ? scene.scene.isActive() : undefined; } catch (_) { return undefined; } })(),
              hookedMethods: (scene[hookedMarker] && scene[hookedMarker].slice ? scene[hookedMarker].slice() : [])
            }
          };
          state.lastSnapshot = payload;
          return payload;
        }
    
        function requestSubmit(reason, options) {
          options = options || {};
          const snapshot = collectScores(reason || 'auto_submit');
          const submitted = window[submittedMarker] = window[submittedMarker] || {};
          if (!snapshot.ok && !options.force) {
            state.lastAutoSubmitRequest = snapshot;
            return Promise.resolve({ ok: false, pass: PASS, status: 'page_snapshot_not_ready_for_submit', snapshot: snapshot });
          }
          if (submitted[snapshot.runSignature] && !options.force) {
            return Promise.resolve({ ok: true, pass: PASS, status: 'page_duplicate_run_submit_ignored', runSignature: snapshot.runSignature, snapshot: snapshot });
          }
          submitted[snapshot.runSignature] = new Date().toISOString();
          const requestId = 'pass96e-' + Date.now() + '-' + Math.random().toString(16).slice(2);
          const message = {
            type: PAGE_TO_PRELOAD,
            requestId: requestId,
            payload: Object.assign({}, snapshot, {
              manual: !!options.manual,
              force: !!options.force,
              reason: reason || snapshot.reason || 'auto_submit'
            })
          };
          state.lastAutoSubmitRequest = message.payload;
          window.postMessage(message, '*');
          return new Promise(function(resolve) {
            function onResult(event) {
              if (event.source !== window) return;
              const data = event.data || {};
              if (data.type !== PRELOAD_TO_PAGE || data.requestId !== requestId) return;
              window.removeEventListener('message', onResult);
              state.lastAutoSubmitResult = data.result;
              resolve(data.result);
            }
            window.addEventListener('message', onResult);
            setTimeout(function() {
              window.removeEventListener('message', onResult);
              resolve({ ok: false, pass: PASS, status: 'page_submit_timeout', requestId: requestId });
            }, 15000);
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
                setTimeout(function() { requestSubmit('auto_hook_' + methodName, { manual: false, force: false }); }, 1800);
                setTimeout(function() { requestSubmit('auto_hook_' + methodName + '_late', { manual: false, force: false }); }, 3500);
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
          const methods = [
            'handlePlayerDeath',
            'showDeathScreen',
            'createDeathScreen',
            'showGameOver',
            'showGameOverScreen',
            'showResults',
            'showResultScreen',
            'showFinalScoreScreen',
            'endRun',
            'finishRun',
            'completeRun'
          ];
          let hooked = false;
          for (let i = 0; i < methods.length; i += 1) {
            hooked = hookMethod(scene, methods[i]) || hooked;
          }
          state.sceneSourcePath = found.sourcePath;
          state.sceneKey = getSceneKey(scene);
          state.lastHookCheckAt = new Date().toISOString();
          return hooked;
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
          state.lastAutoSubmitResult = data.result || null;
        });
    
        window.ChiggasLeaderboardsAutoPage = {
          pass: PASS,
          installHooks: installHooks,
          snapshot: collectScores,
          submitNow: function(reason, force) { return requestSubmit(reason || 'manual_page_submit', { manual: true, force: !!force }); },
          getStatus: function() { return state; }
        };
    
        installHooks();
        setInterval(installHooks, 1000);
      }

module.exports = {
  pageAutoInstaller
};
