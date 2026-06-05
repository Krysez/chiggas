import {
    getSkin,
    isSkinPurchased,
    purchasePremiumSkinLocalTest,
    restoreLocalTestPurchases,
    getPurchaseEntityForSkin,
    getPurchaseEntityForProductId,
    getLegendaryPurchaseCatalog,
    grantPremiumSkinEntitlement,
    revokePremiumSkinEntitlement,
    validateLegendaryPurchases,
    LEGENDARY_ITEM_PRICE_LABEL
} from './SkinRegistry.js';

export const PLATFORM_PURCHASE_ADAPTER_VERSION = '1.6.0-google-play-product-query';
export const PURCHASE_ADAPTER_LOG_KEY = 'chiggas_purchase_adapter_log_v1';
export const PURCHASE_ADAPTER_PENDING_KEY = 'chiggas_purchase_pending_v1';
export const BILLING_DEBUG_HARNESS_KEY = 'chiggas_billing_debug_harness_v1';

// Pass 2 installs the native bridge contract, but real billing stays locked off.
// Do not change this to true until Google Play Billing / Steam Inventory has been fully connected and tested.
const REAL_BILLING_ARMED = false;
const EXPECTED_LEGENDARY_PRODUCT_COUNT = 29;
const SUPPORTED_LIVE_BILLING_PLATFORMS = ['google_play', 'steam'];
const NATIVE_PURCHASE_TIMEOUT_MS = 45000;
const MAX_PENDING_REQUESTS = 20;

const pendingNativeRequests = new Map();
let callbacksRegistered = false;
let latestGooglePlayProductDetailsQueryReport = null;
let googlePlayProductDetailsEventListenerRegistered = false;

function getWindow() {
    return typeof window !== 'undefined' ? window : null;
}

function getUserAgent() {
    const win = getWindow();
    return win?.navigator?.userAgent || '';
}

function getNowIso() {
    try {
        return new Date().toISOString();
    } catch (e) {
        return `${Date.now()}`;
    }
}

function makeRequestId(prefix = 'purchase') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeProductId(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text.length > 0 ? text : null;
}

function normalizeSteamItemDefId(value) {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeBool(value) {
    if (value === true || value === false) return value;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (['true', 'yes', '1', 'consumable'].includes(v)) return true;
        if (['false', 'no', '0', 'non_consumable', 'non-consumable'].includes(v)) return false;
    }
    return null;
}

function getEntityProductIds(entity) {
    if (!entity) return [];
    return [entity.productId, entity.googlePlayProductId, entity.steamProductId]
        .map(normalizeProductId)
        .filter(Boolean);
}

function getCatalogEntityBySteamItemDefId(steamItemDefId) {
    const normalized = normalizeSteamItemDefId(steamItemDefId);
    if (normalized === null) return null;

    return getLegendaryPurchaseCatalog().find(entity =>
        normalizeSteamItemDefId(entity?.steamItemDefId) === normalized
    ) || null;
}

function getPayloadProductIdentifiers(payload = {}) {
    const safe = typeof payload === 'string' ? { productId: payload } : (payload || {});
    const platform = safe.platform || getCurrentPlatform();
    const productId = normalizeProductId(
        safe.productId ||
        safe.sku ||
        safe.itemId ||
        safe.storeProductId ||
        safe.purchaseProductId ||
        safe.googlePlayProductId ||
        safe.steamProductId
    );

    return {
        skinId: normalizeProductId(safe.skinId),
        productId,
        googlePlayProductId: normalizeProductId(safe.googlePlayProductId || (platform === 'google_play' ? productId : null)),
        steamProductId: normalizeProductId(safe.steamProductId || (platform === 'steam' ? productId : null)),
        steamItemDefId: normalizeSteamItemDefId(safe.steamItemDefId || safe.itemDefId || safe.itemdefid || safe.steamItemId),
        platform,
        category: normalizeProductId(safe.category),
        entitlementType: normalizeProductId(safe.entitlementType),
        consumable: normalizeBool(safe.consumable)
    };
}

function addUniqueEntity(list, entity, source) {
    if (!entity) return;
    if (!list.some(item => item.entity?.skinId === entity.skinId)) {
        list.push({ entity, source });
    }
}

export function getPurchaseValidationReport() {
    const catalog = getLegendaryPurchaseCatalog();
    const errors = [...validateLegendaryPurchases()];
    const warnings = [];
    const seenProductIds = new Map();
    const seenSteamItemDefIds = new Map();
    const googlePlayProductIdPattern = /^[a-z0-9][a-z0-9_.]*$/;

    catalog.forEach(entity => {
        if (!entity) return;

        const skin = getSkin(entity.skinId);
        const label = entity.skinId || entity.productId || 'unknown_entity';

        if (entity.active === false) errors.push(`${label} is inactive but still present in purchase validation catalog`);
        if (entity.category !== 'legendary_chigga_wear') errors.push(`${label} has invalid category: ${entity.category}`);
        if (entity.entitlementType !== 'permanent') errors.push(`${label} must use permanent entitlementType`);
        if (entity.consumable !== false) errors.push(`${label} must be non-consumable`);
        if (Number(entity.priceUsd) !== 0.99) warnings.push(`${label} priceUsd is ${entity.priceUsd}; expected 0.99 before launch review`);
        if (!skin) errors.push(`${label} has no matching skin registry entry`);
        if (skin && skin.unlockType !== 'premium') errors.push(`${label} maps to a non-premium skin`);
        if (skin && skin.rarity !== 'legendary') errors.push(`${label} maps to a non-legendary skin`);

        getEntityProductIds(entity).forEach(productId => {
            if (!googlePlayProductIdPattern.test(productId)) {
                errors.push(`${label} has invalid product id format: ${productId}`);
            }

            const previous = seenProductIds.get(productId);
            if (previous && previous !== entity.skinId) {
                errors.push(`Duplicate product id across different skins: ${productId} (${previous} / ${entity.skinId})`);
            }
            seenProductIds.set(productId, entity.skinId);
        });

        const itemDefId = normalizeSteamItemDefId(entity.steamItemDefId);
        if (itemDefId === null) {
            errors.push(`${label} is missing a valid Steam itemdefid`);
        } else {
            const previous = seenSteamItemDefIds.get(itemDefId);
            if (previous && previous !== entity.skinId) {
                errors.push(`Duplicate Steam itemdefid across different skins: ${itemDefId} (${previous} / ${entity.skinId})`);
            }
            seenSteamItemDefIds.set(itemDefId, entity.skinId);
        }
    });

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        catalogItemCount: catalog.length,
        productIdCount: seenProductIds.size,
        steamItemDefIdCount: seenSteamItemDefIds.size,
        priceLabel: LEGENDARY_ITEM_PRICE_LABEL,
        category: 'legendary_chigga_wear',
        entitlementType: 'permanent',
        consumable: false
    };
}

export function validateLegendaryProductReference(input = {}) {
    const raw = typeof input === 'string' ? { productId: input } : (input || {});
    const ids = getPayloadProductIdentifiers(raw);
    const catalogReport = getPurchaseValidationReport();
    const errors = [...catalogReport.errors];
    const warnings = [...catalogReport.warnings];
    const candidates = [];

    if (ids.skinId) addUniqueEntity(candidates, getPurchaseEntityForSkin(ids.skinId), 'skinId');
    if (ids.productId) addUniqueEntity(candidates, getPurchaseEntityForProductId(ids.productId), 'productId');
    if (ids.googlePlayProductId) addUniqueEntity(candidates, getPurchaseEntityForProductId(ids.googlePlayProductId), 'googlePlayProductId');
    if (ids.steamProductId) addUniqueEntity(candidates, getPurchaseEntityForProductId(ids.steamProductId), 'steamProductId');
    if (ids.steamItemDefId !== null) addUniqueEntity(candidates, getCatalogEntityBySteamItemDefId(ids.steamItemDefId), 'steamItemDefId');

    const entity = candidates[0]?.entity || null;
    const uniqueCandidateSkinIds = new Set(candidates.map(item => item.entity?.skinId).filter(Boolean));

    if (uniqueCandidateSkinIds.size > 1) {
        errors.push(`Payload identifiers point to multiple Legendary skins: ${Array.from(uniqueCandidateSkinIds).join(', ')}`);
    }

    if (!entity) {
        errors.push(`Unknown Legendary product reference: ${ids.productId || ids.googlePlayProductId || ids.steamProductId || ids.steamItemDefId || ids.skinId || 'missing identifier'}`);
    }

    if (entity && ids.skinId && entity.skinId !== ids.skinId) {
        errors.push(`Payload skinId mismatch: ${ids.skinId} does not match ${entity.skinId}`);
    }

    if (entity && ids.productId && !getEntityProductIds(entity).includes(ids.productId)) {
        errors.push(`Payload productId mismatch: ${ids.productId} does not map to ${entity.skinId}`);
    }

    if (entity && ids.googlePlayProductId && ids.googlePlayProductId !== entity.googlePlayProductId) {
        errors.push(`Payload Google Play product mismatch: ${ids.googlePlayProductId} does not map to ${entity.googlePlayProductId}`);
    }

    if (entity && ids.steamProductId && ids.steamProductId !== entity.steamProductId) {
        errors.push(`Payload Steam product mismatch: ${ids.steamProductId} does not map to ${entity.steamProductId}`);
    }

    if (entity && ids.steamItemDefId !== null && normalizeSteamItemDefId(entity.steamItemDefId) !== ids.steamItemDefId) {
        errors.push(`Payload Steam itemdefid mismatch: ${ids.steamItemDefId} does not map to ${entity.steamItemDefId}`);
    }

    if (entity && ids.platform === 'google_play' && ids.productId && ids.productId !== entity.googlePlayProductId) {
        errors.push(`Google Play purchase must use product id ${entity.googlePlayProductId}; received ${ids.productId}`);
    }

    if (entity && ids.platform === 'steam' && ids.productId && ids.productId !== entity.steamProductId) {
        errors.push(`Steam purchase must use product id ${entity.steamProductId}; received ${ids.productId}`);
    }

    if (ids.category && ids.category !== 'legendary_chigga_wear') {
        errors.push(`Invalid purchase category: ${ids.category}`);
    }

    if (ids.entitlementType && ids.entitlementType !== 'permanent') {
        errors.push(`Invalid entitlement type: ${ids.entitlementType}`);
    }

    if (ids.consumable === true) {
        errors.push('Legendary Chigga Wear products must be non-consumable');
    }

    const skin = entity ? getSkin(entity.skinId) : null;
    if (skin && (skin.unlockType !== 'premium' || skin.rarity !== 'legendary')) {
        errors.push(`${entity.skinId} is not a valid premium Legendary entitlement`);
    }

    const primaryProductId = ids.productId || ids.googlePlayProductId || ids.steamProductId || entity?.productId || null;

    return {
        ok: errors.length === 0,
        status: errors.length === 0 ? 'product_validated' : 'product_validation_failed',
        errors,
        warnings,
        input: safeJsonClone(raw),
        identifiers: ids,
        entity,
        skin,
        skinId: entity?.skinId || ids.skinId || null,
        productId: primaryProductId,
        googlePlayProductId: entity?.googlePlayProductId || ids.googlePlayProductId || null,
        steamProductId: entity?.steamProductId || ids.steamProductId || null,
        steamItemDefId: entity?.steamItemDefId ?? ids.steamItemDefId ?? null,
        matchedBy: candidates.map(item => item.source),
        catalogReport
    };
}

export function validateNativePurchasePayload(payload = {}) {
    return validateLegendaryProductReference(payload);
}

export function getCurrentPlatform() {
    const win = getWindow();
    const ua = getUserAgent();

    if (win?.ChiggasSteam || win?.Steamworks || win?.steamworks || win?.greenworks) return 'steam';
    if (/Android/i.test(ua)) return 'google_play';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios_web';
    return 'web';
}

export function getNativePurchaseBridge() {
    const win = getWindow();
    if (!win) return null;

    return win.ChiggasPurchaseBridge ||
        win.ChiggasBilling ||
        win.ChiggasNativeBilling ||
        win.AndroidBilling ||
        win.SteamBilling ||
        null;
}

function hasBridgeFunction(bridge, ...names) {
    return !!bridge && names.some(name => typeof bridge[name] === 'function');
}

function getBridgeFunctionNames(bridge) {
    if (!bridge) return [];

    try {
        return Object.keys(bridge).filter(key => typeof bridge[key] === 'function').sort();
    } catch (e) {
        return [];
    }
}


export function isRealBillingArmed() {
    return REAL_BILLING_ARMED === true;
}

export function getBillingBridgeCapabilities() {
    const platform = getCurrentPlatform();
    const bridge = getNativePurchaseBridge();

    return {
        platform,
        bridgeDetected: !!bridge,
        bridgeFunctionNames: getBridgeFunctionNames(bridge),
        purchaseBridgeReady: hasBridgeFunction(bridge, 'purchaseLegendarySkin', 'purchaseProduct', 'buyProduct', 'purchase'),
        restoreBridgeReady: hasBridgeFunction(bridge, 'restorePurchases', 'restoreProducts', 'syncInventory', 'restore'),
        callbacksRegistered,
        supportedLivePlatform: SUPPORTED_LIVE_BILLING_PLATFORMS.includes(platform)
    };
}


function getNativeBridgeResponse(functionNames, payload = {}) {
    const bridge = getNativePurchaseBridge();
    const call = callNativeBridgeFunction(bridge, functionNames, payload);
    if (!call.called) {
        return {
            called: false,
            functionName: null,
            response: null,
            ok: false,
            status: 'native_bridge_function_missing'
        };
    }

    let response = call.value;
    if (typeof response === 'string') {
        try {
            response = JSON.parse(response);
        } catch (e) {
            response = {
                ok: false,
                status: 'native_bridge_response_parse_failed',
                raw: response,
                error: e?.message || String(e)
            };
        }
    }

    return {
        called: true,
        functionName: call.functionName,
        response: safeJsonClone(response),
        ok: response?.ok !== false,
        status: response?.status || (response?.ok === false ? 'native_bridge_response_failed' : 'native_bridge_response_ok')
    };
}

function getCatalogProductIdsForPlatform(platform = 'google_play') {
    return getLegendaryPurchaseCatalog()
        .map(item => platform === 'steam' ? item?.steamProductId : item?.googlePlayProductId || item?.productId)
        .filter(Boolean)
        .sort();
}

function getArrayValues(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(v => String(v)).filter(Boolean);
    try {
        return Array.from(value).map(v => String(v)).filter(Boolean);
    } catch (e) {
        return [];
    }
}

export function getNativeBillingBridgeDetectionReport() {
    const capabilities = getBillingBridgeCapabilities();
    const releaseGuard = getBillingReleaseGuardReport();
    const expectedGoogleIds = getCatalogProductIdsForPlatform('google_play');
    const expectedProductCount = EXPECTED_LEGENDARY_PRODUCT_COUNT;
    const nativeCapabilitiesCall = getNativeBridgeResponse(['getCapabilities', 'getBridgeCapabilities', 'getStatus'], {
        requestId: makeRequestId('bridge_capabilities')
    });
    const nativeCatalogCall = getNativeBridgeResponse(['getCatalog', 'getProductCatalog', 'catalog'], {
        requestId: makeRequestId('bridge_catalog')
    });
    const nativeCapabilities = nativeCapabilitiesCall.response || {};
    const nativeCatalog = nativeCatalogCall.response || {};
    const nativeProductIds = getArrayValues(nativeCatalog.productIds || nativeCatalog.products || nativeCatalog.catalog).sort();
    const missingFromNative = expectedGoogleIds.filter(id => !nativeProductIds.includes(id));
    const unknownFromNative = nativeProductIds.filter(id => !expectedGoogleIds.includes(id));

    const checks = [
        makeReleaseGuardCheck(
            'callback_api_registered',
            callbacksRegistered,
            true,
            callbacksRegistered ? 'Rosebud callback API is registered.' : 'Rosebud callback API is not registered.',
            'PlatformPurchaseAdapter.js must finish registerNativeBillingCallbacks().' 
        ),
        makeReleaseGuardCheck(
            'bridge_detected',
            capabilities.bridgeDetected,
            true,
            capabilities.bridgeDetected ? 'Native billing bridge object is visible in WebView.' : 'Native billing bridge object is not visible in WebView.',
            'Confirm MainActivity injects AndroidChiggasBilling and window.ChiggasBilling.'
        ),
        makeReleaseGuardCheck(
            'purchase_bridge_ready',
            capabilities.purchaseBridgeReady,
            true,
            capabilities.purchaseBridgeReady ? 'Native purchase bridge function is visible.' : 'Native purchase bridge function is missing.',
            'Bridge must expose purchaseLegendarySkin, purchaseProduct, buyProduct, or purchase.'
        ),
        makeReleaseGuardCheck(
            'restore_bridge_ready',
            capabilities.restoreBridgeReady,
            true,
            capabilities.restoreBridgeReady ? 'Native restore bridge function is visible.' : 'Native restore bridge function is missing.',
            'Bridge must expose restorePurchases, restoreProducts, syncInventory, or restore.'
        ),
        makeReleaseGuardCheck(
            'native_capabilities_callable',
            nativeCapabilitiesCall.called && nativeCapabilitiesCall.ok,
            true,
            nativeCapabilitiesCall.called ? `Native capabilities returned: ${nativeCapabilitiesCall.status}.` : 'Native capabilities function was not callable.',
            'Bridge should expose getCapabilities().'
        ),
        makeReleaseGuardCheck(
            'native_platform_google_play',
            nativeCapabilities.platform === 'google_play' || nativeCatalog.platform === 'google_play' || capabilities.platform === 'google_play',
            true,
            `Detected native platform: ${nativeCapabilities.platform || nativeCatalog.platform || capabilities.platform}.`,
            'Android bridge should report google_play.'
        ),
        makeReleaseGuardCheck(
            'native_catalog_callable',
            nativeCatalogCall.called && nativeCatalogCall.ok,
            true,
            nativeCatalogCall.called ? `Native catalog returned: ${nativeCatalogCall.status}.` : 'Native catalog function was not callable.',
            'Bridge should expose getCatalog().'
        ),
        makeReleaseGuardCheck(
            'native_catalog_count',
            Number(nativeCatalog.count || nativeCapabilities.knownProductCount || nativeProductIds.length) === expectedProductCount,
            true,
            `Native catalog count is ${nativeCatalog.count || nativeCapabilities.knownProductCount || nativeProductIds.length}; expected ${expectedProductCount}.`,
            'Native GooglePlayBillingBridge must include all 29 Legendary product IDs.'
        ),
        makeReleaseGuardCheck(
            'native_catalog_matches_rosebud',
            nativeProductIds.length === expectedProductCount && missingFromNative.length === 0 && unknownFromNative.length === 0,
            true,
            missingFromNative.length === 0 && unknownFromNative.length === 0
                ? 'Native product IDs match Rosebud product map.'
                : `${missingFromNative.length} missing native id(s), ${unknownFromNative.length} unknown native id(s).`,
            'Keep GooglePlayBillingBridge.LEGENDARY_PRODUCT_IDS synced with LegendaryPurchaseCatalog.js.'
        ),
        makeReleaseGuardCheck(
            'real_billing_locked',
            REAL_BILLING_ARMED === false,
            true,
            REAL_BILLING_ARMED ? 'Real billing is armed.' : 'Real billing is still locked, as expected for bridge detection.',
            'Leave REAL_BILLING_ARMED false until live billing testing is intentionally started.'
        ),
        makeReleaseGuardCheck(
            'store_still_test_mode',
            releaseGuard.buttonLabelMode === 'test_buy',
            true,
            `Store label mode is ${releaseGuard.buttonLabelMode}.`,
            'Store should stay in TEST BUY mode during Android Billing Bridge Pass 2.'
        )
    ];

    const blockingFailures = checks.filter(check => check.blocking && !check.ok);
    const warnings = checks.filter(check => !check.blocking && !check.ok);

    return {
        adapterVersion: PLATFORM_PURCHASE_ADAPTER_VERSION,
        status: blockingFailures.length === 0 ? 'native_bridge_detection_validated' : 'native_bridge_detection_failed',
        ok: blockingFailures.length === 0,
        realBillingArmed: REAL_BILLING_ARMED,
        bridgeDetected: capabilities.bridgeDetected,
        purchaseBridgeReady: capabilities.purchaseBridgeReady,
        restoreBridgeReady: capabilities.restoreBridgeReady,
        callbacksRegistered,
        capabilities,
        nativeCapabilities,
        nativeCatalog,
        nativeCapabilitiesCall,
        nativeCatalogCall,
        expectedProductCount,
        nativeProductCount: nativeProductIds.length,
        missingFromNative,
        unknownFromNative,
        checks,
        blockingFailures,
        warnings,
        releaseGuardStatus: releaseGuard.status,
        storeLabelMode: releaseGuard.buttonLabelMode,
        recommendedStoreLabel: releaseGuard.recommendedStoreLabel,
        summary: blockingFailures.length === 0
            ? 'Native Android billing bridge is detected and matches the Rosebud Legendary product map. Real billing remains locked.'
            : `Native Android billing bridge detection failed ${blockingFailures.length} required check(s).`
    };
}

export function runNativeBillingBridgeDetectionTest() {
    const report = getNativeBillingBridgeDetectionReport();
    appendPurchaseLog({
        event: 'native_billing_bridge_detection_test',
        status: report.status,
        ok: report.ok,
        bridgeDetected: report.bridgeDetected,
        purchaseBridgeReady: report.purchaseBridgeReady,
        restoreBridgeReady: report.restoreBridgeReady,
        missingFromNative: report.missingFromNative,
        unknownFromNative: report.unknownFromNative,
        blockingFailures: report.blockingFailures.map(check => check.id)
    });
    dispatchPurchaseEvent('native-billing-bridge-detection', report);
    return report;
}

function getGooglePlayProductQueryIds() {
    return getCatalogProductIdsForPlatform('google_play');
}

function getProductIdsFromDetailsList(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map(item => item?.productId || item?.id || item?.sku || null)
        .filter(Boolean)
        .map(String)
        .sort();
}

function makeGooglePlayProductDetailsQuerySummary(report = {}, testId = 'google_product_details_query') {
    const expectedIds = getGooglePlayProductQueryIds();
    const foundIds = getArrayValues(report.foundProductIds || report.availableProductIds || report.productIds)
        .concat(getProductIdsFromDetailsList(report.foundProducts || report.productDetails || []));
    const foundUnique = Array.from(new Set(foundIds.map(String))).sort();
    const missingFromGooglePlay = expectedIds.filter(id => !foundUnique.includes(id));
    const unknownFromGooglePlay = foundUnique.filter(id => !expectedIds.includes(id));
    const products = Array.isArray(report.foundProducts) ? report.foundProducts : (Array.isArray(report.productDetails) ? report.productDetails : []);
    const priceMismatches = products
        .filter(product => product && product.formattedPrice && !String(product.formattedPrice).includes('0.99'))
        .map(product => ({ productId: product.productId, formattedPrice: product.formattedPrice }));

    const nativeOk = report.ok !== false;
    const allProductsFound = missingFromGooglePlay.length === 0 && foundUnique.length === expectedIds.length;
    const status = nativeOk && allProductsFound
        ? 'google_play_product_details_query_validated'
        : (nativeOk ? 'google_play_product_details_query_incomplete' : (report.status || 'google_play_product_details_query_failed'));

    return {
        ok: nativeOk && allProductsFound,
        testId,
        status,
        billingLocked: !REAL_BILLING_ARMED,
        expectedLockedStatus: !REAL_BILLING_ARMED,
        validationOk: nativeOk && allProductsFound,
        validationErrors: missingFromGooglePlay.length > 0 ? [`${missingFromGooglePlay.length} Google Play product(s) missing from ProductDetails query.`] : [],
        validationWarnings: [
            ...unknownFromGooglePlay.map(id => `Unknown Google Play product returned: ${id}`),
            ...priceMismatches.map(item => `${item.productId} returned ${item.formattedPrice}; expected $0.99 before release review.`)
        ],
        expectedProductCount: expectedIds.length,
        requestedCount: Number(report.requestedCount || expectedIds.length),
        foundCount: foundUnique.length,
        missingCount: missingFromGooglePlay.length,
        missingFromGooglePlay,
        unknownFromGooglePlay,
        foundProductIds: foundUnique,
        productDetails: safeJsonClone(products),
        nativeReport: safeJsonClone(report),
        runtime: getPurchaseRuntimeInfo(),
        at: getNowIso()
    };
}

export function processGooglePlayProductDetailsQueryResult(report = {}) {
    if (report?.requestId && latestGooglePlayProductDetailsQueryReport?.nativeReport?.requestId === report.requestId) {
        return latestGooglePlayProductDetailsQueryReport;
    }

    const summary = makeGooglePlayProductDetailsQuerySummary(report);
    latestGooglePlayProductDetailsQueryReport = summary;

    appendPurchaseLog({
        event: 'google_play_product_details_query_result',
        status: summary.status,
        ok: summary.ok,
        requestedCount: summary.requestedCount,
        foundCount: summary.foundCount,
        missingCount: summary.missingCount,
        missingFromGooglePlay: summary.missingFromGooglePlay,
        unknownFromGooglePlay: summary.unknownFromGooglePlay
    });

    dispatchPurchaseEvent('billing-debug-result', summary);
    dispatchPurchaseEvent('google-play-product-details-query', summary);
    return summary;
}

export function getLastGooglePlayProductDetailsQueryReport() {
    return latestGooglePlayProductDetailsQueryReport;
}

export function runGooglePlayProductDetailsQueryTest() {
    const expectedIds = getGooglePlayProductQueryIds();
    const requestId = makeRequestId('product_details');
    const bridgeResult = getNativeBridgeResponse(['queryProductDetails', 'queryProductDetailsTest', 'queryAllProductDetails'], {
        requestId,
        platform: 'google_play',
        productIds: expectedIds,
        expectedProductCount: expectedIds.length,
        all: true
    });

    const summary = {
        ok: bridgeResult.called && bridgeResult.ok,
        testId: 'google_product_details_query',
        status: bridgeResult.called ? (bridgeResult.status || 'product_details_query_queued') : 'product_details_query_bridge_missing',
        billingLocked: !REAL_BILLING_ARMED,
        expectedLockedStatus: !REAL_BILLING_ARMED,
        validationOk: bridgeResult.called && bridgeResult.ok,
        validationErrors: bridgeResult.called ? [] : ['Native bridge does not expose queryProductDetails/queryProductDetailsTest/queryAllProductDetails.'],
        validationWarnings: bridgeResult.called ? ['ProductDetails query is asynchronous. Wait for the final Google Play ProductDetails callback result.'] : [],
        requestId,
        expectedProductCount: expectedIds.length,
        bridgeFunction: bridgeResult.functionName,
        nativeResponse: safeJsonClone(bridgeResult.response),
        runtime: getPurchaseRuntimeInfo(),
        at: getNowIso()
    };

    appendPurchaseLog({
        event: 'google_play_product_details_query_started',
        status: summary.status,
        ok: summary.ok,
        requestId,
        bridgeFunction: bridgeResult.functionName,
        expectedProductCount: expectedIds.length
    });

    dispatchPurchaseEvent('billing-debug-result', summary);
    return summary;
}

function registerGooglePlayProductDetailsEventListener(win) {
    if (!win || googlePlayProductDetailsEventListenerRegistered) return;

    try {
        win.addEventListener('chiggasGooglePlayProductDetailsResult', event => {
            processGooglePlayProductDetailsQueryResult(event?.detail || {});
        });
        googlePlayProductDetailsEventListenerRegistered = true;
    } catch (e) {}
}

function makeReleaseGuardCheck(id, ok, blocking, message, fix = '') {
    return { id, ok: !!ok, blocking: !!blocking, message, fix };
}

export function getBillingReleaseGuardReport() {
    const capabilities = getBillingBridgeCapabilities();
    const validationReport = getPurchaseValidationReport();
    const debugEnabled = isBillingDebugHarnessEnabled();
    const checks = [
        makeReleaseGuardCheck(
            'real_billing_armed',
            REAL_BILLING_ARMED === true,
            true,
            REAL_BILLING_ARMED ? 'Real billing flag is armed.' : 'Real billing flag is locked off for TEST BUY mode.',
            'Only change REAL_BILLING_ARMED to true after native Google Play / Steam billing is connected and tested.'
        ),
        makeReleaseGuardCheck(
            'supported_live_platform',
            capabilities.supportedLivePlatform,
            true,
            capabilities.supportedLivePlatform
                ? `Detected supported billing platform: ${capabilities.platform}.`
                : `Detected platform ${capabilities.platform}; live billing is only allowed for google_play or steam.`,
            'Test live billing from the Android wrapper or Steam build, not the web preview.'
        ),
        makeReleaseGuardCheck(
            'purchase_bridge_ready',
            capabilities.purchaseBridgeReady,
            true,
            capabilities.purchaseBridgeReady ? 'Native purchase bridge is available.' : 'Native purchase bridge is missing.',
            'Expose purchaseLegendarySkin, purchaseProduct, buyProduct, or purchase on the native bridge.'
        ),
        makeReleaseGuardCheck(
            'restore_bridge_ready',
            capabilities.restoreBridgeReady,
            true,
            capabilities.restoreBridgeReady ? 'Native restore bridge is available.' : 'Native restore bridge is missing.',
            'Expose restorePurchases, restoreProducts, syncInventory, or restore on the native bridge.'
        ),
        makeReleaseGuardCheck(
            'native_callbacks_ready',
            callbacksRegistered,
            true,
            callbacksRegistered ? 'Native callback API is registered.' : 'Native callback API has not registered yet.',
            'Make sure PlatformPurchaseAdapter.js is imported and registerNativeBillingCallbacks() runs.'
        ),
        makeReleaseGuardCheck(
            'catalog_validation_ok',
            validationReport.ok,
            true,
            validationReport.ok ? 'Legendary product catalog passed validation.' : `${validationReport.errors.length} catalog validation error(s) found.`,
            'Fix the product map before allowing real purchases.'
        ),
        makeReleaseGuardCheck(
            'expected_product_count',
            validationReport.catalogItemCount === EXPECTED_LEGENDARY_PRODUCT_COUNT,
            true,
            `Legendary product count is ${validationReport.catalogItemCount}; expected ${EXPECTED_LEGENDARY_PRODUCT_COUNT}.`,
            'Confirm every Legendary Chigga Wear item exists in the platform product map.'
        ),
        makeReleaseGuardCheck(
            'billing_debug_disabled',
            !debugEnabled,
            false,
            debugEnabled ? 'Billing debug harness is enabled.' : 'Billing debug harness is disabled.',
            'Turn debug mode off before production release.'
        )
    ];

    const blockingFailures = checks.filter(check => check.blocking && !check.ok);
    const warnings = checks.filter(check => !check.blocking && !check.ok);
    const canUseNativeBilling = REAL_BILLING_ARMED === true && blockingFailures.length === 0;
    const canShowLiveStoreLabels = canUseNativeBilling;

    return {
        adapterVersion: PLATFORM_PURCHASE_ADAPTER_VERSION,
        status: canUseNativeBilling
            ? 'live_billing_ready'
            : (REAL_BILLING_ARMED ? 'live_billing_blocked_by_release_guard' : 'billing_locked_test_mode'),
        realBillingArmed: REAL_BILLING_ARMED,
        canUseNativeBilling,
        canShowLiveStoreLabels,
        supportedLivePlatforms: [...SUPPORTED_LIVE_BILLING_PLATFORMS],
        expectedLegendaryProductCount: EXPECTED_LEGENDARY_PRODUCT_COUNT,
        checks,
        blockingFailures,
        warnings,
        capabilities,
        validationReport,
        debugHarnessEnabled: debugEnabled,
        buttonLabelMode: canShowLiveStoreLabels ? 'live_buy_price' : (REAL_BILLING_ARMED ? 'billing_locked' : 'test_buy'),
        recommendedStoreLabel: canShowLiveStoreLabels ? `BUY ${LEGENDARY_ITEM_PRICE_LABEL}` : (REAL_BILLING_ARMED ? 'BILLING LOCKED' : 'TEST BUY'),
        summary: canUseNativeBilling
            ? 'Live billing guard passed. Platform purchase buttons may show live price labels.'
            : (REAL_BILLING_ARMED
                ? `Live billing is armed but blocked by ${blockingFailures.length} required guard check(s).`
                : 'Real billing is locked off. TEST BUY mode is expected.')
    };
}

export function verifyLiveReleaseReadiness() {
    const report = getBillingReleaseGuardReport();
    appendPurchaseLog({
        event: 'live_release_guard_checked',
        status: report.status,
        canUseNativeBilling: report.canUseNativeBilling,
        blockingFailures: report.blockingFailures.map(check => check.id),
        warnings: report.warnings.map(check => check.id)
    });
    return report;
}

export function getPurchaseRuntimeInfo() {
    const platform = getCurrentPlatform();
    const bridge = getNativePurchaseBridge();
    const validationReport = getPurchaseValidationReport();
    const bridgeCapabilities = getBillingBridgeCapabilities();
    const releaseGuard = getBillingReleaseGuardReport();
    const purchaseBridgeReady = bridgeCapabilities.purchaseBridgeReady;
    const restoreBridgeReady = bridgeCapabilities.restoreBridgeReady;
    const realBillingReady = releaseGuard.canUseNativeBilling;
    const nativeCallbackApiReady = callbacksRegistered;

    return {
        adapterVersion: PLATFORM_PURCHASE_ADAPTER_VERSION,
        platform,
        mode: realBillingReady ? platform : (REAL_BILLING_ARMED ? 'billing_locked' : 'local_test'),
        realBillingArmed: REAL_BILLING_ARMED,
        bridgeDetected: !!bridge,
        bridgeFunctionNames: getBridgeFunctionNames(bridge),
        purchaseBridgeReady,
        restoreBridgeReady,
        realBillingReady,
        nativeCallbackApiReady,
        pendingNativeRequests: pendingNativeRequests.size,
        productValidationReady: true,
        billingDebugHarnessEnabled: isBillingDebugHarnessEnabled(),
        catalogValidationOk: validationReport.ok,
        catalogValidationErrors: validationReport.errors.length,
        catalogValidationWarnings: validationReport.warnings.length,
        validatedProductCount: validationReport.catalogItemCount,
        releaseGuardStatus: releaseGuard.status,
        releaseGuardReady: releaseGuard.canUseNativeBilling,
        releaseGuardBlockingFailures: releaseGuard.blockingFailures.map(check => check.id),
        releaseGuardWarnings: releaseGuard.warnings.map(check => check.id),
        liveButtonLabelsAllowed: releaseGuard.canShowLiveStoreLabels,
        recommendedStoreLabel: releaseGuard.recommendedStoreLabel,
        priceLabel: LEGENDARY_ITEM_PRICE_LABEL,
        storeSubtitle: realBillingReady
            ? `Platform store ready - ${LEGENDARY_ITEM_PRICE_LABEL} each.`
            : (REAL_BILLING_ARMED
                ? `REAL BILLING BLOCKED - ${releaseGuard.blockingFailures.length} release guard check(s) failed.`
                : (bridge
                    ? `Local test store - native bridge detected, billing locked, validation ready.`
                    : `Local test store - ${LEGENDARY_ITEM_PRICE_LABEL} each. Billing locked, validation ready.`))
    };
}
function safeJsonClone(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (e) {
        return null;
    }
}

function appendPurchaseLog(entry) {
    const win = getWindow();
    if (!win?.localStorage) return;

    try {
        const raw = win.localStorage.getItem(PURCHASE_ADAPTER_LOG_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(parsed) ? parsed : [];
        list.push({
            at: getNowIso(),
            adapterVersion: PLATFORM_PURCHASE_ADAPTER_VERSION,
            ...entry
        });
        win.localStorage.setItem(PURCHASE_ADAPTER_LOG_KEY, JSON.stringify(list.slice(-80)));
    } catch (e) {}
}

function savePendingRequests() {
    const win = getWindow();
    if (!win?.localStorage) return;

    try {
        const list = Array.from(pendingNativeRequests.values()).slice(-MAX_PENDING_REQUESTS);
        win.localStorage.setItem(PURCHASE_ADAPTER_PENDING_KEY, JSON.stringify(list));
    } catch (e) {}
}

function rememberPendingRequest(request) {
    if (!request?.requestId) return;

    pendingNativeRequests.set(request.requestId, request);

    while (pendingNativeRequests.size > MAX_PENDING_REQUESTS) {
        const firstKey = pendingNativeRequests.keys().next().value;
        pendingNativeRequests.delete(firstKey);
    }

    savePendingRequests();
}

function resolvePendingRequest(payload = {}) {
    const requestId = payload.requestId || payload.purchaseRequestId || payload.clientRequestId;
    const productId = payload.productId || payload.sku || payload.itemId || payload.googlePlayProductId || payload.steamProductId;

    if (requestId && pendingNativeRequests.has(requestId)) {
        const request = pendingNativeRequests.get(requestId);
        pendingNativeRequests.delete(requestId);
        savePendingRequests();
        return request;
    }

    if (productId) {
        for (const [key, request] of pendingNativeRequests.entries()) {
            if (request.productId === productId || request.googlePlayProductId === productId || request.steamProductId === productId) {
                pendingNativeRequests.delete(key);
                savePendingRequests();
                return request;
            }
        }
    }

    return null;
}

export function getPurchaseAdapterLog() {
    const win = getWindow();
    if (!win?.localStorage) return [];

    try {
        const raw = win.localStorage.getItem(PURCHASE_ADAPTER_LOG_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

export function clearPurchaseAdapterLog() {
    const win = getWindow();
    if (!win?.localStorage) return false;

    try {
        win.localStorage.removeItem(PURCHASE_ADAPTER_LOG_KEY);
        appendPurchaseLog({ event: 'purchase_log_cleared' });
        return true;
    } catch (e) {
        return false;
    }
}

export function isBillingDebugHarnessEnabled() {
    const win = getWindow();
    if (!win) return false;

    try {
        const params = new URLSearchParams(win.location?.search || '');
        if (params.get('billingDebug') === '1' || params.get('debugBilling') === '1') return true;
        if (params.get('billingDebug') === '0' || params.get('debugBilling') === '0') return false;
    } catch (e) {}

    try {
        return win.localStorage?.getItem(BILLING_DEBUG_HARNESS_KEY) === '1';
    } catch (e) {
        return false;
    }
}

export function setBillingDebugHarnessEnabled(enabled) {
    const win = getWindow();
    if (!win?.localStorage) return false;

    try {
        if (enabled) win.localStorage.setItem(BILLING_DEBUG_HARNESS_KEY, '1');
        else win.localStorage.removeItem(BILLING_DEBUG_HARNESS_KEY);
        appendPurchaseLog({ event: enabled ? 'billing_debug_enabled' : 'billing_debug_disabled' });
        dispatchPurchaseEvent('billing-debug-toggle', { enabled: !!enabled, runtime: getPurchaseRuntimeInfo() });
        return true;
    } catch (e) {
        return false;
    }
}


export function getPurchaseButtonLabel(skinId) {
    if (isSkinPurchased(skinId)) return 'OWNED';

    const entity = getPurchaseEntityForSkin(skinId);
    const runtime = getPurchaseRuntimeInfo();

    if (runtime.realBillingReady && runtime.liveButtonLabelsAllowed) {
        return `BUY ${entity?.priceLabel || LEGENDARY_ITEM_PRICE_LABEL}`;
    }

    if (runtime.realBillingArmed && !runtime.releaseGuardReady) {
        return 'BILLING LOCKED';
    }

    return 'TEST BUY';
}

export function getProductIdForRuntime(entity, platform = getCurrentPlatform()) {
    if (!entity) return null;
    if (platform === 'google_play') return entity.googlePlayProductId || entity.productId;
    if (platform === 'steam') return entity.steamProductId || entity.productId;
    return entity.productId;
}

export function getNativePurchaseCatalog() {
    return getLegendaryPurchaseCatalog().map(entity => ({
        skinId: entity.skinId,
        name: entity.name,
        type: entity.type,
        productId: entity.productId,
        googlePlayProductId: entity.googlePlayProductId,
        steamProductId: entity.steamProductId,
        steamItemDefId: entity.steamItemDefId,
        priceUsd: entity.priceUsd,
        priceLabel: entity.priceLabel,
        currency: entity.currency || 'USD',
        consumable: false,
        entitlementType: entity.entitlementType || 'permanent',
        category: entity.category || 'legendary_chigga_wear'
    }));
}

function normalizeNativePayload(payload = {}) {
    const safePayload = typeof payload === 'string' ? { productId: payload } : (payload || {});
    const validation = validateNativePurchasePayload(safePayload);
    const ids = validation.identifiers || getPayloadProductIdentifiers(safePayload);
    const entity = validation.entity || (ids.skinId ? getPurchaseEntityForSkin(ids.skinId) : getPurchaseEntityForProductId(ids.productId));
    const productId = ids.productId || ids.googlePlayProductId || ids.steamProductId || entity?.productId || null;

    return {
        raw: safePayload,
        requestId: safePayload.requestId || safePayload.purchaseRequestId || safePayload.clientRequestId || null,
        skinId: ids.skinId || entity?.skinId || validation.skinId || null,
        productId,
        googlePlayProductId: entity?.googlePlayProductId || ids.googlePlayProductId || null,
        steamProductId: entity?.steamProductId || ids.steamProductId || null,
        steamItemDefId: entity?.steamItemDefId ?? ids.steamItemDefId ?? null,
        platform: safePayload.platform || ids.platform || getCurrentPlatform(),
        transactionId: safePayload.transactionId || safePayload.purchaseToken || safePayload.receiptId || safePayload.orderId || null,
        orderId: safePayload.orderId || null,
        reason: safePayload.reason || safePayload.error || safePayload.message || null,
        entity,
        validation
    };
}

function dispatchPurchaseEvent(name, detail) {
    const win = getWindow();
    if (!win) return;

    try {
        win.dispatchEvent(new CustomEvent(`chiggas:${name}`, { detail }));
    } catch (e) {}
}

function callNativeBridgeFunction(bridge, names, payload) {
    if (!bridge) return { called: false, value: null, functionName: null };

    for (const name of names) {
        if (typeof bridge[name] !== 'function') continue;

        const value = bridge[name](payload);
        return { called: true, value, functionName: name };
    }

    return { called: false, value: null, functionName: null };
}

function withTimeout(promise, timeoutMs, timeoutResult) {
    if (!promise || typeof promise.then !== 'function') return Promise.resolve(promise);

    return new Promise(resolve => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            resolve(timeoutResult);
        }, timeoutMs);

        promise.then(value => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
        }).catch(error => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ ok: false, status: 'native_bridge_error', error: error?.message || String(error) });
        });
    });
}

async function requestNativePurchase(skin, entity, runtime) {
    const bridge = getNativePurchaseBridge();
    const productId = getProductIdForRuntime(entity, runtime.platform);
    const request = {
        requestId: makeRequestId('purchase'),
        skinId: skin.id,
        productId,
        googlePlayProductId: entity.googlePlayProductId,
        steamProductId: entity.steamProductId,
        steamItemDefId: entity.steamItemDefId,
        priceLabel: entity.priceLabel || LEGENDARY_ITEM_PRICE_LABEL,
        currency: entity.currency || 'USD',
        entitlementType: entity.entitlementType || 'permanent',
        category: entity.category || 'legendary_chigga_wear',
        platform: runtime.platform,
        createdAt: getNowIso()
    };

    rememberPendingRequest(request);

    const call = callNativeBridgeFunction(
        bridge,
        ['purchaseLegendarySkin', 'purchaseProduct', 'buyProduct', 'purchase'],
        request
    );

    appendPurchaseLog({
        event: call.called ? 'native_purchase_requested' : 'native_purchase_bridge_missing',
        skinId: skin.id,
        productId,
        requestId: request.requestId,
        bridgeFunction: call.functionName,
        runtime: safeJsonClone(runtime)
    });

    if (!call.called) {
        return { ok: false, status: 'native_purchase_bridge_missing', skinId: skin.id, entity, runtime, productId };
    }

    const value = await withTimeout(call.value, NATIVE_PURCHASE_TIMEOUT_MS, {
        ok: true,
        status: 'native_purchase_started',
        awaitingNativeCallback: true,
        requestId: request.requestId
    });

    if (value && typeof value === 'object' && value.status === 'success') {
        return processNativePurchaseSuccess({ ...value, requestId: request.requestId, skinId: skin.id, productId });
    }

    return {
        ok: value?.ok !== false,
        status: value?.status || 'native_purchase_started',
        awaitingNativeCallback: value?.awaitingNativeCallback !== false,
        skinId: skin.id,
        entity,
        runtime,
        productId,
        requestId: request.requestId,
        nativeResponse: safeJsonClone(value)
    };
}

async function requestNativeRestore(runtime) {
    const bridge = getNativePurchaseBridge();
    const request = {
        requestId: makeRequestId('restore'),
        platform: runtime.platform,
        catalog: getNativePurchaseCatalog(),
        createdAt: getNowIso()
    };

    const call = callNativeBridgeFunction(
        bridge,
        ['restorePurchases', 'restoreProducts', 'syncInventory', 'restore'],
        request
    );

    appendPurchaseLog({
        event: call.called ? 'native_restore_requested' : 'native_restore_bridge_missing',
        requestId: request.requestId,
        bridgeFunction: call.functionName,
        runtime: safeJsonClone(runtime)
    });

    if (!call.called) {
        return { ok: false, status: 'native_restore_bridge_missing', runtime, restoredSkins: [], count: 0 };
    }

    const value = await withTimeout(call.value, NATIVE_PURCHASE_TIMEOUT_MS, {
        ok: true,
        status: 'native_restore_started',
        awaitingNativeCallback: true,
        requestId: request.requestId
    });

    if (value && typeof value === 'object' && Array.isArray(value.productIds)) {
        return processNativeRestoreSuccess({ ...value, requestId: request.requestId });
    }

    return {
        ok: value?.ok !== false,
        status: value?.status || 'native_restore_started',
        awaitingNativeCallback: value?.awaitingNativeCallback !== false,
        runtime,
        requestId: request.requestId,
        nativeResponse: safeJsonClone(value)
    };
}

export async function purchaseLegendarySkin(skinId) {
    const skin = getSkin(skinId);
    const entity = getPurchaseEntityForSkin(skinId);
    const runtime = getPurchaseRuntimeInfo();

    const validation = validateLegendaryProductReference({ skinId });

    if (!skin || !entity || skin.unlockType !== 'premium' || !validation.ok) {
        const result = { ok: false, status: validation.ok ? 'invalid_item' : 'product_validation_failed', skinId, runtime, validation };
        appendPurchaseLog({ event: result.status, skinId, validationErrors: validation.errors, runtime: safeJsonClone(runtime) });
        return result;
    }

    if (isSkinPurchased(skinId)) {
        const result = { ok: true, status: 'already_owned', skinId, skin, entity, runtime };
        appendPurchaseLog({ event: 'purchase_already_owned', skinId, runtime: safeJsonClone(runtime) });
        return result;
    }

    if (runtime.realBillingArmed && !runtime.realBillingReady) {
        const releaseGuard = getBillingReleaseGuardReport();
        const result = {
            ok: false,
            status: 'billing_blocked_by_release_guard',
            skinId,
            skin,
            entity,
            runtime,
            releaseGuard
        };
        appendPurchaseLog({
            event: result.status,
            skinId,
            productId: getProductIdForRuntime(entity, runtime.platform),
            blockingFailures: releaseGuard.blockingFailures.map(check => check.id),
            runtime: safeJsonClone(runtime)
        });
        dispatchPurchaseEvent('billing-guard-blocked', result);
        return result;
    }

    if (runtime.realBillingReady) {
        return requestNativePurchase(skin, entity, runtime);
    }

    // Pass 2 still keeps all store presses in the safe local TEST BUY path.
    const granted = purchasePremiumSkinLocalTest(skinId);
    const result = {
        ok: !!granted,
        status: granted?.alreadyPurchased ? 'already_owned' : 'local_test_purchased',
        skinId,
        skin,
        entity,
        runtime,
        localTestPurchase: true,
        productId: getProductIdForRuntime(entity, runtime.platform),
        validation,
        grant: granted || null
    };

    appendPurchaseLog({
        event: result.status,
        skinId,
        productId: result.productId,
        runtime: safeJsonClone(runtime)
    });

    return result;
}

export async function restoreLegendaryPurchases() {
    const runtime = getPurchaseRuntimeInfo();

    if (runtime.realBillingArmed && !runtime.realBillingReady) {
        const releaseGuard = getBillingReleaseGuardReport();
        const result = {
            ok: false,
            status: 'restore_blocked_by_release_guard',
            runtime,
            restoredSkins: [],
            count: 0,
            releaseGuard
        };
        appendPurchaseLog({
            event: result.status,
            blockingFailures: releaseGuard.blockingFailures.map(check => check.id),
            runtime: safeJsonClone(runtime)
        });
        dispatchPurchaseEvent('billing-guard-blocked', result);
        return result;
    }

    if (runtime.realBillingReady && runtime.restoreBridgeReady) {
        return requestNativeRestore(runtime);
    }

    // Pass 2 restore keeps using local test purchases only until real billing is armed.
    const restoredSkins = restoreLocalTestPurchases();
    const result = {
        ok: true,
        status: 'local_test_restored',
        runtime,
        restoredSkins,
        count: restoredSkins.length,
        localTestRestore: true
    };

    appendPurchaseLog({
        event: 'restore_local_test',
        count: result.count,
        runtime: safeJsonClone(runtime)
    });

    return result;
}

export function processNativePurchaseSuccess(payload = {}) {
    const normalized = normalizeNativePayload(payload);
    const runtime = getPurchaseRuntimeInfo();
    const pending = resolvePendingRequest(normalized.raw);
    const validation = normalized.validation || validateNativePurchasePayload(normalized.raw);

    if (!REAL_BILLING_ARMED) {
        const result = {
            ok: false,
            status: 'native_callback_ignored_billing_not_armed',
            ...normalized,
            validation,
            pendingRequest: pending,
            runtime
        };
        appendPurchaseLog({ event: result.status, skinId: normalized.skinId, productId: normalized.productId, validationOk: validation.ok, validationErrors: validation.errors });
        dispatchPurchaseEvent('purchase-ignored', result);
        return result;
    }

    if (!validation.ok || !validation.skinId || !validation.entity) {
        const result = { ok: false, status: 'native_purchase_validation_failed', ...normalized, validation, pendingRequest: pending, runtime };
        appendPurchaseLog({ event: result.status, productId: normalized.productId, validationErrors: validation.errors });
        dispatchPurchaseEvent('purchase-failed', result);
        return result;
    }

    const grant = grantPremiumSkinEntitlement(validation.skinId, {
        source: 'platform_purchase',
        platform: normalized.platform,
        productId: validation.productId || normalized.productId,
        transactionId: normalized.transactionId,
        orderId: normalized.orderId
    });

    const result = {
        ok: !!grant,
        status: grant?.alreadyPurchased ? 'already_owned' : 'platform_purchased',
        skinId: validation.skinId,
        productId: validation.productId || normalized.productId,
        entity: validation.entity,
        validation,
        grant,
        pendingRequest: pending,
        runtime
    };

    appendPurchaseLog({ event: result.status, skinId: result.skinId, productId: result.productId });
    dispatchPurchaseEvent('purchase-success', result);
    return result;
}

export function processNativePurchaseFailure(payload = {}) {
    const normalized = normalizeNativePayload(payload);
    const runtime = getPurchaseRuntimeInfo();
    const pending = resolvePendingRequest(normalized.raw);
    const status = /cancel/i.test(normalized.reason || '') ? 'purchase_cancelled' : 'purchase_failed';
    const result = { ok: false, status, ...normalized, validation: normalized.validation, pendingRequest: pending, runtime };

    appendPurchaseLog({ event: status, skinId: normalized.skinId, productId: normalized.productId, reason: normalized.reason });
    dispatchPurchaseEvent(status === 'purchase_cancelled' ? 'purchase-cancelled' : 'purchase-failed', result);
    return result;
}

export function processNativeRestoreSuccess(payload = {}) {
    const runtime = getPurchaseRuntimeInfo();

    if (!REAL_BILLING_ARMED) {
        const result = {
            ok: false,
            status: 'native_restore_ignored_billing_not_armed',
            runtime,
            raw: safeJsonClone(payload)
        };
        appendPurchaseLog({ event: result.status });
        dispatchPurchaseEvent('restore-ignored', result);
        return result;
    }

    const rawPurchases = Array.isArray(payload.purchases)
        ? payload.purchases
        : (Array.isArray(payload.productIds) ? payload.productIds.map(productId => ({ productId })) : []);

    const validationResults = rawPurchases.map(item => validateNativePurchasePayload({ ...(typeof item === 'string' ? { productId: item } : item), platform: item?.platform || payload.platform || runtime.platform }));
    const invalidProducts = validationResults.filter(result => !result.ok);
    const seenSkinIds = new Set();
    const grants = [];

    validationResults.forEach(validation => {
        if (!validation.ok || !validation.entity || !validation.skinId) return;
        if (seenSkinIds.has(validation.skinId)) return;
        seenSkinIds.add(validation.skinId);

        const grant = grantPremiumSkinEntitlement(validation.skinId, {
            source: 'platform_restore',
            platform: payload.platform || runtime.platform,
            productId: validation.productId
        });

        if (grant) grants.push(grant);
    });

    const result = {
        ok: invalidProducts.length === 0,
        status: invalidProducts.length === 0 ? 'platform_restored' : 'platform_restored_with_rejections',
        runtime,
        restoredSkins: grants,
        count: grants.length,
        productIds: validationResults.map(result => result.productId).filter(Boolean),
        validationResults,
        invalidProducts
    };

    appendPurchaseLog({ event: result.status, count: result.count });
    dispatchPurchaseEvent('restore-success', result);
    return result;
}

export function processNativePurchaseRevoked(payload = {}) {
    const normalized = normalizeNativePayload(payload);
    const runtime = getPurchaseRuntimeInfo();
    const validation = normalized.validation || validateNativePurchasePayload(normalized.raw);

    if (!REAL_BILLING_ARMED) {
        const result = { ok: false, status: 'native_revoke_ignored_billing_not_armed', ...normalized, validation, runtime };
        appendPurchaseLog({ event: result.status, skinId: normalized.skinId, productId: normalized.productId });
        dispatchPurchaseEvent('purchase-revoke-ignored', result);
        return result;
    }

    if (!validation.ok || !validation.skinId || !validation.entity) {
        const result = { ok: false, status: 'native_revoke_validation_failed', ...normalized, validation, runtime };
        appendPurchaseLog({ event: result.status, productId: normalized.productId, validationErrors: validation.errors });
        return result;
    }

    const revoked = revokePremiumSkinEntitlement(validation.skinId, {
        source: 'platform_revoke',
        platform: normalized.platform,
        productId: validation.productId || normalized.productId,
        transactionId: normalized.transactionId,
        orderId: normalized.orderId
    });

    const result = {
        ok: !!revoked,
        status: revoked ? 'platform_revoked' : 'platform_revoke_failed',
        skinId: validation.skinId,
        productId: validation.productId || normalized.productId,
        validation,
        revoked,
        runtime
    };

    appendPurchaseLog({ event: result.status, skinId: result.skinId, productId: result.productId });
    dispatchPurchaseEvent('purchase-revoked', result);
    return result;
}


function getDefaultDebugEntity(preferredSkinId = null) {
    const preferred = preferredSkinId ? getPurchaseEntityForSkin(preferredSkinId) : null;
    if (preferred) return preferred;
    return getLegendaryPurchaseCatalog().find(entity => entity?.active !== false) || null;
}

function makeDebugPayload(entity, platform = 'google_play', overrides = {}) {
    const productId = platform === 'steam'
        ? (entity?.steamProductId || entity?.productId)
        : (entity?.googlePlayProductId || entity?.productId);

    return {
        skinId: entity?.skinId || null,
        productId,
        googlePlayProductId: entity?.googlePlayProductId || null,
        steamProductId: entity?.steamProductId || null,
        steamItemDefId: entity?.steamItemDefId ?? null,
        platform,
        category: entity?.category || 'legendary_chigga_wear',
        entitlementType: entity?.entitlementType || 'permanent',
        consumable: false,
        transactionId: `debug_txn_${Date.now()}`,
        orderId: `debug_order_${Date.now()}`,
        requestId: makeRequestId('debug'),
        ...overrides
    };
}

function summarizeDebugResult(testId, result, validation = null) {
    return {
        ok: !!result?.ok,
        testId,
        status: result?.status || 'unknown_debug_result',
        billingLocked: !REAL_BILLING_ARMED,
        expectedLockedStatus: !REAL_BILLING_ARMED,
        validationOk: validation ? !!validation.ok : (result?.validation ? !!result.validation.ok : null),
        validationErrors: validation?.errors || result?.validation?.errors || [],
        validationWarnings: validation?.warnings || result?.validation?.warnings || [],
        result: safeJsonClone(result),
        runtime: getPurchaseRuntimeInfo(),
        at: getNowIso()
    };
}

export function getBillingDebugTestCases(preferredSkinId = null) {
    const entity = getDefaultDebugEntity(preferredSkinId);
    const baseSkinId = entity?.skinId || preferredSkinId || null;

    return [
        { id: 'native_bridge_detection', label: 'Bridge Test', description: 'Checks whether the Android native billing bridge is visible and synced with the Rosebud product map.', skinId: baseSkinId },
        { id: 'google_product_details_query', label: 'Product Query', description: 'Queries Google Play ProductDetails for all 29 Legendary products without launching a purchase flow.', skinId: baseSkinId },
        { id: 'google_success_locked', label: 'Google Success', description: 'Simulates a valid Google Play success callback. Billing is locked, so this should validate but not unlock.', skinId: baseSkinId },
        { id: 'steam_success_locked', label: 'Steam Success', description: 'Simulates a valid Steam success callback. Billing is locked, so this should validate but not unlock.', skinId: baseSkinId },
        { id: 'invalid_product', label: 'Invalid Product', description: 'Simulates an unknown product callback. Validation should reject it.', skinId: baseSkinId },
        { id: 'purchase_failure', label: 'Failure', description: 'Simulates a platform purchase failure.', skinId: baseSkinId },
        { id: 'purchase_cancelled', label: 'Cancel', description: 'Simulates a player-cancelled purchase.', skinId: baseSkinId },
        { id: 'restore_success_locked', label: 'Restore Valid', description: 'Simulates a restore containing valid purchases. Billing is locked, so no entitlement is granted.', skinId: baseSkinId },
        { id: 'restore_invalid', label: 'Restore Invalid', description: 'Simulates a restore containing an invalid product.', skinId: baseSkinId },
        { id: 'purchase_revoked_locked', label: 'Revoke', description: 'Simulates a refund/revocation callback. Billing is locked, so it should not alter entitlements.', skinId: baseSkinId }
    ];
}

export function runBillingDebugTest(testId, preferredSkinId = null) {
    const entity = getDefaultDebugEntity(preferredSkinId);
    const runtime = getPurchaseRuntimeInfo();

    if (testId === 'native_bridge_detection') {
        const report = runNativeBillingBridgeDetectionTest();
        const summary = {
            ok: report.ok,
            testId,
            status: report.status,
            billingLocked: !REAL_BILLING_ARMED,
            expectedLockedStatus: !REAL_BILLING_ARMED,
            validationOk: report.ok,
            validationErrors: report.blockingFailures.map(check => check.id),
            validationWarnings: report.warnings.map(check => check.id),
            result: safeJsonClone(report),
            runtime: getPurchaseRuntimeInfo(),
            at: getNowIso()
        };
        dispatchPurchaseEvent('billing-debug-result', summary);
        return summary;
    }

    if (testId === 'google_product_details_query') {
        return runGooglePlayProductDetailsQueryTest();
    }

    if (!entity) {
        const result = { ok: false, status: 'debug_no_catalog_entity', testId, runtime };
        appendPurchaseLog({ event: 'billing_debug_test_failed', testId, status: result.status });
        return result;
    }

    let payload;
    let result;
    let validation = null;

    switch (testId) {
        case 'google_success_locked':
            payload = makeDebugPayload(entity, 'google_play');
            validation = validateNativePurchasePayload(payload);
            result = processNativePurchaseSuccess(payload);
            break;

        case 'steam_success_locked':
            payload = makeDebugPayload(entity, 'steam');
            validation = validateNativePurchasePayload(payload);
            result = processNativePurchaseSuccess(payload);
            break;

        case 'invalid_product':
            payload = {
                productId: 'debug_invalid_legendary_product',
                googlePlayProductId: 'debug_invalid_legendary_product',
                platform: 'google_play',
                category: 'legendary_chigga_wear',
                entitlementType: 'permanent',
                consumable: false,
                requestId: makeRequestId('debug_invalid')
            };
            validation = validateNativePurchasePayload(payload);
            result = processNativePurchaseSuccess(payload);
            break;

        case 'purchase_failure':
            payload = makeDebugPayload(entity, 'google_play', { reason: 'debug_platform_failure' });
            validation = validateNativePurchasePayload(payload);
            result = processNativePurchaseFailure(payload);
            break;

        case 'purchase_cancelled':
            payload = makeDebugPayload(entity, 'google_play', { reason: 'debug_cancelled_by_user' });
            validation = validateNativePurchasePayload(payload);
            result = processNativePurchaseFailure(payload);
            break;

        case 'restore_success_locked':
            payload = {
                platform: 'google_play',
                productIds: [entity.googlePlayProductId || entity.productId],
                purchases: [makeDebugPayload(entity, 'google_play')],
                requestId: makeRequestId('debug_restore')
            };
            validation = validateNativePurchasePayload(payload.purchases[0]);
            result = processNativeRestoreSuccess(payload);
            break;

        case 'restore_invalid':
            payload = {
                platform: 'google_play',
                productIds: ['debug_invalid_restore_product'],
                purchases: [{ productId: 'debug_invalid_restore_product', platform: 'google_play' }],
                requestId: makeRequestId('debug_restore_invalid')
            };
            validation = validateNativePurchasePayload(payload.purchases[0]);
            result = processNativeRestoreSuccess(payload);
            break;

        case 'purchase_revoked_locked':
            payload = makeDebugPayload(entity, 'google_play', { reason: 'debug_refund_or_revocation' });
            validation = validateNativePurchasePayload(payload);
            result = processNativePurchaseRevoked(payload);
            break;

        default:
            result = { ok: false, status: 'debug_unknown_test', testId, runtime };
            break;
    }

    const summary = summarizeDebugResult(testId, result, validation);
    appendPurchaseLog({
        event: 'billing_debug_test_ran',
        testId,
        status: summary.status,
        skinId: entity.skinId,
        productId: payload?.productId || null,
        validationOk: summary.validationOk,
        validationErrors: summary.validationErrors
    });
    dispatchPurchaseEvent('billing-debug-result', summary);
    return summary;
}

export function runBillingDebugSuite(preferredSkinId = null) {
    return getBillingDebugTestCases(preferredSkinId).map(test => runBillingDebugTest(test.id, preferredSkinId));
}

export function registerNativeBillingCallbacks() {
    const win = getWindow();
    if (!win) return false;

    const api = {
        adapterVersion: PLATFORM_PURCHASE_ADAPTER_VERSION,
        realBillingArmed: REAL_BILLING_ARMED,
        getRuntimeInfo: () => getPurchaseRuntimeInfo(),
        getCatalog: () => getNativePurchaseCatalog(),
        getValidationReport: () => getPurchaseValidationReport(),
        getReleaseGuardReport: () => getBillingReleaseGuardReport(),
        verifyLiveReleaseReadiness: () => verifyLiveReleaseReadiness(),
        getBillingBridgeCapabilities: () => getBillingBridgeCapabilities(),
        getNativeBillingBridgeDetectionReport: () => getNativeBillingBridgeDetectionReport(),
        runNativeBillingBridgeDetectionTest: () => runNativeBillingBridgeDetectionTest(),
        runGooglePlayProductDetailsQueryTest: () => runGooglePlayProductDetailsQueryTest(),
        getLastGooglePlayProductDetailsQueryReport: () => getLastGooglePlayProductDetailsQueryReport(),
        isRealBillingArmed: () => isRealBillingArmed(),
        validateProduct: payload => validateLegendaryProductReference(payload),
        validatePayload: payload => validateNativePurchasePayload(payload),
        getPurchaseLog: () => getPurchaseAdapterLog(),
        clearPurchaseLog: () => clearPurchaseAdapterLog(),
        isBillingDebugHarnessEnabled: () => isBillingDebugHarnessEnabled(),
        setBillingDebugHarnessEnabled: enabled => setBillingDebugHarnessEnabled(enabled),
        getBillingDebugTestCases: skinId => getBillingDebugTestCases(skinId),
        runBillingDebugTest: (testId, skinId) => runBillingDebugTest(testId, skinId),
        runBillingDebugSuite: skinId => runBillingDebugSuite(skinId),
        onPurchaseSuccess: payload => processNativePurchaseSuccess(payload),
        onPurchaseFailure: payload => processNativePurchaseFailure(payload),
        onPurchaseCancelled: payload => processNativePurchaseFailure({ ...(payload || {}), reason: payload?.reason || 'cancelled' }),
        onPurchaseRevoked: payload => processNativePurchaseRevoked(payload),
        onRestoreSuccess: payload => processNativeRestoreSuccess(payload),
        onRestoreFailure: payload => {
            const result = { ok: false, status: 'restore_failed', raw: safeJsonClone(payload), runtime: getPurchaseRuntimeInfo() };
            appendPurchaseLog({ event: 'restore_failed', reason: payload?.reason || payload?.error || null });
            dispatchPurchaseEvent('restore-failed', result);
            return result;
        },
        onProductDetailsQueryResult: payload => processGooglePlayProductDetailsQueryResult(payload)
    };

    registerGooglePlayProductDetailsEventListener(win);

    win.ChiggasPurchaseAdapter = api;
    win.ChiggasBillingCallbacks = api;
    callbacksRegistered = true;

    dispatchPurchaseEvent('adapter-ready', getPurchaseRuntimeInfo());
    appendPurchaseLog({ event: 'native_callback_api_registered', runtime: safeJsonClone(getPurchaseRuntimeInfo()) });
    return true;
}

export function getPurchaseResultMessage(result, fallbackName = 'ITEM') {
    const name = (result?.skin?.name || result?.grant?.name || fallbackName || 'ITEM').toUpperCase();

    switch (result?.status) {
        case 'already_owned':
            return 'ALREADY OWNED';
        case 'local_test_purchased':
            return `${name} TEST PURCHASED`;
        case 'local_test_restored':
            return `RESTORED ${result.count || 0} LOCAL TEST PURCHASES`;
        case 'platform_purchased':
            return `${name} PURCHASED`;
        case 'platform_restored':
            return `RESTORED ${result.count || 0} PURCHASES`;
        case 'native_purchase_started':
            return 'PURCHASE STARTED';
        case 'native_restore_started':
            return 'RESTORE STARTED';
        case 'native_callback_ignored_billing_not_armed':
            return 'REAL BILLING LOCKED';
        case 'product_validation_failed':
        case 'native_purchase_validation_failed':
        case 'native_revoke_validation_failed':
            return 'PRODUCT BLOCKED';
        case 'billing_blocked_by_release_guard':
        case 'restore_blocked_by_release_guard':
            return 'BILLING LOCKED';
        case 'platform_restored_with_rejections':
            return `RESTORED ${result.count || 0} VALID PURCHASES`;
        case 'invalid_item':
            return 'ITEM NOT AVAILABLE';
        case 'purchase_cancelled':
            return 'PURCHASE CANCELLED';
        case 'purchase_failed':
        case 'native_bridge_error':
            return 'PURCHASE FAILED';
        default:
            return result?.ok ? `${name} UNLOCKED` : 'PURCHASE UNAVAILABLE';
    }
}

registerNativeBillingCallbacks();