function getElectron() {
  try {
    return require('electron');
  } catch (_error) {
    return null;
  }
}

function stabilizeWindow(win, reason) {
  if (!win || win.isDestroyed?.()) return;

  try { win.setMenuBarVisibility(false); } catch (_error) {}
  try { win.setAutoHideMenuBar(true); } catch (_error) {}

  if (process.env.CHIGGAS_DEVTOOLS === '1' || process.env.NODE_ENV === 'development') {
    return;
  }

  try {
    if (!win.isFullScreen()) win.setFullScreen(true);
  } catch (_error) {}
}

function installStableFullscreenGuard() {
  const electron = getElectron();
  const app = electron?.app;
  const BrowserWindow = electron?.BrowserWindow;

  if (!app || !BrowserWindow || global.__CHIGGAS_STABLE_FULLSCREEN_GUARD) return;
  global.__CHIGGAS_STABLE_FULLSCREEN_GUARD = true;

  app.on('browser-window-created', (_event, win) => {
    stabilizeWindow(win, 'created');
    try { win.once('ready-to-show', () => stabilizeWindow(win, 'ready-to-show')); } catch (_error) {}
  });

  app.whenReady().then(() => {
    for (const win of BrowserWindow.getAllWindows()) {
      stabilizeWindow(win, 'when-ready');
    }
  }).catch(() => {});
}

module.exports = {
  installFullscreenLaunchGuard: installStableFullscreenGuard,
  installDepotFullscreenGuard: installStableFullscreenGuard
};
