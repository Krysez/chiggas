const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installFirstWeaponPickupEventPreload() {
  // CHIGGAS_STEAM_PASS_52C_FIRST_WEAPON_PICKUP_PRELOAD_EVENT_REPAIR_BEGIN
      (() => {
        const PASS = 'steam_desktop_wrapper_pass_52c';
        const APP_ID = 4788490;
        const ACHIEVEMENT = 'FIRST_WEAPON_PICKUP';
        const STORE_SHOULD_SHOW = 'TEST BUY';
        const CHANNEL = 'chiggas-steam-achievements-pass-32-unlock';
        const TRACE_FILE = 'steam-achievement-first-weapon-pickup-pass-52c.json';
        const LOG_FILE = 'steam-achievement-first-weapon-pickup-pass-52c.log';
      
        let fsMod = null;
        let pathMod = null;
        let ipc = null;
        try { fsMod = require('fs'); } catch (_) {}
        try { pathMod = require('path'); } catch (_) {}
        try { ipc = require('electron').ipcRenderer; } catch (_) {}
      
        const history = [];
        let fired = false;
        function rootDir() { try { return typeof STEAM_ROOT === 'string' ? STEAM_ROOT : process.cwd(); } catch (_) { return '.'; } }
        function nowIso() { try { return new Date().toISOString(); } catch (_) { return String(Date.now()); } }
        function writeTrace(entry) {
          const payload = {
            ok: !!entry.ok,
            pass: PASS,
            appId: APP_ID,
            status: entry.status || 'steam_achievement_pass_52c_first_weapon_pickup_trace',
            achievement: ACHIEVEMENT,
            triggerInstalled: true,
            triggerMode: 'shoot_button_visible_has_gun_ammo_dual_event_pass32_ipc_fixed',
            attemptedUnlock: !!entry.attemptedUnlock,
            activationResult: entry.activationResult ?? null,
            bridgeStatus: entry.bridgeStatus || null,
            bridgeChannel: entry.bridgeChannel || null,
            bridgeResultAchievement: entry.bridgeResultAchievement || null,
            bridgeResultKnownAchievement: entry.bridgeResultKnownAchievement ?? null,
            hasGunAmmo: entry.hasGunAmmo ?? null,
            pistolAmmo: entry.pistolAmmo ?? null,
            rifleAmmo: entry.rifleAmmo ?? null,
            eventName: entry.eventName || null,
            reason: entry.reason || null,
            metadata: entry.metadata || null,
            error: entry.error || null,
            time: nowIso(),
            url: (() => { try { return window.location.href; } catch (_) { return null; } })(),
            title: (() => { try { return document.title; } catch (_) { return null; } })(),
            storeShouldShow: STORE_SHOULD_SHOW
          };
          history.push(payload);
          while (history.length > 20) history.shift();
          const full = { ...payload, historyCount: history.length, history: history.slice(-8) };
          try {
            if (fsMod && pathMod) {
              const tracePath = pathMod.join(rootDir(), TRACE_FILE);
              const logPath = pathMod.join(rootDir(), LOG_FILE);
              fsMod.writeFileSync(tracePath, JSON.stringify(full, null, 2) + '\n', 'utf8');
              fsMod.appendFileSync(logPath, JSON.stringify(payload) + '\n', 'utf8');
            }
          } catch (_) {}
          return full;
        }
      
        writeTrace({ ok: true, status: 'steam_achievement_pass_52c_first_weapon_pickup_event_bridge_registered', attemptedUnlock: false, reason: 'preload_registered' });
      
        async function handleWeaponEvent(eventName, detail) {
          if (fired) return;
          const d = detail && typeof detail === 'object' ? detail : {};
          const achievementName = String(d.achievement || ACHIEVEMENT);
          if (achievementName !== ACHIEVEMENT) return;
          fired = true;
          const metadata = {
            source: 'GameScene_hasGunAmmo_visibility_transition',
            scene: 'GameScene',
            event: 'first_weapon_pickup_shoot_button_visible',
            reason: 'shoot_button_visible_has_gun_ammo',
            hasGunAmmo: !!d.hasGunAmmo,
            pistolAmmo: Number.isFinite(Number(d.pistolAmmo)) ? Number(d.pistolAmmo) : 0,
            rifleAmmo: Number.isFinite(Number(d.rifleAmmo)) ? Number(d.rifleAmmo) : 0,
            storeShouldShow: STORE_SHOULD_SHOW,
            pass: PASS,
            hook: 'shoot_button_visible_has_gun_ammo_52c',
            ...(d.metadata && typeof d.metadata === 'object' ? d.metadata : {})
          };
      
          writeTrace({
            ok: false,
            status: 'steam_achievement_pass_52c_first_weapon_pickup_event_received_waiting_for_ipc',
            attemptedUnlock: false,
            hasGunAmmo: metadata.hasGunAmmo,
            pistolAmmo: metadata.pistolAmmo,
            rifleAmmo: metadata.rifleAmmo,
            eventName,
            reason: 'custom_event_received',
            metadata
          });
      
          try {
            if (!ipc || typeof ipc.invoke !== 'function') throw new Error('ipcRenderer.invoke unavailable in preload');
            const result = await ipc.invoke(CHANNEL, ACHIEVEMENT, {
              source: 'renderer_ipc',
              scene: metadata.scene,
              event: metadata.event,
              reason: metadata.reason,
              hasGunAmmo: metadata.hasGunAmmo,
              pistolAmmo: metadata.pistolAmmo,
              rifleAmmo: metadata.rifleAmmo,
              storeShouldShow: STORE_SHOULD_SHOW,
              pass: PASS
            });
            writeTrace({
              ok: !!(result && (result.ok || result.activationResult)),
              status: result && result.status ? result.status : 'steam_achievement_pass_52c_first_weapon_pickup_ipc_result',
              attemptedUnlock: true,
              activationResult: result && Object.prototype.hasOwnProperty.call(result, 'activationResult') ? result.activationResult : null,
              bridgeStatus: result && result.status ? result.status : null,
              bridgeChannel: CHANNEL,
              bridgeResultAchievement: result && result.achievement ? result.achievement : null,
              bridgeResultKnownAchievement: result && Object.prototype.hasOwnProperty.call(result, 'knownAchievement') ? result.knownAchievement : null,
              hasGunAmmo: metadata.hasGunAmmo,
              pistolAmmo: metadata.pistolAmmo,
              rifleAmmo: metadata.rifleAmmo,
              eventName,
              reason: 'pass32_achievement_ipc_result_52c_fixed',
              metadata
            });
          } catch (error) {
            writeTrace({
              ok: false,
              status: 'steam_achievement_pass_52c_first_weapon_pickup_ipc_failed',
              attemptedUnlock: true,
              bridgeStatus: 'steam_achievement_event_bridge_call_failed',
              bridgeChannel: CHANNEL,
              hasGunAmmo: metadata.hasGunAmmo,
              pistolAmmo: metadata.pistolAmmo,
              rifleAmmo: metadata.rifleAmmo,
              eventName,
              reason: 'pass32_achievement_ipc_error_52c',
              error: String(error && error.message ? error.message : error),
              metadata
            });
          }
        }
      
        try {
          window.addEventListener('chiggas-steam-achievement-unlock-request', (event) => handleWeaponEvent('chiggas-steam-achievement-unlock-request', event.detail || {}));
          window.addEventListener('chiggas:first-weapon-pickup', (event) => handleWeaponEvent('chiggas:first-weapon-pickup', event.detail || {}));
        } catch (error) {
          writeTrace({
            ok: false,
            status: 'steam_achievement_pass_52c_first_weapon_pickup_listener_failed',
            attemptedUnlock: false,
            error: String(error && error.message ? error.message : error)
          });
        }
      })();
      // CHIGGAS_STEAM_PASS_52C_FIRST_WEAPON_PICKUP_PRELOAD_EVENT_REPAIR_END
}

module.exports = {
  installFirstWeaponPickupEventPreload
};
