function pageProbeInstaller() {
        if (window.__CHIGGAS_LEADERBOARD_PROBE_PASS_96C2A_PAGE__) return;
        window.__CHIGGAS_LEADERBOARD_PROBE_PASS_96C2A_PAGE__ = true;
    
        const PASS = 'steam_desktop_wrapper_pass_96c2a';
        const REQUEST = 'chiggas-leaderboard-probe-pass-96c2a-request';
        const RESULT = 'chiggas-leaderboard-probe-pass-96c2a-result';
    
        function safeGet(obj, key) {
          try { return obj ? obj[key] : undefined; } catch (_) { return undefined; }
        }
    
        function safeCall(fn, thisArg) {
          try { return typeof fn === 'function' ? fn.call(thisArg) : undefined; } catch (_) { return undefined; }
        }
    
        function safeName(obj) {
          try { return obj && obj.constructor && obj.constructor.name ? obj.constructor.name : null; } catch (_) { return null; }
        }
    
        function keysOf(obj, limit) {
          try {
            if (!obj) return [];
            return Object.getOwnPropertyNames(obj).slice(0, limit || 350);
          } catch (_) {
            return [];
          }
        }
    
        function classifyOwnFields(obj, prefix) {
          const numbers = {};
          const booleans = {};
          const strings = {};
          const keys = keysOf(obj, 260);
          for (let i = 0; i < keys.length; i += 1) {
            const key = keys[i];
            if (!key || key.length > 80) continue;
            const v = safeGet(obj, key);
            const outKey = prefix ? prefix + '.' + key : key;
            if (typeof v === 'number' && Number.isFinite(v)) numbers[outKey] = v;
            else if (typeof v === 'boolean') booleans[outKey] = v;
            else if (typeof v === 'string' && v.length <= 180) strings[outKey] = v;
          }
          return { numbers, booleans, strings };
        }
    
        const interestingPattern = /(score|points|time|elapsed|surviv|second|duration|enemy|enemies|kill|defeat|death|stage|wave|level|boss|munch|str|hp|health|ammo|coin|money|total|count|run|timer)/i;
    
        function collectInterestingNumeric(obj, prefix, depth, seen, out) {
          prefix = prefix || '';
          depth = depth || 0;
          seen = seen || new WeakSet();
          out = out || {};
          if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) return out;
          if (seen.has(obj)) return out;
          seen.add(obj);
    
          const keys = keysOf(obj, 180);
          for (let i = 0; i < keys.length; i += 1) {
            const key = keys[i];
            if (!key || key.length > 80) continue;
            const v = safeGet(obj, key);
            const p = prefix ? prefix + '.' + key : key;
            if (typeof v === 'number' && Number.isFinite(v)) {
              if (interestingPattern.test(p)) out[p] = v;
            } else if (depth < 2 && v && typeof v === 'object') {
              const cname = safeName(v) || '';
              const shouldDive = interestingPattern.test(p) || /Object|Data|Manager|Registry|Stats|Scene|Player|Game|State/i.test(cname);
              if (shouldDive && !/HTML|Canvas|WebGL|Audio|Image|Texture|Cache|Loader|DOM/i.test(cname)) {
                collectInterestingNumeric(v, p, depth + 1, seen, out);
              }
            }
          }
          return out;
        }
    
        function getSceneKey(scene) {
          return safeGet(safeGet(safeGet(scene, 'sys'), 'settings'), 'key') ||
            safeGet(safeGet(scene, 'scene'), 'key') ||
            safeGet(scene, 'key') ||
            safeGet(scene, 'sceneKey') ||
            null;
        }
    
        function isSceneLike(obj) {
          if (!obj || typeof obj !== 'object') return false;
          const sys = safeGet(obj, 'sys');
          if (sys && (safeGet(sys, 'settings') || safeGet(sys, 'events') || safeGet(sys, 'game'))) return true;
          return !!(safeGet(obj, 'scene') && safeGet(obj, 'add') && safeGet(obj, 'children'));
        }
    
        function describeScene(scene, sourcePath) {
          const own = classifyOwnFields(scene, '');
          const sys = safeGet(scene, 'sys');
          const settings = safeGet(sys, 'settings');
          const scenePlugin = safeGet(scene, 'scene');
          const active = safeCall(safeGet(scenePlugin, 'isActive'), scenePlugin);
          const visible = safeCall(safeGet(scenePlugin, 'isVisible'), scenePlugin);
          const interestingNumericFields = collectInterestingNumeric(scene, '', 0, new WeakSet(), {});
          return {
            sourcePath: sourcePath,
            constructorName: safeName(scene),
            key: getSceneKey(scene),
            active: typeof active === 'boolean' ? active : safeGet(settings, 'active'),
            visible: typeof visible === 'boolean' ? visible : safeGet(settings, 'visible'),
            ownNumberFields: own.numbers,
            ownBooleanFields: own.booleans,
            ownStringFields: own.strings,
            interestingNumericFields: interestingNumericFields,
            objectKeysSample: keysOf(scene, 80)
          };
        }
    
        function gameScenesFrom(game, sourcePath) {
          const found = [];
          if (!game || typeof game !== 'object') return found;
          const sceneManager = safeGet(game, 'scene');
          const scenes = safeGet(sceneManager, 'scenes') || safeGet(game, 'scenes');
          if (Array.isArray(scenes)) {
            for (let i = 0; i < scenes.length; i += 1) {
              const scene = scenes[i];
              if (isSceneLike(scene)) found.push(describeScene(scene, sourcePath + '.scene.scenes[' + i + ']'));
            }
          }
          return found;
        }
    
        function looksGameLike(obj) {
          if (!obj || typeof obj !== 'object') return false;
          const sm = safeGet(obj, 'scene');
          return !!(sm && Array.isArray(safeGet(sm, 'scenes')));
        }
    
        function collectProbe(reason, requestId) {
          const generatedAt = new Date().toISOString();
          const candidates = [];
          const games = [];
          const seenGames = new WeakSet();
    
          function addGame(game, sourcePath) {
            if (!game || typeof game !== 'object' || seenGames.has(game)) return;
            seenGames.add(game);
            const scenes = gameScenesFrom(game, sourcePath);
            games.push({ sourcePath: sourcePath, constructorName: safeName(game), sceneCount: scenes.length, keys: keysOf(game, 60) });
            for (let i = 0; i < scenes.length; i += 1) candidates.push(scenes[i]);
          }
    
          const phaserGames = safeGet(safeGet(window, 'Phaser'), 'GAMES');
          if (Array.isArray(phaserGames)) {
            for (let i = 0; i < phaserGames.length; i += 1) addGame(phaserGames[i], 'window.Phaser.GAMES[' + i + ']');
          }
    
          const commonGameKeys = ['game', 'phaserGame', 'PhaserGame', 'GAME', 'app', 'rosebudGame', 'RosebudGame', '__game', '__phaserGame', '__PHASER_GAME__'];
          for (let i = 0; i < commonGameKeys.length; i += 1) {
            const key = commonGameKeys[i];
            addGame(safeGet(window, key), 'window.' + key);
          }
    
          const windowKeys = keysOf(window, 1800);
          for (let i = 0; i < windowKeys.length; i += 1) {
            const key = windowKeys[i];
            if (!key || /^(webkit|chrome|devtools|localStorage|sessionStorage|indexedDB|document|navigator|location|history|screen|performance|console)$/i.test(key)) continue;
            const v = safeGet(window, key);
            if (looksGameLike(v)) addGame(v, 'window.' + key);
            else if (isSceneLike(v)) candidates.push(describeScene(v, 'window.' + key));
            else if (Array.isArray(v) && v.length && v.length < 80) {
              for (let j = 0; j < v.length; j += 1) {
                const item = v[j];
                if (looksGameLike(item)) addGame(item, 'window.' + key + '[' + j + ']');
                else if (isSceneLike(item)) candidates.push(describeScene(item, 'window.' + key + '[' + j + ']'));
              }
            }
          }
    
          const deduped = [];
          const sceneSeen = new Set();
          for (let i = 0; i < candidates.length; i += 1) {
            const c = candidates[i];
            const sig = String(c.sourcePath) + '|' + String(c.key) + '|' + String(c.constructorName);
            if (!sceneSeen.has(sig)) {
              sceneSeen.add(sig);
              deduped.push(c);
            }
          }
    
          const activeCandidates = deduped.filter(function(c) {
            const label = String(c.key || c.constructorName || '');
            return c.active === true || /GameScene|Game|Main|Play|Survival/i.test(label);
          });
    
          return {
            pass: PASS,
            reason: reason || 'manual_probe',
            requestId: requestId,
            generatedAt: generatedAt,
            source: 'page-context-script',
            captureOnly: true,
            liveSteamSubmissionArmed: false,
            windowKeysSample: keysOf(window, 120).filter(function(k) { return !/^on/.test(k); }),
            phaserPresent: !!safeGet(window, 'Phaser'),
            phaserGamesCount: Array.isArray(phaserGames) ? phaserGames.length : null,
            games: games,
            sceneCandidateCount: deduped.length,
            activeCandidateCount: activeCandidates.length,
            sceneCandidates: deduped,
            activeCandidates: activeCandidates,
            errors: []
          };
        }
    
        window.addEventListener('message', function(event) {
          if (event.source !== window) return;
          const data = event.data || {};
          if (!data || data.type !== REQUEST) return;
          let payload;
          try {
            payload = collectProbe(data.reason, data.requestId);
          } catch (err) {
            payload = { pass: PASS, reason: data.reason, requestId: data.requestId, ok: false, error: String(err && err.message || err), source: 'page-context-script' };
          }
          window.__CHIGGAS_LEADERBOARD_PROBE_PASS_96C2A_LAST__ = payload;
          window.postMessage({ type: RESULT, requestId: data.requestId, payload: payload }, '*');
        });
    
        window.ChiggasLeaderboardPageProbe = {
          collect: function(reason) { return collectProbe(reason || 'manual_page_probe', 'direct-' + Date.now()); },
          version: PASS
        };
      }

module.exports = {
  pageProbeInstaller
};
