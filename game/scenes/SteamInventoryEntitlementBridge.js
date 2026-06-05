import {
    getLegendaryPurchaseCatalog,
    grantPremiumSkinEntitlement,
    isSkinPurchased
} from './SkinRegistry.js';

export const STEAM_INVENTORY_ENTITLEMENT_BRIDGE_VERSION = 'steam_inventory_bridge_pass_83';

const TRACE_KEY = 'chiggas_steam_inventory_entitlement_bridge_pass_83_trace';

function getWindowSafe() {
    try {
        if (typeof window !== 'undefined') return window;
    } catch (_) {}
    return null;
}

function normalizeItemDefId(value) {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeQuantity(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.max(0, Math.trunc(n));
}

function getSteamInventoryBridge() {
    const win = getWindowSafe();
    if (!win) return null;
    return win.ChiggasSteamBackend || win.ChiggasSteamInventory || win.ChiggasSteam || win.Steamworks || win.steamworks || null;
}

function makeCatalogMaps() {
    const byItemDef = new Map();
    const bySkinId = new Map();

    try {
        getLegendaryPurchaseCatalog().forEach(entity => {
            const itemdefid = normalizeItemDefId(entity?.steamItemDefId);
            if (itemdefid !== null) byItemDef.set(String(itemdefid), entity);
            if (entity?.skinId) bySkinId.set(String(entity.skinId), entity);
        });
    } catch (_) {}

    return { byItemDef, bySkinId };
}

function extractOwnedItems(rawResult) {
    const safe = rawResult || {};
    const candidates = [];

    if (Array.isArray(safe.ownedItems)) candidates.push(...safe.ownedItems);
    if (Array.isArray(safe.ownedItemDefIds)) {
        safe.ownedItemDefIds.forEach(itemdefid => candidates.push({ itemdefid, quantity: 1, source: 'backend_ownedItemDefIds' }));
    }
    if (Array.isArray(safe.items)) candidates.push(...safe.items);
    if (Array.isArray(safe.inventory)) candidates.push(...safe.inventory);
    if (Array.isArray(safe.results)) candidates.push(...safe.results);

    if (Array.isArray(safe.matchedLegendaryItems)) {
        safe.matchedLegendaryItems.forEach(item => {
            if (item?.itemdefid || item?.itemDefId || item?.definitionId || item?.legendary?.itemdefid) {
                candidates.push(item);
            }
        });
    }

    if (Array.isArray(safe.entitlementsPreview)) {
        safe.entitlementsPreview.forEach(item => {
            if (item?.itemdefid || item?.steamItemDefId || item?.skinId) {
                candidates.push(item);
            }
        });
    }

    return candidates.map((item, index) => {
        const legendary = item?.legendary || {};
        const itemdefid = normalizeItemDefId(
            item?.itemdefid ??
            item?.itemDefId ??
            item?.steamItemDefId ??
            item?.definitionId ??
            item?.definition ??
            item?.defId ??
            legendary?.itemdefid ??
            legendary?.steamItemDefId
        );

        const skinId = item?.skinId || legendary?.skinId || null;
        const quantity = normalizeQuantity(item?.quantity ?? item?.qty ?? item?.amount ?? item?.count ?? 1);

        return {
            index,
            itemdefid,
            skinId,
            quantity,
            raw: item
        };
    }).filter(item => (item.itemdefid !== null || item.skinId) && item.quantity > 0);
}

function writeTrace(payload) {
    const win = getWindowSafe();
    const trace = {
        ok: !!payload.ok,
        pass: STEAM_INVENTORY_ENTITLEMENT_BRIDGE_VERSION,
        status: payload.status || 'steam_inventory_entitlement_bridge_trace',
        time: new Date().toISOString(),
        ...payload
    };

    try {
        if (win) {
            win.__chiggasSteamInventoryEntitlementBridgePass83Trace = trace;
            if (win.localStorage) {
                win.localStorage.setItem(TRACE_KEY, JSON.stringify(trace));
            }
        }
    } catch (_) {}

    return trace;
}

function dispatchSyncEvent(trace) {
    const win = getWindowSafe();
    if (!win || typeof win.dispatchEvent !== 'function') return;

    try {
        win.dispatchEvent(new CustomEvent('chiggas:steam-inventory-sync', { detail: trace }));
        if (trace.grantedCount > 0 || trace.alreadyOwnedCount > 0) {
            win.dispatchEvent(new CustomEvent('chiggas:restore-success', { detail: trace }));
        }
    } catch (_) {}
}

async function callInventoryBridge(bridge, mode = 'sync') {
    if (!bridge) {
        return {
            ok: false,
            status: 'steam_inventory_bridge_not_available',
            reason: 'window.ChiggasSteamInventory was not found.'
        };
    }

    const attempts = mode === 'restore'
        ? ['getOwnedInventory', 'restoreInventory', 'syncInventory', 'getOwnedItems']
        : ['getOwnedInventory', 'syncInventory', 'getOwnedItems', 'restoreInventory'];

    for (const method of attempts) {
        if (typeof bridge[method] !== 'function') continue;

        try {
            const result = await bridge[method]();
            return {
                ok: !!result?.ok,
                status: result?.status || `${method}_completed`,
                method,
                result: result || null
            };
        } catch (error) {
            return {
                ok: false,
                status: `${method}_threw`,
                method,
                error: error?.message || String(error)
            };
        }
    }

    return {
        ok: false,
        status: 'steam_inventory_bridge_missing_callable_method',
        availableMethods: Object.keys(bridge || {}).filter(key => typeof bridge[key] === 'function')
    };
}

export async function syncSteamInventoryEntitlements(options = {}) {
    const reason = options.reason || 'manual';
    const mode = options.mode || 'sync';
    const bridge = getSteamInventoryBridge();
    const { byItemDef, bySkinId } = makeCatalogMaps();

    const base = {
        reason,
        mode,
        bridgeDetected: !!bridge,
        knownLegendaryItemDefCount: byItemDef.size,
        touchedPurchaseAdapter: false,
        touchedBillingLock: false,
        realBillingArmed: false
    };

    try {
        const call = await callInventoryBridge(bridge, mode);
        const ownedItems = extractOwnedItems(call.result || {});
        const matched = [];
        const grants = [];
        const seenSkinIds = new Set();

        ownedItems.forEach(item => {
            const entity = item.skinId
                ? bySkinId.get(String(item.skinId))
                : byItemDef.get(String(item.itemdefid));

            if (!entity?.skinId || seenSkinIds.has(entity.skinId)) return;
            seenSkinIds.add(entity.skinId);

            const alreadyPurchased = isSkinPurchased(entity.skinId);
            const grant = grantPremiumSkinEntitlement(entity.skinId, {
                source: 'steam_inventory',
                platform: 'steam',
                productId: entity.steamProductId || entity.productId || null,
                transactionId: `steam_inventory_itemdef_${entity.steamItemDefId || item.itemdefid}`,
                orderId: `steam_inventory_restore_${entity.steamItemDefId || item.itemdefid}`,
                rawResultStatus: call.status,
                reason
            });

            matched.push({
                skinId: entity.skinId,
                title: entity.title || entity.name || entity.skinId,
                itemdefid: entity.steamItemDefId || item.itemdefid,
                quantity: item.quantity,
                alreadyPurchased,
                grantedNow: !alreadyPurchased
            });

            grants.push(grant);
        });

        const trace = writeTrace({
            ...base,
            ok: !!call.ok || matched.length > 0,
            status: matched.length > 0
                ? 'steam_inventory_entitlements_synced'
                : (call.status || 'steam_inventory_no_matching_entitlements'),
            bridgeCallStatus: call.status || null,
            bridgeMethod: call.method || null,
            bridgeOk: !!call.ok,
            ownedItemCount: ownedItems.length,
            matchedLegendaryCount: matched.length,
            grantedCount: matched.filter(item => item.grantedNow).length,
            alreadyOwnedCount: matched.filter(item => item.alreadyPurchased).length,
            matched,
            grantsApplied: matched.length > 0,
            error: call.error || null
        });

        dispatchSyncEvent(trace);
        return trace;
    } catch (error) {
        const trace = writeTrace({
            ...base,
            ok: false,
            status: 'steam_inventory_entitlement_sync_failed',
            error: error?.message || String(error),
            grantsApplied: false,
            grantedCount: 0,
            alreadyOwnedCount: 0,
            matched: []
        });

        dispatchSyncEvent(trace);
        return trace;
    }
}

export function getSteamInventoryEntitlementBridgeTrace() {
    const win = getWindowSafe();

    try {
        if (win?.__chiggasSteamInventoryEntitlementBridgePass83Trace) {
            return win.__chiggasSteamInventoryEntitlementBridgePass83Trace;
        }

        const raw = win?.localStorage?.getItem(TRACE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (_) {}

    return {
        ok: false,
        pass: STEAM_INVENTORY_ENTITLEMENT_BRIDGE_VERSION,
        status: 'steam_inventory_entitlement_bridge_trace_not_found'
    };
}

export default {
    version: STEAM_INVENTORY_ENTITLEMENT_BRIDGE_VERSION,
    syncSteamInventoryEntitlements,
    getSteamInventoryEntitlementBridgeTrace
};