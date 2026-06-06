import Phaser from 'phaser';
import { getSafeBounds } from './ResponsiveLayout.js';
import { initSteamInputPromptManager, setSteamInputActionSet, runSteamInputPromptDebugSuite, getSteamInputPromptLabel } from './SteamInputPromptManager.js';
import { GAMEPLAY_CONTROL_ROWS, loadControlBindings, resetControlBindings, setKeyboardBinding, setGamepadBinding, keyboardCodeToLabel, gamepadButtonToLabel, runControlsDebugSuite } from './ControlsSettingsManager.js';
import { resetCosmeticState } from './SkinRegistry.js';
import { refreshAudioVolumes, initAudio, playVolumeTick } from '../audio/AudioManager.js';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    create() {
        const { width, height } = this.scale;

        initSteamInputPromptManager();
        setSteamInputActionSet('menu');

        this._initMenuNavigation(() => {
            if (this.optionsContainer) {
                this.showMainMenu();
                return;
            }

            if (this.diffContainer && this.diffContainer.visible) {
                this.showMainMenu();
                return;
            }

            this._requestExitApp();
        });

        this._androidBackHandler = () => {
            if (this.optionsContainer) {
                this.showMainMenu();
                return;
            }

            if (this.diffContainer && this.diffContainer.visible) {
                this.showMainMenu();
                return;
            }

            this._requestExitApp();
        };
        window.addEventListener('chiggasAndroidBack', this._androidBackHandler);

        this.settings = this._loadSettings();
        this.controlBindings = loadControlBindings();
        this.selectedControlMode = this.settings.controlMode || 'touch';
        this.optionsContainer = null;
        this.diffContainer = null;

        this.add.rectangle(width / 2, height / 2, width, height, 0x111111);

        const androidLandscape = this._isAndroidLandscapeLike();
        const featured = this.add.image(width / 2, androidLandscape ? 0 : height / 2, 'game-title-new')
            .setOrigin(0.5, androidLandscape ? 0 : 0.5);

        if (androidLandscape) {
            const titleAreaH = height * 0.54;
            const titleScale = Math.min(width / featured.width, titleAreaH / featured.height) * 1.03;
            featured.setScale(titleScale);
            featured.setY(4);
        } else {
            const coverScale = Math.max(width / featured.width, height / featured.height);
            featured.setScale(coverScale);
        }

        const grad = this.add.graphics();
        grad.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.86, 0.92);
        grad.fillRect(0, Math.max(0, height * 0.46), width, height * 0.54);

        this.tweens.add({
            targets: featured,
            y: androidLandscape ? 10 : height / 2 + 8,
            duration: 3000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const compact = this._isCompact();

        // The title is already embedded in assets/game-title-new.
        // Do not draw an extra Phaser text title on top of the background art.
        this.mainBtnContainer = this.add.container(0, 0);
        this._renderMainButtons();
        this.time.delayedCall(0, () => this._focusFirstVisible());

        this._startTitleMusic();

        this.input.keyboard.on('keydown-ESC', () => {
            if (this.optionsContainer) {
                this.showMainMenu();
                return;
            }

            if (this.diffContainer && this.diffContainer.visible) {
                this.showMainMenu();
                return;
            }

            this._requestExitApp();
        });

        this._debugPressCount = 0;
        this.input.keyboard.on('keydown-D', () => {
            if (this.diffContainer || this.optionsContainer) return;
            this._debugPressCount += 1;
            if (this._debugPressCount >= 5) {
                this._debugPressCount = 0;
                this.showDebugMenu();
            }
        });

        this.input.keyboard.on('keydown-I', () => {
            if (!this.optionsContainer) return;
            this._showSteamInputDebugOverlay();
        });

        // Android landscape app runs in a fixed orientation. Avoid resize restarts caused by
        // immersive navigation bar changes during app launch/video transitions.
        this.events.once('shutdown', () => {
            if (this._androidBackHandler) {
                window.removeEventListener('chiggasAndroidBack', this._androidBackHandler);
                this._androidBackHandler = null;
            }});
        this.events.once('destroy', () => {});
    }

    _restartForResize() {
        this.scene.restart();
    }

    _isCompact() {
        return this.scale.width < 760 || this.scale.height < 620;
    }

    _isAndroidLandscapeLike() {
        return this.scale.width > this.scale.height && this.scale.height < 560;
    }

    _renderMainButtons() {
        const { width, height } = this.scale;
        const safe = getSafeBounds(this, 10);
        const compact = this._isCompact();
        const androidLandscape = this._isAndroidLandscapeLike();

        if (androidLandscape) {
            const btnW = Math.min(282, safe.width * 0.335);
            const btnH = 40;
            const fz = 18;
            const leftX = safe.centerX - btnW / 2 - 12;
            const rightX = safe.centerX + btnW / 2 + 12;
            const row1 = Math.max(safe.top + 130, safe.bottom - 138);
            const rowGap = 46;

            this.createButton(leftX, row1, 'PLAY', 0xcc1111, () => {
                this.showDifficultySelect();
            }, this.mainBtnContainer, btnW, btnH, fz);

            this.createButton(rightX, row1, 'LEADERBOARDS', 0x6b1fa2, () => {
                this.scene.start('LeaderboardScene');
            }, this.mainBtnContainer, btnW, btnH, fz);

            this.createButton(leftX, row1 + rowGap, 'CHIGGA WEAR', 0xaa1111, () => {
                this.scene.start('WardrobeScene');
            }, this.mainBtnContainer, btnW, btnH, fz);

            this.createButton(rightX, row1 + rowGap, 'HOW TO PLAY', 0x225522, () => {
                this.scene.start('HowToPlayScene');
            }, this.mainBtnContainer, btnW, btnH, fz);

            this.createButton(leftX, row1 + rowGap * 2, 'SET IT UP', 0x333333, () => {
                this.showOptionsMenu('main');
            }, this.mainBtnContainer, btnW, btnH, fz);

            const memoryUnlocked = this._isMemoryMatchUnlocked();
            this.createButton(rightX, row1 + rowGap * 2, 'MINI GAME', 0x008888, () => {
                this._openMiniGamesHub();
            }, this.mainBtnContainer, btnW, btnH, fz);

            this.add.text(safe.centerX, safe.bottom - 4, 'Recruit. Capture. Dominate.', {
                fontSize: '14px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ffddaa',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);
            return;
        }

        const btnW = Math.min(compact ? 260 : 380, safe.width - 26);
        const bigH = compact ? 46 : 64;
        const smallH = compact ? 38 : 46;
        const startY = compact ? safe.top + safe.height * 0.52 : safe.top + safe.height * 0.58;
        const gap = compact ? 52 : 62;

        this.createButton(safe.centerX, startY, 'GET UNDER THE SKIN', 0xcc1111, () => {
            this.showDifficultySelect();
        }, this.mainBtnContainer, btnW, bigH, compact ? 19 : 28);

        this.createButton(safe.centerX, startY + gap, 'LEADERBOARDS', 0x6b1fa2, () => {
            this.scene.start('LeaderboardScene');
        }, this.mainBtnContainer, Math.min(btnW, 320), smallH, compact ? 17 : 22);

        this.createButton(safe.centerX, startY + gap * 2, 'CHIGGA WEAR', 0xaa1111, () => {
            this.scene.start('WardrobeScene');
        }, this.mainBtnContainer, Math.min(btnW, 300), smallH, compact ? 17 : 22);

        const memoryUnlockedMain = this._isMemoryMatchUnlocked();
        const splitW = Math.min(compact ? 126 : 170, (safe.width - 42) / 2);
        const splitGap = Math.min(compact ? 76 : 102, safe.width * 0.16);

        this.createButton(safe.centerX - splitGap, startY + gap * 3, 'MINI GAME', 0x008888, () => {
            this._openMiniGamesHub();
        }, this.mainBtnContainer, splitW, smallH, compact ? 13 : 16);

        this.createButton(safe.centerX + splitGap, startY + gap * 3, 'HOW TO PLAY', 0x225522, () => {
            this.scene.start('HowToPlayScene');
        }, this.mainBtnContainer, splitW, smallH, compact ? 13 : 16);

        this.createButton(safe.centerX, startY + gap * 4, 'SET IT UP', 0x333333, () => {
            this.showOptionsMenu('main');
        }, this.mainBtnContainer, Math.min(btnW, 280), smallH, compact ? 16 : 20);

        this.add.text(safe.centerX, safe.bottom - (compact ? 4 : 10), 'Recruit. Capture. Dominate.', {
            fontSize: compact ? '13px' : '17px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffddaa',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
    }

    _isMemoryMatchUnlocked() {
        try {
            const raw = window.localStorage.getItem('chiggas_memory_match_v1');
            const parsed = raw ? JSON.parse(raw) : {};
            return !!parsed.storyUnlocked;
        } catch (e) {
            return false;
        }
    }

    _showMemoryMatchLocked() {
        const { width, height } = this.scale;

        if (this._memoryLockedToast && this._memoryLockedToast.active) {
            this._memoryLockedToast.destroy();
        }

        this._memoryLockedToast = this.add.text(width / 2, height * 0.50, 'LOCKED: Clear Stage 2 to unlock Memory Match!', {
            fontSize: this._isCompact() ? '16px' : '22px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center',
            wordWrap: { width: Math.min(width - 40, 560) }
        }).setOrigin(0.5).setDepth(6000).setAlpha(0);

        this.tweens.add({
            targets: this._memoryLockedToast,
            alpha: 1,
            y: this._memoryLockedToast.y - 12,
            duration: 160,
            yoyo: true,
            hold: 850,
            onComplete: () => {
                if (this._memoryLockedToast && this._memoryLockedToast.active) {
                    this._memoryLockedToast.destroy();
                    this._memoryLockedToast = null;
                }
            }
        });
    }

    _resetAllPlayerData() {
        const keysToRemove = [
            'chiggas_memory_match_v1',
            'chiggas_parasite_maze_v1',
            'chiggas_cosmetics_v1',
            'chiggas_leaderboard_v1',
            'chiggas_player_progress_v1',
            'chiggas_unlockables_v1',
            'chiggas_achievements_v1',
            'chiggas_best_scores_v1',
            'chiggas_save_v1'
        ];

        try {
            const dynamicKeys = [];
            for (let i = 0; i < window.localStorage.length; i += 1) {
                const key = window.localStorage.key(i);
                if (key && key.startsWith('chiggas_') && key !== 'chiggas_settings_v1') {
                    dynamicKeys.push(key);
                }
            }

            [...new Set([...keysToRemove, ...dynamicKeys])].forEach(key => {
                window.localStorage.removeItem(key);
            });
        } catch (e) {}

        this._showDebugToast('PLAYER DATA RESET');
    }

    _showDebugToast(message) {
        const { width, height } = this.scale;

        if (this._debugToast && this._debugToast.active) {
            this._debugToast.destroy();
        }

        this._debugToast = this.add.text(width / 2, height * 0.88, message, {
            fontSize: '24px',
            fontFamily: 'Dhurjati',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center'
        }).setOrigin(0.5).setDepth(10000).setAlpha(0);

        this.tweens.add({
            targets: this._debugToast,
            alpha: 1,
            y: this._debugToast.y - 10,
            duration: 150,
            yoyo: true,
            hold: 900,
            onComplete: () => {
                if (this._debugToast && this._debugToast.active) {
                    this._debugToast.destroy();
                    this._debugToast = null;
                }
            }
        });
    }

    _openMiniGamesHub(debugUnlocked = false) {
        this._stopTitleMusic();
        this.scene.start('MiniGamesScene', { debugUnlocked });
    }


    _requestExitApp() {
        if (window.AndroidChiggasApp && typeof window.AndroidChiggasApp.exitApp === 'function') {
            window.AndroidChiggasApp.exitApp();
            return;
        }

        const appPlugin = window.Capacitor?.Plugins?.App;

        if (appPlugin && typeof appPlugin.exitApp === 'function') {
            appPlugin.exitApp();
            return;
        }

        try {
            navigator.app?.exitApp?.();
            return;
        } catch (e) {}

        try {
            window.close();
        } catch (e) {}
    }


    _startTitleMusic() {
        try {
            const globalKey = '__chiggasTitleMusic';
            let music = window[globalKey];

            if (!music) {
                music = new Audio('assets/endless.mp3');
                music.loop = true;
                music.preload = 'auto';
                window[globalKey] = music;
            }

            this._titleMusic = music;
            music.volume = this._getTitleMusicVolume();

            if (music.paused) {
                const playPromise = music.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(() => {
                        const startAfterInput = () => {
                            if (!window[globalKey]) return;
                            window[globalKey].volume = this._getTitleMusicVolume();
                            window[globalKey].play().catch(() => {});
                        };
                        this.input.once('pointerdown', startAfterInput);
                        this.input.keyboard.once('keydown', startAfterInput);
                        if (this.input.gamepad) this.input.gamepad.once('down', startAfterInput);
                    });
                }
            }
        } catch (e) {}
    }

    _stopTitleMusic() {
        try {
            const music = window.__chiggasTitleMusic || this._titleMusic;
            if (!music) return;

            music.pause();
            music.currentTime = 0;

            if (window.__chiggasTitleMusic === music) {
                window.__chiggasTitleMusic = null;
            }
        } catch (e) {}

        this._titleMusic = null;
    }


    _getTitleMusicVolume() {
        const master = this._clamp01(this.settings?.masterVolume ?? 1);
        const music = this._clamp01(this.settings?.musicVolume ?? 0.75);
        return master * music;
    }

    _loadSettings() {
        try {
            const raw = window.localStorage.getItem('chiggas_settings_v1');
            const parsed = raw ? JSON.parse(raw) : {};
            return {
                controlMode: parsed.controlMode || 'touch',
                masterVolume: this._clamp01(parsed.masterVolume ?? 1),
                musicVolume: this._clamp01(parsed.musicVolume ?? 0.75),
                sfxVolume: this._clamp01(parsed.sfxVolume ?? 1)
            };
        } catch (e) {
            return { controlMode: 'touch', masterVolume: 1, musicVolume: 0.75, sfxVolume: 1 };
        }
    }

    _saveSettingsWithAudioPreview(preview = true) {
        this._saveSettings();

        if (!preview) return;

        initAudio().then(() => {
            playVolumeTick(0.65);
        }).catch(() => {});
    }

    _saveSettings() {
        try {
            window.localStorage.setItem('chiggas_settings_v1', JSON.stringify(this.settings));
        } catch (e) {}
        refreshAudioVolumes();
        if (this._titleMusic) this._titleMusic.volume = this._getTitleMusicVolume();
    }

    _clamp01(value) {
        return Math.max(0, Math.min(1, Number(value)));
    }

    _formatVolume(value) {
        return `${Math.round(this._clamp01(value) * 100)}%`;
    }

    createButton(x, y, text, color, onClick, container, w = 380, h = 88, fz = 34) {
        const btn = this.add.container(x, y);
        const bg = this.add.graphics();

        const draw = (fillColor, lineColor = 0xffffff) => {
            bg.clear();
            bg.fillStyle(fillColor, 1);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 4);
            bg.lineStyle(4, lineColor, 0.62);
            bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 4);
        };

        draw(color);

        const readableFz = Math.max(fz, 16);
        const label = this.add.text(0, 0, text, {
            fontSize: `${readableFz}px`,
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: Math.max(3, Math.round(readableFz * 0.18)),
            align: 'center',
            wordWrap: { width: w - 16 }
        }).setOrigin(0.5);

        btn.add([bg, label]);
        btn.setSize(w, h);
        btn.setInteractive({ useHandCursor: true });
        this._registerMenuButton(btn, onClick, { w, h });

        const hoverColor = Phaser.Display.Color.IntegerToColor(color).lighten(20).color;
        btn.on('pointerover', () => draw(hoverColor));
        btn.on('pointerout', () => draw(color));
        btn.on('pointerdown', () => {
            this.tweens.add({ targets: btn, scale: 0.92, duration: 80, yoyo: true, onComplete: onClick });
        });

        if (container) container.add(btn);
        return btn;
    }

    showDifficultySelect() {
        const { width, height } = this.scale;
        this._navSequential = false;
        const compact = this._isCompact();

        this.mainBtnContainer.setVisible(false);
        if (this.diffContainer) this.diffContainer.destroy(true);

        const c = this.add.container(0, 0).setDepth(8500);
        this.diffContainer = c;
        this.time.delayedCall(0, () => this._focusFirstVisible());

        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55);
        const panelW = Math.min(compact ? 390 : 520, width - 28);
        const panelH = Math.min(compact ? height - 26 : 520, height - 28);
        const top = height / 2 - panelH / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x151015, 0.96);
        panel.fillRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 22);
        panel.lineStyle(4, 0xffdd00, 0.78);
        panel.strokeRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 22);

        const title = this.add.text(width / 2, top + (compact ? 34 : 48), 'SELECT DIFFICULTY', {
            fontSize: compact ? '31px' : '38px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        c.add([shade, panel, title]);

        const btnW = Math.min(panelW - 52, compact ? 280 : 340);
        const btnH = compact ? 44 : 50;
        const fz = compact ? 21 : 24;
        const firstY = top + (compact ? 90 : 122);
        const gap = compact ? 52 : 62;

        this.createButton(width / 2, firstY, 'Too Easy', 0x33aa33, () => this.startGame(0), c, btnW, btnH, fz);
        this.createButton(width / 2, firstY + gap, 'Straight Up Basic', 0xaa8811, () => this.startGame(1), c, btnW, btnH, fz);
        this.createButton(width / 2, firstY + gap * 2, "Gotta Be Kiddin' Me!", 0xcc1111, () => this.startGame(2), c, btnW, btnH, fz);

        const controlY = firstY + gap * 2 + (compact ? 50 : 70);
        const controlText = this.add.text(width / 2, controlY - 22, 'CONTROL MODE', {
            fontSize: compact ? '19px' : '22px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        c.add(controlText);

        const modeGap = Math.min(compact ? 116 : 140, panelW * 0.29);
        const modeW = compact ? 112 : 124;
        const modes = [
            { label: 'Touch', value: 'touch', x: width / 2 - modeGap },
            { label: 'Keyboard', value: 'keyboard', x: width / 2 },
            { label: 'Gamepad', value: 'gamepad', x: width / 2 + modeGap }
        ];

        modes.forEach(mode => {
            const selected = this.selectedControlMode === mode.value;
            this.createButton(mode.x, controlY + 16, mode.label, selected ? 0xffdd00 : 0x333333, () => {
                this.selectedControlMode = mode.value;
                this.settings.controlMode = mode.value;
                this._saveSettings();
                this.showDifficultySelect();
            }, c, modeW, compact ? 38 : 42, compact ? 16 : 18);
        });

        this.createButton(width / 2, top + panelH - (compact ? 28 : 42), 'BACK', 0x333333, () => {
            if (this.diffContainer) {
                this.diffContainer.destroy(true);
                this.diffContainer = null;
            }
            this.mainBtnContainer.setVisible(true);
        }, c, 160, compact ? 38 : 44, compact ? 18 : 20);
    }

    showOptionsMenu(returnTarget = 'main') {
        try { window.__chiggasPass92GOptionsDirectReplaceActive = true; } catch (_) {}

        const { width, height } = this.scale;
        this._navSequential = true;
        const compact = this._isCompact();

        if (this.optionsContainer) this.optionsContainer.destroy(true);
        if (this.diffContainer) this.diffContainer.setVisible(false);
        this.mainBtnContainer.setVisible(false);

        const c = this.add.container(0, 0).setDepth(9000);
        this.optionsContainer = c;

        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72);
        const panelW = Math.min(compact ? 440 : 560, width - 28);
        const panelH = Math.min(height - 24, compact ? 430 : 540);
        const top = height / 2 - panelH / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x151015, 0.97);
        panel.fillRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 22);
        panel.lineStyle(4, 0x8a44ff, 0.75);
        panel.strokeRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 22);

        const title = this.add.text(width / 2, top + (compact ? 30 : 42), 'SET IT UP', {
            fontSize: compact ? '34px' : '42px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 7
        }).setOrigin(0.5);

        const controlLabel = this.add.text(width / 2, top + (compact ? 70 : 92), 'CONTROL SCHEME', {
            fontSize: compact ? '19px' : '22px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        c.add([shade, panel, title, controlLabel]);

        const makeSmallButton = (x, y, text, color, onClick, w = 112, h = 38, fz = 16) => {
            const btn = this.createButton(x, y, text, color, onClick, c, w, h, fz);
            try {
                btn.__pass92GOptionsButton = true;
                btn.__pass92GLabel = String(text || '').trim().toUpperCase();
                btn._navLabel = btn.__pass92GLabel;
            } catch (_) {}
            return btn;
        };

        const modeGap = Math.min(compact ? 116 : 140, panelW * 0.29);
        const modeW = compact ? 112 : 130;
        const modeY = top + (compact ? 106 : 132);
        const modes = [
            { label: 'TOUCH', value: 'touch', x: width / 2 - modeGap },
            { label: 'KEYBOARD', value: 'keyboard', x: width / 2 },
            { label: 'GAMEPAD', value: 'gamepad', x: width / 2 + modeGap }
        ];

        modes.forEach(mode => {
            const selected = this.selectedControlMode === mode.value;
            const btn = makeSmallButton(mode.x, modeY, mode.label, selected ? 0xffdd00 : 0x333333, () => {
                this.selectedControlMode = mode.value;
                this.settings.controlMode = mode.value;
                this._saveSettings();
                this.showOptionsMenu(returnTarget);
            }, modeW, compact ? 38 : 44, compact ? 16 : 18);

            try {
                btn.__pass92GControlModeButton = true;
                btn.__pass92GControlModeValue = mode.value;
            } catch (_) {}
        });

        const controlsButton = makeSmallButton(width / 2, top + (compact ? 154 : 176), 'CONTROLS / HOTKEYS', 0x2255aa, () => {
            this.showControlsSettings(returnTarget);
        }, compact ? 236 : 276, compact ? 36 : 42, compact ? 15 : 17);
        try { controlsButton.__pass92GNonVolumeButton = true; } catch (_) {}

        const volumeStart = top + (compact ? 204 : 246);
        const volumeGap = compact ? 48 : 56;

        const makeVolumeRow = (label, key, y) => {
            const rowLabel = this.add.text(width / 2 - (compact ? 72 : 92), y, `${label}: ${this._formatVolume(this.settings[key])}`, {
                fontSize: compact ? '20px' : '23px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);
            c.add(rowLabel);

            let minusBtn = null;
            let plusBtn = null;

            const applyVolumeDelta = (delta, focusBtn) => {
                this.settings[key] = this._clamp01((this.settings[key] ?? 1) + delta);
                rowLabel.setText(`${label}: ${this._formatVolume(this.settings[key])}`);
                this.__pass92GLastVolumeFocus = focusBtn || null;
                this.__pass92GLastVolumePressAt = this.time?.now || Date.now();
                this._saveSettingsWithAudioPreview(true);

                try {
                    if (focusBtn && this._isButtonUsable?.(focusBtn)) {
                        this._focusMenuButton(focusBtn);
                    }
                } catch (_) {}
            };

            minusBtn = makeSmallButton(width / 2 + (compact ? 72 : 92), y, '–', 0x333333, () => {
                applyVolumeDelta(-0.1, minusBtn);
            }, compact ? 40 : 44, compact ? 34 : 36, compact ? 22 : 24);

            plusBtn = makeSmallButton(width / 2 + (compact ? 126 : 150), y, '+', 0x333333, () => {
                applyVolumeDelta(0.1, plusBtn);
            }, compact ? 40 : 44, compact ? 34 : 36, compact ? 22 : 24);

            try {
                minusBtn.__pass92GVolumeButton = true;
                minusBtn.__pass92GVolumeKey = key;
                minusBtn.__pass92GVolumeDirection = -1;
                minusBtn.__pass92GLabel = `${label} -`;
                minusBtn._navLabel = minusBtn.__pass92GLabel;

                plusBtn.__pass92GVolumeButton = true;
                plusBtn.__pass92GVolumeKey = key;
                plusBtn.__pass92GVolumeDirection = 1;
                plusBtn.__pass92GLabel = `${label} +`;
                plusBtn._navLabel = plusBtn.__pass92GLabel;
            } catch (_) {}
        };

        makeVolumeRow('MASTER', 'masterVolume', volumeStart);
        makeVolumeRow('MUSIC', 'musicVolume', volumeStart + volumeGap);
        makeVolumeRow('SFX', 'sfxVolume', volumeStart + volumeGap * 2);

        const backBtn = makeSmallButton(width / 2, top + panelH - (compact ? 30 : 48), 'BACK', 0x444444, () => {
            if (this.optionsContainer) {
                this.optionsContainer.destroy(true);
                this.optionsContainer = null;
            }
            if (returnTarget === 'difficulty') {
                if (this.diffContainer) this.diffContainer.setVisible(true);
            } else {
                this.mainBtnContainer.setVisible(true);
            }
        }, 205, compact ? 40 : 48, compact ? 20 : 22);
        try { backBtn.__pass92GNonVolumeButton = true; } catch (_) {}

        // First focus only on page open. Volume button presses no longer redraw this page.
        this.time.delayedCall(0, () => this._focusFirstVisible());
    }
    showControlsSettings(returnTarget = 'main') {
        const { width, height } = this.scale;
        const compact = this._isCompact();

        if (this.optionsContainer) this.optionsContainer.destroy(true);
        if (this.diffContainer) this.diffContainer.setVisible(false);
        this.mainBtnContainer.setVisible(false);

        this.controlBindings = loadControlBindings();
        this._navSequential = true;

        const c = this.add.container(0, 0).setDepth(9300);
        this.optionsContainer = c;
        this.time.delayedCall(0, () => this._focusFirstVisible());

        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.76);
        const panelW = Math.min(compact ? width - 20 : 720, width - 20);
        const panelH = Math.min(height - 20, compact ? height - 20 : 620);
        const top = height / 2 - panelH / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x101725, 0.98);
        panel.fillRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 20);
        panel.lineStyle(4, 0x33aaff, 0.78);
        panel.strokeRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 20);

        const title = this.add.text(width / 2, top + (compact ? 28 : 38), 'CONTROLS / HOTKEYS', {
            fontSize: compact ? '25px' : '34px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#33ccff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        const help = this.add.text(width / 2, top + (compact ? 58 : 74), 'Tap a Keyboard or Gamepad box, then press the new key/button.', {
            fontSize: compact ? '12px' : '15px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5);

        c.add([shade, panel, title, help]);

        const rows = GAMEPLAY_CONTROL_ROWS;
        const leftX = width / 2 - panelW * 0.31;
        const keyboardX = width / 2 + (compact ? 38 : 72);
        const gamepadX = width / 2 + panelW * 0.33;
        const rowStart = top + (compact ? 96 : 120);
        const rowGap = Math.min(compact ? 42 : 52, (panelH - (compact ? 190 : 220)) / rows.length);
        const keyW = compact ? 112 : 150;
        const gpW = compact ? 92 : 128;
        const btnH = compact ? 30 : 36;
        const rowFz = compact ? 12 : 15;

        const headerStyle = {
            fontSize: compact ? '12px' : '15px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 4
        };
        c.add(this.add.text(keyboardX, rowStart - rowGap * 0.58, 'KEYBOARD', headerStyle).setOrigin(0.5));
        c.add(this.add.text(gamepadX, rowStart - rowGap * 0.58, 'GAMEPAD', headerStyle).setOrigin(0.5));

        const getBinding = (row) => this.controlBindings?.[row.actionSet]?.[row.action] || {};

        rows.forEach((row, index) => {
            const y = rowStart + index * rowGap;
            const binding = getBinding(row);
            const keyboardText = (binding.keyboard || []).map(keyboardCodeToLabel).join(' / ') || '?';
            const gamepadText = gamepadButtonToLabel(binding.gamepad);

            const label = this.add.text(leftX, y, row.label.toUpperCase(), {
                fontSize: compact ? '14px' : '18px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0, 0.5);
            c.add(label);

            this.createButton(keyboardX, y, keyboardText, 0x333333, () => {
                this._beginKeyboardBindingCapture(row, returnTarget);
            }, c, keyW, btnH, rowFz);

            this.createButton(gamepadX, y, gamepadText, 0x333333, () => {
                this._beginGamepadBindingCapture(row, returnTarget);
            }, c, gpW, btnH, rowFz);
        });

        const bottomY = top + panelH - (compact ? 32 : 42);
        this.createButton(width / 2 - (compact ? 130 : 170), bottomY, 'RESET', 0x884400, () => {
            this.controlBindings = resetControlBindings();
            this.showControlsSettings(returnTarget);
        }, c, compact ? 110 : 132, compact ? 34 : 40, compact ? 14 : 16);

        this.createButton(width / 2, bottomY, 'TEST', 0x0066aa, () => {
            this._showControlsDebugOverlay(returnTarget);
        }, c, compact ? 100 : 124, compact ? 34 : 40, compact ? 14 : 16);

        this.createButton(width / 2 + (compact ? 130 : 170), bottomY, 'BACK', 0x444444, () => {
            this.showOptionsMenu(returnTarget);
        }, c, compact ? 110 : 132, compact ? 34 : 40, compact ? 14 : 16);
    }

    _beginKeyboardBindingCapture(row, returnTarget = 'main') {
        const { width, height } = this.scale;
        const overlay = this._createCaptureOverlay(`PRESS KEY FOR ${row.label.toUpperCase()}`);

        const finish = (event) => {
            if (!event?.code) return;
            event.preventDefault?.();
            overlay?.destroy(true);
            setKeyboardBinding(row.actionSet, row.action, event.code);
            this.controlBindings = loadControlBindings();
            this.showControlsSettings(returnTarget);
        };

        this.input.keyboard.once('keydown', finish);
    }

    _beginGamepadBindingCapture(row, returnTarget = 'main') {
        const overlay = this._createCaptureOverlay(`PRESS GAMEPAD BUTTON FOR ${row.label.toUpperCase()}`);

        const finish = (pad, button, index) => {
            const buttonIndex = button?.index ?? index;
            if (buttonIndex === undefined || buttonIndex === null) return;
            overlay?.destroy(true);
            setGamepadBinding(row.actionSet, row.action, buttonIndex);
            this.controlBindings = loadControlBindings();
            this.showControlsSettings(returnTarget);
        };

        if (this.input.gamepad) {
            this.input.gamepad.once('down', finish);
        }

        this.input.keyboard.once('keydown-ESC', () => {
            overlay?.destroy(true);
            this.showControlsSettings(returnTarget);
        });
    }

    _createCaptureOverlay(message) {
        const { width, height } = this.scale;
        const c = this.add.container(0, 0).setDepth(9900);
        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.82);
        const panelW = Math.min(520, width - 28);
        const panelH = Math.min(170, height - 28);
        const bg = this.add.graphics();
        bg.fillStyle(0x101010, 0.98);
        bg.fillRoundedRect(width / 2 - panelW / 2, height / 2 - panelH / 2, panelW, panelH, 18);
        bg.lineStyle(4, 0xffdd00, 0.88);
        bg.strokeRoundedRect(width / 2 - panelW / 2, height / 2 - panelH / 2, panelW, panelH, 18);
        const text = this.add.text(width / 2, height / 2 - 12, message, {
            fontSize: this._isCompact() ? '20px' : '26px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center',
            wordWrap: { width: panelW - 36 }
        }).setOrigin(0.5);
        const sub = this.add.text(width / 2, height / 2 + 42, 'Press ESC to cancel.', {
            fontSize: this._isCompact() ? '13px' : '16px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        c.add([shade, bg, text, sub]);
        return c;
    }

    _showControlsDebugOverlay(returnTarget = 'main') {
        const result = runControlsDebugSuite();
        const { width, height } = this.scale;
        const compact = this._isCompact();
        const panelW = Math.min(compact ? width - 24 : 560, width - 24);
        const panelH = Math.min(compact ? height - 24 : 420, height - 24);
        const top = height / 2 - panelH / 2;

        const c = this.add.container(0, 0).setDepth(9850);
        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72);
        const panel = this.add.graphics();
        panel.fillStyle(0x0d1622, 0.98);
        panel.fillRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 18);
        panel.lineStyle(3, result.ok ? 0x39ff14 : 0xff3333, 0.9);
        panel.strokeRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 18);

        const title = this.add.text(width / 2, top + 32, 'CONTROLS TEST', {
            fontSize: compact ? '22px' : '28px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: result.ok ? '#39ff14' : '#ff3333',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5);

        const bodyText = [
            `Status: ${result.status}`,
            `Missing: ${(result.missing || []).length}`,
            '',
            ...result.rows.map(row => `${row.label}: ${row.keyboard} / ${row.gamepad}`)
        ].join('\n');

        const body = this.add.text(width / 2, top + 72, bodyText, {
            fontSize: compact ? '12px' : '15px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'left',
            lineSpacing: 4,
            wordWrap: { width: panelW - 40 }
        }).setOrigin(0.5, 0);

        c.add([shade, panel, title, body]);
        this.createButton(width / 2, top + panelH - 34, 'CLOSE', 0x333333, () => {
            c.destroy(true);
        }, c, compact ? 150 : 180, compact ? 34 : 40, compact ? 15 : 18);
    }

    _showSteamInputDebugOverlay() {
        const { width, height } = this.scale;
        const compact = this._isCompact();
        const result = runSteamInputPromptDebugSuite();
        const samples = (result.samplePrompts || [])
            .slice(0, compact ? 7 : 10)
            .map(p => `${p.actionSet}.${p.action}: ${p.promptText}`)
            .join('');

        if (this._steamInputDebugOverlay) {
            this._steamInputDebugOverlay.destroy(true);
            this._steamInputDebugOverlay = null;
        }

        const c = this.add.container(0, 0).setDepth(9800);
        this._steamInputDebugOverlay = c;

        const panelW = Math.min(compact ? width - 24 : 620, width - 24);
        const panelH = Math.min(compact ? height - 24 : 470, height - 24);
        const top = height / 2 - panelH / 2;
        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72);
        const panel = this.add.graphics();
        panel.fillStyle(0x0d1622, 0.98);
        panel.fillRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 18);
        panel.lineStyle(3, result.ok ? 0x39ff14 : 0xff3333, 0.9);
        panel.strokeRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 18);

        const title = this.add.text(width / 2, top + 34, 'STEAM INPUT PROMPT TEST', {
            fontSize: compact ? '20px' : '26px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: result.ok ? '#39ff14' : '#ff3333',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center'
        }).setOrigin(0.5);

        const summary = [
            `Status: ${result.status}`,
            `Native Bridge: ${result.runtime.nativeBridgeDetected ? result.runtime.nativeBridgeName : 'not detected, fallback active'}`,
            `Action Sets: ${result.runtime.availableActionSets.length}`,
            `Actions: ${result.runtime.actionCount}`,
            `Required Prompts: ${result.requiredPromptCount}`,
            `Missing: ${(result.missing || []).length}`
        ].join('');

        const body = this.add.text(width / 2, top + (compact ? 76 : 88), `${summary}

Fallback Samples:
${samples}`, {
            fontSize: compact ? '12px' : '14px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'left',
            lineSpacing: 4,
            wordWrap: { width: panelW - 42 }
        }).setOrigin(0.5, 0);

        const confirmPrompt = this.add.text(width / 2, top + panelH - (compact ? 74 : 82), getSteamInputPromptLabel('confirm', 'Close', { actionSet: 'menu' }), {
            fontSize: compact ? '13px' : '16px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        c.add([shade, panel, title, body, confirmPrompt]);

        this.createButton(width / 2, top + panelH - (compact ? 34 : 38), 'CLOSE', 0x333333, () => {
            if (this._steamInputDebugOverlay) {
                this._steamInputDebugOverlay.destroy(true);
                this._steamInputDebugOverlay = null;
            }
        }, c, compact ? 150 : 180, compact ? 34 : 40, compact ? 15 : 18);

        return result;
    }

    showDebugMenu() {
        const { width, height } = this.scale;
        this._navSequential = false;
        const compact = this._isCompact();

        if (this.optionsContainer) this.optionsContainer.destroy(true);
        this.mainBtnContainer.setVisible(false);
        if (this.diffContainer) this.diffContainer.setVisible(false);

        const c = this.add.container(0, 0).setDepth(9200);
        this.optionsContainer = c;

        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.80);
        const panelW = Math.min(620, width - 28);
        const panelH = Math.min(height - 24, compact ? 560 : 650);
        const top = height / 2 - panelH / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x101010, 0.98);
        panel.fillRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 22);
        panel.lineStyle(4, 0xff3333, 0.85);
        panel.strokeRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 22);

        const title = this.add.text(width / 2, top + (compact ? 28 : 36), 'DEBUG MODE', {
            fontSize: compact ? '28px' : '36px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ff3333',
            stroke: '#000000',
            strokeThickness: 7
        }).setOrigin(0.5);

        const note = this.add.text(width / 2, top + (compact ? 54 : 68), 'Debug runs skip cutscenes, can boost testing, and do not save leaderboard scores.', {
            fontSize: compact ? '15px' : '17px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        c.add([shade, panel, title, note]);

        this.createButton(width / 2 + panelW / 2 - (compact ? 82 : 98), top + (compact ? 28 : 36), 'INPUT TEST', 0x0066aa, () => {
            this._showSteamInputDebugOverlay();
        }, c, compact ? 128 : 156, compact ? 28 : 32, compact ? 10 : 12);

        this._debugGunPowerup = this._debugGunPowerup || 'pistol';
        const gunModes = [
            { key: 'none', label: 'GUN: NONE' },
            { key: 'pistol', label: 'GUN: PISTOL' },
            { key: 'rifle', label: 'GUN: RIFLE' }
        ];

        const getGunModeLabel = () => {
            const mode = gunModes.find(m => m.key === this._debugGunPowerup) || gunModes[1];
            return mode.label;
        };

        const cycleGunMode = () => {
            const index = gunModes.findIndex(m => m.key === this._debugGunPowerup);
            const next = gunModes[(index + 1) % gunModes.length];
            this._debugGunPowerup = next.key;
            if (gunModeText) gunModeText.setText(getGunModeLabel());
        };

        let gunModeText = null;

        const startDebug = (stageIndex, label, options = {}) => {
            this._stopTitleMusic();
            this.scene.start('GameScene', {
                stageIndex,
                difficulty: options.difficulty ?? 1,
                controlMode: this.selectedControlMode,
                debugMode: true,
                debugOptions: {
                    disableScoreSaving: true,
                    giveFullArmy: options.giveFullArmy ?? true,
                    giveHighStr: options.giveHighStr ?? true,
                    givePistolAmmo: options.givePistolAmmo ?? (this._debugGunPowerup === 'pistol'),
                    giveRifleAmmo: options.giveRifleAmmo ?? (this._debugGunPowerup === 'rifle'),
                    gunPowerup: options.gunPowerup ?? this._debugGunPowerup,
                    captureAllTurfs: options.captureAllTurfs ?? false,
                    triggerBossImmediately: options.triggerBossImmediately ?? false,
                    invincible: options.invincible ?? false,
                    label,
                    forceWeather: options.forceWeather ?? null
                }
            });
        };

        const leftX = width / 2 - Math.min(145, panelW * 0.24);
        const rightX = width / 2 + Math.min(145, panelW * 0.24);
        const rowStart = top + (compact ? 92 : 126);
        const rowGap = compact ? 38 : 46;
        const btnW = Math.min(compact ? 160 : 250, panelW * 0.42);
        const btnH = compact ? 30 : 36;
        const fz = compact ? 12 : 15;

        const headerRun = this.add.text(leftX, rowStart - 28, 'FULL STAGE', {
            fontSize: compact ? '13px' : '17px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        const headerBoss = this.add.text(rightX, rowStart - 28, 'BOSS TEST', {
            fontSize: compact ? '13px' : '17px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        c.add([headerRun, headerBoss]);

        const stageRows = [
            { label: 'STAGE 1', stageIndex: 0, runColor: 0x5a1a6a, bossColor: 0x884400 },
            { label: 'STAGE 2', stageIndex: 1, runColor: 0x5a1a6a, bossColor: 0x884400 },
            { label: 'STAGE 3', stageIndex: 2, runColor: 0x5a1a6a, bossColor: 0x884400 },
            { label: 'STAGE 4', stageIndex: 3, runColor: 0x5a1a6a, bossColor: 0x884400 },
            { label: 'STAGE 5', stageIndex: 4, runColor: 0x5a1a6a, bossColor: 0x880000 },
            { label: 'FINAL', stageIndex: 5, runColor: 0x225522, bossColor: 0xaa0000 }
        ];

        stageRows.forEach((row, index) => {
            const y = rowStart + index * rowGap;
            this.createButton(leftX, y, `${row.label} RUN`, row.runColor, () => {
                startDebug(row.stageIndex, `${row.label} Full Run Test`, {
                    captureAllTurfs: false,
                    triggerBossImmediately: false,
                    giveFullArmy: true,
                    giveHighStr: true,
                    // Uses selected debug gun mode
                });
            }, c, btnW, btnH, fz);

            this.createButton(rightX, y, `${row.label} BOSS`, row.bossColor, () => {
                startDebug(row.stageIndex, `${row.label} Boss Test`, {
                    captureAllTurfs: true,
                    triggerBossImmediately: true,
                    giveFullArmy: true,
                    giveHighStr: true,
                    // Uses selected debug gun mode
                });
            }, c, btnW, btnH, fz);
        });

        const utilityY = rowStart + stageRows.length * rowGap + (compact ? 6 : 10);

        const gunBtn = this.createButton(width / 2, utilityY, getGunModeLabel(), 0x225522, () => {
            cycleGunMode();
        }, c, Math.min(compact ? 260 : 330, panelW - 70), compact ? 30 : 34, compact ? 12 : 15);
        gunModeText = gunBtn.list?.[1] || null;

        const utilityY2 = utilityY + (compact ? 36 : 42);

        this.createButton(leftX, utilityY2, 'PURPLE GANG', 0x7a22aa, () => {
            startDebug(2, 'Purple Gang Test', {
                captureAllTurfs: false,
                triggerBossImmediately: false,
                giveFullArmy: true,
                giveHighStr: true,
                invincible: true
            });
        }, c, btnW, btnH, fz);

        this.createButton(rightX, utilityY2, 'ORANGE GANG', 0xaa5500, () => {
            startDebug(4, 'Orange Gang Test', {
                captureAllTurfs: false,
                triggerBossImmediately: false,
                giveFullArmy: true,
                giveHighStr: true,
                invincible: true
            });
        }, c, btnW, btnH, fz);


        const weatherY = utilityY2 + (compact ? 36 : 42);

        this.createButton(leftX, weatherY, 'RAIN WEATHER', 0x006688, () => {
            startDebug(1, 'Rain Weather Test', {
                captureAllTurfs: false,
                triggerBossImmediately: false,
                giveFullArmy: true,
                giveHighStr: true,
                invincible: true,
                forceWeather: 'rain'
            });
        }, c, btnW, btnH, fz);

        this.createButton(rightX, weatherY, 'SNOW WEATHER', 0x88ccff, () => {
            startDebug(3, 'Snow Weather Test', {
                captureAllTurfs: false,
                triggerBossImmediately: false,
                giveFullArmy: true,
                giveHighStr: true,
                invincible: true,
                forceWeather: 'snow'
            });
        }, c, btnW, btnH, fz);

        this.createButton(width / 2, top + panelH - 170, 'RESET PLAYER DATA', 0x880000, () => {
            this._resetAllPlayerData();
        }, c, 320, 42, 18);



        this.createButton(width / 2, top + panelH - (compact ? 62 : 88), 'RESET UNLOCKABLES', 0x884400, () => {
            resetCosmeticState();

            const confirm = this.add.text(width / 2, top + panelH - (compact ? 94 : 122), 'UNLOCKABLES RESET', {
                fontSize: compact ? '15px' : '17px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#39ff14',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);
            c.add(confirm);

            this.tweens.add({
                targets: confirm,
                alpha: 0,
                duration: 1200,
                delay: 700,
                onComplete: () => confirm.destroy()
            });
        }, c, 320, 42, 18);

        this.createButton(width / 2, top + panelH - 118, 'UNLOCK MINI-GAMES', 0x6b1fa2, () => {
            this._openMiniGamesHub(true);
        }, c, 320, 42, 18);





        this.createButton(width / 2, top + panelH - (compact ? 26 : 42), 'BACK', 0x333333, () => {
            if (this.optionsContainer) {
                this.optionsContainer.destroy(true);
                this.optionsContainer = null;
            }
            this.mainBtnContainer.setVisible(true);
        }, c, 170, compact ? 32 : 40, compact ? 16 : 20);
    }

    startGame(difficultyLevel) {
        this._stopTitleMusic();
        this.scene.start('StageIntroScene', {
            targetGameData: {
                stageIndex: 0,
                difficulty: difficultyLevel,
                controlMode: this.selectedControlMode
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
// CHIGGAS_GAMEPLAY_STABILITY_PASS_92B_FIXED_OPTIONS_BEGIN
try {
    if (!MenuScene.prototype.__chiggasPass92BFixedOptionsInstalled) {
        MenuScene.prototype.__chiggasPass92BFixedOptionsInstalled = true;

        const __pass92BOrigLoadSettings = MenuScene.prototype._loadSettings;
        MenuScene.prototype._loadSettings = function(...args) {
            const settings = __pass92BOrigLoadSettings.apply(this, args) || {};
            try {
                const raw = window.localStorage.getItem('chiggas_settings_v1');
                const parsed = raw ? JSON.parse(raw) : {};
                let changed = false;
                if (!parsed.__volumeCalibrated92B) {
                    ['masterVolume', 'musicVolume', 'sfxVolume'].forEach(key => {
                        const value = Number(settings[key]);
                        if (!Number.isFinite(value) || value >= 0.74) {
                            settings[key] = 1;
                            parsed[key] = 1;
                            changed = true;
                        }
                    });
                    parsed.__volumeCalibrated92B = true;
                    changed = true;
                }
                if (changed) {
                    parsed.controlMode = settings.controlMode || parsed.controlMode || this.selectedControlMode || 'touch';
                    window.localStorage.setItem('chiggas_settings_v1', JSON.stringify(parsed));
                }
            } catch (_) {}
            return {
                controlMode: settings.controlMode || 'touch',
                masterVolume: this._clamp01(settings.masterVolume ?? 1),
                musicVolume: this._clamp01(settings.musicVolume ?? 1),
                sfxVolume: this._clamp01(settings.sfxVolume ?? 1)
            };
        };

        const __pass92BOrigCreateButton = MenuScene.prototype.createButton;
        MenuScene.prototype.createButton = function(x, y, text, color, onClick, container, w = 380, h = 88, fz = 34) {
            const btn = __pass92BOrigCreateButton.call(this, x, y, text, color, onClick, container, w, h, fz);
            try {
                if (btn && !btn.__pass92BPointerSafe) {
                    btn.__pass92BPointerSafe = true;
                    btn.removeAllListeners?.('pointerdown');
                    btn.on('pointerdown', (pointer, localX, localY, event) => {
                        try { event?.stopPropagation?.(); } catch (_) {}
                        try { pointer?.event?.stopPropagation?.(); } catch (_) {}
                        const now = this.time?.now || Date.now();
                        if (now < (this.__pass92BMenuPointerLockUntil || 0)) return;
                        this.__pass92BMenuPointerLockUntil = now + 180;
                        const run = () => { try { if (typeof onClick === 'function') onClick(); } catch (_) {} };
                        try {
                            this.tweens.add({ targets: btn, scale: 0.92, duration: 70, yoyo: true, onComplete: run });
                        } catch (_) {
                            run();
                        }
                    });
                }
            } catch (_) {}
            return btn;
        };

        const __pass92BOrigSaveSettings = MenuScene.prototype._saveSettings;
        MenuScene.prototype._saveSettings = function(...args) {
            try {
                this.settings.masterVolume = this._clamp01(this.settings.masterVolume ?? 1);
                this.settings.musicVolume = this._clamp01(this.settings.musicVolume ?? 1);
                this.settings.sfxVolume = this._clamp01(this.settings.sfxVolume ?? 1);
            } catch (_) {}
            return __pass92BOrigSaveSettings.apply(this, args);
        };
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Stability Pass 92B options repair failed safely:', error);
}
// CHIGGAS_GAMEPLAY_STABILITY_PASS_92B_FIXED_OPTIONS_END

// CHIGGAS_GAMEPLAY_STABILITY_PASS_92C_VOLUME_OPTIONS_MENU_BEGIN
try {
    if (!MenuScene.prototype.__chiggasPass92CVolumeOptionsInstalled) {
        MenuScene.prototype.__chiggasPass92CVolumeOptionsInstalled = true;

        MenuScene.prototype.__pass92CCalibrateVolumeSettings = function() {
            try {
                const raw = window.localStorage.getItem('chiggas_settings_v1');
                const parsed = raw ? JSON.parse(raw) : {};
                let changed = false;
                if (!parsed.__volumeCalibrated92C) {
                    ['masterVolume', 'musicVolume', 'sfxVolume'].forEach(key => {
                        const current = Number(parsed[key]);
                        if (!Number.isFinite(current) || current >= 0.74) {
                            parsed[key] = 1;
                            changed = true;
                        }
                    });
                    parsed.__volumeCalibrated92C = true;
                    changed = true;
                }
                if (changed) window.localStorage.setItem('chiggas_settings_v1', JSON.stringify(parsed));
                if (this.settings) {
                    this.settings.masterVolume = this._clamp01(parsed.masterVolume ?? this.settings.masterVolume ?? 1);
                    this.settings.musicVolume = this._clamp01(parsed.musicVolume ?? this.settings.musicVolume ?? 1);
                    this.settings.sfxVolume = this._clamp01(parsed.sfxVolume ?? this.settings.sfxVolume ?? 1);
                }
            } catch (_) {}
        };

        const __pass92COrigLoadSettings = MenuScene.prototype._loadSettings;
        MenuScene.prototype._loadSettings = function(...args) {
            const settings = __pass92COrigLoadSettings.apply(this, args) || {};
            try {
                const raw = window.localStorage.getItem('chiggas_settings_v1');
                const parsed = raw ? JSON.parse(raw) : {};
                if (!parsed.__volumeCalibrated92C) {
                    ['masterVolume', 'musicVolume', 'sfxVolume'].forEach(key => {
                        const current = Number(parsed[key]);
                        if (!Number.isFinite(current) || current >= 0.74) parsed[key] = 1;
                    });
                    parsed.__volumeCalibrated92C = true;
                    window.localStorage.setItem('chiggas_settings_v1', JSON.stringify(parsed));
                }
                settings.masterVolume = this._clamp01(parsed.masterVolume ?? settings.masterVolume ?? 1);
                settings.musicVolume = this._clamp01(parsed.musicVolume ?? settings.musicVolume ?? 1);
                settings.sfxVolume = this._clamp01(parsed.sfxVolume ?? settings.sfxVolume ?? 1);
            } catch (_) {
                settings.masterVolume = this._clamp01(settings.masterVolume ?? 1);
                settings.musicVolume = this._clamp01(settings.musicVolume ?? 1);
                settings.sfxVolume = this._clamp01(settings.sfxVolume ?? 1);
            }
            return settings;
        };

        const __pass92COrigShowOptionsMenu = MenuScene.prototype.showOptionsMenu;
        MenuScene.prototype.showOptionsMenu = function(...args) {
            const result = __pass92COrigShowOptionsMenu.apply(this, args);
            try {
                this.__pass92CCalibrateVolumeSettings();
                this.__pass92CBuildOptionsGrid();
            } catch (_) {}
            return result;
        };

        MenuScene.prototype.__pass92CButtonLabel = function(btn) {
            try {
                const list = btn?.list || [];
                const textObj = list.find(child => typeof child?.text === 'string');
                return String(textObj?.text || '').trim().toUpperCase();
            } catch (_) { return ''; }
        };

        MenuScene.prototype.__pass92CButtonInContainer = function(btn, container) {
            try {
                let current = btn;
                while (current) {
                    if (current === container) return true;
                    current = current.parentContainer;
                }
            } catch (_) {}
            return false;
        };

        MenuScene.prototype.__pass92CBuildOptionsGrid = function() {
            try {
                if (!this.optionsContainer) return;
                const buttons = (this._menuButtons || [])
                    .filter(btn => this._isButtonUsable(btn) && this.__pass92CButtonInContainer(btn, this.optionsContainer));
                const rows = [];
                const byLabel = label => buttons.filter(btn => this.__pass92CButtonLabel(btn) === label);
                const modeRow = ['TOUCH', 'KEYBOARD', 'GAMEPAD'].map(label => byLabel(label)[0]).filter(Boolean);
                if (modeRow.length) rows.push(modeRow);
                const controls = buttons.find(btn => this.__pass92CButtonLabel(btn).includes('CONTROLS'));
                if (controls) rows.push([controls]);
                const volumeButtons = buttons
                    .filter(btn => ['+', '–', '-'].includes(this.__pass92CButtonLabel(btn)))
                    .sort((a, b) => {
                        const ap = this._getButtonWorldPos(a);
                        const bp = this._getButtonWorldPos(b);
                        return (ap.y - bp.y) || (ap.x - bp.x);
                    });
                for (let i = 0; i < volumeButtons.length; i += 2) {
                    const row = volumeButtons.slice(i, i + 2).sort((a, b) => this._getButtonWorldPos(a).x - this._getButtonWorldPos(b).x);
                    if (row.length) rows.push(row);
                }
                const back = byLabel('BACK')[0];
                if (back) rows.push([back]);
                this.__pass92COptionsGrid = rows;
                this.__pass92COptionsRow = 0;
                this.__pass92COptionsCol = 0;
                if (rows[0]?.[0]) this._focusMenuButton(rows[0][0]);
            } catch (_) {}
        };

        MenuScene.prototype.__pass92CMoveOptionsGrid = function(direction) {
            const rows = this.__pass92COptionsGrid;
            if (!rows || !rows.length) return false;
            let row = Phaser.Math.Clamp(this.__pass92COptionsRow || 0, 0, rows.length - 1);
            let col = Phaser.Math.Clamp(this.__pass92COptionsCol || 0, 0, Math.max(0, rows[row].length - 1));
            if (direction === 'up') row = Phaser.Math.Wrap(row - 1, 0, rows.length);
            else if (direction === 'down') row = Phaser.Math.Wrap(row + 1, 0, rows.length);
            else if (direction === 'left') col = Phaser.Math.Wrap(col - 1, 0, rows[row].length);
            else if (direction === 'right') col = Phaser.Math.Wrap(col + 1, 0, rows[row].length);
            col = Phaser.Math.Clamp(col, 0, Math.max(0, rows[row].length - 1));
            this.__pass92COptionsRow = row;
            this.__pass92COptionsCol = col;
            this._focusMenuButton(rows[row][col]);
            return true;
        };

        const __pass92COrigMoveMenuFocus = MenuScene.prototype._moveMenuFocus;
        MenuScene.prototype._moveMenuFocus = function(direction) {
            if (this.optionsContainer && this.__pass92COptionsGrid?.length) {
                if (this.__pass92CMoveOptionsGrid(direction)) return;
            }
            return __pass92COrigMoveMenuFocus.call(this, direction);
        };

        const __pass92COrigActivateMenu = MenuScene.prototype._activateFocusedMenuButton;
        MenuScene.prototype._activateFocusedMenuButton = function() {
            if (this.optionsContainer && this._focusedMenuButton) {
                const now = this.time?.now || Date.now();
                if (now < (this.__pass92COptionActivateLockUntil || 0)) return;
                this.__pass92COptionActivateLockUntil = now + 220;
                if (typeof this._focusedMenuButton._navAction === 'function') {
                    this._focusedMenuButton._navAction();
                    return;
                }
            }
            return __pass92COrigActivateMenu.call(this);
        };
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Stability Pass 92C menu hotfix failed safely:', error);
}
// CHIGGAS_GAMEPLAY_STABILITY_PASS_92C_VOLUME_OPTIONS_MENU_END





/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92I_MENU_NAV_EXIT_BEGIN */
try {
    if (!MenuScene.prototype.__chiggasPass92IMenuNavExitInstalled) {
        MenuScene.prototype.__chiggasPass92IMenuNavExitInstalled = true;

        MenuScene.prototype.__pass92ISpatialMoveMenuFocus = function(direction) {
            const buttons = this._getVisibleMenuButtons?.() || [];
            if (!buttons.length) return false;

            if (!this._isButtonUsable?.(this._focusedMenuButton)) {
                this._focusFirstVisible?.();
                return true;
            }

            const current = this._focusedMenuButton;
            const currentPos = this._getButtonWorldPos?.(current) || { x: current.x || 0, y: current.y || 0 };

            let best = null;
            let bestScore = Infinity;

            buttons.forEach(candidate => {
                if (!candidate || candidate === current) return;

                const pos = this._getButtonWorldPos?.(candidate) || { x: candidate.x || 0, y: candidate.y || 0 };
                const dx = pos.x - currentPos.x;
                const dy = pos.y - currentPos.y;

                if (direction === 'right' && dx <= 8) return;
                if (direction === 'left' && dx >= -8) return;
                if (direction === 'down' && dy <= 8) return;
                if (direction === 'up' && dy >= -8) return;

                const primary = (direction === 'left' || direction === 'right') ? Math.abs(dx) : Math.abs(dy);
                const secondary = (direction === 'left' || direction === 'right') ? Math.abs(dy) : Math.abs(dx);

                // Strong directional scoring:
                // Right/left should prefer same-row adjacent buttons before jumping rows.
                // Down/up should prefer same-column buttons before jumping sideways.
                const score = primary * 1000 + secondary * 28;
                if (score < bestScore) {
                    bestScore = score;
                    best = candidate;
                }
            });

            if (best) {
                this._focusMenuButton?.(best);
                return true;
            }

            return false;
        };

        const __pass92IOrigMoveMenuFocus = MenuScene.prototype._moveMenuFocus;
        MenuScene.prototype._moveMenuFocus = function(direction) {
            try {
                if (this.optionsContainer && ['left', 'right', 'up', 'down'].includes(direction)) {
                    if (this.__pass92ISpatialMoveMenuFocus(direction)) return;
                }
            } catch (_) {}
            return __pass92IOrigMoveMenuFocus.apply(this, arguments);
        };

        const __pass92IOrigCreate = MenuScene.prototype.create;
        MenuScene.prototype.create = function(...args) {
            const result = __pass92IOrigCreate.apply(this, args);

            try {
                const { width, height } = this.scale;
                const compact = this._isCompact?.() || width < 760 || height < 560;
                const x = Math.min(width - (compact ? 78 : 92), width * 0.88);
                const y = height - (compact ? 34 : 42);

                if (this.mainBtnContainer && !this.__pass92IExitGameButton) {
                    this.__pass92IExitGameButton = this.createButton(
                        x,
                        y,
                        'EXIT GAME',
                        0x661111,
                        () => {
                            try { window.__chiggasPass92IExitGameClicked = true; } catch (_) {}
                            try { this._requestExitApp?.(); return; } catch (_) {}
                        },
                        this.mainBtnContainer,
                        compact ? 132 : 154,
                        compact ? 38 : 44,
                        compact ? 16 : 18
                    );

                    try {
                        this.__pass92IExitGameButton.__pass92IExitGameButton = true;
                        this.__pass92IExitGameButton._navLabel = 'EXIT GAME';
                    } catch (_) {}
                }
            } catch (error) {
                console.warn('[Chiggas] Pass 92I exit game button failed safely:', error);
            }

            return result;
        };
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Stability Pass 92I menu nav/exit failed safely:', error);
}
/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92I_MENU_NAV_EXIT_END */

/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92J_MENU_SPATIAL_EXIT_BEGIN */
try {
    if (!MenuScene.prototype.__chiggasPass92JMenuSpatialExitInstalled) {
        MenuScene.prototype.__chiggasPass92JMenuSpatialExitInstalled = true;

        MenuScene.prototype.__pass92JWorldPos = function(btn) {
            try {
                return this._getButtonWorldPos?.(btn) || { x: btn?.x || 0, y: btn?.y || 0 };
            } catch (_) {
                return { x: btn?.x || 0, y: btn?.y || 0 };
            }
        };

        MenuScene.prototype.__pass92JMoveSpatial = function(direction) {
            const buttons = (this._getVisibleMenuButtons?.() || []).filter(btn => this._isButtonUsable?.(btn));
            if (!buttons.length) return false;

            if (!this._isButtonUsable?.(this._focusedMenuButton)) {
                this._focusMenuButton?.(buttons[0]);
                return true;
            }

            const current = this._focusedMenuButton;
            const currentPos = this.__pass92JWorldPos(current);
            const horizontal = direction === 'left' || direction === 'right';
            const sign = (direction === 'right' || direction === 'down') ? 1 : -1;

            const viable = [];
            for (const btn of buttons) {
                if (!btn || btn === current) continue;
                const pos = this.__pass92JWorldPos(btn);
                const dx = pos.x - currentPos.x;
                const dy = pos.y - currentPos.y;

                if (horizontal) {
                    if (sign > 0 && dx <= 8) continue;
                    if (sign < 0 && dx >= -8) continue;
                    viable.push({ btn, dx, dy, pos });
                } else {
                    if (sign > 0 && dy <= 8) continue;
                    if (sign < 0 && dy >= -8) continue;
                    viable.push({ btn, dx, dy, pos });
                }
            }

            if (!viable.length) return true;

            const rowTolerance = 34;
            const columnTolerance = 44;

            let preferred = [];
            if (horizontal) {
                preferred = viable.filter(item => Math.abs(item.dy) <= rowTolerance);
                if (preferred.length) {
                    preferred.sort((a, b) => Math.abs(a.dx) - Math.abs(b.dx) || Math.abs(a.dy) - Math.abs(b.dy));
                    this._focusMenuButton?.(preferred[0].btn);
                    return true;
                }
            } else {
                preferred = viable.filter(item => Math.abs(item.dx) <= columnTolerance);
                if (preferred.length) {
                    preferred.sort((a, b) => Math.abs(a.dy) - Math.abs(b.dy) || Math.abs(a.dx) - Math.abs(b.dx));
                    this._focusMenuButton?.(preferred[0].btn);
                    return true;
                }
            }

            // Fallback: choose nearest candidate in the requested direction, but heavily punish drifting off-axis.
            viable.sort((a, b) => {
                const aPrimary = horizontal ? Math.abs(a.dx) : Math.abs(a.dy);
                const bPrimary = horizontal ? Math.abs(b.dx) : Math.abs(b.dy);
                const aSecondary = horizontal ? Math.abs(a.dy) : Math.abs(a.dx);
                const bSecondary = horizontal ? Math.abs(b.dy) : Math.abs(b.dx);
                const aScore = aPrimary + aSecondary * 4;
                const bScore = bPrimary + bSecondary * 4;
                return aScore - bScore;
            });

            this._focusMenuButton?.(viable[0].btn);
            return true;
        };

        const __pass92JOrigMoveMenuFocus = MenuScene.prototype._moveMenuFocus;
        MenuScene.prototype._moveMenuFocus = function(direction) {
            try {
                if (['left', 'right', 'up', 'down'].includes(direction)) {
                    if (this.__pass92JMoveSpatial(direction)) return;
                }
            } catch (_) {}
            return __pass92JOrigMoveMenuFocus.apply(this, arguments);
        };

        MenuScene.prototype.__pass92JExitGameAction = function() {
            try { window.__chiggasPass92JExitGameClicked = true; } catch (_) {}
            try { this._requestExitApp?.(); return; } catch (_) {}
        };

        MenuScene.prototype.__pass92JEnsureExitGameButton = function() {
            try {
                if (!this.mainBtnContainer || this.mainBtnContainer.visible === false) return;
                if (this.optionsContainer || this.diffContainer?.visible) return;

                const existingUsable = this.__pass92JExitGameButton &&
                    this.__pass92JExitGameButton.active !== false &&
                    this.__pass92JExitGameButton.visible !== false &&
                    this.__pass92JExitGameButton.parentContainer === this.mainBtnContainer;

                if (existingUsable) return;

                try { this.__pass92JExitGameButton?.destroy?.(); } catch (_) {}

                const { width, height } = this.scale;
                const compact = this._isCompact?.() || width < 760 || height < 560;
                const x = Math.min(width - (compact ? 76 : 92), width * 0.88);
                const y = height - (compact ? 32 : 42);

                this.__pass92JExitGameButton = this.createButton(
                    x,
                    y,
                    'EXIT GAME',
                    0x661111,
                    () => this.__pass92JExitGameAction(),
                    this.mainBtnContainer,
                    compact ? 132 : 154,
                    compact ? 38 : 44,
                    compact ? 16 : 18
                );

                this.__pass92JExitGameButton.__pass92JExitGameButton = true;
                this.__pass92JExitGameButton._navLabel = 'EXIT GAME';
                this.__pass92JExitGameButton._navOrder = 9999;
            } catch (error) {
                console.warn('[Chiggas] Pass 92J ensure exit button failed safely:', error);
            }
        };

        const __pass92JOrigCreate = MenuScene.prototype.create;
        MenuScene.prototype.create = function(...args) {
            const result = __pass92JOrigCreate.apply(this, args);
            try {
                this.time?.delayedCall?.(0, () => this.__pass92JEnsureExitGameButton());
                this.time?.delayedCall?.(200, () => this.__pass92JEnsureExitGameButton());
            } catch (_) {}
            return result;
        };

        const __pass92JOrigShowMainMenu = MenuScene.prototype.showMainMenu;
        if (typeof __pass92JOrigShowMainMenu === 'function') {
            MenuScene.prototype.showMainMenu = function(...args) {
                const result = __pass92JOrigShowMainMenu.apply(this, args);
                try {
                    this.time?.delayedCall?.(0, () => this.__pass92JEnsureExitGameButton());
                    this.time?.delayedCall?.(200, () => this.__pass92JEnsureExitGameButton());
                } catch (_) {}
                return result;
            };
        }

        const __pass92JOrigUpdate = MenuScene.prototype.update;
        MenuScene.prototype.update = function(time, delta) {
            if (typeof __pass92JOrigUpdate === 'function') {
                __pass92JOrigUpdate.call(this, time, delta);
            }
            try {
                if ((time || 0) > (this.__pass92JNextExitButtonCheckAt || 0)) {
                    this.__pass92JNextExitButtonCheckAt = (time || 0) + 500;
                    this.__pass92JEnsureExitGameButton();
                }
            } catch (_) {}
        };
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Stability Pass 92J menu spatial/exit failed safely:', error);
}
/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92J_MENU_SPATIAL_EXIT_END */


/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92K_TITLE_BACK_SAFE_BEGIN */
try {
    if (!MenuScene.prototype.__chiggasPass92KTitleBackSafeInstalled) {
        MenuScene.prototype.__chiggasPass92KTitleBackSafeInstalled = true;

        MenuScene.prototype.__pass92KReturnToMainMenuSafely = function() {
            try {
                if (this.optionsContainer) {
                    this.optionsContainer.destroy(true);
                    this.optionsContainer = null;
                }
                if (this.controlsContainer) {
                    this.controlsContainer.destroy(true);
                    this.controlsContainer = null;
                }
                if (this.diffContainer) this.diffContainer.setVisible(false);
                if (this.mainBtnContainer) this.mainBtnContainer.setVisible(true);

                this._focusedMenuButton = null;
                this.time?.delayedCall?.(0, () => {
                    try { this._focusFirstVisible?.(); } catch (_) {}
                });
                this.time?.delayedCall?.(75, () => {
                    try {
                        if (this.mainBtnContainer && this.mainBtnContainer.visible !== true) {
                            this.mainBtnContainer.setVisible(true);
                        }
                        if (!this._focusedMenuButton) this._focusFirstVisible?.();
                    } catch (_) {}
                });
            } catch (error) {
                console.warn('[Chiggas] Pass 92K safe title return failed:', error);
            }
        };

        const __pass92KOrigCreate = MenuScene.prototype.create;
        MenuScene.prototype.create = function(...args) {
            const result = __pass92KOrigCreate.apply(this, args);

            try {
                if (!this.__pass92KBackHandlerInstalled) {
                    this.__pass92KBackHandlerInstalled = true;

                    this.input?.gamepad?.on?.('down', (_pad, button, index) => {
                        const buttonIndex = button?.index ?? index;
                        if ((buttonIndex === 1 || buttonIndex === 8) && (this.optionsContainer || this.controlsContainer)) {
                            this.__pass92KBackPressedAt = this.time?.now || Date.now();
                            this.__pass92KReturnToMainMenuSafely();
                        }
                    });

                    this.input?.keyboard?.on?.('keydown', event => {
                        if ((event.key === 'Escape' || event.code === 'Escape') && (this.optionsContainer || this.controlsContainer)) {
                            this.__pass92KBackPressedAt = this.time?.now || Date.now();
                            this.__pass92KReturnToMainMenuSafely();
                        }
                    });
                }
            } catch (_) {}

            return result;
        };

        const __pass92KOrigUpdate = MenuScene.prototype.update;
        MenuScene.prototype.update = function(time, delta) {
            if (typeof __pass92KOrigUpdate === 'function') {
                __pass92KOrigUpdate.call(this, time, delta);
            }

            try {
                // Black screen watchdog: if every menu container is hidden/destroyed, restore title buttons.
                const hasMain = this.mainBtnContainer && this.mainBtnContainer.visible === true;
                const hasOptions = this.optionsContainer && this.optionsContainer.active !== false;
                const hasControls = this.controlsContainer && this.controlsContainer.active !== false;
                const hasDiff = this.diffContainer && this.diffContainer.visible === true;

                if (!hasMain && !hasOptions && !hasControls && !hasDiff) {
                    this.mainBtnContainer?.setVisible?.(true);
                    this._focusedMenuButton = null;
                    this._focusFirstVisible?.();
                }
            } catch (_) {}
        };
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Stability Pass 92K title back safe failed safely:', error);
}
/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92K_TITLE_BACK_SAFE_END */

/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92L_MENU_SAFE_BEGIN */
try {
    if (!MenuScene.prototype.__chiggasPass92LMenuSafeInstalled) {
        MenuScene.prototype.__chiggasPass92LMenuSafeInstalled = true;

        MenuScene.prototype.showMainMenu = function() {
            try {
                if (this.optionsContainer) {
                    this.optionsContainer.destroy(true);
                    this.optionsContainer = null;
                }

                if (this.controlsContainer) {
                    this.controlsContainer.destroy(true);
                    this.controlsContainer = null;
                }

                if (this.diffContainer) {
                    this.diffContainer.setVisible(false);
                }

                if (this.mainBtnContainer) {
                    this.mainBtnContainer.setVisible(true);
                }

                this._navSequential = false;
                this._focusedMenuButton = null;

                this.__pass92LEnsureExitGameButton?.();

                this.time?.delayedCall?.(0, () => {
                    try { this._focusFirstVisible?.(); } catch (_) {}
                });
            } catch (error) {
                console.warn('[Chiggas] Pass 92L showMainMenu safe fallback failed:', error);
            }
        };

        MenuScene.prototype.__pass92LGetWorldPos = function(btn) {
            try {
                return this._getButtonWorldPos?.(btn) || { x: btn?.x || 0, y: btn?.y || 0 };
            } catch (_) {
                return { x: btn?.x || 0, y: btn?.y || 0 };
            }
        };

        MenuScene.prototype.__pass92LMoveSpatial = function(direction) {
            const buttons = (this._getVisibleMenuButtons?.() || []).filter(btn => this._isButtonUsable?.(btn));
            if (!buttons.length) return false;

            if (!this._isButtonUsable?.(this._focusedMenuButton)) {
                this._focusMenuButton?.(buttons[0]);
                return true;
            }

            const current = this._focusedMenuButton;
            const currentPos = this.__pass92LGetWorldPos(current);
            const horizontal = direction === 'left' || direction === 'right';
            const sign = (direction === 'right' || direction === 'down') ? 1 : -1;

            const viable = [];
            buttons.forEach(btn => {
                if (!btn || btn === current) return;

                const pos = this.__pass92LGetWorldPos(btn);
                const dx = pos.x - currentPos.x;
                const dy = pos.y - currentPos.y;

                if (horizontal) {
                    if (sign > 0 && dx <= 8) return;
                    if (sign < 0 && dx >= -8) return;
                } else {
                    if (sign > 0 && dy <= 8) return;
                    if (sign < 0 && dy >= -8) return;
                }

                viable.push({ btn, dx, dy });
            });

            if (!viable.length) return true;

            const rowTolerance = 34;
            const columnTolerance = 44;

            let preferred = [];
            if (horizontal) {
                preferred = viable.filter(item => Math.abs(item.dy) <= rowTolerance);
                if (preferred.length) {
                    preferred.sort((a, b) => Math.abs(a.dx) - Math.abs(b.dx) || Math.abs(a.dy) - Math.abs(b.dy));
                    this._focusMenuButton?.(preferred[0].btn);
                    return true;
                }
            } else {
                preferred = viable.filter(item => Math.abs(item.dx) <= columnTolerance);
                if (preferred.length) {
                    preferred.sort((a, b) => Math.abs(a.dy) - Math.abs(b.dy) || Math.abs(a.dx) - Math.abs(b.dx));
                    this._focusMenuButton?.(preferred[0].btn);
                    return true;
                }
            }

            viable.sort((a, b) => {
                const aPrimary = horizontal ? Math.abs(a.dx) : Math.abs(a.dy);
                const bPrimary = horizontal ? Math.abs(b.dx) : Math.abs(b.dy);
                const aSecondary = horizontal ? Math.abs(a.dy) : Math.abs(a.dx);
                const bSecondary = horizontal ? Math.abs(b.dy) : Math.abs(b.dx);
                return (aPrimary + aSecondary * 4) - (bPrimary + bSecondary * 4);
            });

            this._focusMenuButton?.(viable[0].btn);
            return true;
        };

        const __pass92LOrigMoveMenuFocus = MenuScene.prototype._moveMenuFocus;
        MenuScene.prototype._moveMenuFocus = function(direction) {
            try {
                if (['left', 'right', 'up', 'down'].includes(direction)) {
                    if (this.__pass92LMoveSpatial(direction)) return;
                }
            } catch (_) {}

            return __pass92LOrigMoveMenuFocus.apply(this, arguments);
        };

        MenuScene.prototype.__pass92LExitGameAction = function() {
            try { window.__chiggasPass92LExitGameClicked = true; } catch (_) {}
            try { this._requestExitApp?.(); return; } catch (_) {}
        };

        MenuScene.prototype.__pass92LEnsureExitGameButton = function() {
            try {
                if (!this.mainBtnContainer || this.mainBtnContainer.visible === false) return;
                if (this.optionsContainer || this.diffContainer?.visible) return;

                const existing = this.__pass92LExitGameButton &&
                    this.__pass92LExitGameButton.active !== false &&
                    this.__pass92LExitGameButton.visible !== false &&
                    this.__pass92LExitGameButton.parentContainer === this.mainBtnContainer;

                if (existing) return;

                try { this.__pass92LExitGameButton?.destroy?.(); } catch (_) {}

                const { width, height } = this.scale;
                const compact = this._isCompact?.() || width < 760 || height < 560;
                const x = Math.min(width - (compact ? 76 : 92), width * 0.88);
                const y = height - (compact ? 32 : 42);

                this.__pass92LExitGameButton = this.createButton(
                    x,
                    y,
                    'EXIT GAME',
                    0x661111,
                    () => this.__pass92LExitGameAction(),
                    this.mainBtnContainer,
                    compact ? 132 : 154,
                    compact ? 38 : 44,
                    compact ? 16 : 18
                );

                this.__pass92LExitGameButton.__pass92LExitGameButton = true;
                this.__pass92LExitGameButton._navLabel = 'EXIT GAME';
                this.__pass92LExitGameButton._navOrder = 9999;
            } catch (error) {
                console.warn('[Chiggas] Pass 92L ensure exit button failed safely:', error);
            }
        };

        const __pass92LOrigCreate = MenuScene.prototype.create;
        MenuScene.prototype.create = function(...args) {
            const result = __pass92LOrigCreate.apply(this, args);
            try {
                this.time?.delayedCall?.(0, () => this.__pass92LEnsureExitGameButton());
                this.time?.delayedCall?.(200, () => this.__pass92LEnsureExitGameButton());
            } catch (_) {}
            return result;
        };

        const __pass92LOrigUpdate = MenuScene.prototype.update;
        MenuScene.prototype.update = function(time, delta) {
            if (typeof __pass92LOrigUpdate === 'function') {
                __pass92LOrigUpdate.call(this, time, delta);
            }

            try {
                if ((time || 0) > (this.__pass92LNextExitButtonCheckAt || 0)) {
                    this.__pass92LNextExitButtonCheckAt = (time || 0) + 500;
                    this.__pass92LEnsureExitGameButton();
                }

                const hasMain = this.mainBtnContainer && this.mainBtnContainer.visible === true;
                const hasOptions = this.optionsContainer && this.optionsContainer.active !== false;
                const hasDiff = this.diffContainer && this.diffContainer.visible === true;

                if (!hasMain && !hasOptions && !hasDiff) {
                    this.showMainMenu();
                }
            } catch (_) {}
        };
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Stability Pass 92L menu safe failed safely:', error);
}
/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92L_MENU_SAFE_END */
