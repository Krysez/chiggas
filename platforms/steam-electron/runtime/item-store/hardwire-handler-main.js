const STEAM_ROOT = require('path').resolve(__dirname, '..', '..');

function installItemStoreHardwireHandlerMain() {
  // CHIGGAS_STEAM_STORE_ITEMSTORE_HARDWIRE_HANDLER_PASS_91G_BEGIN
    try {
      const fs91g = require('fs');
      const path91g = require('path');
      const { ipcMain: ipcMain91g, shell: shell91g, app: app91g } = require('electron');
    
      const PASS91G = 'steam_store_itemstore_hardwire_handler_pass_91g';
      const CHANNEL91G = 'chiggas-steam-store:open-itemstore-external-pass-91b';
      const HTTPS_URL91G = 'https://store.steampowered.com/itemstore/4788490/browse/?filter=All';
      const STEAM_OPEN_URL91G = 'steam://openurl/' + encodeURIComponent(HTTPS_URL91G);
    
      function writePass91GTrace(payload) {
        try {
          const root = app91g && typeof app91g.getAppPath === 'function' ? app91g.getAppPath() : STEAM_ROOT;
          fs91g.writeFileSync(
            path91g.join(root, 'steam-store-itemstore-hardwire-handler-pass-91g.json'),
            JSON.stringify(Object.assign({
              pass: PASS91G,
              channel: CHANNEL91G,
              time: new Date().toISOString()
            }, payload), null, 2) + '\n',
            'utf8'
          );
        } catch (_) {}
      }
    
      if (ipcMain91g && !global.__chiggasSteamItemStoreHardwireHandlerPass91GInstalled) {
        global.__chiggasSteamItemStoreHardwireHandlerPass91GInstalled = true;
    
        try { ipcMain91g.removeHandler(CHANNEL91G); } catch (_) {}
    
        ipcMain91g.handle(CHANNEL91G, async (_event, payload = {}) => {
          const requestedUrl = typeof payload.url === 'string' && payload.url.includes('/itemstore/4788490/')
            ? payload.url
            : HTTPS_URL91G;
          const steamOpenUrl = 'steam://openurl/' + encodeURIComponent(requestedUrl);
    
          const result = {
            ok: false,
            pass: PASS91G,
            appId: Number(payload.appId || 4788490),
            url: requestedUrl,
            steamOpenUrl,
            channel: CHANNEL91G,
            method: null,
            status: 'steam_itemstore_hardwire_handler_started',
            localOwnershipGranted: false,
            realBillingArmedChanged: false,
            error: null
          };
    
          try {
            await shell91g.openExternal(steamOpenUrl);
            result.ok = true;
            result.method = 'electron.shell.openExternal(steam://openurl)';
            result.status = 'steam_itemstore_hardwire_handler_opened_steam_openurl';
          } catch (firstError) {
            result.error = firstError && firstError.message ? firstError.message : String(firstError);
            try {
              await shell91g.openExternal(requestedUrl);
              result.ok = true;
              result.method = 'electron.shell.openExternal(https)';
              result.status = 'steam_itemstore_hardwire_handler_opened_https_fallback';
            } catch (secondError) {
              result.ok = false;
              result.status = 'steam_itemstore_hardwire_handler_failed';
              result.error = {
                steamOpenUrlError: firstError && firstError.message ? firstError.message : String(firstError),
                httpsFallbackError: secondError && secondError.message ? secondError.message : String(secondError)
              };
            }
          }
    
          writePass91GTrace({ registered: true, invokeResult: result });
          return result;
        });
    
        writePass91GTrace({
          registered: true,
          status: 'handler_registered',
          url: HTTPS_URL91G,
          steamOpenUrl: STEAM_OPEN_URL91G
        });
      }
    } catch (error) {
      try {
        const fs91g = require('fs');
        const path91g = require('path');
        fs91g.writeFileSync(
          path91g.join(STEAM_ROOT, 'steam-store-itemstore-hardwire-handler-pass-91g.json'),
          JSON.stringify({
            pass: 'steam_store_itemstore_hardwire_handler_pass_91g',
            registered: false,
            status: 'handler_registration_failed',
            error: error && error.message ? error.message : String(error),
            time: new Date().toISOString()
          }, null, 2) + '\n',
          'utf8'
        );
      } catch (_) {}
      console.warn('[Chiggas] Item Store hardwire handler Pass 91G failed:', error);
    }
    // CHIGGAS_STEAM_STORE_ITEMSTORE_HARDWIRE_HANDLER_PASS_91G_END
}

module.exports = {
  installItemStoreHardwireHandlerMain
};
