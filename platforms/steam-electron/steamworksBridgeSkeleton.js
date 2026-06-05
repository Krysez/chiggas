'use strict';

const PASS_VERSION = 'steam_desktop_wrapper_pass_3';

const ACTION_SET_FALLBACKS = {
  menu: {
    navigate: { glyph: '[L]', label: 'Navigate' },
    confirm: { glyph: '[A]', label: 'Confirm' },
    back: { glyph: '[B]', label: 'Back' },
    scroll_up: { glyph: '[D-Up]', label: 'Scroll Up' },
    scroll_down: { glyph: '[D-Down]', label: 'Scroll Down' },
    pause: { glyph: '[Menu]', label: 'Pause' }
  },
  gameplay: {
    move: { glyph: '[L]', label: 'Move' },
    aim: { glyph: '[R]', label: 'Aim' },
    recruit: { glyph: '[A]', label: 'Recruit' },
    eat: { glyph: '[X]', label: 'Eat' },
    charge: { glyph: '[Y]', label: 'Charge' },
    shoot: { glyph: '[RT]', label: 'Shoot' },
    pause: { glyph: '[Menu]', label: 'Pause' },
    back: { glyph: '[B]', label: 'Back' }
  },
  wardrobe: {
    navigate: { glyph: '[L]', label: 'Navigate' },
    equip: { glyph: '[A]', label: 'Equip' },
    back: { glyph: '[B]', label: 'Back' },
    scroll_up: { glyph: '[D-Up]', label: 'Scroll Up' },
    scroll_down: { glyph: '[D-Down]', label: 'Scroll Down' }
  },
  legendaryStore: {
    navigate: { glyph: '[L]', label: 'Navigate' },
    purchase: { glyph: '[A]', label: 'Test Buy' },
    restore_purchases: { glyph: '[Y]', label: 'Restore' },
    back: { glyph: '[B]', label: 'Back' },
    scroll_up: { glyph: '[D-Up]', label: 'Scroll Up' },
    scroll_down: { glyph: '[D-Down]', label: 'Scroll Down' }
  },
  miniGame: {
    navigate: { glyph: '[L]', label: 'Move' },
    confirm: { glyph: '[A]', label: 'Confirm' },
    back: { glyph: '[B]', label: 'Back' },
    pause: { glyph: '[Menu]', label: 'Pause' }
  }
};

function normalizeActionSet(actionSet, fallback = 'menu') {
  if (!actionSet) return fallback;
  const raw = String(actionSet).trim();
  if (ACTION_SET_FALLBACKS[raw]) return raw;
  const lower = raw.toLowerCase();
  return Object.keys(ACTION_SET_FALLBACKS).find(key => key.toLowerCase() === lower) || fallback;
}

function parsePayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'object') return payload;
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch (_error) {
      return { action: payload };
    }
  }
  return {};
}

function createPrompt(actionSet, action, label = '') {
  const normalizedSet = normalizeActionSet(actionSet, 'menu');
  const normalizedAction = String(action || '').trim();
  const set = ACTION_SET_FALLBACKS[normalizedSet] || ACTION_SET_FALLBACKS.menu;
  const fallback = set[normalizedAction] || ACTION_SET_FALLBACKS.gameplay[normalizedAction] || ACTION_SET_FALLBACKS.menu[normalizedAction] || {
    glyph: '[?]',
    label: label || normalizedAction || 'Action'
  };
  const promptLabel = label || fallback.label || normalizedAction || 'Action';
  const glyph = fallback.glyph || '[?]';

  return {
    ok: true,
    source: 'steam_desktop_placeholder_fallback',
    pass: PASS_VERSION,
    steamworksIntegrated: false,
    actionSet: normalizedSet,
    action: normalizedAction,
    label: promptLabel,
    glyph,
    glyphText: glyph,
    promptText: `${glyph} ${promptLabel}`,
    imagePath: '',
    controllerType: 'fallback_controller',
    note: 'Steamworks SDK is not connected yet. This is a safe desktop-wrapper placeholder prompt.'
  };
}

function createSteamworksBridgeSkeleton() {
  let activeActionSet = 'menu';
  const events = [];

  function log(event, detail = {}) {
    const entry = {
      event,
      detail,
      createdAt: new Date().toISOString()
    };
    events.push(entry);
    if (events.length > 80) events.shift();
    return entry;
  }

  function getCapabilities() {
    return {
      ok: true,
      pass: PASS_VERSION,
      runtime: 'electron',
      steamworksBridgeInstalled: true,
      steamworksIntegrated: false,
      steamClientRequired: true,
      steamInputIntegrated: false,
      steamInventoryIntegrated: false,
      steamPurchasesIntegrated: false,
      steamOverlayIntegrated: false,
      steamworksSdkLoaded: false,
      activeActionSet,
      supportedActionSets: Object.keys(ACTION_SET_FALLBACKS),
      status: 'steamworks_placeholder_bridge_ready',
      note: 'The Electron wrapper bridge exists, but the Steamworks SDK/native module is not connected yet.'
    };
  }

  function getStatus() {
    return {
      ...getCapabilities(),
      recentEvents: events.slice(-20)
    };
  }

  function setActionSet(actionSet) {
    activeActionSet = normalizeActionSet(actionSet, activeActionSet);
    log('set_action_set_placeholder', { activeActionSet });
    return {
      ok: true,
      status: 'action_set_updated_placeholder',
      actionSet: activeActionSet,
      steamworksIntegrated: false
    };
  }

  function getPromptForAction(payload) {
    const parsed = parsePayload(payload);
    return createPrompt(parsed.actionSet || activeActionSet, parsed.action || parsed.actionName, parsed.label || '');
  }

  function getGlyphForAction(actionSetOrPayload, actionName = '') {
    const parsed = typeof actionSetOrPayload === 'object' || (typeof actionSetOrPayload === 'string' && actionSetOrPayload.trim().startsWith('{'))
      ? parsePayload(actionSetOrPayload)
      : { actionSet: actionSetOrPayload, action: actionName };
    return createPrompt(parsed.actionSet || activeActionSet, parsed.action || parsed.actionName, parsed.label || '');
  }

  function getConnectedControllers() {
    return {
      ok: true,
      status: 'steam_input_placeholder_no_native_controllers',
      steamworksIntegrated: false,
      controllers: [],
      count: 0
    };
  }

  function showBindingPanel() {
    log('show_binding_panel_placeholder');
    return {
      ok: false,
      status: 'steamworks_not_integrated',
      reason: 'Steam Input binding panel requires the Steamworks SDK bridge.',
      steamworksIntegrated: false
    };
  }

  function getOwnedItems() {
    return {
      ok: false,
      status: 'steam_inventory_not_integrated',
      steamworksIntegrated: false,
      ownedItems: [],
      entitlements: [],
      note: 'Steam Inventory ownership sync is not connected yet.'
    };
  }

  function syncInventory() {
    log('sync_inventory_placeholder');
    return {
      ok: false,
      status: 'steam_inventory_not_integrated',
      steamworksIntegrated: false,
      ownedItems: [],
      entitlements: []
    };
  }

  function purchaseProduct(payload = {}) {
    const parsed = parsePayload(payload);
    log('purchase_product_placeholder', {
      productId: parsed.productId || parsed.steamProductId || null,
      skinId: parsed.skinId || null
    });
    return {
      ok: false,
      status: 'steam_purchases_not_integrated',
      billingLocked: true,
      steamworksIntegrated: false,
      requestId: parsed.requestId || null,
      productId: parsed.productId || parsed.steamProductId || null,
      skinId: parsed.skinId || null,
      note: 'Steam purchase bridge placeholder only. Rosebud TEST BUY/local test flow should remain active.'
    };
  }

  function restorePurchases(payload = {}) {
    const parsed = parsePayload(payload);
    log('restore_purchases_placeholder', { requestId: parsed.requestId || null });
    return {
      ok: false,
      status: 'steam_purchases_not_integrated',
      billingLocked: true,
      steamworksIntegrated: false,
      requestId: parsed.requestId || null,
      restoredSkins: [],
      count: 0,
      note: 'Steam restore bridge placeholder only. Rosebud TEST BUY/local restore flow should remain active.'
    };
  }

  function getDebugReport() {
    return {
      ok: true,
      status: 'steamworks_bridge_skeleton_ready',
      capabilities: getCapabilities(),
      activeActionSet,
      prompts: {
        recruit: createPrompt('gameplay', 'recruit'),
        eat: createPrompt('gameplay', 'eat'),
        charge: createPrompt('gameplay', 'charge'),
        shoot: createPrompt('gameplay', 'shoot')
      },
      inventory: getOwnedItems(),
      recentEvents: events.slice(-20),
      checkedAt: new Date().toISOString()
    };
  }

  return {
    PASS_VERSION,
    getCapabilities,
    getStatus,
    getDebugReport,
    setActionSet,
    getPromptForAction,
    getGlyphForAction,
    getConnectedControllers,
    showBindingPanel,
    getOwnedItems,
    syncInventory,
    restoreInventory: syncInventory,
    purchaseProduct,
    purchaseLegendarySkin: purchaseProduct,
    buyProduct: purchaseProduct,
    purchase: purchaseProduct,
    restorePurchases,
    restoreProducts: restorePurchases,
    restore: restorePurchases
  };
}

module.exports = {
  PASS_VERSION,
  ACTION_SET_FALLBACKS,
  createPrompt,
  createSteamworksBridgeSkeleton
};
