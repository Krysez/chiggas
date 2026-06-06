
// CHIGGAS_STEAM_LEGACY_ITEM_STORE_BLOCKERS_RUNTIME_BEGIN
try {
  require('./runtime/item-store-legacy-blockers').installLegacyItemStoreBlockers();
} catch (error) {
  console.warn('[Chiggas] Steam legacy item-store blockers failed to install:', error);
}
// CHIGGAS_STEAM_LEGACY_ITEM_STORE_BLOCKERS_RUNTIME_END


// CHIGGAS_STEAM_CLOUD_SAVE_RUNTIME_BEGIN
try {
  require('./runtime/cloud-save-main').installRobustCloudSaveHooks(require('electron').app);
} catch (error) {
  console.warn('[Chiggas] Steam Cloud save runtime failed to install:', error);
}
// CHIGGAS_STEAM_CLOUD_SAVE_RUNTIME_END



// CHIGGAS_STEAM_FULLSCREEN_MAIN_RUNTIME_BEGIN
try {
  require('./runtime/fullscreen-main').installFullscreenLaunchGuard();
} catch (error) {
  console.warn('[Chiggas] Steam fullscreen launch runtime failed to install:', error);
}
// CHIGGAS_STEAM_FULLSCREEN_MAIN_RUNTIME_END



// CHIGGAS_STEAM_ACHIEVEMENTS_MAIN_RUNTIME_EARLY_BEGIN
try {
  require('./runtime/achievements-main').installAchievementBridgeAndLaunchHook();
} catch (error) {
  console.warn('[Chiggas] Steam achievements early runtime failed to install:', error);
}
// CHIGGAS_STEAM_ACHIEVEMENTS_MAIN_RUNTIME_EARLY_END

const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { createSteamBridgeRuntime, registerSteamBridgeIpc } = require('./runtime/steam-bridge-main');

const APP_TITLE = 'Chiggas - Survival of the Mitiest';
const GAME_INDEX = path.join(__dirname, 'game', 'index.html');
const IS_DEV = process.env.CHIGGAS_DEVTOOLS === '1' || process.env.NODE_ENV === 'development';
const BASE_STEAM_APP_ID = '4788490';
const LAUNCHED_STEAM_APP_ID = process.env.SteamAppId || process.env.SteamGameId || process.env.STEAM_APP_ID || '';
const DEMO_MARKER_FILE = 'chiggas-demo-mode.flag';

function hasDemoModeMarker() {
  const dirs = [
    path.dirname(process.execPath || ''),
    process.resourcesPath || '',
    __dirname
  ].filter(Boolean);

  try {
    return dirs.some((dir) => fs.existsSync(path.join(dir, DEMO_MARKER_FILE)));
  } catch (_error) {
    return false;
  }
}

const IS_DEMO = process.env.CHIGGAS_DEMO_MODE === '1' ||
  process.env.STEAM_DEMO === '1' ||
  hasDemoModeMarker() ||
  (!!LAUNCHED_STEAM_APP_ID && String(LAUNCHED_STEAM_APP_ID) !== BASE_STEAM_APP_ID);

try {
  app.disableHardwareAcceleration();
} catch (error) {
  console.warn('[Chiggas] Steam launch GPU guard failed to disable hardware acceleration:', error);
}

let mainWindow = null;
const steamBridge = createSteamBridgeRuntime();

function getLaunchLogPath() {
  try {
    return path.join(app.getPath('userData'), 'chiggas-steam-launch.log');
  } catch (_error) {
    return path.join(__dirname, 'chiggas-steam-launch.log');
  }
}

function appendLaunchLog(event, payload = {}) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    event,
    payload
  }) + '\n';

  try {
    fs.mkdirSync(path.dirname(getLaunchLogPath()), { recursive: true });
    fs.appendFileSync(getLaunchLogPath(), line, 'utf8');
  } catch (_error) {}
}

function installRendererDiagnostics(win) {
  if (!win || !win.webContents) return;

  appendLaunchLog('window_created', {
    gameIndex: GAME_INDEX,
    gameIndexExists: fs.existsSync(GAME_INDEX),
    dirname: __dirname,
    resourcesPath: process.resourcesPath || null,
    cwd: process.cwd(),
    steamEnv: {
      SteamAppId: process.env.SteamAppId || null,
      SteamGameId: process.env.SteamGameId || null,
      SteamOverlayGameId: process.env.SteamOverlayGameId || null,
      SteamClientLaunch: process.env.SteamClientLaunch || null
    },
    demoMode: IS_DEMO
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    appendLaunchLog('did_fail_load', { errorCode, errorDescription, validatedURL });
  });

  win.webContents.on('did-finish-load', () => {
    appendLaunchLog('did_finish_load', { url: win.webContents.getURL() });
  });

  win.webContents.on('dom-ready', () => {
    appendLaunchLog('dom_ready', { url: win.webContents.getURL() });
  });

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    appendLaunchLog('renderer_console', { level, message, line, sourceId });
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    appendLaunchLog('render_process_gone', details || {});
  });
}

function loadDiagnosticPage(win, title, message) {
  if (!win || win.isDestroyed?.()) return;
  const html = [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<title>${APP_TITLE}</title>`,
    '<style>html,body{margin:0;height:100%;background:#111;color:#ffd800;font-family:Arial,sans-serif;}',
    'body{display:flex;align-items:center;justify-content:center;text-align:center;padding:32px;box-sizing:border-box;}',
    '.box{max-width:760px}.msg{color:#fff;font-size:18px;line-height:1.45}</style></head><body>',
    '<div class="box">',
    `<h1>${title}</h1>`,
    `<div class="msg">${message}</div>`,
    `<p class="msg">Log: ${getLaunchLogPath()}</p>`,
    '</div></body></html>'
  ].join('');
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch(() => {});
}

function createMainWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    title: APP_TITLE,
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#000000',
    show: false,
    fullscreen: !IS_DEV,
    fullscreenable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      backgroundThrottling: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) return;
    if (!IS_DEV && !mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(true);
    }
    mainWindow.show();
    if (IS_DEV) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  installRendererDiagnostics(mainWindow);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url && !url.startsWith('file://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    if (input.key === 'F11') {
      event.preventDefault();
      const nextFullscreen = !mainWindow.isFullScreen();
      mainWindow.setFullScreen(nextFullscreen);
      return;
    }

    if (input.key === 'F12') {
      event.preventDefault();
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });

  if (!fs.existsSync(GAME_INDEX)) {
    appendLaunchLog('game_index_missing', { gameIndex: GAME_INDEX });
    loadDiagnosticPage(mainWindow, 'Game files missing', 'Steam did not install the game HTML payload. Re-upload the depot with recursive file mapping enabled.');
    return;
  }

  const loadOptions = IS_DEMO ? { query: { demo: '1' } } : undefined;
  mainWindow.loadFile(GAME_INDEX, loadOptions).catch((error) => {
    appendLaunchLog('load_file_rejected', { error: error?.message || String(error), gameIndex: GAME_INDEX });
    loadDiagnosticPage(mainWindow, 'Game failed to load', error?.message || String(error));
  });
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');

app.whenReady().then(() => {
try {
  require('./runtime/cloud-save-main').exportCloudSave('launch', app, { source: 'main_process_launch_hook' });
} catch (error) { console.warn('[Chiggas Pass 98A] Steam Cloud save export failed:', error); }

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// CHIGGAS_STEAM_BRIDGE_MAIN_IPC_RUNTIME_BEGIN
registerSteamBridgeIpc({
  steamBridge,
  appTitle: APP_TITLE,
  getMainWindow: () => mainWindow
});
// CHIGGAS_STEAM_BRIDGE_MAIN_IPC_RUNTIME_END

ipcMain.handle('chiggas-desktop-runtime:quitApp', async (_event, payload = {}) => {
  try {
    require('./runtime/cloud-save-main').exportCloudSave('renderer_exit_request', app, {
      source: 'renderer_quit_app_ipc',
      reason: payload?.reason || 'title_exit_button'
    });
  } catch (error) {
    console.warn('[Chiggas] Cloud save export on renderer quit request failed:', error);
  }

  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  } catch (error) {
    console.warn('[Chiggas] Main window close on renderer quit request failed:', error);
  }

  const forceExitTimer = setTimeout(() => {
    try {
      app.exit(0);
    } catch (error) {
      console.warn('[Chiggas] Forced desktop exit failed:', error);
    }
  }, 300);
  if (typeof forceExitTimer.unref === 'function') forceExitTimer.unref();

  app.quit();
  return { ok: true, status: 'desktop_quit_requested' };
});
// CHIGGAS_STEAM_ACHIEVEMENTS_MAIN_RUNTIME_TRACES_BEGIN
try {
  require('./runtime/achievements-main').installAchievementTraceHandlers();
} catch (error) {
  console.warn('[Chiggas] Steam achievements trace runtime failed to install:', error);
}
// CHIGGAS_STEAM_ACHIEVEMENTS_MAIN_RUNTIME_TRACES_END


// CHIGGAS_STEAM_ITEM_STORE_RUNTIME_BEGIN
try {
  require('./runtime/item-store-main').installSteamItemStoreHandlers();
} catch (error) {
  console.warn('[Chiggas] Steam item store runtime failed to install:', error);
}
// CHIGGAS_STEAM_ITEM_STORE_RUNTIME_END


// CHIGGAS_STEAM_LEADERBOARDS_MAIN_RUNTIME_BEGIN
try {
  require('./runtime/leaderboards-main').installLeaderboardMainRuntime();
} catch (error) {
  console.warn('[Chiggas] Steam leaderboards main runtime failed to install:', error);
}
// CHIGGAS_STEAM_LEADERBOARDS_MAIN_RUNTIME_END


// CHIGGAS_STEAM_DEPOT_FULLSCREEN_MAIN_RUNTIME_BEGIN
try {
  require('./runtime/fullscreen-main').installDepotFullscreenGuard();
} catch (error) {
  console.warn('[Chiggas] Steam depot fullscreen runtime failed to install:', error);
}
// CHIGGAS_STEAM_DEPOT_FULLSCREEN_MAIN_RUNTIME_END

app.on('before-quit', () => {
try {
  require('./runtime/cloud-save-main').exportCloudSave('before_quit', app, { source: 'main_process_before_quit_hook' });
} catch (error) { console.warn('[Chiggas Pass 98A] Steam Cloud save export before quit failed:', error); }
});
