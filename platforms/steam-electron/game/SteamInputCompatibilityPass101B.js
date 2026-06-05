/* CHIGGAS_STEAM_PASS_101B_STEAM_INPUT_COMPATIBILITY_BEGIN */
(function () {
  if (window.__chiggasSteamPass101BCompatibilityInstalled) return;
  window.__chiggasSteamPass101BCompatibilityInstalled = true;

  const PASS = 'steam_desktop_wrapper_pass_101b';

  const state = {
    pass: PASS,
    installedAt: new Date().toISOString(),
    enabled: true,
    lastInputAt: null,
    lastInputType: null,
    lastKey: null,
    syntheticCount: 0,
    notes: [
      'Steam Input compatibility layer installed.',
      'This pass supports Steam Input Recommended Layouts that emit keyboard-style inputs.'
    ]
  };

  const KEY_TO_ACTION = {
    ArrowUp: 'nav_up',
    ArrowDown: 'nav_down',
    ArrowLeft: 'nav_left',
    ArrowRight: 'nav_right',
    w: 'nav_up',
    W: 'nav_up',
    s: 'nav_down',
    S: 'nav_down',
    a: 'nav_left',
    A: 'nav_left',
    d: 'nav_right',
    D: 'nav_right',
    Enter: 'confirm',
    ' ': 'confirm',
    Escape: 'back_pause',
    Backspace: 'back',
    e: 'eat_interact',
    E: 'eat_interact',
    r: 'recruit_charge',
    R: 'recruit_charge',
    f: 'shoot_action',
    F: 'shoot_action',
    q: 'scroll_left_tab',
    Q: 'scroll_left_tab',
    z: 'scroll_left_tab',
    Z: 'scroll_left_tab',
    Tab: 'tab_next',
    x: 'tab_next',
    X: 'tab_next'
  };

  function trace(update = {}) {
    Object.assign(state, update, { updatedAt: new Date().toISOString() });
    try {
      localStorage.setItem('chiggas_steam_pass_101b_state', JSON.stringify(state, null, 2));
    } catch (_) {}
  }

  function getScenes() {
    const scenes = [];
    try {
      const games = [];
      if (window.game) games.push(window.game);
      if (window.phaserGame) games.push(window.phaserGame);
      if (window.Phaser?.GAMES) games.push(...window.Phaser.GAMES);
      for (const g of games) {
        if (g?.scene?.scenes) scenes.push(...g.scene.scenes);
      }
    } catch (_) {}
    return scenes.filter(Boolean);
  }

  function activeSceneKey() {
    try {
      const s = getScenes().find(scene => scene.scene?.isActive?.());
      return s?.scene?.key || s?.sys?.settings?.key || null;
    } catch (_) {
      return null;
    }
  }

  function dispatchSyntheticKeyboard(key, type = 'keydown') {
    try {
      const event = new KeyboardEvent(type, {
        key,
        code: key === ' ' ? 'Space' : key,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      window.dispatchEvent(event);
      document.dispatchEvent(event);
      if (document.body) document.body.dispatchEvent(event);
      state.syntheticCount += 1;
      trace({ lastSyntheticKey: key, lastSyntheticType: type });
      return true;
    } catch (error) {
      trace({ lastSyntheticError: String(error && error.message ? error.message : error) });
      return false;
    }
  }

  function dispatchGameAction(action, sourceKey) {
    try {
      const detail = {
        pass: PASS,
        action,
        sourceKey,
        sceneKey: activeSceneKey(),
        at: new Date().toISOString()
      };
      window.dispatchEvent(new CustomEvent('chiggas-steam-input-compat-action', { detail }));

      const scene = getScenes().find(s => s.scene?.isActive?.()) || getScenes()[0];
      if (scene?.events?.emit) {
        scene.events.emit('chiggas-steam-input-compat-action', detail);
      }

      return true;
    } catch (_) {
      return false;
    }
  }

  function onKey(event) {
    if (!state.enabled) return;
    if (!event || event.__chiggasPass101BSeen) return;
    try { event.__chiggasPass101BSeen = true; } catch (_) {}

    const action = KEY_TO_ACTION[event.key];
    if (!action) return;

    trace({
      lastInputAt: new Date().toISOString(),
      lastInputType: event.type,
      lastKey: event.key,
      lastAction: action,
      activeScene: activeSceneKey()
    });

    dispatchGameAction(action, event.key);
  }

  function installListeners() {
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    document.addEventListener('keyup', onKey, true);

    window.addEventListener('gamepadconnected', e => {
      trace({ lastGamepadConnectedAt: new Date().toISOString(), lastGamepadId: e.gamepad?.id || null });
      try { document.documentElement.classList.add('chiggas-controller-active'); } catch (_) {}
    });

    window.addEventListener('gamepaddisconnected', e => {
      trace({ lastGamepadDisconnectedAt: new Date().toISOString(), lastGamepadId: e.gamepad?.id || null });
    });
  }

  function getRecommendedLayout() {
    return {
      pass: PASS,
      mode: 'Steam Input emits keyboard/mouse-compatible controls',
      mapping: {
        'Left Stick / D-Pad Up': 'W or ArrowUp',
        'Left Stick / D-Pad Down': 'S or ArrowDown',
        'Left Stick / D-Pad Left': 'A or ArrowLeft',
        'Left Stick / D-Pad Right': 'D or ArrowRight',
        'A / Cross': 'Enter or Space',
        'B / Circle': 'Escape',
        'X / Square': 'E',
        'Y / Triangle': 'R',
        'Right Trigger': 'F or Left Mouse',
        'Left Trigger': 'R or Charge',
        'Start / Menu': 'Escape',
        'Left Shoulder': 'Q / Previous tab',
        'Right Shoulder': 'Tab or X / Next tab'
      }
    };
  }

  window.ChiggasSteamInputCompat = {
    pass: PASS,
    getState() { trace(); return { ...state }; },
    enable() { state.enabled = true; trace(); return { ok: true, enabled: true }; },
    disable() { state.enabled = false; trace(); return { ok: true, enabled: false }; },
    getRecommendedLayout,
    testKey(key = 'Enter') {
      dispatchSyntheticKeyboard(key, 'keydown');
      setTimeout(() => dispatchSyntheticKeyboard(key, 'keyup'), 40);
      return { ok: true, key, action: KEY_TO_ACTION[key] || null };
    },
    selfTest() {
      return {
        ok: true,
        pass: PASS,
        apiPresent: !!window.ChiggasSteamInputCompat,
        activeScene: activeSceneKey(),
        layout: getRecommendedLayout(),
        state: { ...state }
      };
    }
  };

  installListeners();
  trace({ ready: true });
  try { console.log('[Chiggas Pass 101B] Steam Input compatibility loaded'); } catch (_) {}
})();
