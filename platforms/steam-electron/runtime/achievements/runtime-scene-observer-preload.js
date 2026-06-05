function installRuntimeSceneObserverPreload() {
  // CHIGGAS_STEAM_DESKTOP_WRAPPER_PASS_38_RUNTIME_SCENE_OBSERVER_PRELOAD_START
    (function installChiggasPass38RuntimeSceneObserverPreload() {
      try {
        if (globalThis.__CHIGGAS_PASS_38_RUNTIME_SCENE_OBSERVER_INSTALLED__) return;
        globalThis.__CHIGGAS_PASS_38_RUNTIME_SCENE_OBSERVER_INSTALLED__ = true;
    
        const electron = require('electron');
        const ipcRenderer = electron && electron.ipcRenderer;
        const channel = 'chiggas-achievements-runtime-observer-pass-38-trace';
        const startedAt = Date.now();
        let lastSignature = '';
        let tickCount = 0;
    
        function safeString(value) {
          try {
            if (value == null) return '';
            return String(value);
          } catch (_) {
            return '';
          }
        }
    
        function sceneInfo(scene) {
          const sys = scene && scene.sys;
          const settings = sys && sys.settings;
          const key = safeString((settings && settings.key) || scene.scene && scene.scene.key || scene.constructor && scene.constructor.name || 'UnknownScene');
          const active = Boolean(settings && settings.active);
          const visible = Boolean(settings && settings.visible);
          const status = safeString(settings && settings.status);
          const className = safeString(scene && scene.constructor && scene.constructor.name);
          return { key, active, visible, status, className };
        }
    
        function getCandidateGames() {
          const candidates = [];
          const names = ['game', 'phaserGame', 'chiggasGame', 'ChiggasGame', '__PHASER_GAME__'];
          for (const name of names) {
            try {
              const value = window[name];
              if (value && value.scene && Array.isArray(value.scene.scenes)) {
                candidates.push({ name, game: value });
              }
            } catch (_) {}
          }
    
          // Limited global scan. This is read-only and capped to avoid expensive enumeration.
          try {
            const keys = Object.keys(window).slice(0, 400);
            for (const name of keys) {
              if (candidates.some((c) => c.name === name)) continue;
              let value = null;
              try { value = window[name]; } catch (_) { continue; }
              if (value && value.scene && Array.isArray(value.scene.scenes)) {
                candidates.push({ name, game: value });
                if (candidates.length >= 5) break;
              }
            }
          } catch (_) {}
          return candidates;
        }
    
        function collectSnapshot(note) {
          const candidates = getCandidateGames();
          const allScenes = [];
          for (const candidate of candidates) {
            const scenes = (candidate.game.scene && candidate.game.scene.scenes) || [];
            for (const scene of scenes) {
              const info = sceneInfo(scene);
              allScenes.push({ ...info, gameRef: candidate.name });
            }
          }
          const activeScenes = allScenes.filter((s) => s.active).map((s) => s.key);
          const visibleScenes = allScenes.filter((s) => s.visible).map((s) => s.key);
          const sceneKeys = Array.from(new Set(allScenes.map((s) => s.key).filter(Boolean)));
          return {
            event: 'runtime_scene_observer_snapshot',
            note: note || null,
            url: safeString(window.location && window.location.href),
            title: safeString(document && document.title),
            activeScenes,
            visibleScenes,
            sceneKeys,
            candidates: candidates.map((c) => c.name),
            tickCount,
            msSinceInstall: Date.now() - startedAt
          };
        }
    
        async function sendSnapshot(note, force) {
          if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function') return false;
          const snapshot = collectSnapshot(note);
          const signature = JSON.stringify({ active: snapshot.activeScenes, visible: snapshot.visibleScenes, keys: snapshot.sceneKeys, candidates: snapshot.candidates });
          if (!force && signature === lastSignature && tickCount % 5 !== 0) return false;
          lastSignature = signature;
          try {
            await ipcRenderer.invoke(channel, snapshot);
            return true;
          } catch (_) {
            return false;
          }
        }
    
        const api = {
          pass: 'steam_desktop_wrapper_pass_38',
          snapshot: function snapshot() { return collectSnapshot('manual_snapshot'); },
          flush: function flush(note) { return sendSnapshot(note || 'manual_flush', true); }
        };
    
        try { window.ChiggasAchievementRuntimeObserver = api; } catch (_) {}
    
        function startObserver() {
          sendSnapshot('observer_started', true);
          const interval = setInterval(function pass38RuntimeSceneObserverTick() {
            tickCount += 1;
            sendSnapshot('observer_tick', false);
            if (tickCount >= 900) clearInterval(interval);
          }, 1000);
    
          window.addEventListener('keydown', function pass38RuntimeObserverKeydown(event) {
            if (event && event.ctrlKey && event.altKey && String(event.key || '').toLowerCase() === 'o') {
              sendSnapshot('ctrl_alt_o_manual_snapshot', true);
            }
          }, true);
        }
    
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', startObserver, { once: true });
        } else {
          setTimeout(startObserver, 0);
        }
      } catch (_) {}
    })();
    // CHIGGAS_STEAM_DESKTOP_WRAPPER_PASS_38_RUNTIME_SCENE_OBSERVER_PRELOAD_END
}

module.exports = {
  installRuntimeSceneObserverPreload
};
