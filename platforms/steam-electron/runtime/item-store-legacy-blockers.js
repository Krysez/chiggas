function installLegacyItemStoreBlockers() {
  /* CHIGGAS_STEAM_PASS_99F_BLOCK_LEGACY_ITEMSTORE_BEGIN */
  try {
    const __chiggas99FElectron = require('electron');
    const __chiggas99FShell = __chiggas99FElectron.shell;
    const __chiggas99FBrowserWindow = __chiggas99FElectron.BrowserWindow;
    const __chiggas99FChildProcess = require('child_process');
  
    function __chiggas99FStringifyCommand(command, args) {
      try {
        const parts = [];
        if (typeof command !== 'undefined') parts.push(String(command));
        if (Array.isArray(args)) parts.push(args.map(a => String(a)).join(' '));
        else if (typeof args !== 'undefined') parts.push(String(args));
        return parts.join(' ');
      } catch (_) {
        return String(command || '');
      }
    }
  
    function __chiggas99FIsItemStoreUrl(value) {
      try {
        const raw = String(value || '');
        const decoded = decodeURIComponent(raw);
        return /itemstore\/4788490\/detail\//i.test(raw) ||
          /itemstore\/4788490\/detail\//i.test(decoded) ||
          /steam:\/\/openurl\/.*itemstore\/4788490\/detail\//i.test(raw) ||
          /steam:\/\/openurl\/.*itemstore\/4788490\/detail\//i.test(decoded);
      } catch (_) {
        return false;
      }
    }
  
    function __chiggas99FExtractItemDefId(value) {
      try {
        const raw = String(value || '');
        const decoded = decodeURIComponent(raw);
        const m = decoded.match(/\/itemstore\/4788490\/detail\/([0-9]+)/i);
        if (m && m[1]) return m[1];
        const q = decoded.match(/(?:itemdefid|itemDefId|itemid|itemId)=([0-9]+)/i);
        if (q && q[1]) return q[1];
      } catch (_) {}
      return null;
    }
  
    function __chiggas99FTrace(payload) {
      try {
        const fs = require('fs');
        const path = require('path');
        const out = path.join(process.cwd(), 'pass99f-legacy-itemstore-block-trace.json');
        fs.writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8');
      } catch (_) {}
    }
  
    function __chiggas99FRedirectToWallet(value, source) {
      const itemDefId = __chiggas99FExtractItemDefId(value);
      const payload = {
        pass: 'steam_desktop_wrapper_pass_99f',
        status: 'legacy_itemstore_blocked_redirect_to_wallet',
        source,
        value: String(value || ''),
        itemDefId,
        receivedAt: new Date().toISOString()
      };
      __chiggas99FTrace(payload);
      console.log('[Chiggas Pass 99F] Blocked legacy Steam Item Store opener:', JSON.stringify(payload));
  
      try {
        const windows = __chiggas99FBrowserWindow.getAllWindows ? __chiggas99FBrowserWindow.getAllWindows() : [];
        const target = (__chiggas99FBrowserWindow.getFocusedWindow && __chiggas99FBrowserWindow.getFocusedWindow()) || windows[0];
        if (!target || !target.webContents) {
          console.warn('[Chiggas Pass 99F] No BrowserWindow for wallet redirect');
          return false;
        }
  
        const js = `
          (function(){
            const payload = ${JSON.stringify(payload)};
            try {
              if (window.ChiggasSteamWalletPurchase && typeof window.ChiggasSteamWalletPurchase.beginPurchase === 'function') {
                window.ChiggasSteamWalletPurchase.beginPurchase({
                  itemDefId: payload.itemDefId,
                  url: payload.value,
                  description: 'Chiggas Legendary Wear ' + payload.itemDefId,
                  amountCents: 99,
                  source: payload.source
                });
                return { ok: true, status: 'wallet_begin_purchase_called', payload };
              }
              window.__chiggasPass99FPendingWalletPurchase = payload;
              window.dispatchEvent(new CustomEvent('chiggas-steam-wallet-pass99f-purchase-requested', { detail: payload }));
              return { ok: false, status: 'wallet_bridge_missing_pending_saved', payload };
            } catch (error) {
              return { ok: false, status: 'wallet_redirect_failed', error: String(error && error.message ? error.message : error), payload };
            }
          })();
        `;
  
        target.webContents.executeJavaScript(js, true).then(result => {
          console.log('[Chiggas Pass 99F] Renderer redirect result:', JSON.stringify(result));
        }).catch(error => {
          console.warn('[Chiggas Pass 99F] Renderer redirect failed:', error);
        });
        return true;
      } catch (error) {
        console.warn('[Chiggas Pass 99F] Redirect failed:', error);
        return false;
      }
    }
  
    if (__chiggas99FShell && __chiggas99FShell.openExternal && !__chiggas99FShell.__chiggas99FPatched) {
      const originalOpenExternal = __chiggas99FShell.openExternal.bind(__chiggas99FShell);
      __chiggas99FShell.openExternal = function(url, options) {
        if (__chiggas99FIsItemStoreUrl(url)) {
          __chiggas99FRedirectToWallet(url, 'shell.openExternal');
          return Promise.resolve(true);
        }
        return originalOpenExternal(url, options);
      };
      __chiggas99FShell.__chiggas99FPatched = true;
    }
  
    function __chiggas99FWrapChildProcessMethod(methodName) {
      const original = __chiggas99FChildProcess[methodName];
      if (typeof original !== 'function' || original.__chiggas99FPatched) return;
  
      const wrapped = function(command, args, options, callback) {
        const all = __chiggas99FStringifyCommand(command, args) + ' ' + __chiggas99FStringifyCommand(options, callback);
        if (__chiggas99FIsItemStoreUrl(all)) {
          __chiggas99FRedirectToWallet(all, 'child_process.' + methodName);
  
          if (methodName === 'exec' || methodName === 'execFile') {
            const cb = typeof args === 'function' ? args : (typeof options === 'function' ? options : (typeof callback === 'function' ? callback : null));
            if (cb) setTimeout(() => cb(null, 'CHIGGAS_PASS_99F_BLOCKED_ITEMSTORE_REDIRECTED_TO_WALLET', ''), 0);
            return {
              pid: 0,
              killed: false,
              kill() {},
              on() { return this; },
              once() { return this; },
              stdout: { on() {}, once() {} },
              stderr: { on() {}, once() {} }
            };
          }
  
          return {
            pid: 0,
            killed: false,
            kill() {},
            on(event, handler) { if (event === 'close' || event === 'exit') setTimeout(() => handler && handler(0), 0); return this; },
            once(event, handler) { if (event === 'close' || event === 'exit') setTimeout(() => handler && handler(0), 0); return this; },
            stdout: { on() {}, once() {} },
            stderr: { on() {}, once() {} }
          };
        }
  
        return original.apply(this, arguments);
      };
  
      wrapped.__chiggas99FPatched = true;
      __chiggas99FChildProcess[methodName] = wrapped;
    }
  
    ['exec', 'execFile', 'spawn'].forEach(__chiggas99FWrapChildProcessMethod);
  
    console.log('[Chiggas Pass 99F] Legacy Steam Item Store openers blocked: shell.openExternal + child_process exec/execFile/spawn');
  } catch (error) {
    console.warn('[Chiggas Pass 99F] Failed to install legacy item store blocker:', error);
  }
  /* CHIGGAS_STEAM_PASS_99F_BLOCK_LEGACY_ITEMSTORE_END */
  
  
  /* CHIGGAS_STEAM_PASS_99E_BLOCK_ITEMSTORE_EXTERNAL_BEGIN */
  try {
    const __chiggasPass99EElectron = require('electron');
    const __chiggasPass99EShell = __chiggasPass99EElectron.shell;
    const __chiggasPass99EBrowserWindow = __chiggasPass99EElectron.BrowserWindow;
    const __chiggasPass99EOriginalOpenExternal = __chiggasPass99EShell && __chiggasPass99EShell.openExternal
      ? __chiggasPass99EShell.openExternal.bind(__chiggasPass99EShell)
      : null;
  
    function __chiggasPass99EExtractItemDefId(url) {
      try {
        const raw = String(url || '');
        const decoded = decodeURIComponent(raw);
        const detail = decoded.match(/\/itemstore\/4788490\/detail\/([0-9]+)/i);
        if (detail && detail[1]) return detail[1];
        const query = decoded.match(/(?:itemdefid|itemDefId|itemid|itemId)=([0-9]+)/i);
        if (query && query[1]) return query[1];
      } catch (_) {}
      return null;
    }
  
    function __chiggasPass99EIsItemStoreUrl(url) {
      try {
        return /itemstore\/4788490\/detail\//i.test(String(url || '')) ||
          /steam:\/\/openurl\/.*itemstore\/4788490\/detail\//i.test(String(url || ''));
      } catch (_) {
        return false;
      }
    }
  
    function __chiggasPass99ESendWalletPurchaseToRenderer(url) {
      const itemDefId = __chiggasPass99EExtractItemDefId(url);
      const payload = {
        pass: 'steam_desktop_wrapper_pass_99e',
        source: 'main_process_shell_openExternal_intercept',
        url: String(url || ''),
        itemDefId: itemDefId,
        receivedAt: new Date().toISOString()
      };
  
      const windows = __chiggasPass99EBrowserWindow.getAllWindows ? __chiggasPass99EBrowserWindow.getAllWindows() : [];
      const target = __chiggasPass99EBrowserWindow.getFocusedWindow ? (__chiggasPass99EBrowserWindow.getFocusedWindow() || windows[0]) : windows[0];
  
      if (!target || !target.webContents) {
        console.warn('[Chiggas Pass 99E] No BrowserWindow available to redirect Steam Item Store URL:', payload);
        return false;
      }
  
      const js = `
        (function(){
          const payload = ${JSON.stringify(payload)};
          try {
            console.log('[Chiggas Pass 99E] Redirected Steam Item Store URL to Steam Wallet bridge', payload);
            if (window.ChiggasSteamWalletPurchase && typeof window.ChiggasSteamWalletPurchase.beginPurchase === 'function') {
              window.ChiggasSteamWalletPurchase.beginPurchase({
                itemDefId: payload.itemDefId,
                url: payload.url,
                description: 'Chiggas Legendary Wear ' + payload.itemDefId,
                amountCents: 99,
                source: payload.source
              });
              return { ok: true, status: 'wallet_bridge_begin_purchase_called', payload };
            }
            window.__chiggasPass99EPendingWalletPurchase = payload;
            window.dispatchEvent(new CustomEvent('chiggas-steam-wallet-pass99e-purchase-requested', { detail: payload }));
            return { ok: false, status: 'wallet_bridge_missing_pending_saved', payload };
          } catch (error) {
            return { ok: false, status: 'wallet_bridge_redirect_failed', error: String(error && error.message ? error.message : error), payload };
          }
        })();
      `;
  
      try {
        target.webContents.executeJavaScript(js, true).then(result => {
          console.log('[Chiggas Pass 99E] Renderer redirect result:', JSON.stringify(result));
        }).catch(error => {
          console.warn('[Chiggas Pass 99E] Renderer redirect failed:', error);
        });
        return true;
      } catch (error) {
        console.warn('[Chiggas Pass 99E] executeJavaScript failed:', error);
        return false;
      }
    }
  
    if (__chiggasPass99EShell && __chiggasPass99EOriginalOpenExternal) {
      __chiggasPass99EShell.openExternal = function chiggasPass99EOpenExternal(url, options) {
        if (__chiggasPass99EIsItemStoreUrl(url)) {
          console.log('[Chiggas Pass 99E] Blocked Steam Item Store page and redirecting to Steam Wallet:', String(url));
          __chiggasPass99ESendWalletPurchaseToRenderer(url);
          return Promise.resolve(true);
        }
        return __chiggasPass99EOriginalOpenExternal(url, options);
      };
      console.log('[Chiggas Pass 99E] shell.openExternal Steam Item Store redirect installed');
    }
  } catch (error) {
    console.warn('[Chiggas Pass 99E] Failed to install Steam Item Store external URL redirect:', error);
  }
  /* CHIGGAS_STEAM_PASS_99E_BLOCK_ITEMSTORE_EXTERNAL_END */
}

module.exports = {
  installLegacyItemStoreBlockers
};
