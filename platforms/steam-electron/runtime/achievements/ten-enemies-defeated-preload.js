const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installTenEnemiesDefeatedPreload() {
  // CHIGGAS_STEAM_PASS_61_TEN_ENEMIES_DEFEATED_PRELOAD_BEGIN
      (() => {
        const PASS = 'steam_desktop_wrapper_pass_61';
        const APP_ID = 4788490;
        const ACHIEVEMENT = 'TEN_ENEMIES_DEFEATED';
        const STORE_SHOULD_SHOW = 'TEST BUY';
        const CHANNEL = 'chiggas-steam-achievements-pass-32-unlock';
        const TRACE_FILE = 'steam-achievement-ten-enemies-defeated-pass-61.json';
        const LOG_FILE = 'steam-achievement-ten-enemies-defeated-pass-61.log';
        const EVENT_NAME = 'chiggas-steam-achievement-unlock-request';
      
        let fs = null;
        let path = null;
        let ipcRenderer = null;
        try { fs = require('fs'); path = require('path'); } catch (_) {}
        try { ipcRenderer = require('electron').ipcRenderer; } catch (_) {}
      
        function appPath(filename) {
          try { return path ? path.join(STEAM_ROOT, filename) : filename; } catch (_) { return filename; }
        }
        function readJson(file) {
          try {
            if (!fs) return null;
            const p = appPath(file);
            if (!fs.existsSync(p)) return null;
            return JSON.parse(fs.readFileSync(p, 'utf8'));
          } catch (_) { return null; }
        }
        function writeTrace(extra) {
          const base = {
            ok: !!(extra && extra.ok),
            pass: PASS,
            appId: APP_ID,
            status: extra && extra.status ? extra.status : 'steam_achievement_pass_61_ten_enemies_defeated_trace_update',
            achievement: ACHIEVEMENT,
            triggerInstalled: true,
            triggerMode: 'chigga_enemy_death_count_threshold_10_custom_event_pass32_ipc',
            attemptedUnlock: false,
            activationResult: null,
            bridgeStatus: null,
            bridgeChannel: null,
            bridgeResultAchievement: null,
            bridgeResultKnownAchievement: null,
            defeatedCount: null,
            threshold: 10,
            faction: null,
            isWildFaction: null,
            isEnemyFaction: null,
            eventName: null,
            reason: null,
            metadata: null,
            error: null,
            time: new Date().toISOString(),
            url: String(location && location.href || ''),
            title: String(document && document.title || ''),
            storeShouldShow: STORE_SHOULD_SHOW,
            ...(extra || {})
          };
          try {
            const previous = readJson(TRACE_FILE);
            const history = Array.isArray(previous && previous.history) ? previous.history.slice(-19) : [];
            history.push(base);
            base.historyCount = history.length;
            base.history = history;
            if (fs) {
              fs.writeFileSync(appPath(TRACE_FILE), JSON.stringify(base, null, 2) + '\n', 'utf8');
              fs.appendFileSync(appPath(LOG_FILE), JSON.stringify(base) + '\n', 'utf8');
            }
          } catch (_) {}
          return base;
        }
        function parseDetail(detail) {
          if (typeof detail === 'string') return { achievement: detail, metadata: {} };
          if (!detail || typeof detail !== 'object') return { achievement: '', metadata: {} };
          return {
            achievement: String(detail.achievement || ''),
            metadata: detail.metadata && typeof detail.metadata === 'object' ? detail.metadata : {}
          };
        }
      
        window.addEventListener(EVENT_NAME, async (event) => {
          const parsed = parseDetail(event.detail);
          if (parsed.achievement !== ACHIEVEMENT) return;
          const metadata = parsed.metadata || {};
      
          writeTrace({
            ok: false,
            status: 'steam_achievement_pass_61_ten_enemies_defeated_event_received_waiting_for_ipc',
            eventName: EVENT_NAME,
            reason: 'custom_event_received',
            defeatedCount: metadata.defeatedCount ?? null,
            threshold: metadata.threshold ?? 10,
            faction: metadata.faction || null,
            isWildFaction: metadata.isWildFaction ?? null,
            isEnemyFaction: metadata.isEnemyFaction ?? null,
            metadata
          });
      
          if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function') {
            writeTrace({
              ok: false,
              status: 'steam_achievement_pass_61_ipc_unavailable',
              eventName: EVENT_NAME,
              reason: 'ipcRenderer_unavailable',
              defeatedCount: metadata.defeatedCount ?? null,
              threshold: metadata.threshold ?? 10,
              metadata,
              error: 'ipcRenderer.invoke unavailable'
            });
            return;
          }
      
          try {
            const result = await ipcRenderer.invoke(CHANNEL, ACHIEVEMENT, {
              source: 'renderer_ipc',
              scene: metadata.scene || 'GameScene',
              event: metadata.event || 'ten_enemies_defeated_chigga_death_count',
              reason: metadata.reason || 'enemy_or_wild_chigga_death_count_reached_10',
              defeatedCount: metadata.defeatedCount ?? null,
              threshold: metadata.threshold ?? 10,
              faction: metadata.faction || null,
              isWildFaction: metadata.isWildFaction ?? null,
              isEnemyFaction: metadata.isEnemyFaction ?? null
            });
            writeTrace({
              ok: !!(result && result.ok !== false),
              status: result && result.status ? result.status : 'steam_achievement_pass_61_ten_enemies_defeated_ipc_result',
              eventName: EVENT_NAME,
              attemptedUnlock: true,
              activationResult: result && Object.prototype.hasOwnProperty.call(result, 'activationResult') ? result.activationResult : null,
              bridgeStatus: result && result.status ? result.status : null,
              bridgeChannel: CHANNEL,
              bridgeResultAchievement: result && result.achievement ? result.achievement : null,
              bridgeResultKnownAchievement: result && Object.prototype.hasOwnProperty.call(result, 'knownAchievement') ? result.knownAchievement : null,
              reason: 'pass32_achievement_ipc_result_61_fixed',
              defeatedCount: metadata.defeatedCount ?? null,
              threshold: metadata.threshold ?? 10,
              faction: metadata.faction || null,
              isWildFaction: metadata.isWildFaction ?? null,
              isEnemyFaction: metadata.isEnemyFaction ?? null,
              metadata
            });
          } catch (error) {
            writeTrace({
              ok: false,
              status: 'steam_achievement_pass_61_ten_enemies_defeated_ipc_exception',
              eventName: EVENT_NAME,
              attemptedUnlock: true,
              bridgeChannel: CHANNEL,
              reason: 'ipc_exception',
              defeatedCount: metadata.defeatedCount ?? null,
              threshold: metadata.threshold ?? 10,
              metadata,
              error: String(error && error.message ? error.message : error)
            });
          }
        });
      
        writeTrace({
          ok: true,
          status: 'steam_achievement_pass_61_ten_enemies_defeated_event_bridge_registered',
          reason: 'preload_registered'
        });
      })();
      // CHIGGAS_STEAM_PASS_61_TEN_ENEMIES_DEFEATED_PRELOAD_END
}

module.exports = {
  installTenEnemiesDefeatedPreload
};
