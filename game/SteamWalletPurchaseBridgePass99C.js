/* CHIGGAS_STEAM_PASS_99C_WALLET_STORE_BRIDGE_BEGIN */
(function () {
  if (window.__chiggasSteamPass99CWalletStoreBridgeInstalled) return;
  window.__chiggasSteamPass99CWalletStoreBridgeInstalled = true;

  const PASS = 'steam_desktop_wrapper_pass_99c';
  const BACKEND = 'https://chiggas-steam-entitlement-backend-production.up.railway.app'; // CHIGGAS_STEAM_PASS_99D_PRODUCTION_BACKEND_URL
  const APP_ID = 4788490;
  const DEFAULT_AMOUNT_CENTS = 99;


/* CHIGGAS_STEAM_PASS_99G_CANCEL_AND_ITEM_NAME_FIX */
const CHIGGAS_STEAM_PASS_99G_ITEM_NAME_CATALOG = {
  "1000": "Manual Test Legendary Wear",
  "1001": "chigga_wear",
  "1002": "chigga_wear",
  "1003": "chigga_wear",
  "1004": "chigga_wear",
  "1005": "chigga_wear",
  "1006": "chigga_wear",
  "1007": "chigga_wear",
  "1008": "chigga_wear",
  "1009": "chigga_wear",
  "1010": "Chigga Vamp",
  "1011": "chigga_wear",
  "1012": "chigga_wear",
  "1013": "chigga_wear",
  "1014": "chigga_wear",
  "2001": "chigga_wear",
  "2002": "chigga_wear",
  "2003": "chigga_wear",
  "2004": "chigga_wear",
  "2005": "chigga_wear",
  "2006": "chigga_wear",
  "2007": "chigga_wear",
  "2008": "chigga_wear",
  "2009": "chigga_wear",
  "2010": "chigga_wear",
  "2011": "chigga_wear",
  "2012": "chigga_wear",
  "2013": "chigga_wear",
  "2014": "chigga_wear",
  "2015": "chigga_wear"
};


/* CHIGGAS_STEAM_PASS_99G1_STABILITY_FIX */
const CHIGGAS_STEAM_PASS_99G1_ITEM_NAME_OVERRIDES = {
  "1004": "Chigga Wear - Purple Velour Vandal"
};

function chiggasPass99G1CleanNameCandidate(value) {
  try {
    const name = String(value || "").trim();
    if (!name) return null;
    if (/^chigga\s+wear\s*$/i.test(name)) return null;
    if (/^Chiggas?\s+Legendary\s+Wear\s+\d+$/i.test(name)) return null;
    if (/^itemdef/i.test(name)) return null;
    return name.slice(0, 128);
  } catch (_) {
    return null;
  }
}

function chiggasPass99GResolveItemName(itemDefId, input) {
  try {
    const id = String(itemDefId || input?.itemDefId || input?.itemid || '').trim();

    const override = chiggasPass99G1CleanNameCandidate(CHIGGAS_STEAM_PASS_99G1_ITEM_NAME_OVERRIDES[id]);
    if (override) return override;

    const inputDescription = chiggasPass99G1CleanNameCandidate(input?.description);
    if (inputDescription) return inputDescription;

    const mapped = chiggasPass99G1CleanNameCandidate(CHIGGAS_STEAM_PASS_99G_ITEM_NAME_CATALOG[id]);
    if (mapped) return mapped;

    return ('Chiggas Legendary Wear ' + id).slice(0, 128);
  } catch (_) {
    return 'Chiggas Legendary Wear';
  }
}

function chiggasPass99GForceClearPending(reason) {
  try {
    state.pending = false;
    setTrace({
      pending: false,
      pass99GLastPendingClearReason: reason || 'unknown',
      pass99GLastPendingClearAt: new Date().toISOString()
    });
    return { ok: true, reason };
  } catch (error) {
    return { ok: false, reason, error: String(error && error.message ? error.message : error) };
  }
}


  const state = {
    pass: PASS,
    installedAt: new Date().toISOString(),
    lastInit: null,
    lastQuery: null,
    lastFinalize: null,
    lastError: null,
    pending: false
  };

  function log(...args) {
    try { console.log('[Chiggas Pass 99C]', ...args); } catch (_) {}
  }

  function warn(...args) {
    try { console.warn('[Chiggas Pass 99C]', ...args); } catch (_) {}
  }

  function setTrace(update) {
    try {
      Object.assign(state, update || {});
      window.__chiggasSteamWalletLastStatus = { ...state, updatedAt: new Date().toISOString() };
      localStorage.setItem('chiggas_steam_wallet_pass99c_trace', JSON.stringify(window.__chiggasSteamWalletLastStatus, null, 2));
      window.dispatchEvent(new CustomEvent('chiggas-steam-wallet-pass99c-status', { detail: window.__chiggasSteamWalletLastStatus }));
    } catch (_) {}
  }

  function showStatus(message, isError = false) {
    return;
  }

  async function getJson(url, options = {}) {
    const res = await fetch(url, options);
    const text = await res.text();
    let body = text;
    try { body = JSON.parse(text); } catch (_) {}
    return { ok: res.ok, status: res.status, body };
  }

  function parseItemDefId(value) {
    const raw = String(value || '');
    const decoded = decodeURIComponent(raw);

    const direct = decoded.match(/(?:itemdefid|itemDefId|itemid|itemId)=([0-9]+)/i);
    if (direct) return direct[1];

    const detail = decoded.match(/\/itemstore\/4788490\/detail\/([0-9]+)/i);
    if (detail) return detail[1];

    const steamUrl = decoded.match(/store\.steampowered\.com\/itemstore\/4788490\/detail\/([0-9]+)/i);
    if (steamUrl) return steamUrl[1];

    return null;
  }

  function isSteamItemStoreUrl(value) {
    const raw = String(value || '');
    return /itemstore\/4788490\/detail\//i.test(raw) ||
      /steam:\/\/openurl\/.*itemstore\/4788490\/detail\//i.test(raw);
  }

  async function getSteamId64() {
    try {
      const cap = await window.ChiggasSteam?.getCapabilities?.();
      const steamId = cap?.localPlayer?.steamId ?? cap?.steamId64 ?? cap?.steamId;
      if (steamId) return String(steamId).replace(/n$/, '');
    } catch (error) {
      warn('Could not read ChiggasSteam capabilities:', error);
    }

    try {
      const cached = localStorage.getItem('chiggas_last_steamid64') || localStorage.getItem('steamId64');
      if (cached) return String(cached).replace(/n$/, '');
    } catch (_) {}

    return null;
  }

  function extractQueryStatus(queryBody) {
    try {
      const response = queryBody?.steam?.body?.response || queryBody?.response || queryBody?.body?.response;
      const params = response?.params || {};
      const orders = params.orders || response.orders || [];
      const firstOrder = Array.isArray(orders) ? orders[0] : null;
      const status = firstOrder?.status || params.status || response.status || null;
      return {
        response,
        params,
        firstOrder,
        status: status ? String(status) : null
      };
    } catch (_) {
      return { status: null };
    }
  }

  function looksAuthorized(queryBody) {
    const s = extractQueryStatus(queryBody).status;
    if (!s) return false;
    return /approved|authorized|succeeded|complete|completed/i.test(s);
  }

  async function pollForAuthorization(orderId, maxMs = 25000) {
    const started = Date.now();
    let attempt = 0;

    while (Date.now() - started < maxMs) {
      attempt += 1;
      await new Promise(resolve => setTimeout(resolve, attempt === 1 ? 3000 : 5000));

      const query = await getJson(`${BACKEND}/steam/mtx/query?orderId=${encodeURIComponent(orderId)}`);
      setTrace({ lastQuery: query });
      log('query result', query);

      if (query.ok && looksAuthorized(query.body)) {
        return query;
      }
    }

    return null;
  }

  async function finalizeOrder(orderId) {
    const finalize = await getJson(`${BACKEND}/steam/mtx/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
    setTrace({ lastFinalize: finalize });
    return finalize;
  }

  async function triggerRestoreAndEntitlementRefresh(itemDefId) {
    const events = [
      'chiggas-steam-wallet-purchase-finalized',
      'chiggas-steam-entitlement-refresh-requested',
      'chiggas-legendary-store-refresh-requested'
    ];

    events.forEach(name => {
      try {
        window.dispatchEvent(new CustomEvent(name, {
          detail: { pass: PASS, itemDefId: String(itemDefId), source: 'steam_wallet_pass99c' }
        }));
      } catch (_) {}
    });

    const candidateCalls = [
      () => window.ChiggasSteamInventory?.restoreOwnedItems?.(),
      () => window.ChiggasSteamInventory?.refreshOwnedItems?.(),
      () => window.ChiggasSteamEntitlements?.restore?.(),
      () => window.ChiggasSteamEntitlements?.refresh?.(),
      () => window.ChiggasPlatformPurchaseAdapter?.restorePurchases?.(),
      () => window.PlatformPurchaseAdapter?.restorePurchases?.(),
      () => window.ChiggasLegendaryStore?.refreshOwnership?.()
    ];

    const results = [];
    for (const fn of candidateCalls) {
      try {
        const out = fn();
        if (out && typeof out.then === 'function') results.push(await out);
        else if (typeof out !== 'undefined') results.push(out);
      } catch (error) {
        results.push({ ok: false, error: String(error && error.message ? error.message : error) });
      }
    }

    return results;
  }

  async function beginPurchase(input = {}) {
    if (state.pending) {
      showStatus('Steam Wallet purchase is already in progress. Close or cancel the Steam Wallet window, then wait a few seconds before trying again.', true);
      setTrace({
        pass99G1BlockedDuplicatePurchase: true,
        pass99G1BlockedAt: new Date().toISOString()
      });
      return {
        ok: false,
        pass: PASS,
        status: 'purchase_already_pending_wait_for_wallet',
        guidance: 'Close/cancel the Steam Wallet window and wait for the current request to clear.'
      };
    }

    const itemDefId = String(input.itemDefId || parseItemDefId(input.url) || input.itemid || '').trim();
    if (!itemDefId) {
      return { ok: false, pass: PASS, status: 'missing_itemdefid', input };
    }

    state.pending = true;
    setTrace({ pending: true, lastError: null, activeItemDefId: itemDefId });
    showStatus('Opening Steam Wallet...', false);

    try {
      const steamId64 = await getSteamId64();
      if (!steamId64) {
        throw new Error('Steam ID not available. Launch the game from Steam and make sure Steamworks is active.');
      }

      const pass99GDisplayName = chiggasPass99GResolveItemName(itemDefId, input);

      const initRequest = {
        steamId64,
        itemDefId,
        skinId: input.skinId || `itemdef_${itemDefId}`,
        description: pass99GDisplayName,
        amountCents: Number(input.amountCents || DEFAULT_AMOUNT_CENTS),
        currency: input.currency || 'USD',
        language: input.language || 'en'
      };

      const health = await getJson(`${BACKEND}/steam/mtx/health`);
      if (!health.ok || !health.body?.publisherKeyConfigured) {
        throw new Error('Steam Wallet backend is not ready or publisher key is not configured.');
      }

      const init = await getJson(`${BACKEND}/steam/mtx/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initRequest)
      });

      const orderId = init?.body?.order?.orderId || init?.body?.steam?.body?.response?.params?.orderid;
      const transId = init?.body?.steam?.body?.response?.params?.transid;
      const steamResult = init?.body?.steam?.body?.response?.result;

      setTrace({ lastInit: init, activeOrderId: orderId, activeTransId: transId });
      log('init result', init);

      if (!init.ok || steamResult !== 'OK' || !orderId) {
        throw new Error(`Steam InitTxn failed: ${JSON.stringify(init.body?.steam?.body?.response || init.body)}`);
      }

      showStatus('Steam Wallet opened. Complete the purchase in the Steam overlay, then return to the game...', false);

      const query = await pollForAuthorization(orderId);
      if (!query) {
        state.pending = false;
        setTrace({ pending: false });
        chiggasPass99GForceClearPending('authorization_timeout_or_cancel');
        showStatus('Steam Wallet purchase canceled or not completed. You can choose another item now.', true);
        return {
          ok: false,
          pass: PASS,
          status: 'authorization_not_detected_yet',
          orderId,
          transId,
          guidance: 'The Wallet may still be pending. Use Restore or retry verification.'
        };
      }

      showStatus('Finalizing Steam Wallet purchase...', false);
      const finalize = await finalizeOrder(orderId);
      const finalResult = finalize?.body?.steam?.body?.response?.result;

      if (!finalize.ok || finalResult !== 'OK') {
        throw new Error(`FinalizeTxn failed: ${JSON.stringify(finalize.body?.steam?.body?.response || finalize.body)}`);
      }

      const restoreResults = await triggerRestoreAndEntitlementRefresh(itemDefId);

      state.pending = false;
      setTrace({
        pending: false,
        lastRestoreResults: restoreResults,
        lastSuccessfulPurchase: {
          orderId,
          transId,
          itemDefId,
          finalizedAt: new Date().toISOString()
        }
      });

      showStatus('Steam Wallet purchase complete. Refreshing ownership...', false);

      return {
        ok: true,
        pass: PASS,
        status: 'steam_wallet_purchase_finalized',
        orderId,
        transId,
        itemDefId,
        init,
        query,
        finalize,
        restoreResults
      };
    } catch (error) {
      state.pending = false;
      const message = String(error && error.message ? error.message : error);
      setTrace({ pending: false, lastError: message });
      showStatus('Steam Wallet purchase failed: ' + message, true);
      warn(message);
      return { ok: false, pass: PASS, status: 'steam_wallet_purchase_failed', error: message };
    }
  }

  function installWindowOpenInterceptor() {
    if (window.__chiggasSteamPass99CWindowOpenPatched) return;
    window.__chiggasSteamPass99CWindowOpenPatched = true;

    const originalOpen = window.open ? window.open.bind(window) : null;
    window.open = function patchedWindowOpen(url, target, features) {
      try {
        if (isSteamItemStoreUrl(url)) {
          const itemDefId = parseItemDefId(url);
          beginPurchase({ url, itemDefId });
          return null;
        }
      } catch (error) {
        warn('window.open intercept failed:', error);
      }

      return originalOpen ? originalOpen(url, target, features) : null;
    };
  }

  function installClickInterceptor() {
    if (window.__chiggasSteamPass99CClickPatched) return;
    window.__chiggasSteamPass99CClickPatched = true;

    document.addEventListener('click', (event) => {
      try {
        const path = event.composedPath ? event.composedPath() : [];
        const anchor = path.find(el => el && el.tagName === 'A' && el.href);
        const href = anchor?.href;
        if (href && isSteamItemStoreUrl(href)) {
          event.preventDefault();
          event.stopPropagation();
          const itemDefId = parseItemDefId(href);
          beginPurchase({ url: href, itemDefId });
        }
      } catch (error) {
        warn('click intercept failed:', error);
      }
    }, true);
  }

  function installLocationAssignInterceptor() {
    try {
      const originalAssign = window.location.assign.bind(window.location);
      window.location.assign = function patchedAssign(url) {
        if (isSteamItemStoreUrl(url)) {
          beginPurchase({ url, itemDefId: parseItemDefId(url) });
          return;
        }
        return originalAssign(url);
      };
    } catch (_) {
      // Some browsers make location.assign non-writable. Safe to ignore.
    }
  }

  window.ChiggasSteamWalletPurchase = {
    pass: PASS,
    state,
    beginPurchase,
    parseItemDefId,
    isSteamItemStoreUrl,
    getSteamId64,
    pollForAuthorization,
    finalizeOrder,
    triggerRestoreAndEntitlementRefresh,
    getTrace() {
      return { ...state };
    },
    clearPendingSafe(reason = 'manual_clear_safe') {
      return chiggasPass99GForceClearPending(reason);
    },
    clearPending(reason = 'manual_clear') {
      return chiggasPass99GForceClearPending(reason);
    },
    getItemNameCatalog() {
      return { ...CHIGGAS_STEAM_PASS_99G_ITEM_NAME_CATALOG };
    },
    resolveItemName(itemDefId, input = {}) {
      return chiggasPass99GResolveItemName(itemDefId, input);
    },
    health() {
      return getJson(`${BACKEND}/steam/mtx/health`);
    },
    test(itemDefId = 1000) {
      return beginPurchase({ itemDefId, description: `Chiggas Legendary Wear ${itemDefId}`, amountCents: DEFAULT_AMOUNT_CENTS });
    }
  };

  installWindowOpenInterceptor();
  installClickInterceptor();
  installLocationAssignInterceptor();

  setTrace({ ready: true });
  log('installed');
})();
/* CHIGGAS_STEAM_PASS_99C_WALLET_STORE_BRIDGE_END */


/* CHIGGAS_STEAM_PASS_99E_PENDING_PURCHASE_LISTENER */
try {
  window.addEventListener('chiggas-steam-wallet-pass99e-purchase-requested', function(event) {
    try {
      const payload = event && event.detail ? event.detail : {};
      if (window.ChiggasSteamWalletPurchase && typeof window.ChiggasSteamWalletPurchase.beginPurchase === 'function') {
        window.ChiggasSteamWalletPurchase.beginPurchase({
          itemDefId: payload.itemDefId,
          url: payload.url,
          description: 'Chiggas Legendary Wear ' + payload.itemDefId,
          amountCents: 99,
          source: 'pass99e_event_listener'
        });
      }
    } catch (error) {
      console.warn('[Chiggas Pass 99E] pending purchase event listener failed:', error);
    }
  });

  setTimeout(function() {
    try {
      const pending = window.__chiggasPass99EPendingWalletPurchase;
      if (pending && window.ChiggasSteamWalletPurchase && typeof window.ChiggasSteamWalletPurchase.beginPurchase === 'function') {
        window.__chiggasPass99EPendingWalletPurchase = null;
        window.ChiggasSteamWalletPurchase.beginPurchase({
          itemDefId: pending.itemDefId,
          url: pending.url,
          description: 'Chiggas Legendary Wear ' + pending.itemDefId,
          amountCents: 99,
          source: 'pass99e_pending_timeout'
        });
      }
    } catch (error) {
      console.warn('[Chiggas Pass 99E] pending purchase timeout failed:', error);
    }
  }, 1000);
} catch (error) {
  console.warn('[Chiggas Pass 99E] could not install pending purchase listener:', error);
}



/* CHIGGAS_STEAM_PASS_99F_PENDING_PURCHASE_LISTENER */
try {
  window.addEventListener('chiggas-steam-wallet-pass99f-purchase-requested', function(event) {
    try {
      const payload = event && event.detail ? event.detail : {};
      if (window.ChiggasSteamWalletPurchase && typeof window.ChiggasSteamWalletPurchase.beginPurchase === 'function') {
        window.ChiggasSteamWalletPurchase.beginPurchase({
          itemDefId: payload.itemDefId,
          url: payload.value || payload.url,
          description: 'Chiggas Legendary Wear ' + payload.itemDefId,
          amountCents: 99,
          source: 'pass99f_event_listener'
        });
      }
    } catch (error) {
      console.warn('[Chiggas Pass 99F] pending purchase event failed:', error);
    }
  });

  setTimeout(function() {
    try {
      const pending = window.__chiggasPass99FPendingWalletPurchase;
      if (pending && window.ChiggasSteamWalletPurchase && typeof window.ChiggasSteamWalletPurchase.beginPurchase === 'function') {
        window.__chiggasPass99FPendingWalletPurchase = null;
        window.ChiggasSteamWalletPurchase.beginPurchase({
          itemDefId: pending.itemDefId,
          url: pending.value || pending.url,
          description: 'Chiggas Legendary Wear ' + pending.itemDefId,
          amountCents: 99,
          source: 'pass99f_pending_timeout'
        });
      }
    } catch (error) {
      console.warn('[Chiggas Pass 99F] pending purchase timeout failed:', error);
    }
  }, 1000);
} catch (error) {
  console.warn('[Chiggas Pass 99F] listener install failed:', error);
}



/* CHIGGAS_STEAM_PASS_99H_SINGLE_FLIGHT_GUARD */
(function(){
  try {
    const api = window.ChiggasSteamWalletPurchase;
    if (!api || typeof api.beginPurchase !== 'function' || api.__pass99HSingleFlightInstalled) return;

    const ITEM_NAME_OVERRIDES = {
  "1001": "Chigga B-Ball Team Black",
  "1004": "Chigga Wear - Purple Velour Vandal"
};
    const originalBeginPurchase = api.beginPurchase.bind(api);
    const originalResolveItemName = typeof api.resolveItemName === 'function'
      ? api.resolveItemName.bind(api)
      : null;

    let active = false;
    let activeStartedAt = 0;
    let activeItemDefId = null;
    let lastBlockedAt = 0;

    function cleanName(value) {
      const name = String(value || '').trim();
      if (!name) return null;
      if (/^chigga_wear$/i.test(name)) return null;
      if (/^chigga\s+wear\s*$/i.test(name)) return null;
      if (/^itemdef/i.test(name)) return null;
      if (/^Chiggas?\s+Legendary\s+Wear\s+\d+$/i.test(name)) return null;
      return name.slice(0, 128);
    }

    function itemIdFromInput(input) {
      const raw = String(input?.itemDefId || input?.itemid || input?.url || '');
      const direct = raw.match(/^(\d+)$/);
      if (direct) return direct[1];
      const m = decodeURIComponent(raw).match(/\/itemstore\/4788490\/detail\/(\d+)/i);
      return m && m[1] ? m[1] : '';
    }

    function resolveName(itemDefId, input) {
      const id = String(itemDefId || itemIdFromInput(input) || '').trim();

      const override = cleanName(ITEM_NAME_OVERRIDES[id]);
      if (override) return override;

      const inputName = cleanName(input && input.description);
      if (inputName) return inputName;

      if (originalResolveItemName) {
        const resolved = cleanName(originalResolveItemName(id, input || {}));
        if (resolved) return resolved;
      }

      return 'Chiggas Legendary Wear ' + id;
    }

    function clearActive(reason) {
      active = false;
      activeItemDefId = null;
      try {
        if (typeof api.clearPendingSafe === 'function') api.clearPendingSafe(reason || 'pass99h_clear_active');
        else if (typeof api.clearPending === 'function') api.clearPending(reason || 'pass99h_clear_active');
      } catch (_) {}
      try {
        window.__chiggasPass99HWalletState = {
          active,
          activeItemDefId,
          reason,
          clearedAt: new Date().toISOString()
        };
      } catch (_) {}
    }

    api.resolveItemName = function(itemDefId, input = {}) {
      return resolveName(itemDefId, input);
    };

    api.beginPurchase = async function(input = {}) {
      const now = Date.now();
      const id = itemIdFromInput(input);
      const activeAge = now - activeStartedAt;

      if (active && activeAge < 18000) {
        if (now - lastBlockedAt > 2000) {
          lastBlockedAt = now;
          try { console.warn('[Chiggas Pass 99H] Blocked duplicate Steam Wallet attempt while one is active:', { id, activeItemDefId, activeAge }); } catch (_) {}
        }
        return {
          ok: false,
          pass: 'steam_desktop_wrapper_pass_99h',
          status: 'duplicate_wallet_attempt_blocked',
          activeItemDefId,
          requestedItemDefId: id,
          activeAgeMs: activeAge
        };
      }

      if (active && activeAge >= 18000) {
        clearActive('pass99h_stale_active_timeout');
      }

      active = true;
      activeStartedAt = now;
      activeItemDefId = id;

      const itemName = resolveName(id, input);
      const patchedInput = Object.assign({}, input, {
        itemDefId: id || input.itemDefId,
        description: itemName,
        pass99HResolvedItemName: itemName
      });

      try {
        window.__chiggasPass99HWalletState = {
          active,
          activeItemDefId,
          itemName,
          startedAt: new Date(activeStartedAt).toISOString()
        };
      } catch (_) {}

      let timeout = null;
      try {
        timeout = setTimeout(() => {
          clearActive('pass99h_auto_clear_after_25s');
        }, 25000);

        const result = await originalBeginPurchase(patchedInput);

        if (!result || result.ok === false || /failed|timeout|cancel|not_detected|pending/i.test(String(result.status || ''))) {
          setTimeout(() => clearActive('pass99h_result_not_success'), 2000);
        } else if (result.ok === true) {
          setTimeout(() => clearActive('pass99h_success'), 2000);
        }

        return result;
      } catch (error) {
        clearActive('pass99h_exception');
        throw error;
      } finally {
        if (timeout) {
          // Keep backup timeout owned by setTimeout above; do not clear it if original flow is still polling.
        }
      }
    };

    api.clearWalletGuard = function(reason = 'manual_pass99h_clear') {
      clearActive(reason);
      return { ok: true, reason, active, activeItemDefId };
    };

    api.getWalletGuardState = function() {
      return {
        pass: 'steam_desktop_wrapper_pass_99h',
        active,
        activeItemDefId,
        activeAgeMs: active ? Date.now() - activeStartedAt : 0,
        overrides: Object.assign({}, ITEM_NAME_OVERRIDES)
      };
    };

    api.__pass99HSingleFlightInstalled = true;
    console.log('[Chiggas Pass 99H] Steam Wallet single-flight guard installed');
  } catch (error) {
    console.warn('[Chiggas Pass 99H] Failed to install single-flight guard:', error);
  }
})();


