/* CHIGGAS_STEAM_PASS_100A_CONTROLLER_REVIEW_COMPLIANCE_BEGIN */
(function () {
  if (window.__chiggasSteamPass100AControllerReviewInstalled) return;
  window.__chiggasSteamPass100AControllerReviewInstalled = true;

  const PASS = 'steam_desktop_wrapper_pass_100a';

  const state = {
    pass: PASS,
    installedAt: new Date().toISOString(),
    lastControllerInputAt: null,
    lastMouseInputAt: null,
    cursorHidden: false,
    lastPauseReason: null,
    lastPauseAt: null,
    lastDisconnectAt: null,
    overlayBlurPauseEnabled: true,
    controllerDisconnectPauseEnabled: true,
    gamepadPollCount: 0,
    activeGamepadIndexes: [],
    errors: []
  };

  function log(...args) {
    try { console.log('[Chiggas Pass 100A]', ...args); } catch (_) {}
  }

  function warn(...args) {
    try { console.warn('[Chiggas Pass 100A]', ...args); } catch (_) {}
  }

  function trace(update = {}) {
    try {
      Object.assign(state, update, { updatedAt: new Date().toISOString() });
      window.__chiggasSteamPass100AControllerReviewState = { ...state };
      localStorage.setItem('chiggas_steam_pass_100a_controller_review_state', JSON.stringify(state, null, 2));
    } catch (_) {}
  }

  function addGlobalCursorStyle() {
    try {
      if (document.getElementById('chiggas-steam-pass-100a-controller-cursor-style')) return;
      const style = document.createElement('style');
      style.id = 'chiggas-steam-pass-100a-controller-cursor-style';
      style.textContent = `
        html.chiggas-controller-active,
        html.chiggas-controller-active body,
        html.chiggas-controller-active canvas,
        html.chiggas-controller-active * {
          cursor: none !important;
        }
      `;
      document.head.appendChild(style);
    } catch (error) {
      state.errors.push('addGlobalCursorStyle: ' + String(error && error.message ? error.message : error));
    }
  }

  function setControllerActive(source = 'unknown') {
    try {
      state.lastControllerInputAt = new Date().toISOString();
      state.cursorHidden = true;
      document.documentElement.classList.add('chiggas-controller-active');
      trace({ lastControllerSource: source, cursorHidden: true });
    } catch (_) {}
  }

  function setMouseActive(source = 'mouse') {
    try {
      state.lastMouseInputAt = new Date().toISOString();
      state.cursorHidden = false;
      document.documentElement.classList.remove('chiggas-controller-active');
      trace({ lastMouseSource: source, cursorHidden: false });
    } catch (_) {}
  }

  function getSceneCandidates() {
    const out = [];
    try {
      if (window.__chiggasPass94ACurrentGameScene) out.push(window.__chiggasPass94ACurrentGameScene);
      if (window.__chiggasCurrentGameScene) out.push(window.__chiggasCurrentGameScene);
      if (window.game?.scene?.scenes) out.push(...window.game.scene.scenes);
      if (window.phaserGame?.scene?.scenes) out.push(...window.phaserGame.scene.scenes);
      if (window.Phaser?.GAMES) {
        for (const g of window.Phaser.GAMES) {
          if (g?.scene?.scenes) out.push(...g.scene.scenes);
        }
      }
    } catch (_) {}

    const seen = new Set();
    return out.filter(scene => {
      if (!scene || seen.has(scene)) return false;
      seen.add(scene);
      return true;
    });
  }

  function getActiveGameplayScene() {
    const scenes = getSceneCandidates();

    let gameScene = scenes.find(s => {
      try {
        const key = s.scene?.key || s.sys?.settings?.key || '';
        return key === 'GameScene' && s.scene?.isActive?.();
      } catch (_) {
        return false;
      }
    });

    if (gameScene) return gameScene;

    return scenes.find(s => {
      try {
        const key = s.scene?.key || s.sys?.settings?.key || '';
        return key === 'GameScene';
      } catch (_) {
        return false;
      }
    }) || null;
  }

  function isActuallyGameplayActive(scene) {
    try {
      if (!scene) return false;
      const key = scene.scene?.key || scene.sys?.settings?.key || '';
      if (key !== 'GameScene') return false;
      if (scene.scene?.isPaused?.()) return false;
      if (scene.isDead || scene.isEnding) return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  function showPauseNotice(reason) {
    try {
      let box = document.getElementById('chiggas-steam-pass-100a-pause-notice');
      if (!box) {
        box = document.createElement('div');
        box.id = 'chiggas-steam-pass-100a-pause-notice';
        box.style.position = 'fixed';
        box.style.left = '50%';
        box.style.top = '22px';
        box.style.transform = 'translateX(-50%)';
        box.style.zIndex = '2147483646';
        box.style.maxWidth = 'min(620px, 90vw)';
        box.style.padding = '10px 16px';
        box.style.borderRadius = '12px';
        box.style.border = '2px solid rgba(255,255,255,0.88)';
        box.style.background = 'rgba(0,0,0,0.82)';
        box.style.color = '#ffffff';
        box.style.font = 'bold 14px Arial, sans-serif';
        box.style.textAlign = 'center';
        box.style.pointerEvents = 'none';
        document.body.appendChild(box);
      }

      box.textContent = reason === 'controller_disconnect'
        ? 'Controller disconnected — game paused.'
        : 'Game paused while Steam Overlay / window focus changed.';

      clearTimeout(box.__hideTimer);
      box.__hideTimer = setTimeout(() => {
        try { if (box && box.parentNode) box.parentNode.removeChild(box); } catch (_) {}
      }, 4500);
    } catch (_) {}
  }

  function pauseGameplay(reason = 'unknown') {
    try {
      const scene = getActiveGameplayScene();
      if (!isActuallyGameplayActive(scene)) {
        trace({ lastPauseSkippedReason: reason, lastPauseSkippedAt: new Date().toISOString() });
        return { ok: false, status: 'no_active_gameplay_scene', reason };
      }

      try {
        window.dispatchEvent(new CustomEvent('chiggas-controller-review-pause-requested', {
          detail: { pass: PASS, reason }
        }));
      } catch (_) {}

      // Prefer existing pause handlers when present.
      const pauseMethodNames = [
        'pauseGame',
        'togglePause',
        'showPauseMenu',
        'openPauseMenu',
        'createPauseMenu',
        '_showPauseMenu',
        '_openPauseMenu'
      ];

      let methodUsed = null;
      for (const name of pauseMethodNames) {
        if (typeof scene[name] === 'function') {
          try {
            scene[name]();
            methodUsed = name;
            break;
          } catch (_) {}
        }
      }

      // Generic fallback: pause physics/timers/sound and scene if no specific pause UI exists.
      if (!methodUsed) {
        try { scene.physics?.world?.pause?.(); } catch (_) {}
        try { scene.sound?.pauseAll?.(); } catch (_) {}
        try { scene.tweens?.pauseAll?.(); } catch (_) {}
        try { scene.time?.paused = true; } catch (_) {}
        try { scene.scene?.pause?.(); } catch (_) {}
        methodUsed = 'generic_scene_pause';
      }

      const at = new Date().toISOString();
      state.lastPauseReason = reason;
      state.lastPauseAt = at;
      trace({ lastPauseReason: reason, lastPauseAt: at, lastPauseMethod: methodUsed });
      showPauseNotice(reason);

      return { ok: true, status: 'paused', reason, methodUsed };
    } catch (error) {
      const message = String(error && error.message ? error.message : error);
      state.errors.push('pauseGameplay: ' + message);
      trace();
      warn('pauseGameplay failed:', error);
      return { ok: false, status: 'pause_failed', reason, error: message };
    }
  }

  function getActiveGamepads() {
    try {
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
      return pads.map(pad => ({
        index: pad.index,
        id: pad.id,
        connected: pad.connected,
        buttonsPressed: Array.from(pad.buttons || []).some(b => b && b.pressed),
        axesMoved: Array.from(pad.axes || []).some(v => Math.abs(Number(v) || 0) > 0.18)
      }));
    } catch (_) {
      return [];
    }
  }

  function installGamepadPolling() {
    if (window.__chiggasSteamPass100AGamepadPollingInstalled) return;
    window.__chiggasSteamPass100AGamepadPollingInstalled = true;

    setInterval(() => {
      try {
        state.gamepadPollCount += 1;
        const pads = getActiveGamepads();
        state.activeGamepadIndexes = pads.map(p => p.index);

        if (pads.some(p => p.buttonsPressed || p.axesMoved)) {
          setControllerActive('gamepad_poll');
        }

        trace();
      } catch (_) {}
    }, 250);
  }

  function installEventListeners() {
    addGlobalCursorStyle();

    window.addEventListener('gamepadconnected', (event) => {
      try {
        setControllerActive('gamepadconnected');
        trace({
          lastGamepadConnectedAt: new Date().toISOString(),
          lastGamepadConnected: {
            index: event.gamepad?.index,
            id: event.gamepad?.id
          }
        });
      } catch (_) {}
    });

    window.addEventListener('gamepaddisconnected', (event) => {
      try {
        const at = new Date().toISOString();
        state.lastDisconnectAt = at;
        trace({
          lastDisconnectAt: at,
          lastGamepadDisconnected: {
            index: event.gamepad?.index,
            id: event.gamepad?.id
          }
        });

        if (state.controllerDisconnectPauseEnabled) {
          pauseGameplay('controller_disconnect');
        }
      } catch (_) {}
    });

    ['mousemove', 'mousedown', 'pointermove'].forEach(name => {
      window.addEventListener(name, () => setMouseActive(name), { passive: true });
    });

    ['keydown'].forEach(name => {
      window.addEventListener(name, (event) => {
        try {
          const key = String(event.key || '').toLowerCase();
          if (['gamepad', 'controller'].includes(key)) setControllerActive(name);
        } catch (_) {}
      }, true);
    });

    // Steam Overlay commonly causes Electron/Chromium window blur. Pause on blur only while gameplay is active.
    window.addEventListener('blur', () => {
      try {
        if (state.overlayBlurPauseEnabled) {
          setTimeout(() => pauseGameplay('window_blur_or_steam_overlay'), 80);
        }
      } catch (_) {}
    }, true);

    document.addEventListener('visibilitychange', () => {
      try {
        if (document.hidden && state.overlayBlurPauseEnabled) {
          pauseGameplay('document_hidden_or_overlay');
        }
      } catch (_) {}
    }, true);
  }

  window.ChiggasControllerReviewCompliance = {
    pass: PASS,
    getState() {
      trace();
      return { ...state };
    },
    hideCursorNow() {
      setControllerActive('manual');
      return { ok: true, state: { ...state } };
    },
    showCursorNow() {
      setMouseActive('manual');
      return { ok: true, state: { ...state } };
    },
    pauseNow(reason = 'manual') {
      return pauseGameplay(reason);
    },
    getGamepads() {
      return getActiveGamepads();
    },
    setOverlayBlurPauseEnabled(enabled) {
      state.overlayBlurPauseEnabled = !!enabled;
      trace();
      return { ok: true, overlayBlurPauseEnabled: state.overlayBlurPauseEnabled };
    },
    setControllerDisconnectPauseEnabled(enabled) {
      state.controllerDisconnectPauseEnabled = !!enabled;
      trace();
      return { ok: true, controllerDisconnectPauseEnabled: state.controllerDisconnectPauseEnabled };
    }
  };

  installEventListeners();
  installGamepadPolling();
  trace({ ready: true });
  log('installed');
})();
/* CHIGGAS_STEAM_PASS_100A_CONTROLLER_REVIEW_COMPLIANCE_END */
