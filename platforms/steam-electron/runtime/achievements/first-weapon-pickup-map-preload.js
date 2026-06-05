const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..', '..');

function installFirstWeaponPickupMapPreload() {
  // CHIGGAS_STEAM_PASS_48_FIRST_WEAPON_PICKUP_MAPPER_BEGIN
    (() => {
      const PASS = 'steam_desktop_wrapper_pass_48';
      const APP_ID = 4788490;
      const ACHIEVEMENT = 'FIRST_WEAPON_PICKUP';
      const STORE_SHOULD_SHOW = 'TEST BUY';
      const TRACE_FILE = 'steam-achievement-first-weapon-pickup-map-pass-48.json';
      const LOG_FILE = 'steam-achievement-first-weapon-pickup-map-pass-48.log';
    
      let fs = null;
      let path = null;
      try {
        fs = require('fs');
        path = require('path');
      } catch (error) {
        return;
      }
    
      const root = STEAM_ROOT;
      const tracePath = path.join(root, TRACE_FILE);
      const logPath = path.join(root, LOG_FILE);
      const startedAt = new Date().toISOString();
      const history = [];
      const pointerHistory = [];
      const keyHistory = [];
      const gamepadHistory = [];
      let interactionIndex = 0;
      let registered = false;
      let firstGameStartedSeen = false;
      let firstGameStartedAt = null;
      let lastGamepadSnapshot = new Map();
      let gamepadInterval = null;
    
      function safeNow() {
        return new Date().toISOString();
      }
    
      function appendLog(entry) {
        try {
          fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf8');
        } catch (_) {}
      }
    
      function trim(arr, max) {
        while (arr.length > max) arr.shift();
      }
    
      function getCanvasInfo(evt) {
        const canvas = document.querySelector('canvas');
        const viewport = {
          width: window.innerWidth || 0,
          height: window.innerHeight || 0,
          devicePixelRatio: window.devicePixelRatio || 1
        };
        if (!canvas || !canvas.getBoundingClientRect) {
          return {
            canvasFound: false,
            canvasX: null,
            canvasY: null,
            canvasXPct: null,
            canvasYPct: null,
            canvasRect: null,
            viewport
          };
        }
        const rect = canvas.getBoundingClientRect();
        const clientX = typeof evt.clientX === 'number' ? evt.clientX : null;
        const clientY = typeof evt.clientY === 'number' ? evt.clientY : null;
        const canvasX = clientX == null ? null : clientX - rect.left;
        const canvasY = clientY == null ? null : clientY - rect.top;
        const canvasXPct = canvasX == null || !rect.width ? null : Number((canvasX / rect.width).toFixed(4));
        const canvasYPct = canvasY == null || !rect.height ? null : Number((canvasY / rect.height).toFixed(4));
        return {
          canvasFound: true,
          canvasX,
          canvasY,
          canvasXPct,
          canvasYPct,
          canvasRect: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            right: rect.right,
            bottom: rect.bottom
          },
          viewport
        };
      }
    
      function targetInfo(target) {
        if (!target) return null;
        let text = '';
        try { text = (target.innerText || target.textContent || '').slice(0, 300); } catch (_) {}
        return {
          tagName: target.tagName || '',
          id: target.id || '',
          className: typeof target.className === 'string' ? target.className : '',
          ariaLabel: target.getAttribute ? (target.getAttribute('aria-label') || '') : '',
          role: target.getAttribute ? (target.getAttribute('role') || '') : '',
          text
        };
      }
    
      function readFirstGameTrace() {
        const candidateFiles = [
          'steam-achievement-first-game-started-third-interaction-pass-42.json',
          'steam-achievement-first-game-started-third-interaction-pass-41.json',
          'steam-achievement-first-game-started-second-interaction-pass-40.json'
        ];
        for (const file of candidateFiles) {
          const p = path.join(root, file);
          try {
            if (!fs.existsSync(p)) continue;
            const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
            if (parsed && parsed.attemptedUnlock && parsed.activationResult) {
              return {
                found: true,
                file,
                status: parsed.status || null,
                time: parsed.thirdInteractionAt || parsed.secondInteractionAt || parsed.updatedAt || parsed.latest?.time || null
              };
            }
          } catch (_) {}
        }
        return { found: false, file: null, status: null, time: null };
      }
    
      function updateFirstGameState() {
        const trace = readFirstGameTrace();
        if (trace.found && !firstGameStartedSeen) {
          firstGameStartedSeen = true;
          firstGameStartedAt = trace.time || safeNow();
          writeTrace({
            event: 'first_weapon_pickup_mapper_armed_after_first_game_started',
            reason: 'pass_42_first_game_started_trace_detected',
            firstGameTrace: trace
          });
        }
        return trace;
      }
    
      function possiblePickupHint(entry) {
        if (entry.inputType === 'keydown') {
          const k = String(entry.key || '').toLowerCase();
          const c = String(entry.code || '').toLowerCase();
          if (['e', 'f', 'enter', ' ', 'spacebar'].includes(k) || ['keye', 'keyf', 'enter', 'space'].includes(c)) {
            return 'possible_interact_or_pickup_key';
          }
        }
        if (entry.inputType === 'gamepad_button_down') {
          return 'possible_gamepad_pickup_or_action_button';
        }
        if (entry.inputType === 'click' || entry.inputType === 'pointerdown') {
          if (entry.canvasFound && firstGameStartedSeen) return 'post_start_canvas_pointer_input';
        }
        return null;
      }
    
      function writeTrace(extra = {}) {
        updateFirstGameStateSilent();
        const payload = {
          ok: true,
          pass: PASS,
          appId: APP_ID,
          status: 'steam_achievement_pass_48_first_weapon_pickup_mapper_trace_found',
          achievement: ACHIEVEMENT,
          triggerInstalled: registered,
          triggerMode: 'runtime_first_weapon_pickup_input_mapper_no_unlock',
          attemptedUnlock: false,
          activationResult: null,
          bridgeStatus: null,
          firstGameStartedSeen,
          firstGameStartedAt,
          interactionCount: interactionIndex,
          latest: history[history.length - 1] || null,
          latestInteractions: history.slice(-20),
          latestPointerInteractions: pointerHistory.slice(-20),
          latestKeyInteractions: keyHistory.slice(-20),
          latestGamepadInteractions: gamepadHistory.slice(-20),
          url: window.location ? window.location.href : null,
          title: document.title || '',
          storeShouldShow: STORE_SHOULD_SHOW,
          gameScenePatched: false,
          legendaryStoreScenePatched: false,
          note: 'Pass 48 records inputs around a real weapon pickup. It does not unlock FIRST_WEAPON_PICKUP.',
          ...extra
        };
        try {
          fs.writeFileSync(tracePath, JSON.stringify(payload, null, 2), 'utf8');
        } catch (_) {}
        appendLog(payload);
      }
    
      function updateFirstGameStateSilent() {
        if (firstGameStartedSeen) return;
        const trace = readFirstGameTrace();
        if (trace.found) {
          firstGameStartedSeen = true;
          firstGameStartedAt = trace.time || safeNow();
        }
      }
    
      function recordInput(evt, inputType, phase) {
        updateFirstGameState();
        interactionIndex += 1;
        const canvasInfo = getCanvasInfo(evt || {});
        const entry = {
          time: safeNow(),
          event: 'first_weapon_pickup_mapper_input',
          interactionIndex,
          inputType,
          phase: phase || null,
          button: typeof evt.button === 'number' ? evt.button : null,
          key: evt.key || null,
          code: evt.code || null,
          clientX: typeof evt.clientX === 'number' ? evt.clientX : null,
          clientY: typeof evt.clientY === 'number' ? evt.clientY : null,
          ...canvasInfo,
          target: targetInfo(evt.target),
          activeElement: targetInfo(document.activeElement),
          firstGameStartedSeen,
          firstGameStartedAt,
          elapsedMs: Math.round(performance.now()),
          pickupHint: null,
          note: 'Pass 48 records input only. It does not unlock FIRST_WEAPON_PICKUP.',
          attemptedUnlock: false,
          storeShouldShow: STORE_SHOULD_SHOW
        };
        entry.pickupHint = possiblePickupHint(entry);
        history.push(entry);
        trim(history, 200);
        if (inputType.indexOf('pointer') === 0 || inputType === 'click') {
          pointerHistory.push(entry);
          trim(pointerHistory, 80);
        }
        if (inputType.indexOf('key') === 0) {
          keyHistory.push(entry);
          trim(keyHistory, 80);
        }
        writeTrace({ latestInput: entry });
      }
    
      function pollGamepads() {
        updateFirstGameStateSilent();
        const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
        for (const pad of pads) {
          const buttons = pad.buttons || [];
          buttons.forEach((button, index) => {
            const key = String(pad.index) + ':' + String(index);
            const wasPressed = lastGamepadSnapshot.get(key) || false;
            const pressed = Boolean(button && button.pressed);
            if (pressed && !wasPressed) {
              interactionIndex += 1;
              const entry = {
                time: safeNow(),
                event: 'first_weapon_pickup_mapper_gamepad_input',
                interactionIndex,
                inputType: 'gamepad_button_down',
                phase: 'down',
                gamepadIndex: pad.index,
                gamepadId: pad.id || '',
                buttonIndex: index,
                buttonValue: button.value,
                firstGameStartedSeen,
                firstGameStartedAt,
                elapsedMs: Math.round(performance.now()),
                pickupHint: 'possible_gamepad_pickup_or_action_button',
                note: 'Pass 48 records input only. It does not unlock FIRST_WEAPON_PICKUP.',
                attemptedUnlock: false,
                storeShouldShow: STORE_SHOULD_SHOW
              };
              history.push(entry);
              gamepadHistory.push(entry);
              trim(history, 200);
              trim(gamepadHistory, 80);
              writeTrace({ latestInput: entry });
            }
            lastGamepadSnapshot.set(key, pressed);
          });
        }
      }
    
      function register() {
        if (registered) return;
        registered = true;
        try {
          window.addEventListener('pointerdown', (evt) => recordInput(evt, 'pointerdown', 'down'), true);
          window.addEventListener('pointerup', (evt) => recordInput(evt, 'pointerup', 'up'), true);
          window.addEventListener('click', (evt) => recordInput(evt, 'click', 'click'), true);
          window.addEventListener('keydown', (evt) => recordInput(evt, 'keydown', 'down'), true);
          window.addEventListener('keyup', (evt) => recordInput(evt, 'keyup', 'up'), true);
          gamepadInterval = window.setInterval(pollGamepads, 120);
          window.addEventListener('beforeunload', () => {
            try { if (gamepadInterval) window.clearInterval(gamepadInterval); } catch (_) {}
            writeTrace({ event: 'first_weapon_pickup_mapper_beforeunload' });
          });
          writeTrace({
            event: 'first_weapon_pickup_mapper_registered',
            reason: 'preload_registered'
          });
        } catch (error) {
          registered = false;
          writeTrace({
            ok: false,
            event: 'first_weapon_pickup_mapper_register_failed',
            status: 'steam_achievement_pass_48_mapper_register_failed',
            error: String(error && error.message ? error.message : error)
          });
        }
      }
    
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', register, { once: true });
      } else {
        register();
      }
    })();
    // CHIGGAS_STEAM_PASS_48_FIRST_WEAPON_PICKUP_MAPPER_END
}

module.exports = {
  installFirstWeaponPickupMapPreload
};
