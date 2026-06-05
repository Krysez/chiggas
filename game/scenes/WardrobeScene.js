import Phaser from 'phaser';
import { getSafeBounds } from './ResponsiveLayout.js';
import { initSteamInputPromptManager, setSteamInputActionSet } from './SteamInputPromptManager.js';
import {
    getSkinsByType,
    getEquippedPlayerSkin,
    getEquippedSoldierSkin,
    setEquippedPlayerSkin,
    setEquippedSoldierSkin,
    isSkinUnlocked,
    getRarityColor,
    getUnlockRequirementText,
    LEGENDARY_ITEM_PRICE_LABEL
} from './SkinRegistry.js';

const RARITY_SORT = {
    common: 0,
    rare: 1,
    epic: 2,
    legendary: 3
};

export default class WardrobeScene extends Phaser.Scene {
    constructor() {
        super('WardrobeScene');
    }

    preload() {
        if (!this.textures.exists('my-chigga-title')) {
            this.load.image('my-chigga-title', 'assets/my-chigga-title.png');
        }

        ['player', 'soldier'].forEach(type => {
            getSkinsByType(type).forEach(skin => {
                if (skin.assetKey && skin.assetKey !== 'player' && !this.textures.exists(skin.assetKey)) {
                    this.load.image(skin.assetKey, skin.imagePath);
                }
            });
        });
    }

    create() {
        const { width, height } = this.scale;

        initSteamInputPromptManager();
        setSteamInputActionSet('wardrobe');
        const safe = getSafeBounds(this, 10);

        this._initMenuNavigation(() => this._goBack());
        this._navSequential = true;

        this._androidBackHandler = () => this._goBack();
        window.addEventListener('chiggasAndroidBack', this._androidBackHandler);

        this._returning = false;

        this.activeTab = 'player';
        this.selectedIndexByTab = { player: 0, soldier: 0 };
        this.scrollYByTab = { player: 0, soldier: 0 };
        this.dragStartY = null;
        this.dragStartScrollY = 0;

        const equippedPlayer = getEquippedPlayerSkin();
        const playerSkins = this._getSortedSkinsByType('player');
        const playerIndex = playerSkins.findIndex(s => s.id === equippedPlayer.id);
        this.selectedIndexByTab.player = Math.max(0, playerIndex);

        const equippedSoldier = getEquippedSoldierSkin();
        const soldierSkins = this._getSortedSkinsByType('soldier');
        const soldierIndex = soldierSkins.findIndex(s => s.id === equippedSoldier.id);
        this.selectedIndexByTab.soldier = Math.max(0, soldierIndex);

        this.add.rectangle(width / 2, height / 2, width, height, 0x070007);

        const shortLandscape = width > height && height < 560;

        this.add.text(safe.centerX, safe.top + (shortLandscape ? 16 : 24), 'CHIGGA WEAR', {
            fontSize: shortLandscape ? '30px' : (width < 700 ? '34px' : '48px'),
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        this.add.text(safe.centerX, safe.top + (shortLandscape ? 44 : 60), 'Choose your Chigga Wear and Soldier drip for the next takeover!', {
            fontSize: shortLandscape ? '11px' : (width < 700 ? '13px' : '18px'),
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: Math.max(240, safe.width - 24) }
        }).setOrigin(0.5);

        this._legendaryStoreButton = this.createButton(safe.right - (width < 700 ? 96 : 120), safe.top + (shortLandscape ? 30 : 36), 'LEGENDARY STORE', 0x6b1fa2, () => {
            this.scene.start('LegendaryStoreScene', {
                returnScene: 'WardrobeScene',
                activeTab: this.activeTab
            });
        }, null, width < 700 ? 190 : 230, shortLandscape ? 34 : 40, width < 700 ? 12 : 15);

        this.tabContainer = this.add.container(0, 0);
        this.cardContainer = this.add.container(0, 0);
        this.detailContainer = this.add.container(0, 0);
        this.previewContainer = this.add.container(0, 0);
        this.controlContainer = this.add.container(0, 0);

        this._createViewportMask();
        this._renderTabs();
        this._renderSkinCards();
        this._renderSelectedSkinDetails();
        this._renderTeamPreview();
        this._renderScrollControls();
        this._rebuildWardrobeFocusOrder();
        this.time.delayedCall(0, () => this._focusFirstVisible());
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            this._scrollBy(-deltaY);
        });

        this.input.on('pointerdown', pointer => {
            if (!this._isInsideCardViewport(pointer.x, pointer.y)) return;
            this.dragStartY = pointer.y;
            this.dragStartScrollY = this.scrollYByTab[this.activeTab] || 0;
        });

        this.input.on('pointermove', pointer => {
            if (this.dragStartY === null || !pointer.isDown) return;
            const delta = pointer.y - this.dragStartY;
            this._setScroll(this.dragStartScrollY + delta * 1.12);
        });

        this.input.on('pointerup', () => {
            this.dragStartY = null;
        });

        this.scale.on('resize', this._handleResize, this);
        this.events.once('shutdown', () => {
            this.scale.off('resize', this._handleResize, this);
        });
        this.events.once('shutdown', () => {
            this._returning = false;
            if (this._androidBackHandler) {
                window.removeEventListener('chiggasAndroidBack', this._androidBackHandler);
                this._androidBackHandler = null;
            }
        });
    }

    _handleResize() {
        this.scene.restart();
    }

    _getSortedSkinsByType(type) {
        const skins = getSkinsByType(type).slice();

        const getDisplayBucket = skin => {
            if (skin.isPreviewSlot) return -1;

            const unlocked = isSkinUnlocked(skin.id);
            if (unlocked) return 0;

            if (skin.unlockType === 'premium') return 2;

            return 1;
        };

        return skins.sort((a, b) => {
            const bucketA = getDisplayBucket(a);
            const bucketB = getDisplayBucket(b);
            if (bucketA !== bucketB) return bucketA - bucketB;

            const rarityA = RARITY_SORT[a.rarity] ?? 99;
            const rarityB = RARITY_SORT[b.rarity] ?? 99;
            if (rarityA !== rarityB) return rarityA - rarityB;

            return a.name.localeCompare(b.name);
        });
    }

    _getCurrentSkins() {
        return this._getSortedSkinsByType(this.activeTab);
    }

    _getSelectedIndex() {
        return this.selectedIndexByTab[this.activeTab] || 0;
    }

    _setSelectedIndex(index) {
        const skins = this._getCurrentSkins();
        this.selectedIndexByTab[this.activeTab] = Phaser.Math.Clamp(index, 0, Math.max(0, skins.length - 1));
    }

    _getSelectedSkin() {
        const skins = this._getCurrentSkins();
        return skins[this._getSelectedIndex()] || null;
    }

    _createViewportMask() {
        const { width, height } = this.scale;
        const safe = getSafeBounds(this, 12);

        const compact = width < 900 || height < 650 || safe.height < 620;
        const shortLandscape = compact && width > height;
        const reserveRightPreview = (!compact && width >= 1000) ? 280 : 0;

        const topY = safe.top + (compact ? (shortLandscape ? 108 : 128) : 114);
        const bottomReserve = compact
            ? (shortLandscape ? 250 : 292)
            : 364;

        // Keep a dedicated right-side strip for the scroll arrow buttons.
        // On mobile landscape, the arrows were sitting on top of the last
        // visible Chigga Wear card, making taps conflict with card selection.
        const sideMargin = compact ? 10 : 16;
        const scrollControlReserve = compact ? 68 : 58;
        const viewportX = safe.left + sideMargin;
        const viewportW = Math.max(220, safe.width - sideMargin * 2 - reserveRightPreview - scrollControlReserve);

        this.viewport = {
            x: viewportX,
            y: topY,
            w: viewportW,
            h: Math.max(shortLandscape ? 105 : 220, safe.bottom - topY - bottomReserve)
        };

        this._scrollControlX = Math.min(
            safe.right - reserveRightPreview - scrollControlReserve / 2,
            this.viewport.x + this.viewport.w + scrollControlReserve * 0.58
        );

        const maskShape = this.add.graphics();
        maskShape.fillStyle(0xffffff, 1);
        maskShape.fillRect(this.viewport.x, this.viewport.y, this.viewport.w, this.viewport.h);
        maskShape.setVisible(false);
        this.cardMask = maskShape.createGeometryMask();
        this.cardContainer.setMask(this.cardMask);
    }

    _isInsideCardViewport(x, y) {
        return x >= this.viewport.x && x <= this.viewport.x + this.viewport.w && y >= this.viewport.y && y <= this.viewport.y + this.viewport.h;
    }

    _rebuildWardrobeFocusOrder() {
        const ordered = [];

        if (this._playerTabButton) ordered.push(this._playerTabButton);
        if (this._soldierTabButton) ordered.push(this._soldierTabButton);
        if (this._legendaryStoreButton) ordered.push(this._legendaryStoreButton);

        if (Array.isArray(this._skinCardButtons)) {
            ordered.push(...this._skinCardButtons);
        }

        if (this._equipButton) ordered.push(this._equipButton);
        if (this._backButton) ordered.push(this._backButton);

        this._menuButtons = ordered.filter(btn => {
            if (!this._isButtonUsable?.(btn)) return false;

            // Skin cards should only be reachable when they are inside the visible scroll viewport.
            if (btn._navGroup === 'skinCard') {
                const pos = this._getButtonWorldPos?.(btn) || { x: btn.x, y: btn.y };
                return this._isInsideCardViewport(pos.x, pos.y);
            }

            return true;
        });

        this._menuButtons.forEach((btn, index) => {
            btn._navOrder = index;
        });

        if (!this._isButtonUsable?.(this._focusedMenuButton) || !this._menuButtons.includes(this._focusedMenuButton)) {
            this._focusFirstVisible?.();
        }
    }

    _renderTabs() {
        const { width, height } = this.scale;
        this.tabContainer.removeAll(true);

        const compact = width < 900 || height < 650;
        const shortLandscape = compact && width > height;
        const y = compact ? (shortLandscape ? 84 : 112) : 102;
        const tabW = Math.min(compact ? 145 : 190, width * 0.34);
        const tabH = compact ? 34 : 38;
        const gap = compact ? 10 : 16;

        const makeTab = (x, label, tabKey) => {
            const active = this.activeTab === tabKey;
            const color = active ? 0xaa1111 : 0x222222;
            const btn = this.createButton(x, y, label, color, () => {
                if (this.activeTab === tabKey) return;
                this.activeTab = tabKey;
                this._setScroll(this.scrollYByTab[this.activeTab] || 0, false);
                this._renderTabs();
                this._renderSkinCards();
                this._renderSelectedSkinDetails();
                this._renderTeamPreview();
                this._renderScrollControls();
                this._rebuildWardrobeFocusOrder();
            }, this.tabContainer, tabW, tabH, compact ? 15 : 18);
            btn.setAlpha(active ? 1 : 0.82);

            if (tabKey === 'player') this._playerTabButton = btn;
            if (tabKey === 'soldier') this._soldierTabButton = btn;
        };

        makeTab(width / 2 - tabW / 2 - gap / 2, 'PLAYER', 'player');
        makeTab(width / 2 + tabW / 2 + gap / 2, 'SOLDIERS', 'soldier');
    }

    _renderSkinCards() {
        const { width, height } = this.scale;
        this._skinCardButtons = [];
        this.cardContainer.removeAll(true);

        const skins = this._getCurrentSkins();
        const selectedIndex = this._getSelectedIndex();
        const compact = width < 900 || height < 650;
        const shortLandscape = compact && width > height;

        const cardW = shortLandscape ? 88 : (compact ? 104 : 128);
        const cardH = shortLandscape ? 108 : (compact ? 130 : 154);
        const gapX = shortLandscape ? 10 : (compact ? 12 : 20);
        const gapY = shortLandscape ? 12 : (compact ? 16 : 22);
        const cols = Math.max(2, Math.floor((this.viewport.w + gapX) / (cardW + gapX)));
        const totalGridW = cols * cardW + (cols - 1) * gapX;
        const startX = this.viewport.x + this.viewport.w / 2 - totalGridW / 2 + cardW / 2;
        const startY = this.viewport.y + 10 + (this.scrollYByTab[this.activeTab] || 0);

        this._gridRows = Math.ceil(skins.length / cols);
        this._gridContentH = this._gridRows * cardH + Math.max(0, this._gridRows - 1) * gapY + 24;
        this._maxScroll = Math.max(0, this._gridContentH - this.viewport.h);

        skins.forEach((skin, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = startX + col * (cardW + gapX);
            const y = startY + row * (cardH + gapY) + cardH / 2;

            const selected = index === selectedIndex;
            const unlocked = isSkinUnlocked(skin.id);
            const rarityColor = getRarityColor(skin.rarity);

            const c = this.add.container(x, y);
            const bg = this.add.graphics();
            bg.fillStyle(selected ? 0x2a1a00 : 0x111111, 0.96);
            bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 14);
            bg.lineStyle(selected ? 5 : 3, selected ? 0xffdd00 : rarityColor, selected ? 1 : 0.65);
            bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 14);

            const imgKey = this._getDisplayTextureKeyForSkin(skin);
            const img = this.add.image(0, shortLandscape ? -10 : -14, imgKey);
            const maxImgW = cardW * 0.72;
            const maxImgH = cardH * (shortLandscape ? 0.56 : 0.60);
            const scale = Math.min(maxImgW / Math.max(1, img.width), maxImgH / Math.max(1, img.height));
            img.setScale(scale);

            const label = this.add.text(0, cardH / 2 - (shortLandscape ? 16 : 18), skin.name, {
                fontSize: shortLandscape ? '11px' : (compact ? '12px' : '14px'),
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: unlocked ? '#ffffff' : '#777777',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'center',
                wordWrap: { width: cardW - 8 }
            }).setOrigin(0.5);

            if (!unlocked) {
                const lock = this.add.text(0, -2, 'LOCKED', {
                    fontSize: compact ? '14px' : '18px',
                    fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                    color: '#ff3333',
                    stroke: '#000000',
                    strokeThickness: 4
                }).setOrigin(0.5);
                c.add([bg, img, label, lock]);
            } else {
                c.add([bg, img, label]);
            }

            c.setSize(cardW, cardH);
            c.setInteractive({ useHandCursor: true });

            const selectCard = () => {
                this._setSelectedIndex(index);
                this._renderSkinCards();
                this._renderSelectedSkinDetails();
                this._renderTeamPreview();
                this._renderScrollControls();
                this._rebuildWardrobeFocusOrder();

                const nextCard = this._skinCardButtons?.[index];
                if (nextCard) this._focusMenuButton?.(nextCard);
            };

            this._registerMenuButton(c, selectCard, { w: cardW, h: cardH, group: 'skinCard' });
            this._skinCardButtons.push(c);

            c.on('pointerdown', pointer => {
                if (!this._isInsideCardViewport(pointer.x, pointer.y)) return;
                selectCard();
            });

            this.cardContainer.add(c);
        });

        this._rebuildWardrobeFocusOrder();
    }

    _renderSelectedSkinDetails() {
        const { width, height } = this.scale;
        const safe = getSafeBounds(this, 12);
        this.detailContainer.removeAll(true);

        const skin = this._getSelectedSkin();
        if (!skin) {
            const emptyMsg = this.add.text(safe.centerX, safe.bottom - 180, 'No skins available in this category yet.', {
                fontSize: '23px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);
            this.detailContainer.add(emptyMsg);
            return;
        }

        const equipped = this.activeTab === 'player'
            ? getEquippedPlayerSkin().id === skin.id
            : getEquippedSoldierSkin().id === skin.id;
        const unlocked = isSkinUnlocked(skin.id);
        const rarityColor = getRarityColor(skin.rarity);
        const requirementText = getUnlockRequirementText(skin);
        const statusText = unlocked ? 'UNLOCKED' : `LOCKED - ${requirementText}`;

        const compact = width < 900 || height < 650;
        const shortLandscape = compact && width > height;
        const previewReserve = (!compact && width >= 1000) ? 300 : 0;

        const panelW = Math.min(safe.width - 20 - previewReserve, compact ? safe.width - 24 : 650);
        const panelX = previewReserve > 0 ? (safe.left + (safe.width - previewReserve) / 2) : safe.centerX;

        const backButtonY = safe.bottom - (compact ? 18 : 24);
        const equipButtonY = compact ? safe.bottom - 58 : safe.bottom - 72;
        const panelH = compact ? (shortLandscape ? 58 : 74) : 136;
        const panelBottomGap = compact ? 54 : 70;
        const panelY = equipButtonY - panelBottomGap - panelH / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x111111, 0.96);
        panel.fillRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, compact ? 16 : 22);
        panel.lineStyle(compact ? 3 : 4, rarityColor, 0.75);
        panel.strokeRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, compact ? 16 : 22);

        const title = this.add.text(panelX, panelY - (compact ? (shortLandscape ? 13 : 20) : 38), skin.name.toUpperCase(), {
            fontSize: compact ? (shortLandscape ? '16px' : '19px') : '30px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: compact ? 4 : 5,
            align: 'center',
            wordWrap: { width: panelW - 36 }
        }).setOrigin(0.5);

        const rarity = this.add.text(panelX, panelY - (compact ? (shortLandscape ? -4 : 0) : 10), `RARITY: ${skin.rarity.toUpperCase()}  |  ${statusText}`, {
            fontSize: compact ? (shortLandscape ? '12px' : '14px') : '18px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#' + rarityColor.toString(16).padStart(6, '0'),
            stroke: '#000000',
            strokeThickness: compact ? 3 : 4,
            align: 'center',
            wordWrap: { width: panelW - 36 }
        }).setOrigin(0.5);

        let desc = null;
        if (!shortLandscape) {
            desc = this.add.text(panelX, panelY + (compact ? 20 : 30), skin.description, {
                fontSize: compact ? '13px' : '17px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'center',
                wordWrap: { width: panelW - 44 }
            }).setOrigin(0.5);
        }

        const premiumLocked = !unlocked && skin.unlockType === 'premium';
        const buttonText = equipped ? 'EQUIPPED' : (unlocked ? 'EQUIP' : (premiumLocked ? `BUY ${LEGENDARY_ITEM_PRICE_LABEL}` : 'LOCKED'));
        const buttonColor = equipped ? 0x1f6f1f : (unlocked ? 0xaa1111 : (premiumLocked ? 0x6b1fa2 : 0x333333));

        this._equipButton = this.createButton(panelX, equipButtonY, buttonText, buttonColor, () => {
            if (premiumLocked) {
                this.scene.start('LegendaryStoreScene', {
                    returnScene: 'WardrobeScene',
                    focusSkinId: skin.id,
                    activeTab: this.activeTab
                });
                return;
            }

            if (!unlocked || equipped) return;
            this._equipSelectedSkin();
        }, this.detailContainer, compact ? 180 : 230, compact ? 32 : 40, compact ? 15 : 19);

        this._backButton = this.createButton(panelX, backButtonY, 'BACK TO TITLE', 0x333333, () => {
            this._goBack();
        }, this.detailContainer, compact ? 190 : 250, compact ? 32 : 40, compact ? 14 : 18);
        const backBtn = this._backButton;

        const items = [panel, title, rarity];
        if (desc) items.push(desc);
        items.push(this._equipButton, backBtn);
        this.detailContainer.add(items);

        this._rebuildWardrobeFocusOrder();
    }


    _renderTeamPreview() {
        const { width, height } = this.scale;
        const safe = getSafeBounds(this, 12);
        this.previewContainer.removeAll(true);

        const compact = width < 1000 || height < 650 || safe.height < 620;

        // Mobile layouts do not have enough safe space for the team preview.
        // Hiding it prevents the preview from covering cards, details, and buttons.
        if (compact) return;

        const baseX = compact ? safe.right - 128 : safe.right - 150;
        const baseY = compact ? safe.bottom - 150 : safe.bottom - 145;

        const titleY = Math.max(58, baseY - 190);
        let panelTitle = null;

        if (this.textures.exists('my-chigga-title')) {
            panelTitle = this.add.image(baseX, titleY, 'my-chigga-title');
            this._fitImage(panelTitle, 210, 54);
            panelTitle.setDepth(12);
        } else {
            panelTitle = this.add.text(baseX, titleY, 'MY CHIGGA', {
                fontSize: '34px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ffdd00',
                stroke: '#ff0000',
                strokeThickness: 5,
                align: 'center'
            }).setOrigin(0.5).setDepth(12);
        }

        const playerSkin = this._getPlayerPreviewSkin();
        const soldierSkin = this._getSoldierPreviewSkin();

        const playerKey = this._getDisplayTextureKeyForSkin(playerSkin);
        const soldierKey = this._getDisplayTextureKeyForSkin(soldierSkin);

        const playerX = compact ? baseX - 8 : baseX;
        const playerY = compact ? baseY + 4 : baseY;

        const soldierX = compact ? playerX + 40 : playerX + 68;
        const soldierY = compact ? playerY + 26 : playerY + 34;

        const playerShadow = this.add.ellipse(playerX, playerY + 68, compact ? 90 : 116, compact ? 18 : 24, 0x000000, 0.28);
        const soldierShadow = this.add.ellipse(soldierX, soldierY + 26, compact ? 44 : 54, compact ? 10 : 14, 0x000000, 0.30);

        const playerBackGlow = this.add.circle(playerX - 4, playerY - 18, compact ? 44 : 60, 0xffdd00, 0.10);
        const soldierBackGlow = this.add.circle(soldierX + 2, soldierY - 10, compact ? 22 : 28, 0x66ccff, 0.12);

        const playerImg = this.add.image(playerX, playerY, playerKey);
        const soldierImg = this.add.image(soldierX, soldierY, soldierKey);

        this._fitImage(playerImg, compact ? 155 : 220, compact ? 185 : 265);
        this._fitImage(soldierImg, compact ? 60 : 78, compact ? 76 : 104);

        playerImg.setDepth(10);
        soldierImg.setDepth(11);

        this.previewContainer.add([
            panelTitle,
            playerShadow,
            soldierShadow,
            playerBackGlow,
            soldierBackGlow,
            playerImg,
            soldierImg
        ]);
    }

    _getPlayerPreviewSkin() {
        const selected = this._getSelectedSkin();
        if (this.activeTab === 'player' && selected) return selected;
        return getEquippedPlayerSkin();
    }

    _getSoldierPreviewSkin() {
        const selected = this._getSelectedSkin();
        if (this.activeTab === 'soldier' && selected) return selected;
        return getEquippedSoldierSkin();
    }

    _getDisplayTextureKeyForSkin(skin) {
        if (!skin) return 'player';
        if (this.textures.exists(skin.assetKey)) return skin.assetKey;
        if (skin.type === 'soldier') return this.textures.exists('chigga-neutral') ? 'chigga-neutral' : 'player';
        return 'player';
    }

    _fitImage(image, maxW, maxH) {
        const scale = Math.min(maxW / Math.max(1, image.width), maxH / Math.max(1, image.height));
        image.setScale(scale);
    }

    _renderScrollControls() {
        this.controlContainer.removeAll(true);

        if ((this._maxScroll || 0) <= 0) return;

        const { width, height } = this.scale;
        const compact = width < 900 || height < 650;
        const x = this._scrollControlX || (this.viewport.x + this.viewport.w + (compact ? 38 : 32));
        const btnW = compact ? 50 : 42;
        const btnH = compact ? 42 : 34;
        const fontSize = compact ? 22 : 18;

        // Button scrolling only. The scroll bar/track was removed because it
        // interfered with touch hit-testing on Android. Drag-scrolling inside
        // the card box still works through the pointer handlers in create().
        // The buttons now live in their own right-side strip, outside the card
        // viewport, so tapping arrows will not also tap the last visible panel.
        const up = this.createButton(x, this.viewport.y + btnH / 2 + 2, '▲', 0x333333, () => this._scrollBy(170), this.controlContainer, btnW, btnH, fontSize);
        const down = this.createButton(x, this.viewport.y + this.viewport.h - btnH / 2 - 2, '▼', 0x333333, () => this._scrollBy(-170), this.controlContainer, btnW, btnH, fontSize);

        up.setDepth(1000);
        down.setDepth(1000);
    }

    _scrollBy(delta) {
        this._setScroll((this.scrollYByTab[this.activeTab] || 0) + delta);
    }

    _setScroll(value, rerender = true) {
        const min = -(this._maxScroll || 0);
        const clamped = Phaser.Math.Clamp(value, min, 0);
        this.scrollYByTab[this.activeTab] = clamped;

        if (rerender) {
            this._renderSkinCards();
            this._renderScrollControls();
        }
    }

    _selectOffset(offset) {
        const skins = this._getCurrentSkins();
        if (skins.length === 0) return;

        const next = Phaser.Math.Wrap(this._getSelectedIndex() + offset, 0, skins.length);
        this._setSelectedIndex(next);
        this._renderSkinCards();
        this._renderSelectedSkinDetails();
        this._renderTeamPreview();
    }

    _equipSelectedSkin() {
        const skin = this._getSelectedSkin();
        if (!skin || !isSkinUnlocked(skin.id)) return;

        if (this.activeTab === 'player') {
            setEquippedPlayerSkin(skin.id);
            this._applySkinToPlayerTexture(skin);
        } else {
            setEquippedSoldierSkin(skin.id);
        }

        this._renderSkinCards();
        this._renderSelectedSkinDetails();
        this._renderTeamPreview();

        const { width, height } = this.scale;
        const msg = this.add.text(width / 2, height * 0.18, `${skin.name} Equipped!`, {
            fontSize: '26px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#00ff88',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(2000);

        this.tweens.add({
            targets: msg,
            y: msg.y - 24,
            alpha: 0,
            duration: 900,
            onComplete: () => msg.destroy()
        });
    }

    _applySkinToPlayerTexture(skin) {
        if (!skin || skin.assetKey === 'player') return;
        if (!this.textures.exists(skin.assetKey)) return;

        try {
            const sourceImage = this.textures.get(skin.assetKey).getSourceImage();
            if (!sourceImage) return;

            if (this.textures.exists('player')) {
                this.textures.remove('player');
            }

            this.textures.addImage('player', sourceImage);
        } catch (e) {
            console.warn('[WARDROBE] Could not swap player texture:', e);
        }
    }

    createButton(x, y, text, color, onClick, container = null, w = 260, h = 56, fz = 24) {
        const btn = this.add.container(x, y);
        const bg = this.add.graphics();

        const draw = (fillColor) => {
            bg.clear();
            bg.fillStyle(fillColor, 1);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 4);
            bg.lineStyle(4, 0xffffff, 0.45);
            bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 4);
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
        this._registerMenuButton?.(btn, onClick, { w, h });
        btn.on('pointerover', () => draw(Phaser.Display.Color.IntegerToColor(color).lighten(20).color));
        btn.on('pointerout', () => draw(color));
        btn.on('pointerdown', () => {
            btn.setScale(0.92);
            this.time.delayedCall(70, () => {
                if (btn && btn.active) btn.setScale(1);
                onClick();
            });
        });

        if (container) container.add(btn);
        return btn;
    }
    _goBack() {
        if (this._returning) return;
        this._returning = true;
        this.scene.start('MenuScene');
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
        this._pollWardrobeRightStickScroll(time);
    }

    _pollWardrobeRightStickScroll(time) {
        const pad = this.input?.gamepad?.getPad?.(0);
        if (!pad) return;

        const rightY = pad.axes?.[3]?.getValue?.() ?? 0;
        if (Math.abs(rightY) < 0.35) return;

        const current = this.scrollYByTab?.[this.activeTab] || 0;
        this._setScroll(current - rightY * 18, true);
    }


}