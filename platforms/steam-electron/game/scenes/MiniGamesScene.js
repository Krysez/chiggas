import Phaser from 'phaser';
import { getSafeBounds } from './ResponsiveLayout.js';

const MEMORY_KEY = 'chiggas_memory_match_v1';
const MAZE_KEY = 'chiggas_parasite_maze_v1';

export default class MiniGamesScene extends Phaser.Scene {
    constructor() {
        super('MiniGamesScene');
    }

    init(data = {}) {
        this.debugUnlocked = !!data.debugUnlocked;
    }

    create() {
        const { width, height } = this.scale;
        const safe = getSafeBounds(this, 10);

        this._initMenuNavigation(() => {
            this.scene.start('MenuScene');
        });

        this.cameras.main.setBackgroundColor('#050005');
        this.add.rectangle(width / 2, height / 2, width, height, 0x050005, 1);

        const bg = this.add.graphics();
        bg.fillGradientStyle(0x190019, 0x080008, 0x000000, 0x000000, 1, 1, 1, 1);
        bg.fillRect(0, 0, width, height);

        this.add.text(safe.centerX, safe.top + (height < 560 ? 38 : 56), 'MINI-GAMES', {
            fontSize: height < 560 ? '42px' : '64px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: height < 560 ? 8 : 12,
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(safe.centerX, safe.top + (height < 560 ? 78 : 106), 'Choose your side mission.', {
            fontSize: height < 560 ? '16px' : '22px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        const compact = width < 760 || height < 560;
        const cardW = Math.min(compact ? 260 : 330, safe.width - 36);
        const cardH = compact ? 92 : 120;
        const gap = compact ? 18 : 28;
        const startY = safe.top + (compact ? safe.height * 0.34 : safe.height * 0.36);

        const memoryUnlocked = this.debugUnlocked || this._isUnlocked(MEMORY_KEY, 'storyUnlocked');
        const mazeUnlocked = this.debugUnlocked || this._isUnlocked(MAZE_KEY, 'storyUnlocked');

        this._createMiniGameCard(
            safe.centerX,
            startY,
            cardW,
            cardH,
            memoryUnlocked ? 'MEMORY MATCH' : 'MEMORY MATCH 🔒',
            memoryUnlocked ? 'Match Chigga Wear cards for best time.' : 'Clear Stage 2 to unlock.',
            0x008888,
            () => {
                if (!memoryUnlocked) {
                    this._showLockedToast('Clear Stage 2 to unlock Memory Match!');
                    return;
                }
                this.scene.start('MemoryMatchScene', { returnScene: 'MiniGamesScene' });
            }
        );

        this._createMiniGameCard(
            safe.centerX,
            startY + cardH + gap,
            cardW,
            cardH,
            mazeUnlocked ? 'PARASITE MAZE' : 'PARASITE MAZE 🔒',
            mazeUnlocked ? 'Eat parasites, dodge hunters, clear the maze.' : 'Unlocks later in story mode.',
            0x225544,
            () => {
                if (!mazeUnlocked) {
                    this._showLockedToast('Parasite Maze unlocks later!');
                    return;
                }
                this.scene.start('ParasiteMazeScene', { returnScene: 'MiniGamesScene' });
            }
        );

        this._createButton(safe.centerX, safe.bottom - (compact ? 34 : 46), 'BACK', 0x333333, () => {
            this.scene.start('MenuScene');
        }, Math.min(190, safe.width - 30), compact ? 42 : 48, compact ? 18 : 22);
        this.time.delayedCall(0, () => this._focusFirstVisible());
    }

    _isUnlocked(storageKey, flag) {
        try {
            const raw = window.localStorage.getItem(storageKey);
            const parsed = raw ? JSON.parse(raw) : {};
            return !!parsed[flag];
        } catch (e) {
            return false;
        }
    }

    _createMiniGameCard(x, y, w, h, title, desc, color, onClick) {
        const card = this.add.container(x, y);
        const bg = this.add.graphics();

        const draw = (fillColor) => {
            bg.clear();
            bg.fillStyle(0x111111, 0.97);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
            bg.lineStyle(5, fillColor, 0.88);
            bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
            bg.fillStyle(fillColor, 0.18);
            bg.fillRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 14);
        };

        draw(color);

        const titleText = this.add.text(0, -h * 0.18, title, {
            fontSize: h < 100 ? '22px' : '30px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center'
        }).setOrigin(0.5);

        const descText = this.add.text(0, h * 0.20, desc, {
            fontSize: h < 100 ? '12px' : '15px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffddaa',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            wordWrap: { width: w - 34 }
        }).setOrigin(0.5);

        card.add([bg, titleText, descText]);
        card.setSize(w, h);
        card.setInteractive({ useHandCursor: true });
        this._registerMenuButton(card, onClick, { w, h });
        card.on('pointerover', () => draw(Phaser.Display.Color.IntegerToColor(color).lighten(18).color));
        card.on('pointerout', () => draw(color));
        card.on('pointerdown', () => {
            this.tweens.add({
                targets: card,
                scaleX: 0.96,
                scaleY: 0.96,
                duration: 80,
                yoyo: true,
                onComplete: onClick
            });
        });

        return card;
    }

    _createButton(x, y, text, color, onClick, w = 190, h = 48, fz = 22) {
        const btn = this.add.container(x, y);
        const bg = this.add.graphics();

        const draw = (fillColor) => {
            bg.clear();
            bg.fillStyle(fillColor, 1);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
            bg.lineStyle(4, 0xffffff, 0.72);
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
        this._registerMenuButton(btn, onClick, { w, h });
        btn.on('pointerover', () => draw(Phaser.Display.Color.IntegerToColor(color).lighten(18).color));
        btn.on('pointerout', () => draw(color));
        btn.on('pointerdown', () => {
            this.tweens.add({ targets: btn, scale: 0.92, duration: 90, yoyo: true, onComplete: onClick });
        });
        return btn;
    }

    _showLockedToast(message) {
        const { width, height } = this.scale;
        const safe = getSafeBounds(this, 10);
        if (this._toast && this._toast.active) this._toast.destroy();

        this._toast = this.add.text(safe.centerX, safe.bottom - 80, message, {
            fontSize: height < 560 ? '15px' : '20px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center',
            wordWrap: { width: safe.width - 24 }
        }).setOrigin(0.5).setDepth(5000).setAlpha(0);

        this.tweens.add({
            targets: this._toast,
            alpha: 1,
            y: this._toast.y - 10,
            duration: 140,
            yoyo: true,
            hold: 950,
            onComplete: () => {
                if (this._toast && this._toast.active) this._toast.destroy();
                this._toast = null;
            }
        });
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
    }


}