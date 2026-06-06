const { createSteamInputPreloadRuntime } = require('./steam-input-preload');

function exposeSteamBridgePreload(contextBridge, ipcRenderer) {
  const WRAPPER_VERSION = 'steam_desktop_wrapper_pass_12';
  
  const { steamInputBridge, controllerDebugBridge, startNativeActionPolling } = createSteamInputPreloadRuntime(ipcRenderer, WRAPPER_VERSION);
  
  const steamBase = {
    version: WRAPPER_VERSION,
    isSteamDesktopWrapper: true,
    steamworksIntegrated: false,
    getCapabilities: () => ipcRenderer.invoke('chiggas-steam:getCapabilities'),
    getStatus: () => ipcRenderer.invoke('chiggas-steam:getStatus'),
    getDebugReport: () => ipcRenderer.invoke('chiggas-steam:getDebugReport')
  };
  
  const steamInventoryBridge = {
    version: WRAPPER_VERSION,
    isSteamDesktopWrapper: true,
    steamworksIntegrated: false,
    steamInventoryIntegrated: false,
    getCapabilities: () => ipcRenderer.invoke('chiggas-steam-inventory:getCapabilities'),
    getInventoryStatus: () => ipcRenderer.invoke('chiggas-steam-inventory:getInventoryStatus'),
    getStatus: () => ipcRenderer.invoke('chiggas-steam-inventory:getInventoryStatus'),
    getOwnedItems: () => ipcRenderer.invoke('chiggas-steam-inventory:getOwnedItems'),
    syncInventory: () => ipcRenderer.invoke('chiggas-steam-inventory:syncInventory'),
    restoreInventory: () => ipcRenderer.invoke('chiggas-steam-inventory:restoreInventory')
  };
  
  const steamBackendBridge = {
    version: WRAPPER_VERSION,
    isSteamDesktopWrapper: true,
    backendInventoryBridgeAvailable: true,
    purchasesEnabled: false,
    realBillingArmed: false,
    getCapabilities: () => Promise.resolve({
      ok: true,
      pass: 'steam_inventory_current_bridge_alias',
      backendInventoryBridgeAvailable: true,
      source: 'ChiggasSteamInventory'
    }),
    getOwnedInventory: (options = {}) => ipcRenderer.invoke('chiggas-steam-inventory:getOwnedItems', {
      appId: Number(options.appId || 4788490),
      skinId: typeof options.skinId === 'string' ? options.skinId : undefined,
      itemdefid: options.itemdefid || options.itemDefId || options.steamItemDefId || undefined
    })
  };
  
  const steamPurchaseBridge = {
    version: WRAPPER_VERSION,
    isSteamDesktopWrapper: true,
    steamworksIntegrated: false,
    steamPurchasesIntegrated: false,
    realBillingArmed: false,
    getCapabilities: () => ipcRenderer.invoke('chiggas-steam-purchases:getCapabilities'),
    getMonetizationReadiness: () => ipcRenderer.invoke('chiggas-steam-purchases:getMonetizationReadiness'),
    getSteamMicrotxnReadinessReport: () => ipcRenderer.invoke('chiggas-steam-purchases:getMonetizationReadiness'),
    openSteamStorePage: (payload) => ipcRenderer.invoke('chiggas-steam-purchases:openSteamStorePage', payload),
    purchaseLegendarySkin: (payload) => ipcRenderer.invoke('chiggas-steam-purchases:purchaseProduct', payload),
    purchaseProduct: (payload) => ipcRenderer.invoke('chiggas-steam-purchases:purchaseProduct', payload),
    buyProduct: (payload) => ipcRenderer.invoke('chiggas-steam-purchases:purchaseProduct', payload),
    purchase: (payload) => ipcRenderer.invoke('chiggas-steam-purchases:purchaseProduct', payload),
    restorePurchases: (payload) => ipcRenderer.invoke('chiggas-steam-purchases:restorePurchases', payload),
    restoreProducts: (payload) => ipcRenderer.invoke('chiggas-steam-purchases:restorePurchases', payload),
    syncInventory: () => ipcRenderer.invoke('chiggas-steam-inventory:syncInventory'),
    restore: (payload) => ipcRenderer.invoke('chiggas-steam-purchases:restorePurchases', payload)
  };
  
  startNativeActionPolling(33);
  
  contextBridge.exposeInMainWorld('ChiggasDesktopRuntime', {
    version: WRAPPER_VERSION,
    isElectron: true,
    getInfo: () => ipcRenderer.invoke('chiggas-desktop-runtime:getInfo'),
    setFullscreen: (enabled) => ipcRenderer.invoke('chiggas-desktop-runtime:setFullscreen', !!enabled),
    getFullscreen: () => ipcRenderer.invoke('chiggas-desktop-runtime:getFullscreen'),
    quitApp: (payload = {}) => ipcRenderer.invoke('chiggas-desktop-runtime:quitApp', payload),
    exitApp: (payload = {}) => ipcRenderer.invoke('chiggas-desktop-runtime:quitApp', payload)
  });
  
  contextBridge.exposeInMainWorld('ChiggasSteamWrapperStatus', {
    version: WRAPPER_VERSION,
    steamworksIntegrated: 'query window.ChiggasSteam.getCapabilities()',
    steamInputIntegrated: false,
    steamInventoryIntegrated: false,
    steamPurchasesIntegrated: false,
    note: 'Pass 6E can detect steamworks.js core, Steam Input API availability, browser Gamepad API fallback, and Steam launch/controller environment. Inventory and Purchases remain locked.'
  });
  
  contextBridge.exposeInMainWorld('ChiggasSteam', steamBase);
  contextBridge.exposeInMainWorld('ChiggasSteamInput', steamInputBridge);
  contextBridge.exposeInMainWorld('ChiggasNativeSteamInput', steamInputBridge);
  contextBridge.exposeInMainWorld('ChiggasSteamInventory', steamInventoryBridge);
  contextBridge.exposeInMainWorld('ChiggasSteamBackend', steamBackendBridge);
  contextBridge.exposeInMainWorld('ChiggasSteamPurchases', steamPurchaseBridge);
  contextBridge.exposeInMainWorld('SteamBilling', steamPurchaseBridge);
  contextBridge.exposeInMainWorld('ChiggasControllerDebug', controllerDebugBridge);
}

module.exports = {
  exposeSteamBridgePreload
};
