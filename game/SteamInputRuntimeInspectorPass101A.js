/* CHIGGAS_STEAM_PASS_101A_STEAM_INPUT_RUNTIME_INSPECTOR_BEGIN */
(function () {
  if (window.__chiggasSteamPass101AInspectorInstalled) return;
  window.__chiggasSteamPass101AInspectorInstalled = true;

  const PASS = 'steam_desktop_wrapper_pass_101a';
  const TRACE_KEY = 'chiggas_steam_pass_101a_input_inspector_trace';
  const state = { pass: PASS, installedAt: new Date().toISOString(), scanCount: 0, polling: false, samples: [], errors: [] };

  function safeJson(value) {
    return JSON.parse(JSON.stringify(value, (k, v) => typeof v === 'bigint' ? String(v) + 'n' : (typeof v === 'function' ? `[Function ${v.name || 'anonymous'}]` : v)));
  }

  function keysOf(obj, depth = 1, seen = new Set()) {
    if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) return null;
    if (seen.has(obj)) return '[Circular]';
    seen.add(obj);
    const out = {};
    let names = [];
    try { names = Object.getOwnPropertyNames(obj); } catch (_) {}
    try {
      const proto = Object.getPrototypeOf(obj);
      if (proto) names.push(...Object.getOwnPropertyNames(proto).map(k => 'proto:' + k));
    } catch (_) {}
    for (const key of [...new Set(names)].slice(0, 180)) {
      const actual = key.startsWith('proto:') ? key.slice(6) : key;
      try {
        const source = key.startsWith('proto:') ? Object.getPrototypeOf(obj) : obj;
        const v = source[actual];
        if (typeof v === 'function') out[key] = `[Function ${v.name || actual}]`;
        else if (v && typeof v === 'object' && depth > 0) out[key] = keysOf(v, depth - 1, seen);
        else out[key] = typeof v === 'bigint' ? String(v) + 'n' : v;
      } catch (e) { out[key] = '[Error ' + (e.message || e) + ']'; }
    }
    return out;
  }

  function gamepads() {
    try {
      return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean).map(p => ({
        index: p.index, id: p.id, connected: p.connected, mapping: p.mapping, timestamp: p.timestamp,
        axes: Array.from(p.axes || []).map(v => Number(Number(v).toFixed(4))),
        buttons: Array.from(p.buttons || []).map((b, i) => ({ index: i, pressed: !!b.pressed, touched: !!b.touched, value: Number(Number(b.value || 0).toFixed(4)) }))
      }));
    } catch (e) { return { error: String(e.message || e) }; }
  }

  function scenes() {
    try {
      const games = [];
      if (window.game) games.push(window.game);
      if (window.phaserGame) games.push(window.phaserGame);
      if (window.Phaser?.GAMES) games.push(...window.Phaser.GAMES);
      const out = [];
      for (const g of games) for (const s of (g?.scene?.scenes || [])) out.push({
        key: s.scene?.key || s.sys?.settings?.key || null,
        active: !!s.scene?.isActive?.(),
        paused: !!s.scene?.isPaused?.(),
        sleeping: !!s.scene?.isSleeping?.(),
        visible: !!s.scene?.isVisible?.(),
        hasInput: !!s.input,
        hasGamepad: !!s.input?.gamepad,
        hasKeyboard: !!s.input?.keyboard
      });
      return out;
    } catch (e) { return { error: String(e.message || e) }; }
  }

  function parseManifest(text) {
    const names = [...new Set([...text.matchAll(/"([^"]+)"\s*\{/g)].map(m => m[1]))].slice(0, 200);
    const actionSets = names.filter(n => /menu|gameplay|wardrobe|store|legendary|mini/i.test(n));
    const actions = names.filter(n => /move|up|down|left|right|confirm|back|pause|shoot|eat|munch|charge|store|select|action|attack|aim/i.test(n));
    return { length: text.length, actionSets, actions, preview: text.slice(0, 3000) };
  }

  async function readManifest() {
    const candidates = ['./steam_input/game_actions_4788490.vdf','../steam_input/game_actions_4788490.vdf','./game_actions_4788490.vdf'];
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const text = await res.text();
          return { ok: true, url, ...parseManifest(text) };
        }
      } catch (_) {}
    }
    return { ok: false, candidates };
  }

  async function capabilities() {
    try {
      if (window.ChiggasSteam?.getCapabilities) return safeJson(await window.ChiggasSteam.getCapabilities());
      return { available: false, reason: 'window.ChiggasSteam.getCapabilities missing' };
    } catch (e) { return { available: false, error: String(e.message || e) }; }
  }

  function windowSurface() {
    const names = ['ChiggasSteam','ChiggasSteamInput','ChiggasSteamInputNative','ChiggasSteamworks','steamworks','SteamInput','SteamClient','ChiggasControllerReviewCompliance'];
    const out = {};
    for (const n of names) {
      try { out[n] = typeof window[n] === 'undefined' ? null : keysOf(window[n], 2); }
      catch (e) { out[n] = { error: String(e.message || e) }; }
    }
    return out;
  }

  async function knownCalls() {
    const calls = [
      ['ChiggasSteamInput.getStatus', () => window.ChiggasSteamInput?.getStatus?.()],
      ['ChiggasSteamInput.getState', () => window.ChiggasSteamInput?.getState?.()],
      ['ChiggasSteamInput.getCapabilities', () => window.ChiggasSteamInput?.getCapabilities?.()],
      ['ChiggasSteamInput.getActionSets', () => window.ChiggasSteamInput?.getActionSets?.()],
      ['ChiggasSteamInput.getActions', () => window.ChiggasSteamInput?.getActions?.()],
      ['ChiggasSteamInput.sample', () => window.ChiggasSteamInput?.sample?.()],
      ['ChiggasSteam.getSteamInputStatus', () => window.ChiggasSteam?.getSteamInputStatus?.()],
      ['ChiggasSteam.getInputStatus', () => window.ChiggasSteam?.getInputStatus?.()]
    ];
    const out = [];
    for (const [label, fn] of calls) {
      try { out.push({ label, ok: true, value: safeJson(await fn()) }); }
      catch (e) { out.push({ label, ok: false, error: String(e.message || e) }); }
    }
    return out;
  }

  async function scan(reason = 'manual') {
    const snap = {
      pass: PASS, reason, generatedAt: new Date().toISOString(), scanCount: ++state.scanCount,
      focus: document.hasFocus(), hidden: document.hidden, url: location.href,
      capabilities: await capabilities(), windowSurface: windowSurface(), manifest: await readManifest(),
      gamepads: gamepads(), scenes: scenes(), knownCalls: await knownCalls()
    };
    state.lastScan = snap;
    state.samples.push(snap);
    if (state.samples.length > 20) state.samples.shift();
    try { localStorage.setItem(TRACE_KEY, JSON.stringify(snap, null, 2)); } catch (e) { state.errors.push(String(e.message || e)); }
    return snap;
  }

  function startPolling(ms = 250) {
    stopPolling();
    state.polling = true;
    state.pollTimer = setInterval(() => {
      const sample = { pass: PASS, type: 'poll', generatedAt: new Date().toISOString(), gamepads: gamepads(), scenes: scenes() };
      state.samples.push(sample);
      if (state.samples.length > 60) state.samples.shift();
      try { localStorage.setItem(TRACE_KEY + '_poll', JSON.stringify(sample, null, 2)); } catch (_) {}
    }, Number(ms) || 250);
    return { ok: true, pass: PASS, status: 'polling_started', ms: Number(ms) || 250 };
  }

  function stopPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = null;
    state.polling = false;
    return { ok: true, pass: PASS, status: 'polling_stopped' };
  }

  window.ChiggasSteamInputInspector = {
    pass: PASS,
    scan, startPolling, stopPolling,
    getTrace() { return { pass: PASS, installedAt: state.installedAt, scanCount: state.scanCount, polling: state.polling, lastScan: state.lastScan, sampleCount: state.samples.length, errors: state.errors }; },
    getSamples() { return state.samples.slice(); },
    getGamepads: gamepads,
    getScenes: scenes,
    getWindowSurface: windowSurface,
    readManifest,
    tryKnownCalls: knownCalls,
    help() { return ['await window.ChiggasSteamInputInspector.scan("steam_input_enabled")','window.ChiggasSteamInputInspector.startPolling(250)','window.ChiggasSteamInputInspector.stopPolling()','window.ChiggasSteamInputInspector.getTrace()']; }
  };

  scan('auto_startup').then(r => console.log('[Chiggas Pass 101A] Steam Input Inspector loaded', r)).catch(e => state.errors.push(String(e.message || e)));
})();
