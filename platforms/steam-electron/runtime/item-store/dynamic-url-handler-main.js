const STEAM_ROOT = require('path').resolve(__dirname, '..', '..');

function installItemStoreDynamicUrlHandlerMain() {
  // CHIGGAS_STEAM_STORE_ITEMSTORE_DYNAMIC_URL_HANDLER_PASS_91J_BEGIN
    try {
      const fs91j = require('fs');
      const path91j = require('path');
      const childProcess91j = require('child_process');
      const { ipcMain: ipcMain91j, shell: shell91j, app: app91j } = require('electron');
    
      const PASS91J = 'steam_store_itemstore_dynamic_url_handler_pass_91j';
      const CHANNEL91J = 'chiggas-steam-store:open-itemstore-external-pass-91b';
      const DEFAULT_URL91J = 'https://store.steampowered.com/itemstore/4788490/browse/?filter=All';
    
      function getTraceRoot91J() {
        try {
          return app91j && typeof app91j.getAppPath === 'function' ? app91j.getAppPath() : STEAM_ROOT;
        } catch (_) {
          return STEAM_ROOT;
        }
      }
    
      function writeTrace91J(payload) {
        try {
          fs91j.writeFileSync(
            path91j.join(getTraceRoot91J(), 'steam-store-itemstore-dynamic-url-handler-pass-91j.json'),
            JSON.stringify(Object.assign({
              pass: PASS91J,
              channel: CHANNEL91J,
              time: new Date().toISOString()
            }, payload), null, 2) + '\n',
            'utf8'
          );
        } catch (_) {}
      }
    
      function normalizeStoreUrl91J(url) {
        if (typeof url !== 'string') return DEFAULT_URL91J;
        const clean = url.trim();
        if (/^https:\/\/store\.steampowered\.com\/itemstore\/4788490\/(browse\/\?filter=All|detail\/[0-9]+\/)$/i.test(clean)) {
          return clean;
        }
        return DEFAULT_URL91J;
      }
    
      function steamExeCandidates91J() {
        const candidates = [];
        if (process.env.STEAM_EXE_PATH) candidates.push(process.env.STEAM_EXE_PATH);
        if (process.env['ProgramFiles(x86)']) candidates.push(path91j.join(process.env['ProgramFiles(x86)'], 'Steam', 'steam.exe'));
        if (process.env.ProgramFiles) candidates.push(path91j.join(process.env.ProgramFiles, 'Steam', 'steam.exe'));
        candidates.push('C:\\Program Files (x86)\\Steam\\steam.exe');
        candidates.push('C:\\Program Files\\Steam\\steam.exe');
        return Array.from(new Set(candidates)).filter(Boolean);
      }
    
      function spawnOpen91J(command, args) {
        return new Promise((resolve) => {
          try {
            const child = childProcess91j.spawn(command, args, { detached: true, windowsHide: false, stdio: 'ignore' });
            child.on('error', (error) => resolve({ ok: false, command, args, error: error.message || String(error) }));
            child.unref();
            resolve({ ok: true, command, args });
          } catch (error) {
            resolve({ ok: false, command, args, error: error.message || String(error) });
          }
        });
      }
    
      async function openUrlChain91J(url) {
        const attempts = [];
        const rawSteamOpenUrl = 'steam://openurl/' + url;
        const encodedSteamOpenUrl = 'steam://openurl/' + encodeURIComponent(url);
    
        for (const steamExe of steamExeCandidates91J()) {
          if (!fs91j.existsSync(steamExe)) {
            attempts.push({ ok: false, method: 'steam.exe candidate missing', steamExe });
            continue;
          }
    
          const raw = await spawnOpen91J(steamExe, [rawSteamOpenUrl]);
          attempts.push(Object.assign({ method: 'steam.exe raw dynamic steam://openurl' }, raw));
          if (raw.ok) return { ok: true, method: 'steam.exe raw dynamic steam://openurl', rawSteamOpenUrl, encodedSteamOpenUrl, attempts };
    
          const encoded = await spawnOpen91J(steamExe, [encodedSteamOpenUrl]);
          attempts.push(Object.assign({ method: 'steam.exe encoded dynamic steam://openurl' }, encoded));
          if (encoded.ok) return { ok: true, method: 'steam.exe encoded dynamic steam://openurl', rawSteamOpenUrl, encodedSteamOpenUrl, attempts };
        }
    
        try {
          await shell91j.openExternal(rawSteamOpenUrl);
          attempts.push({ ok: true, method: 'shell.openExternal raw dynamic steam://openurl' });
          return { ok: true, method: 'shell.openExternal raw dynamic steam://openurl', rawSteamOpenUrl, encodedSteamOpenUrl, attempts };
        } catch (error) {
          attempts.push({ ok: false, method: 'shell.openExternal raw dynamic steam://openurl', error: error.message || String(error) });
        }
    
        try {
          await shell91j.openExternal(url);
          attempts.push({ ok: true, method: 'shell.openExternal dynamic https' });
          return { ok: true, method: 'shell.openExternal dynamic https', rawSteamOpenUrl, encodedSteamOpenUrl, attempts };
        } catch (error) {
          attempts.push({ ok: false, method: 'shell.openExternal dynamic https', error: error.message || String(error) });
        }
    
        const cmd = await spawnOpen91J('cmd.exe', ['/c', 'start', '', url]);
        attempts.push(Object.assign({ method: 'cmd start dynamic https' }, cmd));
        if (cmd.ok) return { ok: true, method: 'cmd start dynamic https', rawSteamOpenUrl, encodedSteamOpenUrl, attempts };
    
        return { ok: false, method: null, rawSteamOpenUrl, encodedSteamOpenUrl, attempts };
      }
    
      if (ipcMain91j && !global.__chiggasSteamItemStoreDynamicUrlHandlerPass91JInstalled) {
        global.__chiggasSteamItemStoreDynamicUrlHandlerPass91JInstalled = true;
    
        try { ipcMain91j.removeHandler(CHANNEL91J); } catch (_) {}
    
        ipcMain91j.handle(CHANNEL91J, async (_event, payload = {}) => {
          const requestedUrl = normalizeStoreUrl91J(payload.url);
          const openResult = await openUrlChain91J(requestedUrl);
    
          const result = {
            ok: !!openResult.ok,
            pass: PASS91J,
            appId: Number(payload.appId || 4788490),
            url: requestedUrl,
            rawSteamOpenUrl: openResult.rawSteamOpenUrl,
            encodedSteamOpenUrl: openResult.encodedSteamOpenUrl,
            requestedPayloadUrl: payload.url || null,
            channel: CHANNEL91J,
            method: openResult.method,
            attempts: openResult.attempts,
            status: openResult.ok ? 'steam_itemstore_dynamic_url_open_attempted' : 'steam_itemstore_dynamic_url_open_failed',
            localOwnershipGranted: false,
            realBillingArmedChanged: false,
            error: openResult.ok ? null : 'all_open_methods_failed'
          };
    
          writeTrace91J({ registered: true, invokeResult: result });
          return result;
        });
    
        writeTrace91J({
          registered: true,
          status: 'handler_registered',
          defaultUrl: DEFAULT_URL91J,
          supportsDetailUrls: true,
          supportsBrowseAllUrl: true,
          steamExeCandidates: steamExeCandidates91J()
        });
      }
    } catch (error) {
      try {
        const fs91j = require('fs');
        const path91j = require('path');
        fs91j.writeFileSync(
          path91j.join(STEAM_ROOT, 'steam-store-itemstore-dynamic-url-handler-pass-91j.json'),
          JSON.stringify({
            pass: 'steam_store_itemstore_dynamic_url_handler_pass_91j',
            registered: false,
            status: 'handler_registration_failed',
            error: error && error.message ? error.message : String(error),
            time: new Date().toISOString()
          }, null, 2) + '\n',
          'utf8'
        );
      } catch (_) {}
      console.warn('[Chiggas] Item Store dynamic URL handler Pass 91J failed:', error);
    }
    // CHIGGAS_STEAM_STORE_ITEMSTORE_DYNAMIC_URL_HANDLER_PASS_91J_END
}

module.exports = {
  installItemStoreDynamicUrlHandlerMain
};
