/* CHIGGAS_STEAM_PASS_100A1_CONTROLLER_REVIEW_COMPLIANCE_BEGIN */
(function () {
  if (window.__chiggasSteamPass100AControllerReviewInstalled || window.__chiggasSteamPass100A1ControllerReviewInstalled) return;
  window.__chiggasSteamPass100AControllerReviewInstalled = true;
  window.__chiggasSteamPass100A1ControllerReviewInstalled = true;

  const PASS = 'steam_desktop_wrapper_pass_100a1';

  const state = {
    pass: PASS,
    installedAt: new Date().toISOString(),
    ready: true,
    cursorHidden: false,
    lastControllerInputAt: null,
    lastMouseInputAt: null,
    lastPauseReason: null,
    lastPauseAt: null,
    lastDisconnectAt: null,
    activeGamepadIndexes: [],
    gamepadPollCount: 0,
    errors: []
  };

  function trace(update = {}) {
    try {
      Object.assign(state, update, { updatedAt: new Date().toISOString() });
      window.__chiggasSteamPass100AControllerReviewState = { ...state };
      localStorage.setItem('chiggas_steam_pass_100a_controller_review_state', JSON.stringify(state, null, 2));
    } catch (_) {}
  }

  function addStyle() {
    try {
      if (document.getElementById('chiggas-steam-pass-100a1-controller-style')) return;
      const style = document.createElement('style');
      style.id = 'chiggas-steam-pass-100a1-controller-style';
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
      state.errors.push('style:' + String(error && error.message ? error.message : error));
    }
  }

  function controllerActive(source) {
    try {
      addStyle();
      document.documentElement.classList.add('chiggas-controller-active');
      trace({ cursorHidden: true, lastControllerInputAt: new Date().toISOString(), lastControllerSource: source });
    } catch (_) {}
  }

  function mouseActive(source) {
    try {
      document.documentElement.classList.remove('chiggas-controller-active');
      trace({ cursorHidden: false, lastMouseInputAt: new Date().toISOString(), lastMouseSource: source });
    } catch (_) {}
  }

  function sceneCandidates() {
    const out = [];
    try { if (window.__chiggasPass94ACurrentGameScene) out.push(window.__chiggasPass94ACurrentGameScene); } catch (_) {}
    try { if (window.__chiggasCurrentGameScene) out.push(window.__chiggasCurrentGameScene); } catch (_) {}
    try { if (window.game?.scene?.scenes) out.push(...window.game.scene.scenes); } catch (_) {}
    try { if (window.phaserGame?.scene?.scenes) out.push(...window.phaserGame.scene.scenes); } catch (_) {}
    try {
      if (window.Phaser?.GAMES) {
        for (const g of window.Phaser.GAMES) {
          if (g?.scene?.scenes) out.push(...g.scene.scenes);
        }
      }
    } catch (_) {}

    const seen = new Set();
    return out.filter(s => s && !seen.has(s) && seen.add(s));
  }

  function activeGameScene() {
    const scenes = sceneCandidates();
    return scenes.find(s => {
      try {
        const key = s.scene?.key || s.sys?.settings?.key || '';
        return key === 'GameScene' && (!s.scene?.isSleeping?.()) && (!s.scene?.isPaused?.());
      } catch (_) { return false; }
    }) || scenes.find(s => {
      try { return (s.scene?.key || s.sys?.settings?.key || '') === 'GameScene'; } catch (_) { return false; }
    }) || null;
  }

  function showNotice(text) {
    try {
      let box = document.getElementById('chiggas-steam-pass-100a1-notice');
      if (!box) {
        box = document.createElement('div');
        box.id = 'chiggas-steam-pass-100a1-notice';
        box.style.position = 'fixed';
        box.style.top = '20px';
        box.style.left = '50%';
        box.style.transform = 'translateX(-50%)';
        box.style.zIndex = '2147483646';
        box.style.padding = '10px 16px';
        box.style.borderRadius = '12px';
        box.style.background = 'rgba(0,0,0,0.82)';
        box.style.color = '#fff';
        box.style.font = 'bold 14px Arial, sans-serif';
        box.style.border = '2px solid rgba(255,255,255,0.8)';
        box.style.pointerEvents = 'none';
        document.body.appendChild(box);
      }
      box.textContent = text;
      clearTimeout(box.__hideTimer);
      box.__hideTimer = setTimeout(() => {
        try { if (box.parentNode) box.parentNode.removeChild(box); } catch (_) {}
      }, 4500);
    } catch (_) {}
  }

  function pauseNow(reason = 'manual') {
    try {
      const s = activeGameScene();
      if (!s) {
        trace({ lastPauseSkippedReason: reason, lastPauseSkippedAt: new Date().toISOString() });
        return { ok: false, status: 'no_gamescene_found', reason };
      }

      let methodUsed = null;
      const names = ['pauseGame', 'showPauseMenu', 'openPauseMenu', 'createPauseMenu', '_showPauseMenu', '_openPauseMenu'];
      for (const name of names) {
        if (typeof s[name] === 'function') {
          try { s[name](); methodUsed = name; break; } catch (_) {}
        }
      }

      if (!methodUsed) {
        try { s.physics?.world?.pause?.(); } catch (_) {}
        try { s.sound?.pauseAll?.(); } catch (_) {}
        try { s.tweens?.pauseAll?.(); } catch (_) {}
        try { if (s.time) s.time.paused = true; } catch (_) {}
        methodUsed = 'generic_pause';
      }

      const at = new Date().toISOString();
      trace({ lastPauseReason: reason, lastPauseAt: at, lastPauseMethod: methodUsed });
      showNotice(reason === 'controller_disconnect' ? 'Controller disconnected — game paused.' : 'Game paused.');
      return { ok: true, status: 'pause_requested', reason, methodUsed };
    } catch (error) {
      const msg = String(error && error.message ? error.message : error);
      state.errors.push('pause:' + msg);
      trace();
      return { ok: false, status: 'pause_failed', reason, error: msg };
    }
  }

  function gamepads() {
    try {
      return Array.from(navigator.getGamepads ? navigator.getGamepads() : [])
        .filter(Boolean)
        .map(p => ({
          index: p.index,
          id: p.id,
          connected: p.connected,
          pressed: Array.from(p.buttons || []).some(b => b && b.pressed),
          moved: Array.from(p.axes || []).some(v => Math.abs(Number(v) || 0) > 0.18)
        }));
    } catch (_) { return []; }
  }

  function install() {
    addStyle();

    window.addEventListener('gamepadconnected', e => {
      controllerActive('gamepadconnected');
      trace({ lastGamepadConnected: { index: e.gamepad?.index, id: e.gamepad?.id } });
    });

    window.addEventListener('gamepaddisconnected', e => {
      trace({ lastDisconnectAt: new Date().toISOString(), lastGamepadDisconnected: { index: e.gamepad?.index, id: e.gamepad?.id } });
      pauseNow('controller_disconnect');
    });

    ['mousemove', 'mousedown', 'pointermove'].forEach(n => {
      window.addEventListener(n, () => mouseActive(n), { passive: true });
    });

    window.addEventListener('blur', () => {
      setTimeout(() => pauseNow('window_blur_or_steam_overlay'), 100);
    }, true);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseNow('document_hidden_or_overlay');
    }, true);

    setInterval(() => {
      const pads = gamepads();
      const active = pads.filter(p => p.connected);
      const used = active.some(p => p.pressed || p.moved);
      if (used) controllerActive('gamepad_poll');
      trace({ gamepadPollCount: state.gamepadPollCount + 1, activeGamepadIndexes: active.map(p => p.index) });
    }, 250);
  }

  window.ChiggasControllerReviewCompliance = {
    pass: PASS,
    getState() { trace(); return { ...state }; },
    getGamepads: gamepads,
    hideCursorNow() { controllerActive('manual'); return { ok: true, state: { ...state } }; },
    showCursorNow() { mouseActive('manual'); return { ok: true, state: { ...state } }; },
    pauseNow,
    selfTest() {
      return {
        ok: true,
        pass: PASS,
        apiPresent: !!window.ChiggasControllerReviewCompliance,
        state: { ...state },
        gamepads: gamepads(),
        gameSceneFound: !!activeGameScene()
      };
    }
  };

  install();
  trace({ ready: true });
  try { console.log('[Chiggas Pass 100A1] Controller review compliance loaded'); } catch (_) {}
})();
/* CHIGGAS_STEAM_PASS_100A1_CONTROLLER_REVIEW_COMPLIANCE_END */
