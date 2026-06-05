import Phaser from 'phaser';
import { initAudio, startMiniGameMusic, stopAmbientMusic, playCardFlip, playCardMatch, playCardWrong, playMiniGameWin } from '../audio/AudioManager.js';
import { getAllSkins, unlockMiniGameReward } from './SkinRegistry.js';

const MEMORY_MATCH_STORAGE_KEY = 'chiggas_memory_match_v1';

function shuffleArray(items) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export default class MemoryMatchScene extends Phaser.Scene {
    constructor() {
        super('MemoryMatchScene');
    }

    init(data = {}) {
        this.returnScene = data.returnScene || 'MenuScene';
        this.returnData = data.returnData || {};
        this.storyMode = !!data.storyMode;
        this.fromDebug = !!data.fromDebug;
    }

    create() {
        const { width, height } = this.scale;

        this._startMiniGameAudio('memory');

        this.cameras.main.setBackgroundColor('#070007');
        this.add.rectangle(width / 2, height / 2, width, height, 0x070007, 1);

        this.matchesFound = 0;
        this.moves = 0;
        this.score = 0;
        this.matchStartTime = 0;
        this.elapsedMatchSeconds = 0;
        this.locked = false;
        this._hasWon = false;
        this.rewardSkin = null;
        this.flipped = [];
        this.cards = [];

        const bg = this.add.graphics();
        bg.fillGradientStyle(0x120012, 0x120012, 0x000000, 0x000000, 1, 1, 1, 1);
        bg.fillRect(0, 0, width, height);

        this.add.text(width / 2, height < 560 ? 48 : 60, 'MEMORY MATCH', {
            fontSize: height < 560 ? '32px' : '46px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        this.subtitle = this.add.text(width / 2, height < 560 ? 84 : 102, this.storyMode ? 'Clear the board to unlock Mini Game mode!' : 'Match the Chigga Wear cards to clear the board!', {
            fontSize: height < 560 ? '15px' : '19px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        this.statusText = this.add.text(20, height < 560 ? 34 : 42, 'Moves: 0  |  Score: 0', {
            fontSize: height < 560 ? '15px' : '19px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#39ff14',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0, 0.5);

        this._createTopButton(width - 86, height < 560 ? 38 : 44, 'BACK', 0x333333, () => this._returnToMenu());

        const deckSkins = this._pickDeckSkins(6);
        const deck = shuffleArray([...deckSkins, ...deckSkins].map((skin, index) => ({
            uid: `${skin.id}_${index}`,
            matchId: skin.id,
            skin
        })));

        this._buildBoard(deck);
        this._loadBestText();
        this._playOpeningIntro();

        this.events.once('shutdown', () => this._cleanup());
        this.events.once('destroy', () => this._cleanup());
    }


    _playOpeningIntro() {
        const { width, height } = this.scale;

        this.locked = true;
        this.cards.forEach(card => {
            card.setAlpha(0);
            card.setScale(0.72);
        });

        const overlay = this.add.container(0, 0).setDepth(4500).setScrollFactor(0);
        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.92);

        const burst = this.add.graphics();
        burst.fillStyle(0xffdd00, 0.18);
        burst.fillCircle(width / 2, height / 2, Math.min(width, height) * 0.18);
        burst.lineStyle(7, 0xff0000, 0.9);
        burst.strokeCircle(width / 2, height / 2, Math.min(width, height) * 0.18);

        const title = this.add.text(width / 2, height / 2 - 82, 'MINI GAME MODE', {
            fontSize: height < 560 ? '34px' : '58px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: height < 560 ? 8 : 12,
            align: 'center'
        }).setOrigin(0.5).setScale(0.1).setAlpha(0);

        const sub = this.add.text(width / 2, height / 2, 'MEMORY MATCH', {
            fontSize: height < 560 ? '42px' : '74px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#39ff14',
            stroke: '#000000',
            strokeThickness: height < 560 ? 9 : 13,
            align: 'center'
        }).setOrigin(0.5).setScale(0.1).setAlpha(0);

        const callout = this.add.text(width / 2, height / 2 + 74, 'Flip. Match. Unlock the drip.', {
            fontSize: height < 560 ? '18px' : '28px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center'
        }).setOrigin(0.5).setAlpha(0);

        overlay.add([shade, burst, title, sub, callout]);

        const previewCards = [];
        const cardColors = [0xffdd00, 0xff3333, 0x39ff14, 0x8a44ff, 0x00c8ff, 0xff8800];
        for (let i = 0; i < 6; i++) {
            const card = this.add.graphics();
            const x = width / 2 + Math.cos(i / 6 * Math.PI * 2) * (height < 560 ? 115 : 170);
            const y = height / 2 + Math.sin(i / 6 * Math.PI * 2) * (height < 560 ? 80 : 120);
            card.fillStyle(0x111111, 1);
            card.fillRoundedRect(-28, -38, 56, 76, 10);
            card.lineStyle(4, cardColors[i], 0.95);
            card.strokeRoundedRect(-28, -38, 56, 76, 10);
            card.fillStyle(cardColors[i], 0.28);
            card.fillCircle(0, 0, 16);
            card.x = width / 2;
            card.y = height / 2;
            card.rotation = Phaser.Math.DegToRad(-35 + i * 14);
            card.setAlpha(0);
            card.setDepth(4502);
            overlay.add(card);
            previewCards.push({ card, x, y, rot: card.rotation });
        }

        this.tweens.add({
            targets: [title, sub],
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            duration: 520,
            ease: 'Back.easeOut'
        });

        this.tweens.add({
            targets: callout,
            alpha: 1,
            y: callout.y + 8,
            duration: 420,
            delay: 260,
            ease: 'Sine.easeOut'
        });

        previewCards.forEach((item, index) => {
            this.tweens.add({
                targets: item.card,
                x: item.x,
                y: item.y,
                alpha: 1,
                rotation: item.rot + Phaser.Math.DegToRad(360),
                duration: 650,
                delay: 190 + index * 45,
                ease: 'Back.easeOut'
            });
        });

        this.tweens.add({
            targets: burst,
            scaleX: 1.45,
            scaleY: 1.45,
            alpha: 0.15,
            duration: 700,
            yoyo: true,
            repeat: 1,
            ease: 'Sine.easeInOut'
        });

        this.time.delayedCall(1650, () => {
            this.tweens.add({
                targets: overlay,
                alpha: 0,
                duration: 360,
                ease: 'Sine.easeInOut',
                onComplete: () => overlay.destroy(true)
            });

            this.cards.forEach((card, index) => {
                this.tweens.add({
                    targets: card,
                    alpha: 1,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 330,
                    delay: index * 35,
                    ease: 'Back.easeOut'
                });
            });

            this.time.delayedCall(480, () => {
                if (!this._hasWon) {
                    this.locked = false;
                    this.matchStartTime = this.time.now;
                }
            });
        });
    }

    _pickDeckSkins(pairCount = 6) {
        const preferred = getAllSkins()
            .filter(skin => {
                return skin &&
                    skin.type === 'player' &&
                    !skin.isPreviewSlot &&
                    skin.assetKey &&
                    skin.imagePath &&
                    this.textures.exists(skin.assetKey);
            });

        const fallback = getAllSkins()
            .filter(skin => {
                return skin &&
                    !skin.isPreviewSlot &&
                    skin.assetKey &&
                    skin.imagePath &&
                    this.textures.exists(skin.assetKey);
            });

        const pool = preferred.length >= pairCount ? preferred : fallback;
        return shuffleArray(pool).slice(0, pairCount);
    }

    _buildBoard(deck) {
        const { width, height } = this.scale;
        const compact = height < 560 || width < 760;

        const cols = 4;
        const rows = 3;
        const boardTop = compact ? 118 : 146;
        const boardBottom = compact ? height - 56 : height - 70;
        const boardH = boardBottom - boardTop;
        const gap = compact ? 8 : 14;
        const maxCardW = (width - 36 - gap * (cols - 1)) / cols;
        const maxCardH = (boardH - gap * (rows - 1)) / rows;
        const cardW = Math.min(compact ? 124 : 154, maxCardW);
        const cardH = Math.min(compact ? 104 : 132, maxCardH);
        const totalW = cols * cardW + (cols - 1) * gap;
        const startX = width / 2 - totalW / 2 + cardW / 2;
        const startY = boardTop + cardH / 2;

        deck.forEach((cardData, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = startX + col * (cardW + gap);
            const y = startY + row * (cardH + gap);
            const card = this._createCard(x, y, cardW, cardH, cardData, compact);
            this.cards.push(card);
        });
    }

    _createCard(x, y, w, h, data, compact) {
        const container = this.add.container(x, y);
        container._matchId = data.matchId;
        container._skin = data.skin;
        container._isFlipped = false;
        container._isMatched = false;

        const back = this.add.graphics();
        const front = this.add.graphics();

        const drawBack = () => {
            back.clear();
            back.fillStyle(0x180018, 1);
            back.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
            back.lineStyle(4, 0xffdd00, 0.85);
            back.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
            back.fillStyle(0xffdd00, 0.18);
            back.fillCircle(0, 0, Math.min(w, h) * 0.28);
        };

        const drawFront = () => {
            front.clear();
            front.fillStyle(0x101010, 1);
            front.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
            front.lineStyle(4, this._getRarityColor(data.skin.rarity), 0.95);
            front.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
        };

        drawBack();
        drawFront();
        front.setVisible(false);

        const backLabel = this.add.text(0, 0, '?', {
            fontSize: compact ? '48px' : '66px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        const img = this.add.image(0, -h * 0.08, data.skin.assetKey);
        const maxImgW = w * 0.74;
        const maxImgH = h * 0.58;
        const scale = Math.min(maxImgW / Math.max(1, img.width), maxImgH / Math.max(1, img.height));
        img.setScale(scale);
        img.setVisible(false);

        const name = this.add.text(0, h * 0.34, data.skin.name, {
            fontSize: compact ? '10px' : '12px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            wordWrap: { width: w - 12 }
        }).setOrigin(0.5);
        name.setVisible(false);

        container.add([back, front, backLabel, img, name]);
        container.setSize(w, h);
        container.setInteractive({ useHandCursor: true });

        container.on('pointerdown', () => this._handleCardPress(container));

        container._showBack = () => {
            container._isFlipped = false;
            back.setVisible(true);
            backLabel.setVisible(true);
            front.setVisible(false);
            img.setVisible(false);
            name.setVisible(false);
        };

        container._showFront = () => {
            container._isFlipped = true;
            back.setVisible(false);
            backLabel.setVisible(false);
            front.setVisible(true);
            img.setVisible(true);
            name.setVisible(true);
        };

        return container;
    }

    _startMiniGameAudio(type = 'memory') {
        const start = () => {
            initAudio().then(() => startMiniGameMusic(type)).catch(() => {});
        };

        start();
        this.input.once('pointerdown', start);
        this.input.keyboard?.once('keydown', start);
        if (this.input.gamepad) this.input.gamepad.once('down', start);

        this.events.once('shutdown', () => stopAmbientMusic());
        this.events.once('destroy', () => stopAmbientMusic());
    }

    _handleCardPress(card) {
        if (this.locked || !card || card._isMatched || card._isFlipped) return;

        playCardFlip();
        card._showFront();
        this.tweens.add({
            targets: card,
            scaleX: 1.06,
            scaleY: 1.06,
            duration: 90,
            yoyo: true,
            ease: 'Sine.easeInOut'
        });

        this.flipped.push(card);

        if (this.flipped.length === 2) {
            this.moves += 1;
            this.locked = true;
            this._checkPair();
        }

        this._updateStatus();
    }

    _checkPair() {
        const [a, b] = this.flipped;
        const matched = a && b && a._matchId === b._matchId;

        if (matched) {
            playCardMatch();
            a._isMatched = true;
            b._isMatched = true;
            this.matchesFound += 1;

            [a, b].forEach(card => {
                this.tweens.add({
                    targets: card,
                    alpha: 0.72,
                    scaleX: 0.94,
                    scaleY: 0.94,
                    duration: 220,
                    ease: 'Back.easeOut'
                });
            });

            this._showFloatingText('+MATCH', 0x39ff14, (a.x + b.x) / 2, (a.y + b.y) / 2);
            this.flipped = [];
            this.locked = false;
            this._updateStatus();

            if (this.matchesFound >= 6) {
                this.time.delayedCall(450, () => this._winGame());
            }
            return;
        }

        playCardWrong();
        this._showFloatingText('NOPE', 0xff3333, (a.x + b.x) / 2, (a.y + b.y) / 2);

        this.time.delayedCall(700, () => {
            a?._showBack();
            b?._showBack();
            this.flipped = [];
            this.locked = false;
        });
    }

    _winGame() {
        if (this._hasWon) return;
        this._hasWon = true;
        this.locked = true;
        playMiniGameWin();

        this.elapsedMatchSeconds = this.matchStartTime
            ? Math.max(1, Math.floor((this.time.now - this.matchStartTime) / 1000))
            : 1;

        const timeScore = Math.max(1000, 10000 - this.elapsedMatchSeconds * 120);
        const movePenalty = Math.max(0, this.moves - 6) * 75;
        this.score = Math.max(500, timeScore - movePenalty);

        this.rewardSkin = this.storyMode ? this._claimMemoryReward() : null;
        this._saveBest(this.rewardSkin);

        const { width, height } = this.scale;
        const overlay = this.add.container(0, 0).setDepth(5000).setScrollFactor(0);
        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.86);
        const panelW = Math.min(560, width - 34);
        const panelH = Math.min(360, height - 42);
        const panelX = width / 2;
        const panelY = height / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x111111, 0.98);
        panel.fillRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 22);
        panel.lineStyle(5, 0x39ff14, 0.92);
        panel.strokeRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 22);

        const title = this.add.text(panelX, panelY - panelH / 2 + 58, 'BOARD CLEARED!', {
            fontSize: height < 560 ? '32px' : '48px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#39ff14',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        const rewardLine = this.storyMode
            ? 'Memory Match unlocked in the Mini-Games menu!'
            : 'Menu Run: Best score saved only';

        const body = this.add.text(panelX, panelY - 18, [
            `Time: ${this.elapsedMatchSeconds}s`,
            `Moves: ${this.moves}`,
            `Final Score: ${this.score}`,
            '',
            rewardLine,
            this.storyMode ? 'Legendary Chigga Wear remains purchase-only.' : 'No costume reward from menu play.'
        ].join('\n'), {
            fontSize: height < 560 ? '15px' : '20px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5);

        let rewardPreview = null;
        if (this.storyMode && this.rewardSkin && this.rewardSkin.assetKey && this.textures.exists(this.rewardSkin.assetKey)) {
            rewardPreview = this.add.image(panelX, panelY + (height < 560 ? 76 : 92), this.rewardSkin.assetKey);
            const maxPreviewW = height < 560 ? 58 : 74;
            const maxPreviewH = height < 560 ? 58 : 74;
            const previewScale = Math.min(maxPreviewW / Math.max(1, rewardPreview.width), maxPreviewH / Math.max(1, rewardPreview.height));
            rewardPreview.setScale(previewScale);
            rewardPreview.setAlpha(0);
            rewardPreview.setDepth(5002);

            this.tweens.add({
                targets: rewardPreview,
                alpha: 1,
                scaleX: previewScale * 1.12,
                scaleY: previewScale * 1.12,
                duration: 420,
                ease: 'Back.easeOut',
                yoyo: true
            });
        }

        overlay.add([shade, panel, title, body]);
        if (rewardPreview) overlay.add(rewardPreview);

        if (this.storyMode) {
            this._createOverlayButton(panelX, panelY + panelH / 2 - 58, 'CONTINUE', 0x225522, () => {
                this._returnToMenu();
            }, overlay, 220, 48, 20);
        } else {
            this._createOverlayButton(panelX - 120, panelY + panelH / 2 - 58, 'PLAY AGAIN', 0x225522, () => {
                this.scene.restart({
                    returnScene: this.returnScene,
                    returnData: this.returnData,
                    storyMode: this.storyMode,
                    fromDebug: this.fromDebug
                });
            }, overlay);

            this._createOverlayButton(panelX + 120, panelY + panelH / 2 - 58, 'MENU', 0xaa1111, () => {
                this._returnToMenu();
            }, overlay);
        }
    }

    update(time, delta) {
        if (!this._hasWon && !this.locked && this.matchStartTime) {
            this._updateStatus();
        }
    }

    _updateStatus() {
        if (this.statusText) {
            const elapsed = this.matchStartTime ? Math.floor((this.time.now - this.matchStartTime) / 1000) : 0;
            this.statusText.setText(`Moves: ${this.moves}  |  Time: ${elapsed}s`);
        }
    }

    _loadBestText() {
        const { width, height } = this.scale;
        const best = this._loadBestScore();
        this.bestText = this.add.text(width - 20, height - 18, `Best: ${best}`, {
            fontSize: height < 560 ? '13px' : '16px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#aaaaaa',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(1, 0.5);
    }

    _loadBestScore() {
        try {
            const raw = window.localStorage.getItem(MEMORY_MATCH_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return Math.max(0, Number(parsed.bestScore || 0));
        } catch (e) {
            return 0;
        }
    }

    _claimMemoryReward() {
        // Legendary Chigga Wear is purchase-only.
        // Memory Match no longer grants a costume reward.
        // Story-mode completion is saved by _saveBest(), which unlocks the mini-game from the main menu.
        return null;
    }

    _saveBest(rewardSkin = null) {
        try {
            const raw = window.localStorage.getItem(MEMORY_MATCH_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            const bestScore = Math.max(Number(parsed.bestScore || 0), this.score);
            window.localStorage.setItem(MEMORY_MATCH_STORAGE_KEY, JSON.stringify({
                ...parsed,
                bestScore,
                completedOnce: true,
                storyUnlocked: !!(parsed.storyUnlocked || this.storyMode),
                rewardClaimed: !!(parsed.rewardClaimed || (this.storyMode && rewardSkin)),
                rewardSkinId: parsed.rewardSkinId || (this.storyMode && rewardSkin ? rewardSkin.id : null) || null,
                lastScore: this.score,
                lastMoves: this.moves
            }));
        } catch (e) {}
    }

    _showFloatingText(text, color, x, y) {
        const t = this.add.text(x, y, text, {
            fontSize: '22px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: Phaser.Display.Color.IntegerToColor(color).rgba,
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(2000);

        this.tweens.add({
            targets: t,
            y: y - 44,
            alpha: 0,
            duration: 520,
            ease: 'Sine.easeOut',
            onComplete: () => t.destroy()
        });
    }

    _createTopButton(x, y, text, color, onClick) {
        return this._createOverlayButton(x, y, text, color, onClick, null, 132, 40, 16, 1000);
    }

    _createOverlayButton(x, y, text, color, onClick, container = null, w = 190, h = 46, fz = 18, depth = 5100) {
        const btn = this.add.container(x, y).setDepth(depth);
        const bg = this.add.graphics();
        const draw = (fillColor) => {
            bg.clear();
            bg.fillStyle(fillColor, 1);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
            bg.lineStyle(4, 0xffffff, 0.7);
            bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
        };
        draw(color);

        const label = this.add.text(0, 0, text, {
            fontSize: `${fz}px`,
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        btn.add([bg, label]);
        btn.setSize(w, h);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => draw(Phaser.Display.Color.IntegerToColor(color).lighten(18).color));
        btn.on('pointerout', () => draw(color));
        btn.on('pointerdown', () => {
            this.tweens.add({
                targets: btn,
                scaleX: 0.92,
                scaleY: 0.92,
                duration: 80,
                yoyo: true,
                onComplete: onClick
            });
        });

        if (container) container.add(btn);
        return btn;
    }

    _getRarityColor(rarity) {
        if (rarity === 'legendary') return 0xffaa00;
        if (rarity === 'epic') return 0x8a44ff;
        if (rarity === 'rare') return 0x008cff;
        return 0xffffff;
    }

    _returnToMenu() {
        this.scene.start(this.returnScene || 'MenuScene', this.returnData || {});
    }

    _cleanup() {}
}

// CHIGGAS_GAMEPLAY_STABILITY_PASS_92A_REPAIR_MEMORY_BEGIN
try {
    if (!MemoryMatchScene.prototype.__chiggasPass92ARepairInstalled) {
        MemoryMatchScene.prototype.__chiggasPass92ARepairInstalled = true;

        const __pass92AOrigCreate = MemoryMatchScene.prototype.create;
        MemoryMatchScene.prototype.create = function(...args) {
            const result = __pass92AOrigCreate.apply(this, args);
            try {
                this.__pass92AButtons = [];
                this.__pass92ASelectedButtonIndex = 0;
                this.__pass92ASelectedCardIndex = 0;
                this.__pass92AGamepadCooldownAt = 0;
                this.__pass92ACardSelectRing = this.add.graphics().setDepth(5200).setScrollFactor(0);
                this.input?.gamepad?.once?.('connected', () => {});
            } catch (_) {}
            return result;
        };

        const __pass92AOrigWin = MemoryMatchScene.prototype._winGame;
        if (typeof __pass92AOrigWin === 'function') {
            MemoryMatchScene.prototype._winGame = function(...args) {
                try {
                    this.__pass92AButtons = [];
                    this.__pass92ASelectedButtonIndex = 0;
                } catch (_) {}
                return __pass92AOrigWin.apply(this, args);
            };
        }

        const __pass92AOrigCreateOverlayButton = MemoryMatchScene.prototype._createOverlayButton;
        if (typeof __pass92AOrigCreateOverlayButton === 'function') {
            MemoryMatchScene.prototype._createOverlayButton = function(...args) {
                const btn = __pass92AOrigCreateOverlayButton.apply(this, args);
                try {
                    const label = String(args[2] || '').toUpperCase();
                    const onClick = args[4];
                    if (btn && typeof onClick === 'function') {
                        btn.__pass92AAction = onClick;
                        btn.__pass92ALabel = label;
                        this.__pass92AButtons = this.__pass92AButtons || [];
                        this.__pass92AButtons.push(btn);
                    }
                } catch (_) {}
                return btn;
            };
        }

        MemoryMatchScene.prototype.__pass92APad = function() {
            try {
                return this.input?.gamepad?.getPad?.(0) || null;
            } catch (_) {
                return null;
            }
        };

        MemoryMatchScene.prototype.__pass92AButtonDown = function(pad, indexes) {
            try {
                return indexes.some(i => !!pad?.buttons?.[i]?.pressed);
            } catch (_) {
                return false;
            }
        };

        MemoryMatchScene.prototype.__pass92AActiveButtons = function() {
            try {
                return (this.__pass92AButtons || []).filter(btn => btn && btn.active !== false && btn.visible !== false && typeof btn.__pass92AAction === 'function');
            } catch (_) {
                return [];
            }
        };

        MemoryMatchScene.prototype.__pass92ASelectButton = function(delta) {
            const buttons = this.__pass92AActiveButtons();
            if (!buttons.length) return;
            this.__pass92ASelectedButtonIndex = Phaser.Math.Wrap((this.__pass92ASelectedButtonIndex || 0) + delta, 0, buttons.length);
            this.__pass92ADrawButtonHighlight(buttons[this.__pass92ASelectedButtonIndex]);
        };

        MemoryMatchScene.prototype.__pass92ADrawButtonHighlight = function(btn) {
            try {
                if (!this.__pass92AButtonRing) this.__pass92AButtonRing = this.add.graphics().setDepth(6200).setScrollFactor(0);
                this.__pass92AButtonRing.clear();
                if (!btn) return;
                const w = btn.input?.hitArea?.width || btn.width || 190;
                const h = btn.input?.hitArea?.height || btn.height || 46;
                this.__pass92AButtonRing.lineStyle(4, 0xffdd00, 1);
                this.__pass92AButtonRing.strokeRoundedRect(btn.x - w / 2 - 6, btn.y - h / 2 - 6, w + 12, h + 12, 16);
            } catch (_) {}
        };

        MemoryMatchScene.prototype.__pass92APressSelectedButton = function() {
            const buttons = this.__pass92AActiveButtons();
            if (!buttons.length) return false;
            const btn = buttons[Phaser.Math.Clamp(this.__pass92ASelectedButtonIndex || 0, 0, buttons.length - 1)];
            if (!btn || typeof btn.__pass92AAction !== 'function') return false;
            try { btn.__pass92AAction(); } catch (_) {}
            return true;
        };

        MemoryMatchScene.prototype.__pass92ASelectableCards = function() {
            try {
                return (this.cards || []).filter(card => card && card.active !== false && card.visible !== false && !card._isMatched);
            } catch (_) {
                return [];
            }
        };

        MemoryMatchScene.prototype.__pass92AMoveCardSelection = function(dx, dy) {
            const cards = this.__pass92ASelectableCards();
            if (!cards.length) return;
            const allCards = this.cards || cards;
            let index = Number.isFinite(this.__pass92ASelectedCardIndex) ? this.__pass92ASelectedCardIndex : 0;
            index = Phaser.Math.Clamp(index, 0, allCards.length - 1);

            const cols = 4;
            let next = index + dx + dy * cols;
            next = Phaser.Math.Clamp(next, 0, allCards.length - 1);

            let guard = 0;
            while (allCards[next] && allCards[next]._isMatched && guard++ < allCards.length) {
                next += dx || (dy * cols) || 1;
                if (next < 0) next = 0;
                if (next >= allCards.length) next = allCards.length - 1;
                if (next === index) break;
            }

            this.__pass92ASelectedCardIndex = next;
            this.__pass92ADrawCardHighlight();
        };

        MemoryMatchScene.prototype.__pass92ADrawCardHighlight = function() {
            try {
                const ring = this.__pass92ACardSelectRing;
                if (!ring) return;
                ring.clear();
                if (this.locked || this._hasWon) return;
                const cards = this.cards || [];
                const card = cards[Phaser.Math.Clamp(this.__pass92ASelectedCardIndex || 0, 0, Math.max(0, cards.length - 1))];
                if (!card || card._isMatched) return;
                const w = card.input?.hitArea?.width || 120;
                const h = card.input?.hitArea?.height || 100;
                ring.lineStyle(5, 0xffdd00, 1);
                ring.strokeRoundedRect(card.x - w / 2 - 7, card.y - h / 2 - 7, w + 14, h + 14, 18);
                ring.lineStyle(2, 0xffffff, 0.9);
                ring.strokeRoundedRect(card.x - w / 2 - 13, card.y - h / 2 - 13, w + 26, h + 26, 22);
            } catch (_) {}
        };

        MemoryMatchScene.prototype.__pass92APressSelectedCard = function() {
            try {
                if (this.locked || this._hasWon) return false;
                const cards = this.cards || [];
                const card = cards[Phaser.Math.Clamp(this.__pass92ASelectedCardIndex || 0, 0, Math.max(0, cards.length - 1))];
                if (!card || card._isMatched) return false;
                this._handleCardPress?.(card);
                return true;
            } catch (_) {
                return false;
            }
        };

        MemoryMatchScene.prototype.__pass92AUpdateGamepad = function(time = 0) {
            const pad = this.__pass92APad();
            if (!pad) return;

            if (time < (this.__pass92AGamepadCooldownAt || 0)) {
                this.__pass92ADrawCardHighlight();
                return;
            }

            const left = this.__pass92AButtonDown(pad, [14]) || (pad.axes?.[0]?.getValue?.() ?? 0) < -0.45;
            const right = this.__pass92AButtonDown(pad, [15]) || (pad.axes?.[0]?.getValue?.() ?? 0) > 0.45;
            const up = this.__pass92AButtonDown(pad, [12]) || (pad.axes?.[1]?.getValue?.() ?? 0) < -0.45;
            const down = this.__pass92AButtonDown(pad, [13]) || (pad.axes?.[1]?.getValue?.() ?? 0) > 0.45;
            const accept = this.__pass92AButtonDown(pad, [0, 9]);
            const cancel = this.__pass92AButtonDown(pad, [1, 8]);

            if (this._hasWon || this.__pass92AActiveButtons().length) {
                if (left || up) { this.__pass92ASelectButton(-1); this.__pass92AGamepadCooldownAt = time + 180; return; }
                if (right || down) { this.__pass92ASelectButton(1); this.__pass92AGamepadCooldownAt = time + 180; return; }
                if (accept) { if (this.__pass92APressSelectedButton()) this.__pass92AGamepadCooldownAt = time + 260; return; }
                if (cancel) { this._returnToMenu?.(); this.__pass92AGamepadCooldownAt = time + 260; return; }
                this.__pass92ADrawButtonHighlight(this.__pass92AActiveButtons()[this.__pass92ASelectedButtonIndex || 0]);
                return;
            }

            if (left) { this.__pass92AMoveCardSelection(-1, 0); this.__pass92AGamepadCooldownAt = time + 150; return; }
            if (right) { this.__pass92AMoveCardSelection(1, 0); this.__pass92AGamepadCooldownAt = time + 150; return; }
            if (up) { this.__pass92AMoveCardSelection(0, -1); this.__pass92AGamepadCooldownAt = time + 150; return; }
            if (down) { this.__pass92AMoveCardSelection(0, 1); this.__pass92AGamepadCooldownAt = time + 150; return; }
            if (accept) { if (this.__pass92APressSelectedCard()) this.__pass92AGamepadCooldownAt = time + 250; return; }
            if (cancel) { this._returnToMenu?.(); this.__pass92AGamepadCooldownAt = time + 260; return; }

            this.__pass92ADrawCardHighlight();
        };

        const __pass92AOrigUpdate = MemoryMatchScene.prototype.update;
        MemoryMatchScene.prototype.update = function(time, delta) {
            if (typeof __pass92AOrigUpdate === 'function') __pass92AOrigUpdate.call(this, time, delta);
            try { this.__pass92AUpdateGamepad(time); } catch (_) {}
        };
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Stability Pass 92A Memory repair failed safely:', error);
}
// CHIGGAS_GAMEPLAY_STABILITY_PASS_92A_REPAIR_MEMORY_END

