const ITEM_STORE_CHANNEL = 'chiggas-steam-store:open-itemstore-external-pass-91b';

function exposeSteamItemStoreExternalBridge(contextBridge, ipcRenderer) {
  if (!contextBridge || !ipcRenderer || globalThis.__chiggasSteamItemStoreExternalBridgeInstalled) {
    return;
  }

  globalThis.__chiggasSteamItemStoreExternalBridgeInstalled = true;

  contextBridge.exposeInMainWorld('ChiggasSteamItemStoreExternal', {
    openItemStore: async (options = {}) => ipcRenderer.invoke(ITEM_STORE_CHANNEL, {
      url: typeof options.url === 'string' ? options.url : undefined,
      appId: Number(options.appId || 4788490),
      skinId: typeof options.skinId === 'string' ? options.skinId : undefined,
      itemdefid: options.itemdefid || options.itemDefId || options.steamItemDefId || undefined
    }),
    getCapabilities: () => ({
      ok: true,
      pass: 'steam_item_store_current_bridge',
      itemStoreExternalOpenAvailable: true,
      realBillingArmedChanged: false,
      localOwnershipGranted: false
    })
  });
}

module.exports = {
  exposeSteamItemStoreExternalBridge
};
