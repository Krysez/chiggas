const { ipcMain } = require('electron');
const { createSteamworksBridgeCore, PASS_VERSION: STEAM_BRIDGE_PASS_VERSION } = require('../steamworksBridgeCore');

function createSteamBridgeRuntime() {
  return createSteamworksBridgeCore();
}

function registerSteamBridgeIpc({ steamBridge, appTitle, getMainWindow }) {
  ipcMain.handle('chiggas-desktop-runtime:getInfo', () => ({
    ok: true,
    appTitle,
    runtime: 'electron',
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    steamworksIntegrated: steamBridge.getCapabilities().steamworksIntegrated,
    pass: STEAM_BRIDGE_PASS_VERSION,
    steamBridge: steamBridge.getCapabilities()
  }));

  ipcMain.handle('chiggas-desktop-runtime:setFullscreen', (_event, enabled) => {
    const mainWindow = getMainWindow ? getMainWindow() : null;
    if (!mainWindow) return { ok: false, error: 'window_unavailable' };
    mainWindow.setFullScreen(!!enabled);
    return { ok: true, fullscreen: mainWindow.isFullScreen() };
  });

  ipcMain.handle('chiggas-desktop-runtime:getFullscreen', () => {
    const mainWindow = getMainWindow ? getMainWindow() : null;
    return { ok: true, fullscreen: !!mainWindow?.isFullScreen() };
  });

  ipcMain.handle('chiggas-steam:getCapabilities', () => steamBridge.getCapabilities());
  ipcMain.handle('chiggas-steam:getStatus', () => steamBridge.getStatus());
  ipcMain.handle('chiggas-steam:getDebugReport', () => steamBridge.getDebugReport());

  ipcMain.handle('chiggas-steam-input:getCapabilities', () => steamBridge.getCapabilities());
  ipcMain.handle('chiggas-steam-input:getNativeInputStatus', () => steamBridge.getSteamInputStatus());
  ipcMain.handle('chiggas-steam-input:detectSteamInput', () => steamBridge.getSteamInputStatus());
  ipcMain.handle('chiggas-steam-input:getConnectedControllers', () => steamBridge.getConnectedControllers());
  ipcMain.handle('chiggas-steam-input:getActionState', (_event, payload) => steamBridge.getActionState(payload));
  ipcMain.handle('chiggas-steam-input:getControllerEnvironmentReport', () => steamBridge.getControllerEnvironmentReport());
  ipcMain.handle('chiggas-steam-input:setActionSet', (_event, actionSet) => steamBridge.setActionSet(actionSet));
  ipcMain.handle('chiggas-steam-input:getPromptForAction', (_event, payload) => steamBridge.getPromptForAction(payload));
  ipcMain.handle('chiggas-steam-input:getGlyphForAction', (_event, payload) => steamBridge.getGlyphForAction(payload));
  ipcMain.handle('chiggas-steam-input:showBindingPanel', () => steamBridge.showBindingPanel());
  ipcMain.handle('chiggas-steam-input:getDebugReport', () => steamBridge.getDebugReport());

  ipcMain.handle('chiggas-steam-inventory:getCapabilities', () => steamBridge.getCapabilities());
  ipcMain.handle('chiggas-steam-inventory:getInventoryStatus', async () => steamBridge.getInventoryStatus());
  ipcMain.handle('chiggas-steam-inventory:getOwnedItems', async () => steamBridge.getOwnedItems());
  ipcMain.handle('chiggas-steam-inventory:syncInventory', async (_event, payload) => steamBridge.syncInventory(payload));
  ipcMain.handle('chiggas-steam-inventory:restoreInventory', async (_event, payload) => steamBridge.restoreInventory(payload));

  ipcMain.handle('chiggas-steam-purchases:getCapabilities', () => steamBridge.getCapabilities());
  ipcMain.handle('chiggas-steam-purchases:getMonetizationReadiness', () => steamBridge.getSteamMicrotxnReadinessReport());
  ipcMain.handle('chiggas-steam-purchases:openSteamStorePage', (_event, payload) => steamBridge.openSteamStorePage(payload));
  ipcMain.handle('chiggas-steam-purchases:purchaseProduct', (_event, payload) => steamBridge.purchaseProduct(payload));
  ipcMain.handle('chiggas-steam-purchases:restorePurchases', (_event, payload) => steamBridge.restorePurchases(payload));
}

module.exports = {
  createSteamBridgeRuntime,
  registerSteamBridgeIpc
};
