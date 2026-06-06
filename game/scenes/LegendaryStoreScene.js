import Phaser from 'phaser';
import { addResponsiveResizeHandler, getSafeBounds, isShortLandscape } from './ResponsiveLayout.js';
import { initSteamInputPromptManager, setSteamInputActionSet } from './SteamInputPromptManager.js';
import {
    getLegendaryStoreItems,
    isSkinPurchased,
    LEGENDARY_ITEM_PRICE_LABEL,
    getRarityColor
} from './SkinRegistry.js';
import {
    getPurchaseRuntimeInfo,
    getPurchaseButtonLabel,
    purchaseLegendarySkin,
    restoreLegendaryPurchases,
    getPurchaseResultMessage,
    isBillingDebugHarnessEnabled,
    setBillingDebugHarnessEnabled,
    getBillingDebugTestCases,
    runBillingDebugTest,
    runBillingDebugSuite,
    getPurchaseAdapterLog,
    clearPurchaseAdapterLog
} from './PlatformPurchaseAdapter.js';
// CHIGGAS_STEAM_INVENTORY_BRIDGE_PASS_83_IMPORT_BEGIN
import {
    syncSteamInventoryEntitlements,
    getSteamInventoryEntitlementBridgeTrace
} from './SteamInventoryEntitlementBridge.js';
// CHIGGAS_STEAM_INVENTORY_BRIDGE_PASS_83_IMPORT_END

export default class LegendaryStoreScene extends Phaser.Scene {
    constructor() {
        super('LegendaryStoreScene');
    }

    init(data = {}) {
        this.returnScene = data.returnScene || 'WardrobeScene';
        this.focusSkinId = data.focusSkinId || null;
        this.activeTab = data.activeTab || 'player';
    }

    preload() {
        getLegendaryStoreItems().forEach(skin => {
            if (skin.assetKey && skin.imagePath && !this.textures.exists(skin.assetKey)) {
                this.load.image(skin.assetKey, skin.imagePath);
            }
        });
    }

    create() {
        const { width, height } = this.scale;

        initSteamInputPromptManager();
        setSteamInputActionSet('legendaryStore');

        this._initMenuNavigation(() => this._goBack());
        this._navSequential = true;

        this.scrollY = this.scrollY || 0;
        this.dragStartY = null;
        this.dragStartScrollY = 0;
        this.activeTab = this.activeTab === 'soldier' ? 'soldier' : 'player';
        this._billingDebugEnabled = isBillingDebugHarnessEnabled();
        this._billingDebugTapCount = 0;

        this._bg = this.add.rectangle(width / 2, height / 2, width, height, 0x070007);
        this._titleText = this.add.text(width / 2, 42, 'LEGENDARY STORE', {
            fontSize: '52px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 10
        }).setOrigin(0.5);
        this._attachBillingDebugToggleGesture();

        const purchaseRuntime = getPurchaseRuntimeInfo();
        this._subtitleText = this.add.text(width / 2, 82, purchaseRuntime.storeSubtitle, {
            fontSize: '17px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: width - 40 }
        }).setOrigin(0.5);

        this.content = this.add.container(0, 0);
        this.detail = this.add.container(0, 0);

        this._rebuildStaticLayout();

        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            this._setScroll(this.scrollY - deltaY);
        });

        this.input.on('pointerdown', pointer => {
            if (!this._isInsideStoreViewport(pointer.x, pointer.y)) return;
            this.dragStartY = pointer.y;
            this.dragStartScrollY = this.scrollY;
        });

        this.input.on('pointermove', pointer => {
            if (this.dragStartY === null || !pointer.isDown) return;
            this._setScroll(this.dragStartScrollY + (pointer.y - this.dragStartY) * 1.1);
        });

        this.input.on('pointerup', () => {
            this.dragStartY = null;
        });

        this.input.keyboard?.on('keydown-ESC', () => this._goBack());

        addResponsiveResizeHandler(this, () => this._rebuildStaticLayout(), { debounceMs: 180, minDelta: 8 });
        this._setupNativePurchaseEventRefresh();
        // CHIGGAS_STEAM_INVENTORY_BRIDGE_PASS_83_CREATE_SYNC_BEGIN
        this._syncSteamInventoryEntitlementsOnOpen();
        // CHIGGAS_STEAM_INVENTORY_BRIDGE_PASS_83_CREATE_SYNC_END
    }




    // CHIGGAS_STEAM_INVENTORY_BRIDGE_PASS_83_METHOD_BEGIN
    async _syncSteamInventoryEntitlementsOnOpen() {
        try {
            const result = await syncSteamInventoryEntitlements({ mode: 'sync', reason: 'legendary_store_open' });
            this._lastSteamInventoryEntitlementSync = result || getSteamInventoryEntitlementBridgeTrace();

            if ((result?.grantedCount || 0) > 0) {
                this.time?.delayedCall(0, () => this._renderStore());
            }
        } catch (error) {
            console.warn('[Chiggas] Steam Inventory entitlement sync failed safely:', error);
        }
    }
    // CHIGGAS_STEAM_INVENTORY_BRIDGE_PASS_83_METHOD_END

    _setupNativePurchaseEventRefresh() {
        if (typeof window === 'undefined') return;

        const refresh = () => {
            if (!this.content || !this.time) return;
            this.time.delayedCall(0, () => this._renderStore());
        };

        const debugResult = event => {
            if (!this._billingDebugPanel?.active || !this._billingDebugResultText) return;
            this._updateBillingDebugResult(event?.detail || { status: 'billing_debug_result' });
        };

        this._nativePurchaseRefreshHandler = refresh;
        this._billingDebugResultHandler = debugResult;
        window.addEventListener('chiggas:purchase-success', refresh);
        window.addEventListener('chiggas:restore-success', refresh);
        window.addEventListener('chiggas:purchase-revoked', refresh);
        window.addEventListener('chiggas:billing-debug-toggle', refresh);
        window.addEventListener('chiggas:billing-debug-result', debugResult);
        window.addEventListener('chiggas:google-play-product-details-query', debugResult);

        this.events.once('shutdown', () => {
            window.removeEventListener('chiggas:purchase-success', refresh);
            window.removeEventListener('chiggas:restore-success', refresh);
            window.removeEventListener('chiggas:purchase-revoked', refresh);
            window.removeEventListener('chiggas:billing-debug-toggle', refresh);
            window.removeEventListener('chiggas:billing-debug-result', debugResult);
            window.removeEventListener('chiggas:google-play-product-details-query', debugResult);
            this._nativePurchaseRefreshHandler = null;
            this._billingDebugResultHandler = null;
            this._destroyBillingDebugPanel();
        });
    }

    _getLayout() {
        const { width, height } = this.scale;
        const safe = getSafeBounds(this, 12);
        const shortLandscape = isShortLandscape(this);
        const compact = width < 760 || height < 560 || safe.height < 500;
        const footerY = safe.bottom - (shortLandscape ? 24 : 30);
        const footerTop = footerY - (shortLandscape ? 24 : 28);
        const titleY = safe.top + (shortLandscape ? 22 : 34);
        const subtitleY = safe.top + (shortLandscape ? 52 : 72);
        const tabsY = safe.top + (shortLandscape ? 82 : 112);
        const storeTop = safe.top + (shortLandscape ? 145 : (compact ? 160 : 202));
        const storeBottom = Math.max(storeTop + 120, footerTop - 14);

        return {
            width,
            height,
            safe,
            compact,
            shortLandscape,
            titleY,
            subtitleY,
            tabsY,
            storeTop,
            storeBottom,
            footerY,
            buttonW: Math.min(shortLandscape ? 180 : 210, Math.max(132, safe.width * 0.42)),
            footerGap: Math.min(shortLandscape ? 212 : 264, Math.max(148, safe.width * 0.42))
        };
    }

    _rebuildStaticLayout() {
        const layout = this._getLayout();
        const { width, height, safe, compact, shortLandscape } = layout;

        this.dragStartY = null;
        this._bg?.setPosition(width / 2, height / 2).setSize(width, height);

        this._titleText
            ?.setPosition(safe.centerX, layout.titleY)
            .setFontSize(shortLandscape ? 30 : (compact ? 38 : 52))
            .setStroke('#000000', shortLandscape ? 7 : 10);

        this._subtitleText
            ?.setText(getPurchaseRuntimeInfo().storeSubtitle)
            .setPosition(safe.centerX, layout.subtitleY)
            .setFontSize(shortLandscape ? 12 : (compact ? 14 : 17))
            .setWordWrapWidth(Math.max(240, safe.width - 24));

        this._playerTabButton?.destroy();
        this._soldierTabButton?.destroy();
        this._restoreButton?.destroy();
        this._backButton?.destroy();
        this._debugButton?.destroy();
        this._debugButton = null;

        this._createTabs();
        this._renderStore();
        this._createFooterButtons();
        this._createDebugButtonIfEnabled();
        this._rebuildLegendaryStoreFocusOrder();
        this.time.delayedCall(0, () => this._focusFirstVisible());
    }

    _attachBillingDebugToggleGesture() {
        if (!this._titleText) return;

        this._titleText.setInteractive({ useHandCursor: true });
        this._titleText.on('pointerup', () => {
            this._billingDebugTapCount = (this._billingDebugTapCount || 0) + 1;

            if (this._billingDebugTapReset) this._billingDebugTapReset.remove(false);
            this._billingDebugTapReset = this.time.delayedCall(1400, () => {
                this._billingDebugTapCount = 0;
            });

            if (this._billingDebugTapCount < 5) return;

            this._billingDebugTapCount = 0;
            this._billingDebugEnabled = !this._billingDebugEnabled;
            setBillingDebugHarnessEnabled(this._billingDebugEnabled);
            this._toast(this._billingDebugEnabled ? 'BILLING DEBUG ON' : 'BILLING DEBUG OFF');
            this._rebuildStaticLayout();
        });
    }

    _createDebugButtonIfEnabled() {
        this._billingDebugEnabled = isBillingDebugHarnessEnabled();
        if (!this._billingDebugEnabled) return;

        const layout = this._getLayout();
        const x = layout.safe.right - (layout.shortLandscape ? 50 : 62);
        const y = layout.safe.top + (layout.shortLandscape ? 20 : 28);
        const w = layout.shortLandscape ? 92 : 118;
        const h = layout.shortLandscape ? 30 : 36;
        const fz = layout.shortLandscape ? 12 : 14;

        this._debugButton = this._createButton(x, y, 'DEBUG', 0x114477, () => this._showBillingDebugPanel(), w, h, fz);
        this._debugButton.setDepth(7000);
    }

    _getDebugSkinId() {
        const items = getLegendaryStoreItems(this.activeTab) || [];
        const focus = this.focusSkinId && items.find(item => item?.id === this.focusSkinId);
        return (focus || items[0])?.id || null;
    }

    _destroyBillingDebugPanel() {
        if (this._billingDebugPanel && this._billingDebugPanel.active) {
            this._billingDebugPanel.destroy(true);
        }
        this._billingDebugPanel = null;
        this._billingDebugResultText = null;
    }

    _showBillingDebugPanel() {
        if (this._billingDebugPanel?.active) {
            this._destroyBillingDebugPanel();
            return;
        }

        const layout = this._getLayout();
        const safe = layout.safe;
        const panelW = Math.min(620, Math.max(300, safe.width - 24));
        const panelH = Math.min(430, Math.max(260, safe.height - 42));
        const x = safe.centerX;
        const y = safe.centerY;
        const skinId = this._getDebugSkinId();
        const tests = getBillingDebugTestCases(skinId);
        const logs = getPurchaseAdapterLog();
        const lastLog = logs[logs.length - 1];
        const runtimeInfo = getPurchaseRuntimeInfo();
        const bridgeState = runtimeInfo.bridgeDetected ? 'Bridge: DETECTED' : 'Bridge: MISSING';

        const panel = this.add.container(x, y).setDepth(12000);
        const bg = this.add.graphics();
        bg.fillStyle(0x050505, 0.96);
        bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18);
        bg.lineStyle(4, 0xffdd00, 0.95);
        bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18);

        const title = this.add.text(0, -panelH / 2 + 28, 'BILLING DEBUG HARNESS', {
            fontSize: layout.shortLandscape ? '18px' : '24px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        const subtitle = this.add.text(0, -panelH / 2 + (layout.shortLandscape ? 54 : 66), `Target: ${skinId || 'none'} | ${bridgeState} | Real Billing: LOCKED`, {
            fontSize: layout.shortLandscape ? '10px' : '13px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            wordWrap: { width: panelW - 36 }
        }).setOrigin(0.5);

        panel.add([bg, title, subtitle]);

        const buttonW = Math.min(176, (panelW - 58) / 2);
        const buttonH = layout.shortLandscape ? 26 : 32;
        const startY = -panelH / 2 + (layout.shortLandscape ? 90 : 112);
        const rowGap = layout.shortLandscape ? 32 : 40;
        const colX = [-buttonW / 2 - 8, buttonW / 2 + 8];

        tests.forEach((test, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const btn = this._makeDebugPanelButton(colX[col], startY + row * rowGap, test.label, 0x333366, () => {
                const summary = runBillingDebugTest(test.id, skinId);
                this._updateBillingDebugResult(summary);
                this._renderStore();
            }, buttonW, buttonH, layout.shortLandscape ? 10 : 12);
            panel.add(btn);
        });

        const suiteBtn = this._makeDebugPanelButton(-buttonW / 2 - 8, panelH / 2 - 68, 'RUN SUITE', 0x225522, () => {
            const results = runBillingDebugSuite(skinId);
            this._updateBillingDebugResult(results[results.length - 1] || { status: 'suite_finished' }, `SUITE COMPLETE: ${results.length} TESTS`);
            this._renderStore();
        }, buttonW, buttonH, layout.shortLandscape ? 10 : 12);

        const clearBtn = this._makeDebugPanelButton(buttonW / 2 + 8, panelH / 2 - 68, 'CLEAR LOG', 0x663333, () => {
            clearPurchaseAdapterLog();
            this._updateBillingDebugResult({ status: 'purchase_log_cleared' }, 'LOG CLEARED');
        }, buttonW, buttonH, layout.shortLandscape ? 10 : 12);

        const closeBtn = this._makeDebugPanelButton(0, panelH / 2 - 28, 'CLOSE', 0x444444, () => this._destroyBillingDebugPanel(), Math.min(220, panelW - 48), buttonH, layout.shortLandscape ? 10 : 12);

        this._billingDebugResultText = this.add.text(0, panelH / 2 - 108, lastLog ? `LAST: ${lastLog.event || lastLog.status || 'log entry'}` : 'No debug result yet.', {
            fontSize: layout.shortLandscape ? '10px' : '12px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            wordWrap: { width: panelW - 42 }
        }).setOrigin(0.5);

        panel.add([suiteBtn, clearBtn, closeBtn, this._billingDebugResultText]);
        this._billingDebugPanel = panel;
    }

    _makeDebugPanelButton(x, y, text, color, onClick, w, h, fz) {
        const btn = this.add.container(x, y);
        const bg = this.add.graphics();
        bg.fillStyle(color, 1);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
        bg.lineStyle(2, 0xffffff, 0.65);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);

        const label = this.add.text(0, 0, text, {
            fontSize: `${fz}px`,
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5);

        btn.add([bg, label]);
        btn.setSize(w, h);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => this.tweens.add({ targets: btn, scaleX: 0.94, scaleY: 0.94, duration: 70, yoyo: true, onComplete: onClick }));
        return btn;
    }

    _updateBillingDebugResult(summary, overrideText = null) {
        if (!this._billingDebugResultText) return;

        const status = overrideText || `${summary?.testId || 'DEBUG'}: ${summary?.status || 'unknown'}`;
        const counts = Number.isFinite(summary?.foundCount) || Number.isFinite(summary?.missingCount)
            ? ` | found ${summary?.foundCount ?? 0}/${summary?.expectedProductCount ?? summary?.requestedCount ?? 29}`
            : '';
        const validation = summary?.validationOk === false
            ? ` | issue: ${(summary.validationErrors || []).slice(0, 1).join('')}`
            : (summary?.validationOk === true ? ' | validation OK' : '');
        this._billingDebugResultText.setText(`${status}${counts}${validation}`);
    }

    _createFooterButtons() {
        const layout = this._getLayout();
        const restoreX = layout.safe.centerX - layout.footerGap / 2;
        const backX = layout.safe.centerX + layout.footerGap / 2;
        const btnH = layout.shortLandscape ? 38 : 42;
        const fontSize = layout.shortLandscape ? 15 : 17;

        this._restoreButton = this._createButton(restoreX, layout.footerY, 'RESTORE', 0x225522, () => {
            this._handleRestorePurchases();
        }, layout.buttonW, btnH, fontSize);

        this._backButton = this._createButton(backX, layout.footerY, 'BACK', 0x333333, () => this._goBack(), layout.buttonW, btnH, fontSize);
    }

    _rebuildLegendaryStoreFocusOrder() {
        const ordered = [];

        if (this._playerTabButton) ordered.push(this._playerTabButton);
        if (this._soldierTabButton) ordered.push(this._soldierTabButton);

        if (Array.isArray(this._storeCardButtons)) {
            ordered.push(...this._storeCardButtons);
        }

        if (this._debugButton) ordered.push(this._debugButton);
        if (this._restoreButton) ordered.push(this._restoreButton);
        if (this._backButton) ordered.push(this._backButton);

        this._menuButtons = ordered.filter(btn => this._isButtonUsable?.(btn));
        this._menuButtons.forEach((btn, index) => {
            btn._navOrder = index;
        });

        if (!this._isButtonUsable?.(this._focusedMenuButton)) {
            this._focusFirstVisible?.();
        }
    }

    _createTabs() {
        const layout = this._getLayout();
        const gap = Math.min(layout.shortLandscape ? 120 : 140, layout.safe.width * 0.22);
        const tabW = Math.min(layout.shortLandscape ? 156 : 190, Math.max(128, layout.safe.width * 0.34));
        const tabH = layout.shortLandscape ? 34 : 38;
        const fz = layout.shortLandscape ? 15 : 17;

        this._playerTabButton = this._createButton(layout.safe.centerX - gap, layout.tabsY, 'PLAYER', this.activeTab === 'player' ? 0xaa1111 : 0x333333, () => {
            this.activeTab = 'player';
            this.scrollY = 0;
            this._rebuildStaticLayout();
        }, tabW, tabH, fz);

        this._soldierTabButton = this._createButton(layout.safe.centerX + gap, layout.tabsY, 'SOLDIERS', this.activeTab === 'soldier' ? 0xaa1111 : 0x333333, () => {
            this.activeTab = 'soldier';
            this.scrollY = 0;
            this._rebuildStaticLayout();
        }, tabW, tabH, fz);
    }

    _renderStore() {
        const layout = this._getLayout();
        const { width, safe, compact, shortLandscape } = layout;

        this._storeCardButtons = [];
        this.content.removeAll(true);

        const top = layout.storeTop;
        const bottom = layout.storeBottom;
        const availableW = Math.max(220, safe.width - 20);
        const cardW = compact ? Math.min(shortLandscape ? 220 : 250, availableW) : 230;
        const cardH = compact ? (shortLandscape ? 150 : 166) : 198;
        const gap = compact ? (shortLandscape ? 12 : 16) : 22;
        const cols = compact ? Math.max(1, Math.floor((availableW + gap) / (cardW + gap))) : Math.max(2, Math.floor((availableW + gap) / (cardW + gap)));
        const startX = safe.centerX - ((cols - 1) * (cardW + gap)) / 2;

        const items = getLegendaryStoreItems(this.activeTab);
        const focusIndex = this.focusSkinId ? Math.max(0, items.findIndex(s => s.id === this.focusSkinId)) : 0;

        if (this.focusSkinId && focusIndex > 0 && this.scrollY === 0) {
            const focusRow = Math.floor(focusIndex / cols);
            this.scrollY = -focusRow * (cardH + gap);
        }

        items.forEach((skin, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;
            const x = startX + col * (cardW + gap);
            const y = top + row * (cardH + gap) + this.scrollY;

            if (y < top - cardH || y > bottom + cardH) return;

            const owned = isSkinPurchased(skin.id);
            const c = this.add.container(x, y);
            const rarityColor = getRarityColor(skin.rarity);

            const bg = this.add.graphics();
            bg.fillStyle(0x111111, 0.98);
            bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 18);
            bg.lineStyle(4, owned ? 0x39ff14 : rarityColor, 0.88);
            bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 18);

            const img = this.add.image(0, -cardH * 0.20, skin.assetKey);
            this._fitImage(img, cardW * 0.62, cardH * 0.44);

            const name = this.add.text(0, cardH * 0.13, skin.name.toUpperCase(), {
                fontSize: compact ? '13px' : '15px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center',
                wordWrap: { width: cardW - 24 }
            }).setOrigin(0.5);

            const price = this.add.text(0, cardH * 0.29, owned ? 'OWNED' : (skin.priceLabel || LEGENDARY_ITEM_PRICE_LABEL), {
                fontSize: compact ? '15px' : '18px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: owned ? '#39ff14' : '#ffdd00',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);

            // CHIGGAS_STORE_PASS_81D_DISPLAY_PRICE_LABEL_BEGIN
            const rawPurchaseLabel = getPurchaseButtonLabel(skin.id);
            const purchaseLabel = (rawPurchaseLabel === 'TEST BUY' || rawPurchaseLabel === 'Test Buy' || rawPurchaseLabel === 'test buy')
                ? '$0.99'
                : rawPurchaseLabel;
            // CHIGGAS_STORE_PASS_81D_DISPLAY_PRICE_LABEL_END
            const btn = this._makeCardButton(x, y + cardH * 0.42, owned ? 'OWNED' : purchaseLabel, owned ? 0x225522 : 0x6b1fa2, () => {
                this._handlePurchasePress(skin, owned);
            }, cardW - 36, 34, compact ? 13 : 15);

            c.add([bg, img, name, price]);
            this.content.add(c);
            this.content.add(btn);
            this._storeCardButtons.push(btn);
        });

        const totalRows = Math.ceil(items.length / Math.max(1, cols));
        this.minScroll = Math.min(0, bottom - top - totalRows * (cardH + gap) - gap);
        this.maxScroll = 0;
        this._setScroll(this.scrollY, false);
        this._rebuildLegendaryStoreFocusOrder();
        this.time.delayedCall(0, () => this._focusFirstVisible());
    }

    async _handlePurchasePress(skin, owned = false) {
        if (owned || !skin?.id || this._purchaseInProgress) return;

        this._purchaseInProgress = skin.id;

        try {
            const purchaseRuntime = getPurchaseRuntimeInfo();
            if (purchaseRuntime.platform !== 'steam') {
                const result = await purchaseLegendarySkin(skin.id);
                this._toast(getPurchaseResultMessage(result, skin.name));
                return;
            }

                        // CHIGGAS_STORE_PRE_LIVE_PURCHASE_LOCK_PASS_90_BEGIN
            if (true) {
                try {
                    if (typeof window !== 'undefined') {
                        window.__chiggasLastPreLivePurchaseBlockedPass90 = {
                            pass: 'steam_store_pre_live_purchase_lock_pass_90',
                            skinId: skin?.id || null,
                            time: new Date().toISOString(),
                            reason: 'real_steam_purchase_flow_not_enabled'
                        };
                    }
                } catch (_) {}
            
        // CHIGGAS_STEAM_STORE_ITEMSTORE_CANONICAL_MAP_PASS_91K_BEGIN
        const skinItemDefMapPass91K = {
            "skin_chigga_bball_team_black": 1001,
            "skin_chigga_bball_team_blue": 1002,
            "skin_chigga_bball_team_green": 1003,
            "skin_chigga_bball_team_purple": 1004,
            "skin_chigga_bball_team_red": 1005,
            "skin_chigga_fball_team_black": 1006,
            "skin_chigga_fball_team_green": 1007,
            "skin_chigga_fball_team_purple": 1008,
            "skin_chigga_fball_team_red": 1009,
            "skin_chigga_vamp": 1010,
            "skin_formal_fine_flea": 1011,
            "skin_mummified_mite": 1012,
            "skin_pinstripe_plague_boss": 1013,
            "skin_purple_velour_vandal": 1014,
            "soldier_lil_vamp_soldier": 2001,
            "soldier_soldier_0007_suit": 2002,
            "soldier_soldier_bball_blue": 2003,
            "soldier_soldier_bball_team_flame": 2004,
            "soldier_soldier_bball_team_green": 2005,
            "soldier_soldier_bball_team_purple": 2006,
            "soldier_soldier_bball_team_red": 2007,
            "soldier_soldier_franken_flea": 2008,
            "soldier_soldier_mummy_fit": 2009,
            "soldier_soldier_sour_prince": 2010,
            "soldier_soldier_team_black": 2011,
            "soldier_soldier_team_black_2": 2012,
            "soldier_soldier_team_blue": 2013,
            "soldier_soldier_team_green": 2014,
            "soldier_soldier_team_orange": 2015
};
        const skinIdPass91K = skin?.id || skin?.skinId || null;
        const itemdefidPass91K = skinItemDefMapPass91K[skinIdPass91K] || null;
        const itemStoreUrlPass91K = itemdefidPass91K
            ? 'https://store.steampowered.com/itemstore/4788490/detail/' + encodeURIComponent(String(itemdefidPass91K)) + '/'
            : 'https://store.steampowered.com/itemstore/4788490/browse/?filter=All';

        let itemStoreOpenResultPass91K = null;
        let rendererFallbackResultPass91K = null;
        let bridgeErrorPass91K = null;

        try {
            itemStoreOpenResultPass91K = await window.ChiggasSteamItemStoreExternal?.openItemStore?.({
                url: itemStoreUrlPass91K,
                skinId: skinIdPass91K,
                itemdefid: itemdefidPass91K,
                appId: 4788490
            });
        } catch (error) {
            bridgeErrorPass91K = error?.message || String(error);
        }

        if (!itemStoreOpenResultPass91K?.ok) {
            try {
                const opened = window.open(itemStoreUrlPass91K, '_blank', 'noopener,noreferrer');
                rendererFallbackResultPass91K = { ok: !!opened, method: 'window.open(https)', opened: !!opened };
            } catch (error) {
                rendererFallbackResultPass91K = { ok: false, method: 'window.open(https)', error: error?.message || String(error) };
            }
        }

        try {
            window.__chiggasLastSteamItemStoreCanonicalMapPass91K = {
                pass: 'steam_store_itemstore_canonical_map_pass_91k',
                time: new Date().toISOString(),
                skinId: skinIdPass91K,
                itemdefid: itemdefidPass91K || null,
                url: itemStoreUrlPass91K,
                canonicalMapVersion: 'steam_product_map_4788490_v2',
                bridgeAvailable: !!window.ChiggasSteamItemStoreExternal,
                bridgeKeys: window.ChiggasSteamItemStoreExternal ? Object.keys(window.ChiggasSteamItemStoreExternal) : [],
                bridgeResult: itemStoreOpenResultPass91K || null,
                bridgeError: bridgeErrorPass91K,
                rendererFallbackResult: rendererFallbackResultPass91K,
                localOwnershipGranted: false,
                autoRestoreAfterClick: false,
                realBillingArmedChanged: false,
                nextRequiredAction: 'manual_restore_after_real_steam_purchase'
            };
        } catch (_) {}

        if (itemStoreOpenResultPass91K?.ok || rendererFallbackResultPass91K?.ok) {
            this._toast(itemdefidPass91K ? 'STEAM ITEM PAGE OPENED' : 'STEAM ITEM STORE OPENED');
        } else {
            this._toast('OPEN STEAM STORE PAGE');
        }

        return;
        // CHIGGAS_STEAM_STORE_ITEMSTORE_CANONICAL_MAP_PASS_91K_END                return;
            }
            // CHIGGAS_STORE_PRE_LIVE_PURCHASE_LOCK_PASS_90_END
const result = await purchaseLegendarySkin(skin.id);
            this._toast(getPurchaseResultMessage(result, skin.name));
        } catch (error) {
            console.warn('[Chiggas] Purchase adapter error:', error);
            this._toast('PURCHASE TEST FAILED');
        } finally {
            this._purchaseInProgress = null;
            this._renderStore();
        }
    }

    async _handleRestorePurchases() {
        if (this._restoreInProgress) return;

        this._restoreInProgress = true;

        try {
            const result = await restoreLegendaryPurchases();
            const purchaseRuntime = getPurchaseRuntimeInfo();
            if (purchaseRuntime.platform !== 'steam') {
                this._toast(getPurchaseResultMessage(result));
                return;
            }

            // CHIGGAS_STEAM_INVENTORY_BRIDGE_PASS_83_RESTORE_SYNC_BEGIN
            const steamInventorySync = await syncSteamInventoryEntitlements({ mode: 'restore', reason: 'legendary_store_restore_button' });
            if (steamInventorySync?.grantedCount > 0 || steamInventorySync?.alreadyOwnedCount > 0) {
                this._toast(steamInventorySync.grantedCount > 0
                    ? `STEAM RESTORED ${steamInventorySync.grantedCount}`
                    : 'STEAM INVENTORY CHECKED');
            } else {
                this._toast(getPurchaseResultMessage(result));
            }
            return;
            // CHIGGAS_STEAM_INVENTORY_BRIDGE_PASS_83_RESTORE_SYNC_END
            this._toast(getPurchaseResultMessage(result));
        } catch (error) {
            console.warn('[Chiggas] Restore adapter error:', error);
            this._toast('RESTORE FAILED');
        } finally {
            this._restoreInProgress = false;
            this._renderStore();
        }
    }

    _isInsideStoreViewport(x, y) {
        const layout = this._getLayout();
        return x >= layout.safe.left && x <= layout.safe.right && y >= layout.storeTop && y <= layout.storeBottom;
    }

    _setScroll(value, rerender = true) {
        this.scrollY = Phaser.Math.Clamp(value, this.minScroll ?? -9999, this.maxScroll ?? 0);
        if (rerender) this._renderStore();
    }

    _makeCardButton(x, y, text, color, onClick, w, h, fz) {
        const btn = this.add.container(x, y).setDepth(1000);
        const bg = this.add.graphics();

        const draw = fill => {
            bg.clear();
            bg.fillStyle(fill, 1);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
            bg.lineStyle(3, 0xffffff, 0.65);
            bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
        };

        draw(color);

        const label = this.add.text(0, 0, text, {
            fontSize: `${fz}px`,
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        btn.add([bg, label]);
        btn.setSize(w, h);
        btn.setInteractive({ useHandCursor: true });
        this._registerMenuButton(btn, onClick, { w, h });
        btn.on('pointerdown', () => {
            this.tweens.add({ targets: btn, scaleX: 0.92, scaleY: 0.92, duration: 80, yoyo: true, onComplete: onClick });
        });
        return btn;
    }

    _createButton(x, y, text, color, onClick, w = 190, h = 44, fz = 18) {
        const btn = this.add.container(x, y).setDepth(1000);
        const bg = this.add.graphics();

        const draw = fill => {
            bg.clear();
            bg.fillStyle(fill, 1);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
            bg.lineStyle(4, 0xffffff, 0.66);
            bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
        };

        draw(color);

        const label = this.add.text(0, 0, text, {
            fontSize: `${fz}px`,
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        btn.add([bg, label]);
        btn.setSize(w, h);
        btn.setInteractive({ useHandCursor: true });
        this._registerMenuButton(btn, onClick, { w, h, group: 'storeCard' });
        btn.on('pointerdown', () => {
            this.tweens.add({ targets: btn, scaleX: 0.92, scaleY: 0.92, duration: 80, yoyo: true, onComplete: onClick });
        });
        return btn;
    }

    _fitImage(image, maxW, maxH) {
        if (!image) return;
        const scale = Math.min(maxW / Math.max(1, image.width), maxH / Math.max(1, image.height));
        image.setScale(scale);
    }

    _toast(message) {
        const { height } = this.scale;
        const safe = getSafeBounds(this, 18);
        if (this._toastText && this._toastText.active) this._toastText.destroy();

        this._toastText = this.add.text(safe.centerX, safe.bottom - 78, message, {
            fontSize: height < 560 ? '16px' : '22px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center',
            wordWrap: { width: Math.max(240, safe.width - 24) }
        }).setOrigin(0.5).setDepth(9000).setAlpha(0);

        this.tweens.add({
            targets: this._toastText,
            alpha: 1,
            y: this._toastText.y - 10,
            duration: 130,
            yoyo: true,
            hold: 850,
            onComplete: () => {
                if (this._toastText && this._toastText.active) {
                    this._toastText.destroy();
                    this._toastText = null;
                }
            }
        });
    }

    _goBack() {
        this.scene.start(this.returnScene || 'WardrobeScene');
    }
    _initMenuNavigation(onBack = null) {
        this._menuButtons = [];
        this._focusedMenuButton = null;
        this._menuNavBack = onBack;
        this._lastGamepadMoveAt = 0;
        this._navSequential = false;
        this._navOrderCounter = 0;

        if (this.input?.keyboard) {
            this.input.keyboard.on('keydown', event => {
                const key = event.key;
                if (key === 'ArrowUp' || key === 'w' || key === 'W') {
                    this._moveMenuFocus('up');
                } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
                    this._moveMenuFocus('down');
                } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
                    this._moveMenuFocus('left');
                } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
                    this._moveMenuFocus('right');
                } else if (key === 'Enter' || key === ' ') {
                    this._activateFocusedMenuButton();
                } else if (key === 'Escape' || key === 'Backspace') {
                    this._menuNavBack?.();
                }
            });
        }

        if (this.input?.gamepad) {
            this.input.gamepad.on('down', (pad, button, index) => {
                const buttonIndex = button?.index ?? index;
                if (buttonIndex === 0) {
                    this._activateFocusedMenuButton();
                } else if (buttonIndex === 1 || buttonIndex === 8) {
                    this._menuNavBack?.();
                } else if (buttonIndex === 12) {
                    this._moveMenuFocus('up');
                } else if (buttonIndex === 13) {
                    this._moveMenuFocus('down');
                } else if (buttonIndex === 14) {
                    this._moveMenuFocus('left');
                } else if (buttonIndex === 15) {
                    this._moveMenuFocus('right');
                }
            });
        }

        this.events.once('shutdown', () => {
            this._menuButtons = [];
            this._focusedMenuButton = null;
        });
    }

    _registerFocusable(btn, onClick, options = {}) {
        return this._registerMenuButton(btn, onClick, options);
    }

    _registerMenuButton(btn, onClick, options = {}) {
        if (!btn) return btn;

        btn._navAction = onClick;
        btn._navGroup = options.group || btn._navGroup || 'default';
        btn._navW = options.w || btn._navW || btn.input?.hitArea?.width || btn.width || 160;
        btn._navH = options.h || btn._navH || btn.input?.hitArea?.height || btn.height || 44;
        btn._navOrder = this._navOrderCounter++;

        if (!btn._navFocusRing) {
            const ring = this.add.graphics();
            ring.setVisible(false);
            ring.setDepth(9999);
            btn.add(ring);
            btn._navFocusRing = ring;
        }

        if (!this._menuButtons) this._menuButtons = [];
        if (!this._menuButtons.includes(btn)) this._menuButtons.push(btn);

        btn.on('pointerover', () => this._focusMenuButton(btn));
        return btn;
    }

    _isButtonUsable(btn) {
        if (!btn || !btn.active || !btn.visible) return false;

        let current = btn;
        while (current) {
            if (current.visible === false || current.active === false) return false;
            current = current.parentContainer;
        }

        return true;
    }

    _getVisibleMenuButtons() {
        return (this._menuButtons || []).filter(btn => this._isButtonUsable(btn));
    }

    _getButtonWorldPos(btn) {
        if (!btn) return { x: 0, y: 0 };

        try {
            const matrix = btn.getWorldTransformMatrix();
            return { x: matrix.tx, y: matrix.ty };
        } catch (e) {
            let x = btn.x || 0;
            let y = btn.y || 0;
            let current = btn.parentContainer;
            while (current) {
                x += current.x || 0;
                y += current.y || 0;
                current = current.parentContainer;
            }
            return { x, y };
        }
    }

    _focusFirstVisible() {
        const buttons = this._getVisibleMenuButtons()
            .sort((a, b) => (a._navOrder ?? 0) - (b._navOrder ?? 0));

        if (buttons.length > 0) {
            this._focusMenuButton(buttons[0]);
        }
    }

    _focusMenuButton(btn) {
        if (!this._isButtonUsable(btn)) return;

        if (this._focusedMenuButton?._navFocusRing) {
            this._focusedMenuButton._navFocusRing.setVisible(false);
        }

        this._focusedMenuButton = btn;

        if (btn._navFocusRing) {
            btn._navFocusRing.clear();
            btn._navFocusRing.lineStyle(4, 0xffdd00, 1);
            btn._navFocusRing.strokeRoundedRect(
                -btn._navW / 2 - 5,
                -btn._navH / 2 - 5,
                btn._navW + 10,
                btn._navH + 10,
                Math.max(10, btn._navH / 4)
            );
            btn._navFocusRing.setVisible(true);
        }
    }

    _moveMenuFocus(direction) {
        const buttons = this._getVisibleMenuButtons();
        if (buttons.length === 0) return;

        if (!this._isButtonUsable(this._focusedMenuButton)) {
            this._focusFirstVisible();
            return;
        }

        if (this._navSequential) {
            const ordered = buttons.slice().sort((a, b) => (a._navOrder ?? 0) - (b._navOrder ?? 0));
            const currentIndex = Math.max(0, ordered.indexOf(this._focusedMenuButton));
            const step = (direction === 'left' || direction === 'up') ? -1 : 1;
            const nextIndex = (currentIndex + step + ordered.length) % ordered.length;
            this._focusMenuButton(ordered[nextIndex]);
            return;
        }

        const current = this._focusedMenuButton;
        const currentPos = this._getButtonWorldPos(current);
        let best = null;
        let bestScore = Infinity;

        buttons.forEach(candidate => {
            if (candidate === current) return;

            const pos = this._getButtonWorldPos(candidate);
            const dx = pos.x - currentPos.x;
            const dy = pos.y - currentPos.y;

            if (direction === 'up' && dy >= -6) return;
            if (direction === 'down' && dy <= 6) return;
            if (direction === 'left' && dx >= -6) return;
            if (direction === 'right' && dx <= 6) return;

            const primary = (direction === 'up' || direction === 'down') ? Math.abs(dy) : Math.abs(dx);
            const secondary = (direction === 'up' || direction === 'down') ? Math.abs(dx) : Math.abs(dy);
            const score = primary * 1000 + secondary;

            if (score < bestScore) {
                bestScore = score;
                best = candidate;
            }
        });

        if (!best) {
            const sorted = buttons.slice().sort((a, b) => {
                const ap = this._getButtonWorldPos(a);
                const bp = this._getButtonWorldPos(b);
                if (direction === 'up' || direction === 'down') return (ap.y - bp.y) || (ap.x - bp.x);
                return (ap.x - bp.x) || (ap.y - bp.y);
            });

            best = (direction === 'up' || direction === 'left') ? sorted[sorted.length - 1] : sorted[0];
        }

        this._focusMenuButton(best);
    }

    _activateFocusedMenuButton() {
        const btn = this._focusedMenuButton;
        if (!this._isButtonUsable(btn)) {
            this._focusFirstVisible();
            return;
        }

        if (typeof btn._navAction === 'function') {
            btn._navAction();
        } else {
            btn.emit?.('pointerdown');
        }
    }

    _pollMenuGamepadStick(time) {
        const pad = this.input?.gamepad?.getPad?.(0);
        if (!pad || time - (this._lastGamepadMoveAt || 0) < 220) return;

        const axisX = pad.axes?.[0]?.getValue?.() ?? 0;
        const axisY = pad.axes?.[1]?.getValue?.() ?? 0;

        if (Math.abs(axisX) < 0.55 && Math.abs(axisY) < 0.55) return;

        if (Math.abs(axisX) > Math.abs(axisY)) {
            this._moveMenuFocus(axisX > 0 ? 'right' : 'left');
        } else {
            this._moveMenuFocus(axisY > 0 ? 'down' : 'up');
        }

        this._lastGamepadMoveAt = time;
    }

    update(time, delta) {
        this._pollMenuGamepadStick(time);
        this._pollStoreRightStickScroll(time);
    }

    _pollStoreRightStickScroll(time) {
        const pad = this.input?.gamepad?.getPad?.(0);
        if (!pad) return;

        const rightY = pad.axes?.[3]?.getValue?.() ?? 0;
        if (Math.abs(rightY) < 0.35) return;

        this._setScroll(this.scrollY - rightY * 18);
    }


}
