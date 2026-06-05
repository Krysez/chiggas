const path = require('path');

const STEAM_ROOT = path.resolve(__dirname, '..');

function installFullscreenLaunchGuard() {
  // CHIGGAS_PASS_96H_FULLSCREEN_GUARD
  (function () {
    var __pass96h = {
      pass: 'steam_desktop_wrapper_pass_96h',
      installedAt: new Date().toISOString(),
      attempts: []
    };
  
    function __pass96hSafeRequireElectron() {
      try { return require('electron'); } catch (err) { return null; }
    }
  
    function __pass96hWriteTrace(reason, extra) {
      try {
        var fs = require('fs');
        var path = require('path');
        var electron = __pass96hSafeRequireElectron();
        var app = electron && electron.app;
        var fixedRoot = STEAM_ROOT;
        var traceName = 'pass96h-fullscreen-launch-trace.json';
        var paths = [];
  
        function addTracePath(p) {
          try {
            if (p && paths.indexOf(p) === -1) paths.push(p);
          } catch (_) {}
        }
  
        addTracePath(path.join(fixedRoot, traceName));
        try { addTracePath(path.join(STEAM_ROOT, traceName)); } catch (_) {}
        try { addTracePath(path.join(STEAM_ROOT, traceName)); } catch (_) {}
        try { if (process.resourcesPath) addTracePath(path.join(process.resourcesPath, traceName)); } catch (_) {}
        try { if (app && app.getPath) addTracePath(path.join(app.getPath('userData'), traceName)); } catch (_) {}
  
        var trace = Object.assign({
          pass: 'steam_desktop_wrapper_pass_96h',
          status: 'fullscreen_guard_attempted',
          reason: reason || null,
          writtenAt: new Date().toISOString(),
          cwd: null,
          dirname: null,
          execPath: null,
          resourcesPath: null,
          argv: null,
          attempts: __pass96h.attempts
        }, extra || {});
  
        try { trace.cwd = STEAM_ROOT; } catch (_) {}
        try { trace.dirname = STEAM_ROOT; } catch (_) {}
        try { trace.execPath = process.execPath; } catch (_) {}
        try { trace.resourcesPath = process.resourcesPath || null; } catch (_) {}
        try { trace.argv = process.argv; } catch (_) {}
  
        for (var i = 0; i < paths.length; i++) {
          try {
            fs.mkdirSync(path.dirname(paths[i]), { recursive: true });
            fs.writeFileSync(paths[i], JSON.stringify(trace, null, 2), 'utf8');
          } catch (err) {}
        }
      } catch (err) {}
    }
  
    function __pass96hForceFullscreen(reason) {
      var result = {
        reason: reason || null,
        at: new Date().toISOString(),
        ok: false,
        windowCount: 0,
        windows: [],
        error: null
      };
  
      try {
        var electron = __pass96hSafeRequireElectron();
        var BrowserWindow = electron && electron.BrowserWindow;
        if (!BrowserWindow || !BrowserWindow.getAllWindows) {
          result.error = 'BrowserWindow unavailable';
          __pass96h.attempts.push(result);
          __pass96hWriteTrace(reason, { lastResult: result });
          return result;
        }
  
        var wins = BrowserWindow.getAllWindows();
        result.windowCount = wins.length;
  
        for (var i = 0; i < wins.length; i++) {
          var win = wins[i];
          var before = {};
          var after = {};
          try { before.isVisible = win.isVisible && win.isVisible(); } catch (_) {}
          try { before.isMinimized = win.isMinimized && win.isMinimized(); } catch (_) {}
          try { before.isFullScreen = win.isFullScreen && win.isFullScreen(); } catch (_) {}
          try { before.isMaximized = win.isMaximized && win.isMaximized(); } catch (_) {}
  
          try { if (win.setSkipTaskbar) win.setSkipTaskbar(false); } catch (_) {}
          try { if (win.show) win.show(); } catch (_) {}
          try { if (win.restore) win.restore(); } catch (_) {}
          try { if (win.setFullScreen) win.setFullScreen(true); } catch (_) {}
          try { if (win.maximize) win.maximize(); } catch (_) {}
          try { if (win.focus) win.focus(); } catch (_) {}
          try { if (win.moveTop) win.moveTop(); } catch (_) {}
  
          try { after.isVisible = win.isVisible && win.isVisible(); } catch (_) {}
          try { after.isMinimized = win.isMinimized && win.isMinimized(); } catch (_) {}
          try { after.isFullScreen = win.isFullScreen && win.isFullScreen(); } catch (_) {}
          try { after.isMaximized = win.isMaximized && win.isMaximized(); } catch (_) {}
          try { after.bounds = win.getBounds && win.getBounds(); } catch (_) {}
  
          result.windows.push({ index: i, before: before, after: after });
        }
  
        result.ok = wins.length > 0;
      } catch (err) {
        result.error = err && (err.stack || err.message || String(err));
      }
  
      __pass96h.attempts.push(result);
      if (__pass96h.attempts.length > 20) __pass96h.attempts.shift();
      __pass96hWriteTrace(reason, { lastResult: result });
      return result;
    }
  
    try {
      var electron = __pass96hSafeRequireElectron();
      var app = electron && electron.app;
      if (app && app.whenReady) {
        app.whenReady().then(function () {
          [0, 100, 300, 750, 1500, 3000, 6000].forEach(function (ms) {
            setTimeout(function () { __pass96hForceFullscreen('app_ready_timeout_' + ms); }, ms);
          });
        });
      }
    } catch (err) {
      __pass96hWriteTrace('install_error', { error: err && (err.stack || err.message || String(err)) });
    }
  
    try {
      global.ChiggasPass96HForceFullscreen = __pass96hForceFullscreen;
    } catch (_) {}
  })();
  // /CHIGGAS_PASS_96H_FULLSCREEN_GUARD
}

function installDepotFullscreenGuard() {
  /* CHIGGAS_PASS_96G_DEPOT_FULLSCREEN_GUARD
   * Depot/fullscreen hardening for Chiggas Steam build.
   * This is intentionally appended instead of rewriting BrowserWindow construction.
   */
  (function chiggasPass96GDepotFullscreenGuard() {
    try {
      const electron = require('electron');
      const app = electron && electron.app;
      const BrowserWindow = electron && electron.BrowserWindow;
      if (!app || !BrowserWindow || global.__CHIGGAS_PASS_96G_DEPOT_FULLSCREEN_GUARD) return;
      global.__CHIGGAS_PASS_96G_DEPOT_FULLSCREEN_GUARD = true;
  
      function forceWindow(win, reason) {
        try {
          if (!win || win.isDestroyed()) return;
          try { win.setMenuBarVisibility(false); } catch (_) {}
          try { win.setAutoHideMenuBar(true); } catch (_) {}
          try { win.show(); } catch (_) {}
          try { win.restore(); } catch (_) {}
          try { win.setFullScreen(true); } catch (_) {}
          try { win.maximize(); } catch (_) {}
          try { win.focus(); } catch (_) {}
          try { win.moveTop(); } catch (_) {}
          try {
            const tracePath = require('path').join(STEAM_ROOT, 'pass96g-fullscreen-launch-trace.json');
            require('fs').writeFileSync(tracePath, JSON.stringify({
              ok: true,
              pass: 'steam_desktop_wrapper_pass_96g',
              status: 'fullscreen_force_attempted',
              reason,
              isFullScreen: typeof win.isFullScreen === 'function' ? win.isFullScreen() : null,
              isMaximized: typeof win.isMaximized === 'function' ? win.isMaximized() : null,
              isMinimized: typeof win.isMinimized === 'function' ? win.isMinimized() : null,
              updatedAt: new Date().toISOString()
            }, null, 2));
          } catch (_) {}
        } catch (_) {}
      }
  
      function scheduleFor(win, reason) {
        if (!win) return;
        try { win.once('ready-to-show', () => forceWindow(win, reason + ':ready-to-show')); } catch (_) {}
        try { win.webContents.once('did-finish-load', () => forceWindow(win, reason + ':did-finish-load')); } catch (_) {}
        try { win.webContents.once('dom-ready', () => forceWindow(win, reason + ':dom-ready')); } catch (_) {}
        [0, 100, 350, 800, 1500, 3000, 6000].forEach(ms => {
          try { setTimeout(() => forceWindow(win, reason + ':timeout-' + ms), ms); } catch (_) {}
        });
      }
  
      try {
        app.on('browser-window-created', function (_event, win) {
          scheduleFor(win, 'browser-window-created');
        });
      } catch (_) {}
  
      try {
        app.whenReady().then(function () {
          [0, 150, 500, 1200, 2500, 5000, 8000].forEach(ms => {
            setTimeout(function () {
              try {
                BrowserWindow.getAllWindows().forEach(function (win) {
                  forceWindow(win, 'whenReady-scan-' + ms);
                });
              } catch (_) {}
            }, ms);
          });
        });
      } catch (_) {}
    } catch (_) {}
  })();
  /* END CHIGGAS_PASS_96G_DEPOT_FULLSCREEN_GUARD */
}

module.exports = {
  installFullscreenLaunchGuard,
  installDepotFullscreenGuard
};
