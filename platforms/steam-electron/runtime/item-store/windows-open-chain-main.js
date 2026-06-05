const STEAM_ROOT = require('path').resolve(__dirname, '..', '..');

function installItemStoreWindowsOpenChainMain() {
  // CHIGGAS_STEAM_STORE_ITEMSTORE_WINDOWS_OPEN_CHAIN_PASS_91H_BEGIN
    try {
      const fs91h = require('fs');
      const path91h = require('path');
      const childProcess91h = require('child_process');
      const { ipcMain: ipcMain91h, shell: shell91h, app: app91h } = require('electron');
    
      const PASS91H = 'steam_store_itemstore_windows_open_chain_pass_91h';
      const CHANNEL91H = 'chiggas-steam-store:open-itemstore-external-pass-91b';
      const HTTPS_URL91H = 'https://store.steampowered.com/itemstore/4788490/browse/?filter=All';
      const RAW_STEAM_OPENURL91H = 'steam://openurl/' + HTTPS_URL91H;
      const ENCODED_STEAM_OPENURL91H = 'steam://openurl/' + encodeURIComponent(HTTPS_URL91H);
    
      function getTraceRoot91H() {
        try {
          return app91h && typeof app91h.getAppPath === 'function' ? app91h.getAppPath() : STEAM_ROOT;
        } catch (_) {
          return STEAM_ROOT;
        }
      }
    
      function writeTrace91H(payload) {
        try {
          fs91h.writeFileSync(
            path91h.join(getTraceRoot91H(), 'steam-store-itemstore-windows-open-chain-pass-91h.json'),
            JSON.stringify(Object.assign({
              pass: PASS91H,
              channel: CHANNEL91H,
              time: new Date().toISOString()
            }, payload), null, 2) + '\n',
            'utf8'
          );
        } catch (_) {}
      }
    
      function steamExeCandidates91H() {
        const candidates = [];
        if (process.env.STEAM_EXE_PATH) candidates.push(process.env.STEAM_EXE_PATH);
        if (process.env['ProgramFiles(x86)']) candidates.push(path91h.join(process.env['ProgramFiles(x86)'], 'Steam', 'steam.exe'));
        if (process.env.ProgramFiles) candidates.push(path91h.join(process.env.ProgramFiles, 'Steam', 'steam.exe'));
        candidates.push('C:\\Program Files (x86)\\Steam\\steam.exe');
        candidates.push('C:\\Program Files\\Steam\\steam.exe');
        return Array.from(new Set(candidates)).filter(Boolean);
      }
    
      function runExecFile91H(command, args) {
        return new Promise((resolve) => {
          try {
            const child = childProcess91h.spawn(command, args, {
              detached: true,
              windowsHide: false,
              stdio: 'ignore'
            });
            child.on('error', (error) => resolve({ ok: false, command, args, error: error.message || String(error) }));
            child.unref();
            resolve({ ok: true, command, args });
          } catch (error) {
            resolve({ ok: false, command, args, error: error.message || String(error) });
          }
        });
      }
    
      async function tryOpen91H(url) {
        const attempts = [];
    
        const steamExeList = steamExeCandidates91H();
        for (const steamExe of steamExeList) {
          if (!fs91h.existsSync(steamExe)) {
            attempts.push({ ok: false, method: 'steam.exe candidate missing', steamExe });
            continue;
          }
    
          const rawResult = await runExecFile91H(steamExe, [RAW_STEAM_OPENURL91H]);
          attempts.push(Object.assign({ method: 'steam.exe raw steam://openurl' }, rawResult));
          if (rawResult.ok) return { ok: true, method: 'steam.exe raw steam://openurl', attempts };
    
          const encodedResult = await runExecFile91H(steamExe, [ENCODED_STEAM_OPENURL91H]);
          attempts.push(Object.assign({ method: 'steam.exe encoded steam://openurl' }, encodedResult));
          if (encodedResult.ok) return { ok: true, method: 'steam.exe encoded steam://openurl', attempts };
        }
    
        try {
          await shell91h.openExternal(RAW_STEAM_OPENURL91H);
          attempts.push({ ok: true, method: 'shell.openExternal raw steam://openurl' });
          return { ok: true, method: 'shell.openExternal raw steam://openurl', attempts };
        } catch (error) {
          attempts.push({ ok: false, method: 'shell.openExternal raw steam://openurl', error: error.message || String(error) });
        }
    
        try {
          await shell91h.openExternal(url);
          attempts.push({ ok: true, method: 'shell.openExternal https' });
          return { ok: true, method: 'shell.openExternal https', attempts };
        } catch (error) {
          attempts.push({ ok: false, method: 'shell.openExternal https', error: error.message || String(error) });
        }
    
        const cmdResult = await runExecFile91H('cmd.exe', ['/c', 'start', '', url]);
        attempts.push(Object.assign({ method: 'cmd start https' }, cmdResult));
        if (cmdResult.ok) return { ok: true, method: 'cmd start https', attempts };
    
        return { ok: false, method: null, attempts };
      }
    
      if (ipcMain91h && !global.__chiggasSteamItemStoreWindowsOpenChainPass91HInstalled) {
        global.__chiggasSteamItemStoreWindowsOpenChainPass91HInstalled = true;
    
        try { ipcMain91h.removeHandler(CHANNEL91H); } catch (_) {}
    
        ipcMain91h.handle(CHANNEL91H, async (_event, payload = {}) => {
          const requestedUrl = typeof payload.url === 'string' && payload.url.includes('/itemstore/4788490/')
            ? payload.url
            : HTTPS_URL91H;
    
          const openResult = await tryOpen91H(requestedUrl);
    
          const result = {
            ok: !!openResult.ok,
            pass: PASS91H,
            appId: Number(payload.appId || 4788490),
            url: requestedUrl,
            rawSteamOpenUrl: RAW_STEAM_OPENURL91H,
            encodedSteamOpenUrl: ENCODED_STEAM_OPENURL91H,
            channel: CHANNEL91H,
            method: openResult.method,
            attempts: openResult.attempts,
            status: openResult.ok ? 'steam_itemstore_windows_open_chain_attempted' : 'steam_itemstore_windows_open_chain_failed',
            localOwnershipGranted: false,
            realBillingArmedChanged: false,
            error: openResult.ok ? null : 'all_open_methods_failed'
          };
    
          writeTrace91H({ registered: true, invokeResult: result });
          return result;
        });
    
        writeTrace91H({
          registered: true,
          status: 'handler_registered',
          url: HTTPS_URL91H,
          rawSteamOpenUrl: RAW_STEAM_OPENURL91H,
          encodedSteamOpenUrl: ENCODED_STEAM_OPENURL91H,
          steamExeCandidates: steamExeCandidates91H()
        });
      }
    } catch (error) {
      try {
        const fs91h = require('fs');
        const path91h = require('path');
        fs91h.writeFileSync(
          path91h.join(STEAM_ROOT, 'steam-store-itemstore-windows-open-chain-pass-91h.json'),
          JSON.stringify({
            pass: 'steam_store_itemstore_windows_open_chain_pass_91h',
            registered: false,
            status: 'handler_registration_failed',
            error: error && error.message ? error.message : String(error),
            time: new Date().toISOString()
          }, null, 2) + '\n',
          'utf8'
        );
      } catch (_) {}
      console.warn('[Chiggas] Item Store Windows open chain Pass 91H failed:', error);
    }
    // CHIGGAS_STEAM_STORE_ITEMSTORE_WINDOWS_OPEN_CHAIN_PASS_91H_END
}

module.exports = {
  installItemStoreWindowsOpenChainMain
};
