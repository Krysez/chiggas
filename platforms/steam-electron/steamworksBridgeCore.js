'use strict';

const fs = require('fs');
const path = require('path');
const { ACTION_SET_FALLBACKS, createPrompt } = require('./steamworksBridgeSkeleton');

const PASS_VERSION = 'steam_desktop_wrapper_pass_26';
const DEFAULT_APP_ID = 4788490;
const STEAM_ACHIEVEMENTS_ARMED = String(process.env.CHIGGAS_STEAM_ACHIEVEMENTS_ARMED || '').toLowerCase() === 'true';

const ACTIONS_BY_SET = {
  menu: { analog: ['navigate'], digital: ['confirm', 'back', 'scroll_up', 'scroll_down', 'pause'] },
  gameplay: { analog: ['move', 'aim'], digital: ['recruit', 'eat', 'charge', 'shoot', 'pause', 'back', 'confirm'] },
  wardrobe: { analog: ['navigate'], digital: ['confirm', 'equip', 'back', 'scroll_up', 'scroll_down', 'switch_player_tab', 'switch_soldier_tab', 'open_legendary_store'] },
  legendaryStore: { analog: ['navigate'], digital: ['confirm', 'purchase', 'restore_purchases', 'back', 'scroll_up', 'scroll_down', 'debug_toggle'] },
  miniGame: { analog: ['move', 'navigate'], digital: ['confirm', 'back', 'pause'] }
};


function parsePayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'object') return payload;
  if (typeof payload === 'string') {
    try { return JSON.parse(payload); } catch (_error) { return { action: payload }; }
  }
  return {};
}

function normalizeActionSet(actionSet, fallback = 'menu') {
  if (!actionSet) return fallback;
  const raw = String(actionSet).trim();
  if (ACTION_SET_FALLBACKS[raw]) return raw;
  const lower = raw.toLowerCase();
  return Object.keys(ACTION_SET_FALLBACKS).find(key => key.toLowerCase() === lower) || fallback;
}

function readSteamAppId(baseDir = __dirname) {
  const envId = Number.parseInt(process.env.CHIGGAS_STEAM_APP_ID || process.env.STEAM_APP_ID || '', 10);
  if (Number.isFinite(envId) && envId > 0) return envId;

  const appIdPath = path.join(baseDir, 'steam_appid.txt');
  try {
    const fileId = Number.parseInt(fs.readFileSync(appIdPath, 'utf8').trim(), 10);
    if (Number.isFinite(fileId) && fileId > 0) return fileId;
  } catch (_error) {}

  return DEFAULT_APP_ID;
}

function safeCall(fn, fallback = null) {
  try { return fn(); } catch (error) { return fallback; }
}

function toJsonSafe(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[Function]';
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(toJsonSafe);

  const output = {};
  for (const [key, item] of Object.entries(value)) output[key] = toJsonSafe(item);
  return output;
}

function getFunctionNames(obj) {
  if (!obj || typeof obj !== 'object') return [];
  const names = new Set();
  let cursor = obj;
  let depth = 0;
  while (cursor && depth < 4) {
    Object.getOwnPropertyNames(cursor).forEach(name => {
      try {
        if (typeof obj[name] === 'function' || typeof cursor[name] === 'function') names.add(name);
      } catch (_error) {}
    });
    cursor = Object.getPrototypeOf(cursor);
    depth += 1;
  }
  return Array.from(names).filter(name => name !== 'constructor').sort();
}

function normalizeControllers(rawControllers) {
  if (!rawControllers) return [];
  const list = Array.isArray(rawControllers)
    ? rawControllers
    : (typeof rawControllers[Symbol.iterator] === 'function' ? Array.from(rawControllers) : [rawControllers]);

  return list.filter(item => item !== null && item !== undefined).map((item, index) => {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'bigint') {
      return { index, handle: String(item), rawType: typeof item };
    }

    const safe = toJsonSafe(item);
    return {
      index,
      handle: safe?.handle ?? safe?.id ?? safe?.controllerHandle ?? safe?.steamInputHandle ?? null,
      type: safe?.type ?? safe?.controllerType ?? safe?.inputType ?? null,
      name: safe?.name ?? safe?.label ?? null,
      raw: safe
    };
  });
}

function callFirstAvailable(obj, methodNames, args = []) {
  if (!obj) return { called: false, method: null, value: null, error: null };
  for (const methodName of methodNames) {
    if (typeof obj[methodName] !== 'function') continue;
    try {
      return { called: true, method: methodName, value: obj[methodName](...args), error: null };
    } catch (error) {
      return {
        called: true,
        method: methodName,
        value: null,
        error: { name: error?.name || 'Error', message: error?.message || String(error) }
      };
    }
  }
  return { called: false, method: null, value: null, error: null };
}

function getAnalogVectorSafe(controller, actionHandle) {
  if (!controller || actionHandle === null || actionHandle === undefined) return { x: 0, y: 0, ok: false };
  try {
    const value = controller.getAnalogActionVector(actionHandle);
    return {
      x: Number(value?.x || 0),
      y: Number(value?.y || 0),
      ok: true
    };
  } catch (error) {
    return { x: 0, y: 0, ok: false, error: error?.message || String(error) };
  }
}

function getDigitalPressedSafe(controller, actionHandle) {
  if (!controller || actionHandle === null || actionHandle === undefined) return { pressed: false, ok: false };
  try {
    return { pressed: !!controller.isDigitalActionPressed(actionHandle), ok: true };
  } catch (error) {
    return { pressed: false, ok: false, error: error?.message || String(error) };
  }
}

function createSteamworksBridgeCore(options = {}) {
  let activeActionSet = 'menu';
  const events = [];
  const baseDir = options.baseDir || __dirname;
  const appId = Number.parseInt(options.appId || readSteamAppId(baseDir), 10) || DEFAULT_APP_ID;
  const actionManifestPath = path.join(baseDir, 'steam_input', `game_actions_${appId}.vdf`);

  let steamworks = null;
  let client = null;
  let initError = null;
  let initAttempted = false;
  let steamInputInitAttempted = false;
  let lastSteamInputStatus = null;

  function log(event, detail = {}) {
    const entry = { event, detail: toJsonSafe(detail), createdAt: new Date().toISOString() };
    events.push(entry);
    if (events.length > 140) events.shift();
    return entry;
  }

  function getSteamControllerConfigDir() {
    const envPath = process.env.CHIGGAS_STEAM_CONTROLLER_CONFIG_DIR || process.env.STEAM_CONTROLLER_CONFIG_DIR;
    if (envPath) return envPath;

    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    return path.join(programFilesX86, 'Steam', 'controller_config');
  }

  function getActionManifestStatus() {
    const controllerConfigDir = getSteamControllerConfigDir();
    const steamManifestPath = path.join(controllerConfigDir, `game_actions_${appId}.vdf`);

    return {
      ok: true,
      appId,
      expectedFileName: `game_actions_${appId}.vdf`,
      localManifestPath: actionManifestPath,
      localManifestExists: fs.existsSync(actionManifestPath),
      steamControllerConfigDir: controllerConfigDir,
      steamControllerConfigExists: fs.existsSync(controllerConfigDir),
      steamManifestPath,
      steamManifestInstalled: fs.existsSync(steamManifestPath),
      status: fs.existsSync(actionManifestPath)
        ? (fs.existsSync(steamManifestPath) ? 'action_manifest_local_and_steam_copy_found' : 'action_manifest_local_found_not_installed_to_steam_controller_config')
        : 'action_manifest_missing_from_wrapper'
    };
  }

  function applyActionManifestOverride(inputApi) {
    const manifest = getActionManifestStatus();
    if (!inputApi || !manifest.localManifestExists) {
      return { attempted: false, method: null, ok: false, error: null, manifest };
    }

    const result = callFirstAvailable(inputApi, [
      'setInputActionManifestFilePath',
      'SetInputActionManifestFilePath',
      'setInputActionManifestPath',
      'SetInputActionManifestPath',
      'setActionManifestPath',
      'SetActionManifestPath'
    ], [manifest.localManifestPath]);

    if (result.called) {
      log(result.error ? 'steam_input_manifest_override_failed' : 'steam_input_manifest_override_called', {
        method: result.method,
        manifestPath: manifest.localManifestPath,
        error: result.error
      });
    }

    return {
      attempted: result.called,
      method: result.method,
      ok: result.called ? !result.error : true,
      result: toJsonSafe(result.value),
      error: result.error,
      manifest
    };
  }

  function initSteamworks() {
    if (initAttempted) return !!client;
    initAttempted = true;

    try {
      steamworks = require('steamworks.js');
      client = steamworks.init(appId);
      log('steamworks_init_success', { appId });
      return true;
    } catch (error) {
      initError = {
        name: error?.name || 'Error',
        message: error?.message || String(error),
        stack: String(error?.stack || '').split('\n').slice(0, 4).join('\n')
      };
      client = null;
      log('steamworks_init_failed', { appId, error: initError.message });
      return false;
    }
  }

  initSteamworks();

  function getSteamInputCandidate() {
    if (!client) return null;

    const candidates = [
      ['client.input', client.input],
      ['client.steamInput', client.steamInput],
      ['client.SteamInput', client.SteamInput],
      ['client.controller', client.controller],
      ['client.controllers', client.controllers],
      ['steamworks.input', steamworks?.input],
      ['steamworks.steamInput', steamworks?.steamInput]
    ];

    for (const [pathName, candidate] of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;
      const methods = getFunctionNames(candidate);
      const looksLikeInput = methods.some(name => /input|controller|glyph|action|binding|init|getControllers|getConnectedControllers/i.test(name));
      if (looksLikeInput) return { pathName, api: candidate, methods };
    }

    return null;
  }


  function getSteamInventoryCandidate() {
    if (!client) return null;

    const candidates = [
      ['client.inventory', client.inventory],
      ['client.steamInventory', client.steamInventory],
      ['client.SteamInventory', client.SteamInventory],
      ['client.items', client.items],
      ['client.itemStore', client.itemStore],
      ['steamworks.inventory', steamworks?.inventory],
      ['steamworks.steamInventory', steamworks?.steamInventory],
      ['steamworks.SteamInventory', steamworks?.SteamInventory]
    ];

    for (const [pathName, candidate] of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;
      const methods = getFunctionNames(candidate);
      const looksLikeInventory = methods.some(name => /inventory|item|items|price|definition|result|ownership/i.test(name));
      if (looksLikeInventory) return { pathName, api: candidate, methods };
    }

    return null;
  }

  function readLegendaryItemDefMap() {
    const catalogPath = path.join(baseDir, 'game', 'scenes', 'LegendaryPurchaseCatalog.js');
    const map = new Map();
    try {
      const source = fs.readFileSync(catalogPath, 'utf8');
      const blocks = source.matchAll(/([a-zA-Z0-9_]+):\s*\{([\s\S]*?)\n\s*\},/g);
      for (const match of blocks) {
        const key = match[1];
        const block = match[2];
        const idMatch = block.match(/steamItemDefId:\s*(\d+)/);
        if (!idMatch) continue;
        const str = (name) => {
          const found = block.match(new RegExp(`${name}:\\s*[\"']([^\"']+)[\"']`));
          return found ? found[1] : '';
        };
        const itemdefid = Number.parseInt(idMatch[1], 10);
        map.set(String(itemdefid), {
          itemdefid,
          skinId: str('skinId') || key,
          title: str('title') || str('name') || key,
          type: str('type') || '',
          steamProductId: str('steamProductId') || str('productId') || ''
        });
      }
    } catch (error) {
      log('steam_inventory_catalog_read_failed', { error: error?.message || String(error) });
    }
    return map;
  }

  function normalizeInventoryItem(raw, index = 0) {
    const safe = toJsonSafe(raw);
    const itemdefid = safe?.itemdefid ?? safe?.itemDefId ?? safe?.definition ?? safe?.definitionId ?? safe?.defId ?? safe?.id ?? null;
    const quantity = safe?.quantity ?? safe?.qty ?? safe?.amount ?? safe?.count ?? 1;
    const instanceId = safe?.itemid ?? safe?.itemId ?? safe?.instanceId ?? safe?.id ?? null;
    return {
      index,
      itemdefid: itemdefid === null || itemdefid === undefined ? null : String(itemdefid),
      instanceId: instanceId === null || instanceId === undefined ? null : String(instanceId),
      quantity: Number(quantity || 1),
      raw: safe
    };
  }

  function normalizeInventoryResult(value) {
    const safe = toJsonSafe(value);
    let rawItems = [];

    if (Array.isArray(safe)) rawItems = safe;
    else if (Array.isArray(safe?.items)) rawItems = safe.items;
    else if (Array.isArray(safe?.itemDetails)) rawItems = safe.itemDetails;
    else if (Array.isArray(safe?.inventory)) rawItems = safe.inventory;
    else if (Array.isArray(safe?.results)) rawItems = safe.results;
    else if (Array.isArray(safe?.ownedItems)) rawItems = safe.ownedItems;
    else if (safe && typeof safe === 'object') {
      const arrayEntry = Object.entries(safe).find(([_key, item]) => Array.isArray(item));
      if (arrayEntry) rawItems = arrayEntry[1];
    }

    return rawItems.map((item, index) => normalizeInventoryItem(item, index));
  }

  async function callFirstAvailableAsync(obj, methodNames, args = []) {
    if (!obj) return { called: false, method: null, value: null, error: null };
    for (const methodName of methodNames) {
      if (typeof obj[methodName] !== 'function') continue;
      try {
        const value = obj[methodName](...args);
        const resolved = value && typeof value.then === 'function' ? await value : value;
        return { called: true, method: methodName, value: resolved, error: null };
      } catch (error) {
        return {
          called: true,
          method: methodName,
          value: null,
          error: { name: error?.name || 'Error', message: error?.message || String(error) }
        };
      }
    }
    return { called: false, method: null, value: null, error: null };
  }

  async function getSteamInventoryStatus() {
    const candidate = getSteamInventoryCandidate();
    const legendaryMap = readLegendaryItemDefMap();
    return {
      ok: true,
      pass: PASS_VERSION,
      appId,
      steamworksIntegrated: !!client,
      steamInventoryApiDetected: !!candidate,
      steamInventoryIntegrated: !!client && !!candidate,
      steamInventoryApiPath: candidate?.pathName || null,
      steamInventoryMethods: candidate?.methods || [],
      knownLegendaryItemDefCount: legendaryMap.size,
      realBillingArmed: false,
      status: !client
        ? 'steamworks_core_unavailable'
        : (candidate ? 'steam_inventory_api_detected_readonly' : 'steam_inventory_api_not_detected'),
      note: !client
        ? 'Steamworks core is unavailable in this run. Inventory remains read-only and purchases remain locked.'
        : (candidate
          ? 'Steam Inventory API object was detected. This pass only reads inventory data and does not grant entitlements or unlock skins.'
          : 'steamworks.js initialized, but no Steam Inventory API object was detected through the inspected API paths.')
    };
  }

  async function getOwnedItemsReadOnly(payload = {}) {
    const parsed = parsePayload(payload);
    const candidate = getSteamInventoryCandidate();
    const legendaryMap = readLegendaryItemDefMap();
    const base = {
      ok: true,
      pass: PASS_VERSION,
      appId,
      steamworksIntegrated: !!client,
      steamInventoryApiDetected: !!candidate,
      steamInventoryIntegrated: !!client && !!candidate,
      steamInventoryApiPath: candidate?.pathName || null,
      steamInventoryMethods: candidate?.methods || [],
      readOnly: true,
      grantsApplied: false,
      realBillingArmed: false,
      knownLegendaryItemDefCount: legendaryMap.size,
      requestId: parsed.requestId || null,
      ownedItems: [],
      matchedLegendaryItems: [],
      entitlementsPreview: [],
      readCall: { called: false, method: null, error: null },
      status: 'steam_inventory_readonly_not_run'
    };

    if (!client) return { ...base, ok: false, status: 'steamworks_core_unavailable' };
    if (!candidate) return { ...base, ok: false, status: 'steam_inventory_api_not_detected' };

    const readCall = await callFirstAvailableAsync(candidate.api, [
      'getAllItems', 'GetAllItems',
      'getItems', 'GetItems',
      'getInventory', 'GetInventory',
      'getOwnedItems', 'GetOwnedItems',
      'requestInventory', 'RequestInventory',
      'queryInventory', 'QueryInventory'
    ]);

    const ownedItems = normalizeInventoryResult(readCall.value);
    const matchedLegendaryItems = ownedItems
      .filter(item => item.itemdefid && legendaryMap.has(String(item.itemdefid)))
      .map(item => ({ ...item, legendary: legendaryMap.get(String(item.itemdefid)) }));

    const entitlementsPreview = matchedLegendaryItems.map(item => ({
      skinId: item.legendary.skinId,
      itemdefid: item.legendary.itemdefid,
      title: item.legendary.title,
      type: item.legendary.type,
      quantity: item.quantity
    }));

    return {
      ...base,
      ownedItems,
      matchedLegendaryItems,
      entitlementsPreview,
      readCall: {
        called: readCall.called,
        method: readCall.method,
        error: readCall.error,
        rawResultType: readCall.value === null || readCall.value === undefined ? null : typeof readCall.value
      },
      status: readCall.error
        ? 'steam_inventory_readonly_query_failed'
        : (readCall.called ? 'steam_inventory_readonly_query_complete' : 'steam_inventory_api_detected_no_read_method_found'),
      note: 'Read-only inventory detection complete. No Rosebud unlocks were granted from this report.'
    };
  }

  function initSteamInputIfPossible(inputApi) {
    if (!inputApi || steamInputInitAttempted) return { attempted: steamInputInitAttempted, method: null, ok: true, result: null, error: null, actionManifestOverride: null };
    steamInputInitAttempted = true;

    const actionManifestOverride = applyActionManifestOverride(inputApi);
    const result = callFirstAvailable(inputApi, ['init', 'Init', 'initialize', 'Initialize']);
    if (!result.called) {
      log('steam_input_init_no_method');
      return { attempted: true, method: null, ok: true, result: 'no_init_method', error: null, actionManifestOverride };
    }

    log(result.error ? 'steam_input_init_failed' : 'steam_input_init_called', {
      method: result.method,
      result: toJsonSafe(result.value),
      error: result.error
    });

    return {
      attempted: true,
      method: result.method,
      ok: !result.error,
      result: toJsonSafe(result.value),
      error: result.error,
      actionManifestOverride
    };
  }

  function getSteamInputStatus() {
    const inputCandidate = getSteamInputCandidate();
    const apiDetected = !!inputCandidate;
    const inputInit = apiDetected ? initSteamInputIfPossible(inputCandidate.api) : {
      attempted: false,
      method: null,
      ok: false,
      result: null,
      error: null
    };

    const frameCall = apiDetected
      ? callFirstAvailable(inputCandidate.api, ['runFrame', 'RunFrame', 'inputRunFrame', 'runInputFrame', 'update', 'Update'])
      : { called: false, method: null, value: null, error: null };

    const controllerCall = apiDetected
      ? callFirstAvailable(inputCandidate.api, ['getControllers', 'getConnectedControllers', 'controllers', 'getControllerHandles', 'getConnectedControllerHandles'])
      : { called: false, method: null, value: null, error: null };

    const controllers = normalizeControllers(controllerCall.value);
    const status = {
      ok: true,
      pass: PASS_VERSION,
      appId,
      actionManifest: getActionManifestStatus(),
      steamworksIntegrated: !!client,
      steamInputApiDetected: apiDetected,
      steamInputIntegrated: !!client && apiDetected,
      steamInputApiPath: inputCandidate?.pathName || null,
      steamInputMethods: inputCandidate?.methods || [],
      steamInputInit: inputInit,
      steamInputFrame: {
        called: frameCall.called,
        method: frameCall.method,
        error: frameCall.error,
        result: toJsonSafe(frameCall.value)
      },
      controllerQuery: {
        called: controllerCall.called,
        method: controllerCall.method,
        error: controllerCall.error
      },
      controllers,
      controllerCount: controllers.length,
      activeActionSet,
      status: !client
        ? 'steamworks_core_unavailable'
        : (apiDetected ? 'steam_input_native_api_detected' : 'steam_input_native_api_not_found'),
      note: apiDetected
        ? 'Steam Input API object was detected through steamworks.js. Native controller handles may remain unavailable in Electron. Stable controller play uses browser/XInput with Steam Input disabled for this app.'
        : 'steamworks.js initialized, but this build did not expose a Steam Input object through the inspected API paths.'
    };

    lastSteamInputStatus = status;
    return status;
  }

  function getLocalPlayerInfo() {
    if (!client) return null;
    const localplayer = client.localplayer || client.localPlayer || null;
    if (!localplayer) return { available: false };

    const name = safeCall(() => localplayer.getName(), null);
    const steamId = safeCall(() => localplayer.getSteamId()?.steamId64 || localplayer.getSteamId()?.toString?.() || String(localplayer.getSteamId()), null);
    const level = safeCall(() => localplayer.getLevel?.(), null);

    return { available: true, name, steamId, level };
  }

  function getCapabilities() {
    const inputCandidate = getSteamInputCandidate();
    const inputDetected = !!inputCandidate;
    const integrated = !!client;
    return {
      ok: true,
      pass: PASS_VERSION,
      runtime: 'electron',
      appId,
      actionManifest: getActionManifestStatus(),
      steamworksBridgeInstalled: true,
      steamworksIntegrated: integrated,
      steamworksSdkLoaded: !!steamworks,
      steamClientRequired: true,
      steamInputIntegrated: integrated && inputDetected,
      steamInputApiDetected: inputDetected,
      steamInputApiPath: inputCandidate?.pathName || null,
      steamInventoryIntegrated: integrated && !!getSteamInventoryCandidate(),
      steamPurchasesIntegrated: false,
      steamOverlayIntegrated: integrated,
      steamCloudIntegrated: integrated && !!(client?.cloud),
      steamAchievementsIntegrated: integrated && !!(client?.achievement),
      steamAchievementApiDetected: !!(client?.achievement),
      realBillingArmed: false,
      activeActionSet,
      supportedActionSets: Object.keys(ACTION_SET_FALLBACKS),
      localPlayer: getLocalPlayerInfo(),
      status: integrated
        ? (inputDetected ? 'steamworks_core_and_input_detected' : 'steamworks_core_detected_input_not_found')
        : 'steamworks_core_not_detected',
      initError,
      lastSteamInputStatus,
      note: integrated
        ? 'steamworks.js initialized. Steam Input detection is active. Inventory and Purchases remain intentionally locked.'
        : 'steamworks.js did not initialize. The wrapper remains in safe fallback mode.'
    };
  }

  function getStatus() {
    return { ...getCapabilities(), steamInput: getSteamInputStatus(), recentEvents: events.slice(-30), checkedAt: new Date().toISOString() };
  }

  function setActionSet(actionSet) {
    activeActionSet = normalizeActionSet(actionSet, activeActionSet);
    log('set_action_set', { activeActionSet, steamworksIntegrated: !!client });
    return {
      ok: true,
      status: client ? 'action_set_recorded_steamworks_core_ready' : 'action_set_recorded_fallback',
      actionSet: activeActionSet,
      steamworksIntegrated: !!client,
      steamInputIntegrated: !!getSteamInputCandidate()
    };
  }

  function getPromptForAction(payload) {
    const parsed = parsePayload(payload);
    const inputDetected = !!getSteamInputCandidate();
    const prompt = createPrompt(parsed.actionSet || activeActionSet, parsed.action || parsed.actionName, parsed.label || '');
    return {
      ...prompt,
      source: inputDetected ? 'steam_input_native_detected_fallback_prompt' : (client ? 'steamworks_core_ready_fallback_prompt' : prompt.source),
      pass: PASS_VERSION,
      steamworksIntegrated: !!client,
      steamInputIntegrated: inputDetected,
      note: inputDetected
        ? 'Steam Input native API is detected. Real Steam glyph lookup is reserved for the next glyph pass.'
        : (client ? 'Steamworks core is detected. Raw browser/XInput controller fallback remains available in renderer when Steam Input is disabled.' : prompt.note)
    };
  }

  function getGlyphForAction(actionSetOrPayload, actionName = '') {
    const parsed = typeof actionSetOrPayload === 'object' || (typeof actionSetOrPayload === 'string' && actionSetOrPayload.trim().startsWith('{'))
      ? parsePayload(actionSetOrPayload)
      : { actionSet: actionSetOrPayload, action: actionName };
    return getPromptForAction(parsed);
  }

  function getConnectedControllers() {
    const inputStatus = getSteamInputStatus();
    return {
      ok: true,
      status: inputStatus.steamInputApiDetected ? 'steam_input_native_controller_query_complete' : 'steam_input_fallback_no_native_api',
      steamworksIntegrated: !!client,
      steamInputIntegrated: inputStatus.steamInputIntegrated,
      steamInputApiDetected: inputStatus.steamInputApiDetected,
      steamInputApiPath: inputStatus.steamInputApiPath,
      query: inputStatus.controllerQuery,
      controllers: inputStatus.controllers,
      count: inputStatus.controllerCount,
      note: inputStatus.note
    };
  }

  function showBindingPanel() {
    const inputCandidate = getSteamInputCandidate();
    log('show_binding_panel_requested', { steamworksIntegrated: !!client, steamInputApiDetected: !!inputCandidate });

    // Detection only. Do not open Steam overlay/configurator until the explicit binding-panel pass.
    return {
      ok: false,
      status: 'steam_input_binding_panel_locked_until_binding_pass',
      reason: 'Steam Input API detection is active, but opening the binding panel is reserved for a later pass.',
      steamworksIntegrated: !!client,
      steamInputIntegrated: !!inputCandidate
    };
  }

  async function getOwnedItems() {
    return getOwnedItemsReadOnly({ source: 'getOwnedItems' });
  }

  async function syncInventory(payload = {}) {
    const parsed = parsePayload(payload);
    log('sync_inventory_readonly_requested', { steamworksIntegrated: !!client, requestId: parsed.requestId || null });
    const report = await getOwnedItemsReadOnly({ ...parsed, source: 'syncInventory' });
    return { ...report, status: report.status === 'steam_inventory_readonly_query_complete' ? 'steam_inventory_readonly_sync_complete' : report.status };
  }



  function getSteamCloudReadinessReport() {
    const cloudApi = client?.cloud || null;
    const cloudMethods = cloudApi ? getFunctionNames(cloudApi) : [];
    const fileListCall = cloudApi && typeof cloudApi.listFiles === 'function'
      ? safeCall(() => cloudApi.listFiles(), null)
      : null;

    const accountEnabled = cloudApi && typeof cloudApi.isEnabledForAccount === 'function'
      ? safeCall(() => !!cloudApi.isEnabledForAccount(), null)
      : null;
    const appEnabled = cloudApi && typeof cloudApi.isEnabledForApp === 'function'
      ? safeCall(() => !!cloudApi.isEnabledForApp(), null)
      : null;

    const files = Array.isArray(fileListCall)
      ? fileListCall.map((item, index) => toJsonSafe({ index, ...((typeof item === 'object' && item) ? item : { name: String(item) }) }))
      : [];

    return {
      ok: true,
      pass: PASS_VERSION,
      appId,
      steamworksIntegrated: !!client,
      steamCloudApiDetected: !!cloudApi,
      steamCloudIntegrated: !!client && !!cloudApi,
      accountCloudEnabled: accountEnabled,
      appCloudEnabled: appEnabled,
      cloudMethods,
      cloudFileCount: files.length,
      filesPreview: files.slice(0, 12),
      readWriteArmed: false,
      status: !client
        ? 'steamworks_core_unavailable'
        : (!cloudApi
          ? 'steam_cloud_api_not_detected'
          : 'steam_cloud_readiness_detected_readonly'),
      note: 'Read-only Steam Cloud readiness check. This pass does not sync, overwrite, or upload save data.'
    };
  }


  function getSteamCloudSyncGuardReport() {
    const readiness = getSteamCloudReadinessReport();
    return {
      ok: true,
      pass: PASS_VERSION,
      appId,
      steamworksIntegrated: !!client,
      steamCloudIntegrated: !!readiness.steamCloudIntegrated,
      accountCloudEnabled: readiness.accountCloudEnabled,
      appCloudEnabled: readiness.appCloudEnabled,
      readWriteArmed: false,
      syncArmed: false,
      cloudSaveFileName: 'chiggas_save_snapshot_v1.json',
      cloudFileCount: readiness.cloudFileCount,
      status: readiness.steamCloudIntegrated
        ? 'steam_cloud_sync_guard_ready_locked'
        : 'steam_cloud_sync_guard_unavailable',
      note: 'Steam Cloud API is detectable, but save upload/download remains locked until the explicit save-sync pass.'
    };
  }

  function lockedSteamCloudOperation(operation, payload = {}) {
    const parsed = parsePayload(payload);
    const report = getSteamCloudSyncGuardReport();
    log('steam_cloud_operation_blocked', { operation, requestId: parsed.requestId || null });
    return {
      ok: false,
      pass: PASS_VERSION,
      status: 'steam_cloud_sync_locked',
      operation,
      readWriteArmed: false,
      syncArmed: false,
      requestId: parsed.requestId || null,
      reason: 'Steam Cloud save read/write is intentionally locked until the explicit cloud save sync implementation pass.',
      report
    };
  }


  function readSteamAchievementMap() {
    const mapPath = path.join(baseDir, 'steam_achievements', 'achievements_map_v1.json');
    try {
      const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      const achievements = Array.isArray(map.achievements) ? map.achievements : [];
      return { ok: true, mapPath, map, achievements };
    } catch (error) {
      return { ok: false, mapPath, map: null, achievements: [], error: error.message };
    }
  }

  function areSteamAchievementsArmed() {
    return STEAM_ACHIEVEMENTS_ARMED === true;
  }

  function activateSteamAchievementById(achievementId, source = 'direct') {
    const readiness = getSteamAchievementsReadinessReport();
    const achievementApi = client?.achievement || null;
    const id = String(achievementId || '').trim();

    if (!areSteamAchievementsArmed()) {
      return {
        ok: false,
        pass: PASS_VERSION,
        status: 'steam_achievements_locked',
        achievementId: id || null,
        achievementsArmed: areSteamAchievementsArmed(),
        source,
        reason: 'Steam achievement writes are still locked. Set CHIGGAS_STEAM_ACHIEVEMENTS_ARMED=true only for the explicit arming pass.',
        readiness
      };
    }

    if (!id) {
      return { ok: false, pass: PASS_VERSION, status: 'steam_achievement_missing_id', achievementId: null, achievementsArmed: true, source, readiness };
    }

    if (!achievementApi || typeof achievementApi.activate !== 'function') {
      return { ok: false, pass: PASS_VERSION, status: 'steam_achievement_api_not_available', achievementId: id, achievementsArmed: true, source, readiness };
    }

    try {
      const result = achievementApi.activate(id);
      let statsStored = null;
      let statsStoreError = null;
      try {
        if (client?.stats && typeof client.stats.store === 'function') {
          statsStored = client.stats.store();
        }
      } catch (storeErr) {
        statsStoreError = storeErr && storeErr.message ? storeErr.message : String(storeErr);
      }
      log('steam_achievement_activated', { achievementId: id, source, result, statsStored, statsStoreError });
      return {
        ok: true,
        pass: PASS_VERSION,
        status: 'steam_achievement_activated',
        achievementId: id,
        achievementsArmed: true,
        source,
        result,
        statsStored,
        statsStoreError,
        readiness: getSteamAchievementsReadinessReport()
      };
    } catch (err) {
      const error = err && err.message ? err.message : String(err);
      log('steam_achievement_activation_failed', { achievementId: id, source, error });
      return { ok: false, pass: PASS_VERSION, status: 'steam_achievement_activation_failed', achievementId: id, achievementsArmed: true, source, error, readiness };
    }
  }

  function normalizeAchievementEventName(value) {
    return String(value || '')
      .trim()
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }

  function getAchievementEventAliasMap() {
    return {
      FIRST_RUN: 'FIRST_RUN',
      RUN_STARTED: 'FIRST_RUN',
      GAME_STARTED: 'FIRST_RUN',
      START_GAME: 'FIRST_RUN',
      FIRST_RECRUIT: 'FIRST_RECRUIT',
      RECRUIT: 'FIRST_RECRUIT',
      RECRUITED: 'FIRST_RECRUIT',
      SOLDIER_RECRUITED: 'FIRST_RECRUIT',
      FIRST_TURF: 'FIRST_TURF',
      TURF_CLAIMED: 'FIRST_TURF',
      TURF_CAPTURED: 'FIRST_TURF',
      CLAIM_TURF: 'FIRST_TURF',
      FIRST_BOSS: 'FIRST_BOSS',
      BOSS_DEFEATED: 'FIRST_BOSS',
      DEFEAT_BOSS: 'FIRST_BOSS',
      FIRST_LEGENDARY_UNLOCK: 'FIRST_LEGENDARY_UNLOCK',
      LEGENDARY_UNLOCKED: 'FIRST_LEGENDARY_UNLOCK',
      LEGENDARY_SKIN_UNLOCKED: 'FIRST_LEGENDARY_UNLOCK',
      SURVIVE_STAGE_5: 'SURVIVE_STAGE_5',
      STAGE_5: 'SURVIVE_STAGE_5',
      STAGE_FIVE: 'SURVIVE_STAGE_5',
      CLEARED_STAGE_5: 'SURVIVE_STAGE_5',
      SURVIVE_STAGE_10: 'SURVIVE_STAGE_10',
      STAGE_10: 'SURVIVE_STAGE_10',
      STAGE_TEN: 'SURVIVE_STAGE_10',
      CLEARED_STAGE_10: 'SURVIVE_STAGE_10'
    };
  }

  function resolveSteamAchievementEvent(payload = {}) {
    const parsed = parsePayload(payload);
    const mapResult = readSteamAchievementMap();
    const achievements = mapResult.achievements || [];
    const knownIds = new Set(achievements.map(item => String(item.id || '').trim()).filter(Boolean));
    const aliasMap = getAchievementEventAliasMap();
    const raw = parsed.achievementId || parsed.id || parsed.event || parsed.eventName || parsed.trigger || '';
    const normalized = normalizeAchievementEventName(raw);
    const achievementId = knownIds.has(normalized) ? normalized : (aliasMap[normalized] || null);
    const achievement = achievementId ? achievements.find(item => item.id === achievementId) || null : null;

    return {
      ok: !!achievement,
      pass: PASS_VERSION,
      status: achievement ? 'steam_achievement_event_resolved_locked' : 'steam_achievement_event_unknown',
      input: raw,
      normalized,
      achievementId,
      achievement,
      achievementsArmed: areSteamAchievementsArmed(),
      mapLoaded: !!mapResult.ok,
      mapPath: mapResult.mapPath,
      reason: achievement
        ? 'Achievement event resolves to a mapped API name. Unlock remains locked until explicit arming.'
        : 'Achievement event does not match a mapped achievement ID or supported alias.'
    };
  }

  function getSteamAchievementEventBridgeReport() {
    const readiness = getSteamAchievementsReadinessReport();
    const mapResult = readSteamAchievementMap();
    const sampleEvents = ['FIRST_RUN', 'RECRUIT', 'TURF_CLAIMED', 'BOSS_DEFEATED', 'LEGENDARY_UNLOCKED', 'STAGE_5', 'STAGE_10'];
    const sampleResolutions = sampleEvents.map(event => resolveSteamAchievementEvent({ event }));
    const unresolvedSamples = sampleResolutions.filter(item => !item.ok).map(item => item.input);

    return {
      ok: !!readiness.achievementApiDetected && !!mapResult.ok && unresolvedSamples.length === 0,
      pass: PASS_VERSION,
      appId,
      status: 'steam_achievement_event_bridge_ready_locked',
      steamworksIntegrated: !!client,
      achievementApiDetected: !!readiness.achievementApiDetected,
      achievementsArmed: areSteamAchievementsArmed(),
      mapLoaded: !!mapResult.ok,
      mapPath: mapResult.mapPath,
      achievementCount: mapResult.achievements.length,
      supportedAliases: Object.keys(getAchievementEventAliasMap()).length,
      sampleResolutions: sampleResolutions.map(item => ({ input: item.input, achievementId: item.achievementId, ok: item.ok })),
      unresolvedSamples,
      storeShouldShow: 'TEST BUY',
      note: 'Achievement event bridge can resolve game events to Steam achievement IDs, but unlocks remain locked.'
    };
  }

  function recordSteamAchievementEvent(payload = {}) {
    const parsed = parsePayload(payload);
    const resolution = resolveSteamAchievementEvent(parsed);
    const eventName = parsed.event || parsed.eventName || parsed.achievementId || parsed.id || null;

    log(areSteamAchievementsArmed() ? 'steam_achievement_event_received_armed' : 'steam_achievement_event_received_locked', {
      event: eventName,
      achievementId: resolution.achievementId,
      resolved: !!resolution.ok
    });

    if (!resolution.ok) {
      return {
        ok: false,
        pass: PASS_VERSION,
        status: 'steam_achievement_event_rejected_unknown',
        event: eventName,
        achievementId: null,
        resolved: false,
        achievementsArmed: areSteamAchievementsArmed(),
        reason: 'Unknown achievement event. No unlock attempted.',
        resolution,
        readiness: getSteamAchievementsReadinessReport()
      };
    }

    if (!areSteamAchievementsArmed()) {
      return {
        ok: false,
        pass: PASS_VERSION,
        status: 'steam_achievement_event_resolved_but_unlock_locked',
        event: eventName,
        achievementId: resolution.achievementId,
        resolved: true,
        achievementsArmed: false,
        reason: 'Steam achievement event bridge is ready, but unlocks remain intentionally locked.',
        resolution,
        readiness: getSteamAchievementsReadinessReport()
      };
    }

    const activation = activateSteamAchievementById(resolution.achievementId, 'rosebud_event');
    return {
      ok: !!activation.ok,
      pass: PASS_VERSION,
      status: activation.ok ? 'steam_achievement_event_unlocked' : 'steam_achievement_event_unlock_failed',
      event: eventName,
      achievementId: resolution.achievementId,
      resolved: true,
      achievementsArmed: true,
      activation,
      resolution,
      readiness: getSteamAchievementsReadinessReport()
    };
  }

  function getSteamAchievementsReadinessReport() {
    const achievementApi = client?.achievement || null;
    const achievementMethods = achievementApi ? getFunctionNames(achievementApi) : [];
    const activateDetected = typeof achievementApi?.activate === 'function';
    const clearDetected = typeof achievementApi?.clear === 'function';
    const isActivatedDetected = typeof achievementApi?.isActivated === 'function';

    return {
      ok: true,
      pass: PASS_VERSION,
      appId,
      status: achievementApi
        ? 'steam_achievements_readiness_detected_locked'
        : 'steam_achievements_api_not_detected',
      steamworksIntegrated: !!client,
      steamAchievementsIntegrated: !!client && !!achievementApi,
      achievementApiDetected: !!achievementApi,
      activateDetected,
      clearDetected,
      isActivatedDetected,
      achievementMethods,
      achievementsArmed: areSteamAchievementsArmed(),
      readOnlyCheck: true,
      plannedAchievementIds: [
        'FIRST_RUN',
        'FIRST_RECRUIT',
        'FIRST_TURF',
        'FIRST_BOSS',
        'FIRST_LEGENDARY_UNLOCK',
        'SURVIVE_STAGE_5',
        'SURVIVE_STAGE_10'
      ],
      note: achievementApi
        ? 'Steam achievement API is detectable. Unlock/clear operations remain locked until achievement IDs are created in Steamworks and mapped intentionally.'
        : 'Steamworks core loaded, but steamworks.js did not expose achievement API through client.achievement.'
    };
  }


  function getSteamAchievementLiveApiNameReport() {
    const readiness = getSteamAchievementsReadinessReport();
    const mapResult = readSteamAchievementMap();
    const achievementApi = client?.achievement || null;
    const isActivatedAvailable = typeof achievementApi?.isActivated === 'function';
    const achievements = mapResult.achievements || [];

    const results = achievements.map(item => {
      const id = String(item.id || '').trim();
      const title = item.title || item.name || id;
      let queryOk = false;
      let isActivated = null;
      let error = null;

      if (!id) {
        error = 'missing_achievement_id';
      } else if (!isActivatedAvailable) {
        error = 'achievement_isActivated_not_available';
      } else {
        try {
          isActivated = !!achievementApi.isActivated(id);
          queryOk = true;
        } catch (err) {
          error = err && err.message ? err.message : String(err);
        }
      }

      return {
        id,
        title,
        queryOk,
        isActivated,
        error
      };
    });

    const failed = results.filter(item => !item.queryOk);
    const queryOkCount = results.filter(item => item.queryOk).length;

    return {
      ok: !!client && !!readiness.achievementApiDetected && !!mapResult.ok && failed.length === 0,
      pass: PASS_VERSION,
      appId,
      status: failed.length === 0
        ? 'steam_achievement_live_api_names_query_ok_locked'
        : 'steam_achievement_live_api_names_need_steamworks_setup',
      steamworksIntegrated: !!client,
      achievementApiDetected: !!readiness.achievementApiDetected,
      isActivatedAvailable,
      mapLoaded: !!mapResult.ok,
      mapPath: mapResult.mapPath,
      achievementsArmed: areSteamAchievementsArmed(),
      achievementCount: achievements.length,
      queryOkCount,
      failedCount: failed.length,
      failedIds: failed.map(item => item.id),
      results,
      storeShouldShow: 'TEST BUY',
      note: failed.length === 0
        ? 'All mapped achievement API names can be queried through Steam. Unlocks remain locked until the arming pass.'
        : 'Some mapped achievement API names could not be queried. Create/fix those exact API names in Steamworks before arming unlocks.'
    };
  }

  function lockedSteamAchievementOperation(operation, payload = {}) {
    const parsed = parsePayload(payload);
    const id = parsed.achievementId || parsed.id || parsed.event || parsed.eventName || null;

    if (areSteamAchievementsArmed() && (operation === 'unlockAchievement' || operation === 'activateAchievement')) {
      const resolution = resolveSteamAchievementEvent({ achievementId: id });
      const achievementId = resolution.ok ? resolution.achievementId : id;
      return activateSteamAchievementById(achievementId, operation);
    }

    const report = getSteamAchievementsReadinessReport();
    log('steam_achievement_operation_blocked', { operation, achievementId: id });
    return {
      ok: false,
      pass: PASS_VERSION,
      status: 'steam_achievements_locked',
      operation,
      achievementId: id,
      achievementsArmed: areSteamAchievementsArmed(),
      reason: 'Steam achievement unlock/clear is intentionally locked until the explicit arming pass.',
      report
    };
  }

  function getSteamAchievementArmingGuardReport() {
    const readiness = getSteamAchievementsReadinessReport();
    const live = getSteamAchievementLiveApiNameReport();
    const eventBridge = getSteamAchievementEventBridgeReport();
    const armed = areSteamAchievementsArmed();

    return {
      ok: !!readiness.steamAchievementsIntegrated && !!live.ok && !!eventBridge.ok,
      pass: PASS_VERSION,
      appId,
      status: armed ? 'steam_achievement_arming_enabled' : 'steam_achievement_arming_ready_locked',
      achievementsArmed: armed,
      requiredEnv: 'CHIGGAS_STEAM_ACHIEVEMENTS_ARMED=true',
      steamAchievementsIntegrated: !!readiness.steamAchievementsIntegrated,
      achievementApiDetected: !!readiness.achievementApiDetected,
      liveApiNamesOk: !!live.ok,
      eventBridgeReady: !!eventBridge.ok,
      achievementCount: live.achievementCount || 0,
      storeShouldShow: 'TEST BUY',
      warning: armed
        ? 'Achievement writes are enabled. This can permanently unlock achievements for the current Steam account.'
        : 'Achievement writes are still locked. This is the expected safe state before the explicit arming pass.',
      next: armed
        ? 'Run controlled gameplay tests for FIRST_RUN and FIRST_RECRUIT only.'
        : 'Keep locked until you intentionally run the achievement arming pass.'
    };
  }

  function getSteamMicrotxnReadinessReport() {
    const overlayApi = client?.overlay || null;
    const callbackApi = client?.callback || null;
    const steamCallbackEnum = callbackApi?.SteamCallback || null;
    const inventoryCandidate = getSteamInventoryCandidate();
    const localPlayer = getLocalPlayerInfo();

    const overlayMethods = overlayApi ? getFunctionNames(overlayApi) : [];
    const callbackMethods = callbackApi ? getFunctionNames(callbackApi) : [];
    const steamCallbackProperties = steamCallbackEnum && typeof steamCallbackEnum === 'object'
      ? Object.getOwnPropertyNames(steamCallbackEnum).sort()
      : [];

    const activateToStoreDetected = typeof overlayApi?.activateToStore === 'function';
    const addToCartFlagDetected = !!(overlayApi?.StoreFlag && Object.prototype.hasOwnProperty.call(overlayApi.StoreFlag, 'AddToCart'));
    const microTxnCallbackDetected = !!(steamCallbackEnum && Object.prototype.hasOwnProperty.call(steamCallbackEnum, 'MicroTxnAuthorizationResponse'));

    return {
      ok: true,
      pass: PASS_VERSION,
      appId,
      status: 'steam_microtxn_backend_required_keep_test_buy',
      steamworksIntegrated: !!client,
      steamOverlayIntegrated: !!overlayApi,
      activateToStoreDetected,
      addToCartFlagDetected,
      steamCallbackIntegrated: !!callbackApi,
      microTxnAuthorizationCallbackDetected: microTxnCallbackDetected,
      steamInventoryViaSteamworksJs: !!inventoryCandidate,
      inventoryApiPath: inventoryCandidate?.pathName || null,
      localPlayerAvailable: !!localPlayer?.available,
      localPlayer,
      realBillingArmed: false,
      storeShouldShow: 'TEST BUY',
      overlayMethods,
      callbackMethods,
      steamCallbackProperties,
      selectedStrategy: 'do_not_grant_paid_steam_entitlements_until_backend_or_native_inventory_bridge_exists',
      recommendedNextImplementation: 'secure_backend_microtransaction_flow_or_native_steam_inventory_bridge',
      notes: [
        'Steamworks core is available, but steamworks.js does not expose a reliable Steam Inventory ownership API in this wrapper.',
        'MicroTxnAuthorizationResponse callback metadata is useful only after a secure backend starts Steam microtransactions.',
        'Do not initiate or grant paid Legendary entitlements from the client alone.',
        'Keep Legendary Store on TEST BUY until a backend/native inventory bridge validates ownership.'
      ]
    };
  }

  function openSteamStorePage(payload = {}) {
    const parsed = parsePayload(payload);
    const report = getSteamMicrotxnReadinessReport();
    const allowStorePageOpen = parsed.allowStorePageOpen === true || parsed.allow === true;
    const targetAppId = Number.parseInt(parsed.appId || appId, 10) || appId;

    if (!client || !client.overlay || typeof client.overlay.activateToStore !== 'function') {
      return {
        ok: false,
        status: 'steam_overlay_store_open_unavailable',
        realBillingArmed: false,
        storeShouldShow: 'TEST BUY',
        report
      };
    }

    if (!allowStorePageOpen) {
      return {
        ok: false,
        status: 'steam_overlay_store_open_locked_diagnostic_only',
        realBillingArmed: false,
        storeShouldShow: 'TEST BUY',
        reason: 'Pass 14 only validates readiness. It does not open purchase UI unless allowStorePageOpen is explicitly true.',
        report
      };
    }

    try {
      const flag = client.overlay.StoreFlag?.None ?? 0;
      client.overlay.activateToStore(targetAppId, flag);
      log('steam_overlay_store_page_opened', { appId: targetAppId, flag, sourceAppId: appId });
      return {
        ok: true,
        status: 'steam_overlay_store_page_opened',
        appId: targetAppId,
        realBillingArmed: false,
        storeShouldShow: 'TEST BUY',
        report
      };
    } catch (error) {
      return {
        ok: false,
        status: 'steam_overlay_store_page_open_failed',
        error: { name: error?.name || 'Error', message: error?.message || String(error) },
        realBillingArmed: false,
        storeShouldShow: 'TEST BUY',
        report
      };
    }
  }

  function purchaseProduct(payload = {}) {
    const parsed = parsePayload(payload);
    log('purchase_product_requested_locked', {
      productId: parsed.productId || parsed.steamProductId || null,
      skinId: parsed.skinId || null,
      steamworksIntegrated: !!client
    });
    return {
      ok: false,
      status: 'steam_purchases_locked_until_inventory_store_pass',
      billingLocked: true,
      steamworksIntegrated: !!client,
      steamPurchasesIntegrated: false,
      requestId: parsed.requestId || null,
      productId: parsed.productId || parsed.steamProductId || null,
      skinId: parsed.skinId || null
    };
  }

  function restorePurchases(payload = {}) {
    const parsed = parsePayload(payload);
    log('restore_purchases_requested_locked', { requestId: parsed.requestId || null, steamworksIntegrated: !!client });
    return {
      ok: false,
      status: 'steam_restore_locked_until_inventory_pass',
      billingLocked: true,
      steamworksIntegrated: !!client,
      steamPurchasesIntegrated: false,
      requestId: parsed.requestId || null,
      restoredSkins: [],
      count: 0
    };
  }


  function getActionState(payload = {}) {
    const parsed = parsePayload(payload);
    const requestedSet = normalizeActionSet(parsed.actionSet || activeActionSet, activeActionSet);
    const inputCandidate = getSteamInputCandidate();
    const inputApi = inputCandidate?.api || null;
    const actions = ACTIONS_BY_SET[requestedSet] || ACTIONS_BY_SET.gameplay;

    const base = {
      ok: true,
      pass: PASS_VERSION,
      appId,
      actionSet: requestedSet,
      steamworksIntegrated: !!client,
      steamInputApiDetected: !!inputCandidate,
      steamInputIntegrated: !!client && !!inputCandidate,
      controllerCount: 0,
      connected: false,
      axes: {},
      buttons: {},
      controller: null,
      errors: [],
      status: 'steam_input_no_controller_state'
    };

    if (!client || !inputApi) return base;

    initSteamInputIfPossible(inputApi);
    callFirstAvailable(inputApi, ['runFrame', 'RunFrame', 'inputRunFrame', 'runInputFrame', 'update', 'Update']);

    const controllerCall = callFirstAvailable(inputApi, ['getControllers', 'getConnectedControllers', 'controllers', 'getControllerHandles', 'getConnectedControllerHandles']);
    const rawControllers = controllerCall.value;
    const controllerList = Array.isArray(rawControllers)
      ? rawControllers
      : (rawControllers && typeof rawControllers[Symbol.iterator] === 'function' ? Array.from(rawControllers) : (rawControllers ? [rawControllers] : []));
    const controllers = controllerList.filter(Boolean);
    base.controllerCount = controllers.length;
    base.connected = controllers.length > 0;

    if (controllerCall.error) base.errors.push({ source: 'getControllers', error: controllerCall.error });
    if (controllers.length === 0) {
      base.status = 'steam_input_api_detected_no_controllers';
      return base;
    }

    const controller = controllers[0];
    base.controller = toJsonSafe({
      handle: safeCall(() => controller.getHandle?.(), null),
      type: safeCall(() => controller.getType?.(), null)
    });

    const actionSetCall = callFirstAvailable(inputApi, ['getActionSet', 'GetActionSet'], [requestedSet]);
    const actionSetHandle = actionSetCall.value;
    if (actionSetCall.error) base.errors.push({ source: 'getActionSet', error: actionSetCall.error });

    try {
      if (actionSetHandle !== null && actionSetHandle !== undefined && typeof controller.activateActionSet === 'function') {
        controller.activateActionSet(actionSetHandle);
      }
    } catch (error) {
      base.errors.push({ source: 'activateActionSet', error: error?.message || String(error) });
    }

    for (const actionName of actions.analog || []) {
      const handleCall = callFirstAvailable(inputApi, ['getAnalogAction', 'GetAnalogAction'], [actionName]);
      if (handleCall.error) base.errors.push({ source: `getAnalogAction.${actionName}`, error: handleCall.error });
      base.axes[actionName] = getAnalogVectorSafe(controller, handleCall.value);
    }

    for (const actionName of actions.digital || []) {
      const handleCall = callFirstAvailable(inputApi, ['getDigitalAction', 'GetDigitalAction'], [actionName]);
      if (handleCall.error) base.errors.push({ source: `getDigitalAction.${actionName}`, error: handleCall.error });
      base.buttons[actionName] = getDigitalPressedSafe(controller, handleCall.value).pressed;
    }

    base.status = 'steam_input_action_state_polled';
    return base;
  }

  function getControllerEnvironmentReport() {
    const steamInput = getSteamInputStatus();
    const steamEnv = {};
    for (const [key, value] of Object.entries(process.env || {})) {
      if (/steam/i.test(key)) {
        steamEnv[key] = typeof value === 'string' ? value.slice(0, 180) : String(value);
      }
    }

    const steamLaunchSignals = [
      'SteamAppId', 'SteamGameId', 'SteamOverlayGameId', 'SteamClientLaunch',
      'STEAM_APP_ID', 'STEAM_GAME_ID', 'STEAM_COMPAT_CLIENT_INSTALL_PATH'
    ].filter(key => process.env[key]);

    const likelyLaunchedThroughSteam = steamLaunchSignals.length > 0;
    const controllerCount = Number(steamInput?.controllerCount || 0);
    const steamInputReady = !!steamInput?.steamInputIntegrated;

    let nextAction = 'unknown';
    if (!client) {
      nextAction = 'steamworks_core_not_initialized';
    } else if (!steamInputReady) {
      nextAction = 'steam_input_api_not_available_in_steamworks_js';
    } else if (controllerCount > 0) {
      nextAction = 'native_controller_handles_detected_continue_to_action_mapping';
    } else if (!likelyLaunchedThroughSteam) {
      nextAction = 'launch_wrapper_through_steam_before_more_code_changes';
    } else {
      nextAction = 'native_steam_input_handles_unavailable_use_raw_browser_gamepad_with_steam_input_disabled';
    }

    return {
      ok: true,
      pass: PASS_VERSION,
      appId,
      actionManifest: getActionManifestStatus(),
      cwd: process.cwd(),
      argv: process.argv.slice(0, 6),
      steamworksIntegrated: !!client,
      steamInputIntegrated: steamInputReady,
      steamInputApiDetected: !!steamInput?.steamInputApiDetected,
      nativeControllerCount: controllerCount,
      likelyLaunchedThroughSteam,
      steamLaunchSignals,
      steamEnv,
      steamInput,
      diagnosis: nextAction,
      instruction: controllerCount > 0
        ? 'Native Steam controller handles are visible. Steam Input action polling may be used.'
        : 'Native Steam Input handles are not available through this Electron/steamworks.js path. Use the stable raw browser/XInput gamepad path by disabling Steam Input for this app.'
    };
  }

  function getDebugReport() {
    return {
      ok: true,
      status: client ? 'steamworks_core_detection_validated' : 'steamworks_core_detection_failed_or_unavailable',
      capabilities: getCapabilities(),
      steamInput: getSteamInputStatus(),
      controllerEnvironment: getControllerEnvironmentReport(),
      activeActionSet,
      prompts: {
        recruit: getPromptForAction({ actionSet: 'gameplay', action: 'recruit' }),
        eat: getPromptForAction({ actionSet: 'gameplay', action: 'eat' }),
        charge: getPromptForAction({ actionSet: 'gameplay', action: 'charge' }),
        shoot: getPromptForAction({ actionSet: 'gameplay', action: 'shoot' })
      },
      inventory: { status: 'use_getOwnedItems_or_syncInventory_for_async_readonly_inventory_report', steamInventoryIntegrated: !!getSteamInventoryCandidate() },
      monetization: getSteamMicrotxnReadinessReport(),
      cloud: getSteamCloudReadinessReport(),
      cloudSyncGuard: getSteamCloudSyncGuardReport(),
      achievements: getSteamAchievementsReadinessReport(),
      achievementEventBridge: getSteamAchievementEventBridgeReport(),
      achievementLiveApiNames: getSteamAchievementLiveApiNameReport(),
      achievementArmingGuard: getSteamAchievementArmingGuardReport(),
      recentEvents: events.slice(-30),
      checkedAt: new Date().toISOString()
    };
  }

  return {
    PASS_VERSION,
    getCapabilities,
    getStatus,
    getDebugReport,
    getSteamInputStatus,
    getSteamInventoryStatus,
    detectSteamInput: getSteamInputStatus,
    getActionManifestStatus,
    setActionSet,
    getPromptForAction,
    getGlyphForAction,
    getConnectedControllers,
    getActionState,
    getControllerEnvironmentReport,
    showBindingPanel,
    getOwnedItems,
    getInventoryStatus: getSteamInventoryStatus,
    syncInventory,
    restoreInventory: syncInventory,
    getSteamAchievementsReadinessReport,
    getAchievementsReadiness: getSteamAchievementsReadinessReport,
    getSteamAchievementEventBridgeReport,
    getSteamAchievementLiveApiNameReport,
    getSteamAchievementArmingGuardReport,
    getAchievementArmingGuardReport: getSteamAchievementArmingGuardReport,
    getAchievementLiveApiNameReport: getSteamAchievementLiveApiNameReport,
    getAchievementEventBridgeReport: getSteamAchievementEventBridgeReport,
    resolveSteamAchievementEvent,
    resolveAchievementEvent: resolveSteamAchievementEvent,
    recordSteamAchievementEvent,
    recordAchievementEvent: recordSteamAchievementEvent,
    reportAchievementEvent: recordSteamAchievementEvent,
    unlockAchievement: (payload) => lockedSteamAchievementOperation('unlockAchievement', payload),
    activateAchievement: (payload) => lockedSteamAchievementOperation('activateAchievement', payload),
    clearAchievement: (payload) => lockedSteamAchievementOperation('clearAchievement', payload),
    getSteamMicrotxnReadinessReport,
    getMonetizationReadiness: getSteamMicrotxnReadinessReport,
    getSteamCloudReadinessReport,
    getCloudReadiness: getSteamCloudReadinessReport,
    getSteamCloudSyncGuardReport,
    getCloudSyncGuard: getSteamCloudSyncGuardReport,
    writeCloudSave: (payload) => lockedSteamCloudOperation('writeCloudSave', payload),
    readCloudSave: (payload) => lockedSteamCloudOperation('readCloudSave', payload),
    syncCloudSave: (payload) => lockedSteamCloudOperation('syncCloudSave', payload),
    openSteamStorePage,
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
  readSteamAppId,
  createSteamworksBridgeCore
};
