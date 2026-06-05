package com.krysez.chiggas;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;
import com.android.billingclient.api.UnfetchedProduct;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.Set;

/**
 * Native Android bridge for Chiggas Legendary Chigga Wear purchases.
 *
 * This is Pass 3 of the native billing bridge. It exposes a JavaScript bridge that the
 * Rosebud-side PlatformPurchaseAdapter can detect later, but Rosebud still keeps real billing
 * locked off until REAL_BILLING_ARMED is intentionally enabled in PlatformPurchaseAdapter.js.
 */
public class GooglePlayBillingBridge implements PurchasesUpdatedListener {
    private static final String PLATFORM = "google_play";
    private static final String CATEGORY = "legendary_chigga_wear";
    private static final String ENTITLEMENT_TYPE = "permanent";
    private static final String CURRENCY = "USD";
    private static final String PRICE_LABEL = "$0.99";

    private static final String[] LEGENDARY_PRODUCT_IDS = new String[] {
        "chigga_wear_skin_chigga_bball_team_black",
        "chigga_wear_skin_chigga_bball_team_blue",
        "chigga_wear_skin_chigga_bball_team_green",
        "chigga_wear_skin_chigga_bball_team_purple",
        "chigga_wear_skin_chigga_bball_team_red",
        "chigga_wear_skin_chigga_fball_team_black",
        "chigga_wear_skin_chigga_fball_team_green",
        "chigga_wear_skin_chigga_fball_team_purple",
        "chigga_wear_skin_chigga_fball_team_red",
        "chigga_wear_skin_chigga_vamp",
        "chigga_wear_skin_formal_fine_flea",
        "chigga_wear_skin_mummified_mite",
        "chigga_wear_skin_pinstripe_plague_boss",
        "chigga_wear_skin_purple_velour_vandal",
        "chigga_wear_soldier_lil_vamp_soldier",
        "chigga_wear_soldier_soldier_0007_suit",
        "chigga_wear_soldier_soldier_bball_blue",
        "chigga_wear_soldier_soldier_bball_team_flame",
        "chigga_wear_soldier_soldier_bball_team_green",
        "chigga_wear_soldier_soldier_bball_team_purple",
        "chigga_wear_soldier_soldier_bball_team_red",
        "chigga_wear_soldier_soldier_franken_flea",
        "chigga_wear_soldier_soldier_mummy_fit",
        "chigga_wear_soldier_soldier_sour_prince",
        "chigga_wear_soldier_soldier_team_black",
        "chigga_wear_soldier_soldier_team_black_2",
        "chigga_wear_soldier_soldier_team_blue",
        "chigga_wear_soldier_soldier_team_green",
        "chigga_wear_soldier_soldier_team_orange"
    };

    private final Activity activity;
    private final WebView webView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Set<String> allowedProductIds = new HashSet<>(Arrays.asList(LEGENDARY_PRODUCT_IDS));
    private final Map<String, ProductDetails> productDetailsById = new HashMap<>();
    private final Queue<Runnable> pendingBillingActions = new ArrayDeque<>();
    private final Map<String, String> requestIdByProductId = new HashMap<>();

    private BillingClient billingClient;
    private boolean isConnecting = false;
    private String lastConnectionStatus = "not_connected";
    private String lastDebugMessage = "";
    private JSONObject lastProductDetailsQueryReport = null;

    public GooglePlayBillingBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        setupBillingClient();
    }

    private void setupBillingClient() {
        PendingPurchasesParams pendingPurchasesParams = PendingPurchasesParams
            .newBuilder()
            .enableOneTimeProducts()
            .build();

        billingClient = BillingClient
            .newBuilder(activity)
            .setListener(this)
            .enablePendingPurchases(pendingPurchasesParams)
            .enableAutoServiceReconnection()
            .build();
    }

    public void connect() {
        mainHandler.post(() -> ensureConnected(null));
    }

    public void onResume() {
        connect();
    }

    public void destroy() {
        mainHandler.post(() -> {
            pendingBillingActions.clear();
            if (billingClient != null && billingClient.isReady()) {
                billingClient.endConnection();
            }
            lastConnectionStatus = "destroyed";
        });
    }

    public void injectJavascriptBridge() {
        mainHandler.post(this::injectJavascriptBridgeNow);
        mainHandler.postDelayed(this::injectJavascriptBridgeNow, 500);
        mainHandler.postDelayed(this::injectJavascriptBridgeNow, 1500);
    }

    private void injectJavascriptBridgeNow() {
        if (webView == null) return;

        String script = "(function(){"
            + "if(!window.AndroidChiggasBilling){return;}"
            + "var parse=function(v){try{return (typeof v==='string')?JSON.parse(v):v;}catch(e){return {ok:false,status:'native_response_parse_failed',raw:String(v),error:String(e)}}};"
            + "var call=function(name,payload){try{return parse(window.AndroidChiggasBilling[name](JSON.stringify(payload||{})));}catch(e){return {ok:false,status:'native_bridge_exception',bridgeFunction:name,error:String(e)}}};"
            + "var bridge={"
            + "isNativeGooglePlayBillingBridge:true,"
            + "platform:'google_play',"
            + "purchaseLegendarySkin:function(payload){return call('purchaseLegendarySkin',payload);},"
            + "purchaseProduct:function(payload){return call('purchaseLegendarySkin',payload);},"
            + "buyProduct:function(payload){return call('purchaseLegendarySkin',payload);},"
            + "purchase:function(payload){return call('purchaseLegendarySkin',payload);},"
            + "restorePurchases:function(payload){return call('restorePurchases',payload);},"
            + "restoreProducts:function(payload){return call('restorePurchases',payload);},"
            + "syncInventory:function(payload){return call('restorePurchases',payload);},"
            + "restore:function(payload){return call('restorePurchases',payload);},"
            + "getCapabilities:function(){return call('getCapabilities',{});},"
            + "getCatalog:function(){return call('getCatalog',{});},"
            + "queryProductDetails:function(payload){return call('queryProductDetails',payload);},"
            + "queryProductDetailsTest:function(payload){return call('queryProductDetails',payload);},"
            + "queryAllProductDetails:function(payload){return call('queryProductDetails',payload);},"
            + "getLastProductDetailsQuery:function(){return call('getLastProductDetailsQuery',{});}"
            + "};"
            + "window.ChiggasBilling=bridge;"
            + "window.ChiggasNativeBilling=bridge;"
            + "window.AndroidBilling=bridge;"
            + "try{window.dispatchEvent(new CustomEvent('chiggasBillingBridgeReady',{detail:bridge.getCapabilities()}));}catch(e){}"
            + "})();";

        webView.evaluateJavascript(script, null);
    }

    @JavascriptInterface
    public String getCapabilities(String ignoredJson) {
        JSONObject out = baseResponse(true, "native_google_play_billing_bridge_ready");
        try {
            out.put("bridgeVersion", "android-billing-bridge-pass-3");
            out.put("billingClientReady", billingClient != null && billingClient.isReady());
            out.put("connectionStatus", lastConnectionStatus);
            out.put("lastDebugMessage", lastDebugMessage);
            out.put("supportedProductType", BillingClient.ProductType.INAPP);
            out.put("knownProductCount", LEGENDARY_PRODUCT_IDS.length);
            out.put("cachedProductDetailsCount", productDetailsById.size());
            out.put("productDetailsQueryBridgeReady", true);
            out.put("lastProductDetailsQueryStatus", lastProductDetailsQueryReport != null ? lastProductDetailsQueryReport.optString("status", "unknown") : "not_run");
            out.put("realBillingStillControlledByRosebud", true);
            out.put("purchaseBridgeReady", true);
            out.put("restoreBridgeReady", true);
        } catch (JSONException ignored) {}
        return out.toString();
    }

    @JavascriptInterface
    public String getCapabilities() {
        return getCapabilities("{}");
    }

    @JavascriptInterface
    public String getCatalog(String ignoredJson) {
        JSONObject out = baseResponse(true, "native_catalog_ready");
        try {
            JSONArray productIds = new JSONArray();
            for (String productId : LEGENDARY_PRODUCT_IDS) productIds.put(productId);
            out.put("platform", PLATFORM);
            out.put("productIds", productIds);
            out.put("count", LEGENDARY_PRODUCT_IDS.length);
            out.put("category", CATEGORY);
            out.put("entitlementType", ENTITLEMENT_TYPE);
            out.put("consumable", false);
            out.put("priceLabel", PRICE_LABEL);
        } catch (JSONException ignored) {}
        return out.toString();
    }

    @JavascriptInterface
    public String getCatalog() {
        return getCatalog("{}");
    }

    @JavascriptInterface
    public String queryProductDetails(String requestJson) {
        JSONObject request = parseJson(requestJson);
        String requestId = request.optString("requestId", "product_details_" + System.currentTimeMillis());
        List<String> requestedProductIds = getRequestedProductIds(request);

        if (requestedProductIds.isEmpty()) {
            return errorResponse("no_product_ids_requested", null, requestId, "No known Legendary product IDs were provided for ProductDetails query.");
        }

        ensureConnected(() -> queryProductDetailsForDebug(requestedProductIds, requestId));

        JSONObject out = baseResponse(true, "product_details_query_queued");
        try {
            out.put("requestId", requestId);
            out.put("requestedProductIds", new JSONArray(requestedProductIds));
            out.put("requestedCount", requestedProductIds.size());
            out.put("awaitingNativeCallback", true);
            out.put("callback", "onProductDetailsQueryResult");
        } catch (JSONException ignored) {}
        return out.toString();
    }

    @JavascriptInterface
    public String queryProductDetails() {
        return queryProductDetails("{}");
    }

    @JavascriptInterface
    public String getLastProductDetailsQuery(String ignoredJson) {
        if (lastProductDetailsQueryReport == null) {
            JSONObject out = baseResponse(false, "product_details_query_not_run");
            try {
                out.put("requestedCount", 0);
                out.put("foundCount", productDetailsById.size());
            } catch (JSONException ignored) {}
            return out.toString();
        }
        return lastProductDetailsQueryReport.toString();
    }

    @JavascriptInterface
    public String getLastProductDetailsQuery() {
        return getLastProductDetailsQuery("{}");
    }

    @JavascriptInterface
    public String purchaseLegendarySkin(String requestJson) {
        JSONObject request = parseJson(requestJson);
        String productId = getProductIdFromRequest(request);
        String requestId = request.optString("requestId", "");

        if (!isKnownProductId(productId)) {
            return errorResponse("unknown_product_id", productId, requestId, "Native bridge rejected an unknown Legendary product id.");
        }

        if (requestId != null && !requestId.isEmpty()) {
            requestIdByProductId.put(productId, requestId);
        }

        ensureConnected(() -> queryProductAndLaunchPurchase(productId, requestId));

        JSONObject out = baseResponse(true, "native_purchase_queued");
        try {
            out.put("productId", productId);
            out.put("googlePlayProductId", productId);
            out.put("requestId", requestId);
            out.put("awaitingNativeCallback", true);
        } catch (JSONException ignored) {}
        return out.toString();
    }

    @JavascriptInterface
    public String restorePurchases(String requestJson) {
        JSONObject request = parseJson(requestJson);
        String requestId = request.optString("requestId", "");

        ensureConnected(() -> queryOwnedPurchases(requestId));

        JSONObject out = baseResponse(true, "native_restore_queued");
        try {
            out.put("requestId", requestId);
            out.put("awaitingNativeCallback", true);
        } catch (JSONException ignored) {}
        return out.toString();
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        int code = billingResult != null ? billingResult.getResponseCode() : BillingClient.BillingResponseCode.ERROR;
        String debugMessage = billingResult != null ? billingResult.getDebugMessage() : "Missing BillingResult";
        lastDebugMessage = debugMessage;

        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase purchase : purchases) {
                handlePurchase(purchase, false);
            }
            return;
        }

        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            dispatchFailure("cancelled", "User cancelled the Google Play purchase flow.", null, null);
            return;
        }

        dispatchFailure("billing_response_" + code, debugMessage, null, null);
    }

    private void ensureConnected(Runnable afterConnected) {
        if (afterConnected != null) pendingBillingActions.add(afterConnected);

        if (billingClient != null && billingClient.isReady()) {
            lastConnectionStatus = "connected";
            drainPendingBillingActions();
            return;
        }

        if (isConnecting || billingClient == null) return;

        isConnecting = true;
        lastConnectionStatus = "connecting";

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                isConnecting = false;
                int code = billingResult != null ? billingResult.getResponseCode() : BillingClient.BillingResponseCode.ERROR;
                lastDebugMessage = billingResult != null ? billingResult.getDebugMessage() : "Missing BillingResult";

                if (code == BillingClient.BillingResponseCode.OK) {
                    lastConnectionStatus = "connected";
                    injectJavascriptBridge();
                    drainPendingBillingActions();
                } else {
                    lastConnectionStatus = "connection_failed_" + code;
                    pendingBillingActions.clear();
                    dispatchFailure("billing_connection_failed", lastDebugMessage, null, null);
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                isConnecting = false;
                lastConnectionStatus = "disconnected";
            }
        });
    }

    private void drainPendingBillingActions() {
        while (!pendingBillingActions.isEmpty()) {
            Runnable action = pendingBillingActions.poll();
            if (action != null) action.run();
        }
    }

    private List<String> getRequestedProductIds(JSONObject request) {
        List<String> ids = new ArrayList<>();

        JSONArray requested = null;
        if (request != null) {
            requested = request.optJSONArray("productIds");
            if (requested == null) requested = request.optJSONArray("googlePlayProductIds");
            if (requested == null) requested = request.optJSONArray("products");
        }

        if (requested != null) {
            for (int i = 0; i < requested.length(); i++) {
                String productId = requested.optString(i, "");
                if (isKnownProductId(productId) && !ids.contains(productId)) ids.add(productId);
            }
        }

        String singleProductId = getProductIdFromRequest(request);
        if (isKnownProductId(singleProductId) && !ids.contains(singleProductId)) ids.add(singleProductId);

        if (ids.isEmpty() && request != null && request.optBoolean("all", true)) {
            ids.addAll(Arrays.asList(LEGENDARY_PRODUCT_IDS));
        }

        return ids;
    }

    private void queryProductDetailsForDebug(List<String> requestedProductIds, String requestId) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String productId : requestedProductIds) {
            if (!isKnownProductId(productId)) continue;
            products.add(QueryProductDetailsParams.Product
                .newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.INAPP)
                .build());
        }

        if (products.isEmpty()) {
            JSONObject out = baseResponse(false, "product_details_query_no_known_products");
            try {
                out.put("requestId", requestId);
                out.put("requestedProductIds", new JSONArray(requestedProductIds));
                out.put("requestedCount", requestedProductIds.size());
                out.put("foundCount", 0);
                out.put("missingCount", requestedProductIds.size());
            } catch (JSONException ignored) {}
            lastProductDetailsQueryReport = out;
            dispatchCallback("onProductDetailsQueryResult", out);
            dispatchEvent("chiggasGooglePlayProductDetailsResult", out);
            return;
        }

        QueryProductDetailsParams params = QueryProductDetailsParams
            .newBuilder()
            .setProductList(products)
            .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsResult) -> {
            int code = billingResult != null ? billingResult.getResponseCode() : BillingClient.BillingResponseCode.ERROR;
            String debugMessage = billingResult != null ? billingResult.getDebugMessage() : "Missing BillingResult";
            lastDebugMessage = debugMessage;

            JSONObject out = baseResponse(code == BillingClient.BillingResponseCode.OK, "product_details_query_complete");
            JSONArray requested = new JSONArray();
            JSONArray foundIds = new JSONArray();
            JSONArray missingIds = new JSONArray();
            JSONArray productDetails = new JSONArray();
            JSONArray unfetchedProducts = new JSONArray();
            Set<String> foundIdSet = new HashSet<>();

            try {
                for (String id : requestedProductIds) requested.put(id);

                List<ProductDetails> detailsList = productDetailsResult != null ? productDetailsResult.getProductDetailsList() : null;
                if (detailsList != null) {
                    for (ProductDetails details : detailsList) {
                        if (details == null) continue;
                        String productId = details.getProductId();
                        foundIdSet.add(productId);
                        productDetailsById.put(productId, details);
                        foundIds.put(productId);
                        productDetails.put(productDetailsToJson(details));
                    }
                }

                if (productDetailsResult != null && productDetailsResult.getUnfetchedProductList() != null) {
                    for (UnfetchedProduct unfetched : productDetailsResult.getUnfetchedProductList()) {
                        if (unfetched == null) continue;
                        JSONObject item = new JSONObject();
                        item.put("productId", unfetched.getProductId());
                        item.put("productType", unfetched.getProductType());
                        item.put("statusCode", unfetched.getStatusCode());
                        unfetchedProducts.put(item);
                    }
                }

                for (String requestedId : requestedProductIds) {
                    if (!foundIdSet.contains(requestedId)) missingIds.put(requestedId);
                }

                out.put("requestId", requestId);
                out.put("platform", PLATFORM);
                out.put("billingResponseCode", code);
                out.put("debugMessage", debugMessage);
                out.put("requestedProductIds", requested);
                out.put("requestedCount", requestedProductIds.size());
                out.put("foundProductIds", foundIds);
                out.put("foundProducts", productDetails);
                out.put("foundCount", foundIds.length());
                out.put("missingProductIds", missingIds);
                out.put("missingCount", missingIds.length());
                out.put("unfetchedProducts", unfetchedProducts);
                out.put("unfetchedCount", unfetchedProducts.length());
                out.put("allProductsFound", missingIds.length() == 0 && foundIds.length() == requestedProductIds.size());
                out.put("cachedProductDetailsCount", productDetailsById.size());
                out.put("realBillingStillControlledByRosebud", true);
                out.put("doesNotLaunchPurchaseFlow", true);
            } catch (JSONException ignored) {}

            lastProductDetailsQueryReport = out;
            dispatchCallback("onProductDetailsQueryResult", out);
            dispatchEvent("chiggasGooglePlayProductDetailsResult", out);
        });
    }

    private JSONObject productDetailsToJson(ProductDetails details) {
        JSONObject out = new JSONObject();
        try {
            out.put("productId", details.getProductId());
            out.put("productType", details.getProductType());
            out.put("title", details.getTitle());
            out.put("name", details.getName());
            out.put("description", details.getDescription());

            ProductDetails.OneTimePurchaseOfferDetails offer = details.getOneTimePurchaseOfferDetails();
            if (offer != null) {
                out.put("formattedPrice", offer.getFormattedPrice());
                out.put("fullPriceMicros", offer.getFullPriceMicros());
                String offerId = offer.getOfferId();
                if (offerId != null) out.put("offerId", offerId);
                String offerToken = offer.getOfferToken();
                if (offerToken != null) out.put("offerToken", offerToken);
            }

            List<ProductDetails.OneTimePurchaseOfferDetails> offers = details.getOneTimePurchaseOfferDetailsList();
            if (offers != null) out.put("oneTimeOfferCount", offers.size());
        } catch (JSONException ignored) {}
        return out;
    }

    private void queryProductAndLaunchPurchase(String productId, String requestId) {
        ProductDetails cached = productDetailsById.get(productId);
        if (cached != null) {
            launchPurchaseFlow(cached, requestId);
            return;
        }

        List<QueryProductDetailsParams.Product> products = Collections.singletonList(
            QueryProductDetailsParams.Product
                .newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        );

        QueryProductDetailsParams params = QueryProductDetailsParams
            .newBuilder()
            .setProductList(products)
            .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsResult) -> {
            int code = billingResult != null ? billingResult.getResponseCode() : BillingClient.BillingResponseCode.ERROR;
            lastDebugMessage = billingResult != null ? billingResult.getDebugMessage() : "Missing BillingResult";

            if (code != BillingClient.BillingResponseCode.OK || productDetailsResult == null) {
                dispatchFailure("query_product_failed_" + code, lastDebugMessage, productId, requestId);
                return;
            }

            List<ProductDetails> detailsList = productDetailsResult.getProductDetailsList();
            if (detailsList == null || detailsList.isEmpty()) {
                dispatchFailure("product_unavailable", "Google Play returned no ProductDetails for " + productId, productId, requestId);
                return;
            }

            ProductDetails details = detailsList.get(0);
            productDetailsById.put(details.getProductId(), details);
            launchPurchaseFlow(details, requestId);
        });
    }

    private void launchPurchaseFlow(ProductDetails productDetails, String requestId) {
        BillingFlowParams.ProductDetailsParams.Builder detailsParamsBuilder = BillingFlowParams
            .ProductDetailsParams
            .newBuilder()
            .setProductDetails(productDetails);

        String offerToken = getOneTimeOfferToken(productDetails);
        if (offerToken != null && !offerToken.isEmpty()) {
            detailsParamsBuilder.setOfferToken(offerToken);
        }

        BillingFlowParams billingFlowParams = BillingFlowParams
            .newBuilder()
            .setProductDetailsParamsList(Collections.singletonList(detailsParamsBuilder.build()))
            .build();

        BillingResult launchResult = billingClient.launchBillingFlow(activity, billingFlowParams);
        int code = launchResult != null ? launchResult.getResponseCode() : BillingClient.BillingResponseCode.ERROR;
        lastDebugMessage = launchResult != null ? launchResult.getDebugMessage() : "Missing launch result";

        if (code != BillingClient.BillingResponseCode.OK) {
            dispatchFailure("launch_billing_flow_failed_" + code, lastDebugMessage, productDetails.getProductId(), requestId);
        }
    }

    private String getOneTimeOfferToken(ProductDetails productDetails) {
        try {
            List<ProductDetails.OneTimePurchaseOfferDetails> offers = productDetails.getOneTimePurchaseOfferDetailsList();
            if (offers != null && !offers.isEmpty() && offers.get(0) != null) {
                return offers.get(0).getOfferToken();
            }
        } catch (Exception ignored) {}

        try {
            ProductDetails.OneTimePurchaseOfferDetails offer = productDetails.getOneTimePurchaseOfferDetails();
            return offer != null ? offer.getOfferToken() : null;
        } catch (Exception ignored) {}

        return null;
    }

    private void queryOwnedPurchases(String requestId) {
        QueryPurchasesParams params = QueryPurchasesParams
            .newBuilder()
            .setProductType(BillingClient.ProductType.INAPP)
            .build();

        billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
            int code = billingResult != null ? billingResult.getResponseCode() : BillingClient.BillingResponseCode.ERROR;
            lastDebugMessage = billingResult != null ? billingResult.getDebugMessage() : "Missing BillingResult";

            if (code != BillingClient.BillingResponseCode.OK) {
                dispatchRestoreFailure("restore_query_failed_" + code, lastDebugMessage, requestId);
                return;
            }

            JSONArray productIds = new JSONArray();
            JSONArray purchasePayloads = new JSONArray();

            if (purchases != null) {
                for (Purchase purchase : purchases) {
                    if (purchase == null || purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;

                    JSONObject payload = makePurchasePayload(purchase, requestId);
                    JSONArray ids = payload.optJSONArray("productIds");
                    if (ids != null) {
                        for (int i = 0; i < ids.length(); i++) {
                            String productId = ids.optString(i, "");
                            if (isKnownProductId(productId)) productIds.put(productId);
                        }
                    }
                    purchasePayloads.put(payload);
                    acknowledgeIfNeeded(purchase);
                }
            }

            JSONObject out = baseResponse(true, "platform_restored");
            try {
                out.put("requestId", requestId);
                out.put("platform", PLATFORM);
                out.put("productIds", productIds);
                out.put("purchases", purchasePayloads);
                out.put("count", productIds.length());
            } catch (JSONException ignored) {}
            dispatchCallback("onRestoreSuccess", out);
        });
    }

    private void handlePurchase(Purchase purchase, boolean fromRestore) {
        if (purchase == null) return;

        List<String> products = purchase.getProducts();
        String productId = firstKnownProductId(products);
        String requestId = productId != null ? requestIdByProductId.remove(productId) : null;

        if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            dispatchFailure("purchase_pending", "Purchase is pending. Entitlement was not granted yet.", productId, requestId);
            return;
        }

        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) {
            dispatchFailure("purchase_not_completed", "Purchase state was not PURCHASED.", productId, requestId);
            return;
        }

        if (productId == null) {
            dispatchFailure("unknown_purchased_product", "Google Play purchase did not include a known Legendary product id.", null, requestId);
            return;
        }

        acknowledgeIfNeeded(purchase);
        JSONObject payload = makePurchasePayload(purchase, requestId);
        dispatchCallback("onPurchaseSuccess", payload);
    }

    private void acknowledgeIfNeeded(Purchase purchase) {
        if (purchase == null || purchase.isAcknowledged()) return;

        AcknowledgePurchaseParams params = AcknowledgePurchaseParams
            .newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken())
            .build();

        billingClient.acknowledgePurchase(params, billingResult -> {
            int code = billingResult != null ? billingResult.getResponseCode() : BillingClient.BillingResponseCode.ERROR;
            lastDebugMessage = billingResult != null ? billingResult.getDebugMessage() : "Missing acknowledgement result";

            JSONObject payload = baseResponse(code == BillingClient.BillingResponseCode.OK, "acknowledge_purchase_result");
            try {
                payload.put("billingResponseCode", code);
                payload.put("debugMessage", lastDebugMessage);
                payload.put("purchaseToken", purchase.getPurchaseToken());
                payload.put("productIds", new JSONArray(purchase.getProducts()));
            } catch (JSONException ignored) {}
            dispatchEvent("chiggasBillingAcknowledgeResult", payload);
        });
    }

    private JSONObject makePurchasePayload(Purchase purchase, String requestId) {
        JSONObject payload = baseResponse(true, "success");
        try {
            JSONArray ids = new JSONArray();
            String firstKnownId = null;
            for (String id : purchase.getProducts()) {
                ids.put(id);
                if (firstKnownId == null && isKnownProductId(id)) firstKnownId = id;
            }

            payload.put("platform", PLATFORM);
            payload.put("category", CATEGORY);
            payload.put("entitlementType", ENTITLEMENT_TYPE);
            payload.put("consumable", false);
            payload.put("currency", CURRENCY);
            payload.put("priceLabel", PRICE_LABEL);
            payload.put("productId", firstKnownId);
            payload.put("googlePlayProductId", firstKnownId);
            payload.put("productIds", ids);
            payload.put("purchaseToken", purchase.getPurchaseToken());
            payload.put("orderId", purchase.getOrderId());
            payload.put("packageName", purchase.getPackageName());
            payload.put("purchaseTime", purchase.getPurchaseTime());
            payload.put("purchaseState", purchase.getPurchaseState());
            payload.put("acknowledged", purchase.isAcknowledged());
            payload.put("quantity", purchase.getQuantity());
            payload.put("signature", purchase.getSignature());
            payload.put("originalJson", purchase.getOriginalJson());
            if (requestId != null && !requestId.isEmpty()) payload.put("requestId", requestId);
        } catch (JSONException ignored) {}
        return payload;
    }

    private void dispatchFailure(String reason, String message, String productId, String requestId) {
        JSONObject payload = baseResponse(false, "failure");
        try {
            payload.put("platform", PLATFORM);
            payload.put("reason", reason);
            payload.put("message", message);
            if (productId != null) {
                payload.put("productId", productId);
                payload.put("googlePlayProductId", productId);
            }
            if (requestId != null && !requestId.isEmpty()) payload.put("requestId", requestId);
        } catch (JSONException ignored) {}

        if ("cancelled".equals(reason)) {
            dispatchCallback("onPurchaseCancelled", payload);
        } else {
            dispatchCallback("onPurchaseFailure", payload);
        }
    }

    private void dispatchRestoreFailure(String reason, String message, String requestId) {
        JSONObject payload = baseResponse(false, "restore_failure");
        try {
            payload.put("platform", PLATFORM);
            payload.put("reason", reason);
            payload.put("message", message);
            if (requestId != null && !requestId.isEmpty()) payload.put("requestId", requestId);
        } catch (JSONException ignored) {}
        dispatchCallback("onRestoreFailure", payload);
    }

    private void dispatchCallback(String callbackName, JSONObject payload) {
        String script = "(function(){"
            + "var payload=" + payload.toString() + ";"
            + "try{"
            + "if(window.ChiggasBillingCallbacks&&typeof window.ChiggasBillingCallbacks." + callbackName + "==='function'){window.ChiggasBillingCallbacks." + callbackName + "(payload);return;}"
            + "window.dispatchEvent(new CustomEvent('chiggasNativeBillingCallback',{detail:{callback:'" + callbackName + "',payload:payload}}));"
            + "}catch(e){console.error('Chiggas native billing callback failed',e,payload);}"
            + "})();";

        mainHandler.post(() -> {
            if (webView != null) webView.evaluateJavascript(script, null);
        });
    }

    private void dispatchEvent(String eventName, JSONObject payload) {
        String script = "(function(){try{window.dispatchEvent(new CustomEvent('" + eventName + "',{detail:" + payload.toString() + "}));}catch(e){}})();";
        mainHandler.post(() -> {
            if (webView != null) webView.evaluateJavascript(script, null);
        });
    }

    private JSONObject parseJson(String requestJson) {
        if (requestJson == null || requestJson.trim().isEmpty()) return new JSONObject();
        try {
            return new JSONObject(requestJson);
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private String getProductIdFromRequest(JSONObject request) {
        if (request == null) return null;
        String productId = request.optString("productId", "");
        if (productId.isEmpty()) productId = request.optString("googlePlayProductId", "");
        if (productId.isEmpty()) productId = request.optString("sku", "");
        if (productId.isEmpty()) productId = request.optString("storeProductId", "");
        return productId.isEmpty() ? null : productId;
    }

    private boolean isKnownProductId(String productId) {
        return productId != null && allowedProductIds.contains(productId);
    }

    private String firstKnownProductId(List<String> productIds) {
        if (productIds == null) return null;
        for (String productId : productIds) {
            if (isKnownProductId(productId)) return productId;
        }
        return null;
    }

    private JSONObject baseResponse(boolean ok, String status) {
        JSONObject out = new JSONObject();
        try {
            out.put("ok", ok);
            out.put("status", status);
            out.put("platform", PLATFORM);
            out.put("createdAt", System.currentTimeMillis());
        } catch (JSONException ignored) {}
        return out;
    }

    private String errorResponse(String status, String productId, String requestId, String message) {
        JSONObject out = baseResponse(false, status);
        try {
            if (productId != null) out.put("productId", productId);
            if (requestId != null) out.put("requestId", requestId);
            out.put("message", message);
        } catch (JSONException ignored) {}
        return out.toString();
    }
}
