import Phaser from 'phaser';
import { getSafeBounds } from './ResponsiveLayout.js';
import { initSteamInputPromptManager, setSteamInputActionSet, getSteamInputPromptLabel } from './SteamInputPromptManager.js';
import { getKeyboardCodes, getPrimaryKeyboardCode, isGamepadActionButton, isGamepadActionPressed, keyboardCodeToLabel } from './ControlsSettingsManager.js';
import { getPrimaryBrowserGamepad, getBrowserGamepadStatus } from './GamepadRuntimeBridge.js';
import { CONFIG } from '../config.js';
import Player from '../entities/Player.js';
import Chigga from '../entities/Chigga.js';
import Territory from '../entities/Territory.js';
import { MobileControlsManager } from '../rosie/controls/phaserMobileControls.js';
import EnemyCommander from '../entities/EnemyCommander.js';
import BossChigga from '../entities/BossChigga.js';
import MiteOverlord from '../entities/MiteOverlord.js';
import TickBoss from '../entities/TickBoss.js';
import LiceBoss from '../entities/LiceBoss.js';
import TickTwins from '../entities/TickTwins.js';
import CockroachBoss from '../entities/CockroachBoss.js';
import TerrainDecorator from './TerrainDecorator.js';
import { initAudio, playTurfCapture, playRecruit, playDeath, playStageAdvance, startAmbientMusic, stopAmbientMusic, playHit, playBite, playChargeCry, playGunshot, playSpeedGush, refreshAudioVolumes, startRainAmbience, startSnowWindAmbience, stopWeatherAmbience } from '../audio/AudioManager.js';
import { unlockStageRewards, unlockAchievementRewards, getEquippedPlayerSkin, getEquippedSoldierSkin, pass95AUnlockBaseChiggaWear, pass95AGetBaseUnlockCompletion } from './SkinRegistry.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init(data) {
        this.stageIndex = data?.stageIndex ?? 0;
        this.startingScore = data?.score ?? 0;
        this.difficulty = data?.difficulty ?? 1; // 0 = easy, 1 = basic, 2 = hard
        this.controlMode = data?.controlMode ?? 'touch'; // touch, keyboard, gamepad
        this.debugMode = data?.debugMode ?? false;
        this.debugOptions = data?.debugOptions ?? {};

        this.runStats = data?.runStats ?? {
            kills: 0,
            recruits: 0,
            eaten: 0,
            turfsClaimed: 0,
            bossesDefeated: 0,
            startedAt: Date.now()
        };

        this._seenHostileIds = new Set();
        this._lastHostileIds = new Set();
        this._nextStatId = 1;
    }

    create() {
        this._setupPauseInput();
        const { width, height } = this.scale;

        initSteamInputPromptManager();
        setSteamInputActionSet('gameplay');

        this._androidBackHandler = () => this._handleAndroidBack();
        window.addEventListener('chiggasAndroidBack', this._androidBackHandler);

        // Procedurally generate 'ant' and 'gnat' textures if they don't exist
        if (!this.textures.exists('ant')) {
            const canvas = this.textures.createCanvas('ant', 60, 60);
            const ctx = canvas.context;
            // Head
            ctx.fillStyle = '#2b1d11';
            ctx.beginPath(); ctx.arc(15, 30, 8, 0, Math.PI * 2); ctx.fill();
            // Thorax
            ctx.fillStyle = '#3a2718';
            ctx.beginPath(); ctx.arc(30, 30, 7, 0, Math.PI * 2); ctx.fill();
            // Abdomen (larger segment)
            ctx.fillStyle = '#1d120a';
            ctx.beginPath(); ctx.arc(46, 30, 10, 0, Math.PI * 2); ctx.fill();
            // Antennae
            ctx.strokeStyle = '#2b1d11';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(10, 24); ctx.lineTo(3, 16); ctx.lineTo(0, 18);
            ctx.moveTo(10, 36); ctx.lineTo(3, 44); ctx.lineTo(0, 42);
            ctx.stroke();
            // Legs (6 legs jointed)
            ctx.beginPath();
            // leg set 1
            ctx.moveTo(30, 25); ctx.lineTo(25, 12);
            ctx.moveTo(30, 35); ctx.lineTo(25, 48);
            // leg set 2
            ctx.moveTo(32, 25); ctx.lineTo(32, 10);
            ctx.moveTo(32, 35); ctx.lineTo(32, 50);
            // leg set 3
            ctx.moveTo(34, 25); ctx.lineTo(38, 12);
            ctx.moveTo(34, 35); ctx.lineTo(38, 48);
            ctx.stroke();
            
            canvas.refresh();
        }

        if (!this.textures.exists('gnat')) {
            const canvas = this.textures.createCanvas('gnat', 50, 50);
            const ctx = canvas.context;
            // Body
            ctx.fillStyle = '#222222';
            ctx.beginPath(); ctx.arc(25, 25, 6, 0, Math.PI * 2); ctx.fill();
            // Tiny head
            ctx.fillStyle = '#331111';
            ctx.beginPath(); ctx.arc(17, 25, 4, 0, Math.PI * 2); ctx.fill();
            // Wings (glowing cyan-white, translucent)
            ctx.fillStyle = 'rgba(180, 240, 255, 0.7)';
            ctx.beginPath(); ctx.ellipse(25, 17, 10, 6, -Math.PI / 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(25, 33, 10, 6, Math.PI / 6, 0, Math.PI * 2); ctx.fill();
            
            canvas.refresh();
        }

        const stage = CONFIG.STAGES[this.stageIndex] ?? CONFIG.STAGES[CONFIG.STAGES.length - 1];
        this.currentStage = stage;
        this.difficultySettings = this._getDifficultySettings();
        this.settings = this._loadSettings();

        // Normal runs use saved settings. Debug runs keep the control mode passed by the debug menu.
        if (!this.debugMode) {
            this.controlMode = this.settings.controlMode || this.controlMode || 'touch';
        }

        // Territory.js reads this CONFIG value directly, so set it at scene start
        // to make turf-claim speed difficulty-aware for the current run.
        CONFIG.TERRITORY_CAPTURE_TIME = this.difficultySettings.turfCaptureTime;

        this.physics.world.setBounds(0, 0, CONFIG.WORLD_SIZE, CONFIG.WORLD_SIZE);
        
        const bgTex = stage.bgTexture ?? 'skin-texture';
        this.add.tileSprite(CONFIG.WORLD_SIZE / 2, CONFIG.WORLD_SIZE / 2, CONFIG.WORLD_SIZE, CONFIG.WORLD_SIZE, bgTex);

        // Core collections must exist BEFORE terrain decoration.
        this.hazards = null;
        this.pimples = [];
        this.weatherFx = null;
        this.bullets = this.physics.add.group();
        this.territories = [];
        this.units = this.physics.add.group();
        this.enemies = [];
        this._gangWipeoutAnnounced = new Set();
        this._gangStartingFactions = new Set();
        this.follicles = this.physics.add.staticGroup();
        this._contactCooldowns = new Map();

        const decorator = new TerrainDecorator(this, stage.decorDensity, stage);
        decorator.decorate();

        this.score = this.startingScore;
        this.startTime = this.time.now;
        this.elapsedTime = 0;
        // CHIGGAS_STEAM_PASS_66C_REVENGE_NEXT_RUN_GAME_BEGIN
        try {
            const __chiggasRevengePending = (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('chiggas_steam_revenge_run_pending') === 'true');
            if (__chiggasRevengePending && typeof window !== 'undefined' && window.dispatchEvent && !window.__chiggasSteamRevengeRunSent) {
                window.__chiggasSteamRevengeRunSent = true;
                const __chiggasDeathAt = window.localStorage.getItem('chiggas_steam_revenge_run_death_at') || null;
                window.localStorage.removeItem('chiggas_steam_revenge_run_pending');
                window.localStorage.removeItem('chiggas_steam_revenge_run_death_at');
                window.dispatchEvent(new CustomEvent('chiggas-steam-pass-66c-revenge-run', {
                    detail: {
                        achievement: 'REVENGE_RUN',
                        deathSeen: true,
                        deathSeenAt: __chiggasDeathAt,
                        metadata: {
                            source: 'GameScene_new_run_after_death_flag',
                            scene: 'GameScene',
                            event: 'revenge_run_new_run_after_death',
                            reason: 'local_storage_death_flag_seen_on_new_run_start',
                            deathSeenAt: __chiggasDeathAt,
                            storeShouldShow: 'TEST BUY',
                            pass: 'steam_desktop_wrapper_pass_66c',
                            hook: 'death_flag_then_new_run_start_66c'
                        }
                    }
                }));
            }
        } catch (_) {}
        // CHIGGAS_STEAM_PASS_66C_REVENGE_NEXT_RUN_GAME_END

        this.isEnding = false;
        this.isDead = false;
        this._isPausedByExitMenu = false;

        this.runStats.stageReached = Math.max(this.runStats.stageReached || 1, this.stageIndex + 1);

        this.boss = null;
        this.bossPhaseActive = false;
        this.bossDefeated = false;
        this._maxTurfsEverHeld = 0;

        this._raidTimer = 0;
        this._raidInterval = this._randomRange(
            this.difficultySettings.firstRaidMin,
            this.difficultySettings.firstRaidMax
        );

        this.scoreText = null;
        this.timeText = null;
        this._bossWarningText = null;
        this._bossWarningBg = null;
        this._bossCountdownStarted = false;
        this._bossCountdownEndsAt = 0;
        this._bossCountdownDelayMs = 0;
        this._mmBg = null;
        this._mmGfx = null;
        this._mmLabel = null;
        this._mmLegend1 = null;
        this._mmLegend2 = null;

        this.player = new Player(this, CONFIG.WORLD_SIZE / 2, CONFIG.WORLD_SIZE / 2);
        this.spawnGraceDurationMs = 12000;
        this.spawnGraceUntil = 0;
        this._spawnGraceActive = false;
        this._spawnGraceEvent = null;
        this._spawnGraceText = null;
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, CONFIG.WORLD_SIZE, CONFIG.WORLD_SIZE);
        this._applyResponsiveCameraZoom(width, height);
        this._layoutAvatarHUD(width, height);
        this._wrapPlayerDamageForSpawnProtection();

        this.physics.add.collider(this.player, this.follicles);
        this.physics.add.collider(this.units, this.follicles);
        this.physics.add.collider(this.bullets, this.follicles, (bullet, follicle) => {
            bullet.destroy();
        });

        if (this.hazards) {
            this.physics.add.overlap(this.player, this.hazards, (player, hazard) => this._handleWeatherHazardOverlap(player, hazard));
            this.physics.add.overlap(this.units, this.hazards, (unit, hazard) => this._handleWeatherHazardOverlap(unit, hazard));
        }

        this.spawnTerritories(stage.turfs);
        this.spawnEnemies(stage.enemies);

        const initialNeutralCount = Math.max(4, Math.round(stage.neutralChiggas * this.difficultySettings.neutralMultiplier));
        for (let i = 0; i < initialNeutralCount; i++) {
            this.spawnChigga(
                Math.random() * CONFIG.WORLD_SIZE,
                Math.random() * CONFIG.WORLD_SIZE,
                CONFIG.FACTIONS.NEUTRAL
            );
        }

        this.controls = new MobileControlsManager(this);
        this.joystick = this.controls.addJoystick();

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        this.spaceBar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        this.chargeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
        this.shootKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);

        // Rosebud/mobile browser embeds can occasionally fail to route WASD cleanly through
        // Phaser's keyboard manager. Keep a small browser-level key state as a fallback.
        this._keyboardState = {};
        this._windowKeyDownHandler = (event) => {
            this._keyboardState[event.code] = true;
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
                event.preventDefault();
            }
        };
        this._windowKeyUpHandler = (event) => {
            this._keyboardState[event.code] = false;
        };
        window.addEventListener('keydown', this._windowKeyDownHandler, { passive: false });
        window.addEventListener('keyup', this._windowKeyUpHandler, { passive: false });

        this.compass = this.add.graphics().setScrollFactor(0).setDepth(2001);
        this.compassWhite = this.add.graphics().setScrollFactor(0).setDepth(2001);

        this.recruitBtn = this.controls.addButton({
            label: 'RECRUIT', color: 0x33ff33,
            onPress: () => this.handleRecruit()
        });
        this.eatBtn = this.controls.addButton({
            label: 'EAT', color: 0xff3333,
            onPress: () => this.handleEat()
        });
        this.chargeBtn = this.controls.addButton({
            label: 'CHARGE!', color: 0xffaa00,
            onPress: () => this.handleCharge()
        });
        this.shootBtn = this.controls.addButton({
            label: 'SHOOT (0)', color: 0x222222,
            onPress: () => {
                this._shootHeld = true;
                this.handleShoot(this.time.now);
            },
            onRelease: () => {
                this._shootHeld = false;
            }
        });

        this._mobileActionButtons = [this.recruitBtn, this.eatBtn, this.chargeBtn, this.shootBtn];
        this._mobileActionButtons.forEach(btn => this._styleMobileActionButton(btn));

        // Extra global release guards keep mobile hold-to-fire reliable even if the pointer
        // leaves the button while the player is moving.
        this.input.on('pointerup', () => { this._shootHeld = false; });
        this.input.on('pointerupoutside', () => { this._shootHeld = false; });

        this.recruitBtn.button.setVisible(false);
        this.eatBtn.button.setVisible(false);
        this.chargeBtn.button.setVisible(false);
        this.shootBtn.button.setVisible(false);

        if (this.recruitBtn.text) this.recruitBtn.text.setVisible(false);
        if (this.eatBtn.text) this.eatBtn.text.setVisible(false);
        if (this.chargeBtn.text) this.chargeBtn.text.setVisible(false);
        if (this.shootBtn.text) this.shootBtn.text.setVisible(false);

        this.pistolAmmo = 0;
        this.rifleAmmo = 0;
        this._shootHeld = false;
        this._lastRifleShotTime = 0;
        this._lastGunshotSoundTime = 0;
        this._rifleFireDelay = 82;
        this._equippedGunType = 'none';
        this._heldWeaponSprite = null;
        this._shootBtnIcon = null;
        this.bullets = this.physics.add.group();

        const uiStyle = { fontSize: '24px', fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif', color: '#ffffff', stroke: '#000000', strokeThickness: 4 };
        this.armyText      = this.add.text(204, 18, 'Army Lv.1: 0/3', uiStyle).setScrollFactor(0).setDepth(2000);
        this.armyXpText    = this.add.text(372, 39, 'Eat: 0/3', {
            fontSize: '14px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#39ff14',
            stroke: '#000000',
            strokeThickness: 3
        }).setScrollFactor(0).setDepth(2001);
        this.armyXpBarBg   = this.add.graphics().setScrollFactor(0).setDepth(1999);
        this.armyXpBarFill = this.add.graphics().setScrollFactor(0).setDepth(2000);
        this.strText       = this.add.text(204, 66, 'STR: 1', uiStyle).setScrollFactor(0).setDepth(2000);
        this.territoryText = this.add.text(204, 96, 'Turf: 0/0', uiStyle).setScrollFactor(0).setDepth(2000);

        this._setupAvatarHUD();
        this._updateSpawnProtectionUI?.();

        this.stageBadge = this.add.text(width / 2, 20,
            `STAGE ${stage.level}: ${stage.name.toUpperCase()}`, {
                fontSize: '22px', fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif', color: '#ffdd00',
                stroke: '#000000', strokeThickness: 5,
                backgroundColor: '#00000066', padding: { x: 10, y: 4 }
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2000);

        this.inputHelpText = this.add.text(width / 2, 48, this._getInputHelpText(), {
            fontSize: '18px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            backgroundColor: '#00000055',
            padding: { x: 6, y: 2 }
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2000);

        this._refreshInputHelpText();

        this.bossAlertText = this.add.text(width / 2, height / 2 - 60, ' ', {
            fontSize: '52px', fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif', color: '#ff0000',
            stroke: '#000000', strokeThickness: 8, align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5000).setVisible(false);

        this.bossSubText = this.add.text(width / 2, height / 2 + 10, ' ', {
            fontSize: '26px', fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif', color: '#ffaaaa',
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5000).setVisible(false);

        this._setupMinimap(width, height);
        this._setupExitButton(width, height);

        const wildCount = Math.max(4, Math.round((10 + stage.level * 5) * this.difficultySettings.wildMultiplier));
        for (let i = 0; i < wildCount; i++) {
            const x = Math.random() * CONFIG.WORLD_SIZE;
            const y = Math.random() * CONFIG.WORLD_SIZE;
            this.spawnChigga(x, y, CONFIG.FACTIONS.WILD);
        }

        const spawnEconomy = this._getSpawnEconomySettings();

        this.time.addEvent({
            delay: spawnEconomy.wildRespawnDelay,
            loop: true,
            callback: () => {
                if (this.isEnding || this.isDead) return;

                const currentWild = this._countUnitsByFaction(CONFIG.FACTIONS.WILD);
                const wildCap = wildCount + this.difficultySettings.extraWildCap + spawnEconomy.wildMapCapBonus;

                if (currentWild < wildCap) {
                    const missing = wildCap - currentWild;
                    const burstMax = Math.min(spawnEconomy.wildBurstMax, missing);
                    const burstMin = Math.min(spawnEconomy.wildBurstMin, burstMax);
                    const spawnCount = burstMin + Math.floor(Math.random() * Math.max(1, burstMax - burstMin + 1));

                    for (let i = 0; i < spawnCount; i++) {
                        this._spawnRandomMapChigga(CONFIG.FACTIONS.WILD, 500);
                    }
                }
            }
        });

        this.time.addEvent({
            delay: spawnEconomy.neutralRespawnDelay,
            loop: true,
            callback: () => {
                if (this.isEnding || this.isDead) return;

                const neutralCount = this._countUnitsByFaction(CONFIG.FACTIONS.NEUTRAL);
                const neutralCap = Math.max(8, this.difficultySettings.neutralRespawnCap + spawnEconomy.neutralMapCapBonus);

                if (neutralCount < neutralCap) {
                    const missing = neutralCap - neutralCount;
                    const burstMax = Math.min(spawnEconomy.neutralBurstMax, missing);
                    const burstMin = Math.min(spawnEconomy.neutralBurstMin, burstMax);
                    const spawnCount = burstMin + Math.floor(Math.random() * Math.max(1, burstMax - burstMin + 1));

                    for (let i = 0; i < spawnCount; i++) {
                        this._spawnRandomMapChigga(CONFIG.FACTIONS.NEUTRAL, 500);
                    }
                }
            }
        });

        this.powerup = null;
        this.time.addEvent({
            delay: 30000,
            loop: true,
            callback: () => {
                if (!this.powerup) {
                    const padding = 500;
                    const x = padding + Math.random() * (CONFIG.WORLD_SIZE - padding * 2);
                    const y = padding + Math.random() * (CONFIG.WORLD_SIZE - padding * 2);
                    this.spawnPowerup(x, y);
                }
            }
        });

        this.initWeather(stage);
        this._initRandomWeatherVisuals();
        this._setupBossWarning(width, height, stage);
        this._startSpawnProtection();

        if (this.stageIndex === 5) { // Stage 6 Final Boss Arena
            this.time.delayedCall(500, () => {
                this._startBossCountdown(60000, 'Final stage survival timer');
            });
        }

        this.scale.on('resize', this.handleResize, this);
        this.events.once('shutdown', () => {
            if (this._androidBackHandler) {
                window.removeEventListener('chiggasAndroidBack', this._androidBackHandler);
                this._androidBackHandler = null;
            }
            this._cleanupKeyboardFallback();
            this.scale.off('resize', this.handleResize, this);
        });

        this.handleResize(this.scale);
        this._updateSpawnProtectionUI?.(true);
        this.time.delayedCall(75, () => {
            if (!this._spawnGraceActive || !Number.isFinite(this.spawnGraceUntil) || this.spawnGraceUntil <= this._getSpawnProtectionClockNow()) {
                this._startSpawnProtection();
            }
            this._updateSpawnProtectionUI?.(true);
        });

        this._applyDebugOptions();

        this._musicStarted = false;
        const tryStartMusic = () => {
            if (this._musicStarted) return;

            initAudio().then(() => {
                this._musicStarted = true;
                startAmbientMusic(Math.min(1, 0.4 + this.stageIndex * 0.15), this.stageIndex);
            }).catch(() => {
                this._musicStarted = false;
            });
        };

        // Try immediately, then retry on every common first-interaction path.
        tryStartMusic();
        this.input.once('pointerdown', tryStartMusic);
        this.input.keyboard.once('keydown', tryStartMusic);
        if (this.input.gamepad) this.input.gamepad.once('down', tryStartMusic);

        const cleanup = () => {
            stopAmbientMusic();
            stopWeatherAmbience();
            if (this._larvae) {
                this._larvae.forEach(l => { if (l && l.active) l.destroy(); });
                this._larvae = [];
            }
            if (this.input.gamepad) this.input.gamepad.off('down', this._handleGamepadDown, this);
        };
        this.events.once('shutdown', cleanup);
        this.events.once('destroy', cleanup);

        this._handleGamepadDown = (pad, button, value) => {
            const buttonIndex = button?.index ?? value;
            if (isGamepadActionButton('gameplay', 'recruit', buttonIndex)) this.handleRecruit();
            if (isGamepadActionButton('gameplay', 'eat', buttonIndex)) this.handleEat();
            if (isGamepadActionButton('gameplay', 'charge', buttonIndex)) this.handleCharge();
            if (isGamepadActionButton('gameplay', 'shoot', buttonIndex)) this.handleShoot();
        };
        if (this.input.gamepad) {
            this.input.gamepad.on('down', this._handleGamepadDown, this);
        }
    }

    _loadSettings() {
        try {
            const raw = window.localStorage.getItem('chiggas_settings_v1');
            const parsed = raw ? JSON.parse(raw) : {};
            return {
                controlMode: parsed.controlMode || this.controlMode || 'touch',
                masterVolume: this._clamp01(parsed.masterVolume ?? 1),
                musicVolume: this._clamp01(parsed.musicVolume ?? 1),
                sfxVolume: this._clamp01(parsed.sfxVolume ?? 1)
            };
        } catch (e) {
            return { controlMode: this.controlMode || 'touch', masterVolume: 1, musicVolume: 1, sfxVolume: 1 };
        }
    }

    _saveSettings() {
        try {
            window.localStorage.setItem('chiggas_settings_v1', JSON.stringify(this.settings));
        } catch (e) {}
        refreshAudioVolumes();
    }

    _clamp01(value) {
        return Math.max(0, Math.min(1, Number(value)));
    }

    _formatVolume(value) {
        return `${Math.round(this._clamp01(value) * 100)}%`;
    }

    _getDifficultySettings() {
        if (this.difficulty === 0) {
            return {
                neutralMultiplier: 1.25,
                neutralRespawnCap: 34,
                wildMultiplier: 0.82,
                extraWildCap: 8,
                turfCaptureTime: 4500,
                firstRaidMin: 30000,
                firstRaidMax: 45000,
                raidMin: 35000,
                raidMax: 52000,
                maxRaiders: 2,
                raidMarchSpeedMultiplier: 0.80,
                enemyCommanderBonus: -1
            };
        }

        if (this.difficulty === 2) {
            return {
                neutralMultiplier: 0.55,
                neutralRespawnCap: 16,
                wildMultiplier: 1.65,
                extraWildCap: 22,
                turfCaptureTime: 8500,
                firstRaidMin: 12000,
                firstRaidMax: 22000,
                raidMin: 14000,
                raidMax: 26000,
                maxRaiders: 4,
                raidMarchSpeedMultiplier: 1.25,
                enemyCommanderBonus: 1
            };
        }

        return {
            neutralMultiplier: 0.95,
            neutralRespawnCap: 26,
            wildMultiplier: 1.15,
            extraWildCap: 12,
            turfCaptureTime: 6000,
            firstRaidMin: 20000,
            firstRaidMax: 35000,
            raidMin: 22000,
            raidMax: 47000,
            maxRaiders: 3,
            raidMarchSpeedMultiplier: 1.0,
            enemyCommanderBonus: 0
        };
    }

    _randomRange(min, max) {
        return min + Math.random() * Math.max(0, max - min);
    }

    _wrapPlayerDamageForSpawnProtection() {
        if (!this.player || this.player._spawnProtectionDamageWrapped) return;
        if (typeof this.player.takeDamage !== 'function') return;

        this.player._spawnProtectionDamageWrapped = true;
        const originalTakeDamage = this.player.takeDamage.bind(this.player);
        this.player.takeDamage = (amount = 0, attacker = null) => {
            if (this._isSpawnProtected()) {
                this.showFeedback?.('SAFE', 0x00ffff, this.player.x, this.player.y - 60);
                return;
            }

            return originalTakeDamage(amount, attacker);
        };
    }

    _getSpawnProtectionClockNow() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }

    _startSpawnProtection(durationMs = this.spawnGraceDurationMs || 12000) {
        const now = this._getSpawnProtectionClockNow();
        this.spawnGraceDurationMs = durationMs;
        this.spawnGraceStartedAt = now;
        this.spawnGraceUntil = now + durationMs;
        this._spawnGraceActive = true;

        if (this._spawnGraceEvent) {
            this._spawnGraceEvent.remove(false);
            this._spawnGraceEvent = null;
        }

        if (this.player) {
            this.player._spawnProtected = true;
            this.player._spawnProtectedUntil = this.spawnGraceUntil;
        }

        this._updateSpawnProtectionUI?.();

        this._spawnGraceEvent = this.time.delayedCall(durationMs + 80, () => {
            this._spawnGraceEvent = null;
            this._endSpawnProtection(false);
            this._updateSpawnProtectionUI?.();
        });
    }

    _endSpawnProtection(clearTimer = true) {
        if (clearTimer && this._spawnGraceEvent) {
            this._spawnGraceEvent.remove(false);
        }

        this._spawnGraceEvent = null;
        this._spawnGraceActive = false;
        this.spawnGraceUntil = 0;

        if (this.player) {
            this.player._spawnProtected = false;
            this.player._spawnProtectedUntil = 0;
        }
    }

    _isSpawnProtected() {
        if (!this._spawnGraceActive) return false;
        if (!Number.isFinite(this.spawnGraceUntil) || this.spawnGraceUntil <= 0) {
            this._endSpawnProtection();
            return false;
        }

        if (this._getSpawnProtectionClockNow() >= this.spawnGraceUntil) {
            this._endSpawnProtection();
            return false;
        }

        return true;
    }

    _handleAndroidBack() {
        if (this.isEnding) return;

        // Android Back should behave like the in-game EXIT button.
        // If the pause/options modal is open, close it. Otherwise open the same pause menu.
        if (this._pauseContainer) {
            this._closePauseMenu();
            return;
        }

        this._openPauseMenu();
    }

    _setupExitButton(width, height) {
        if (this._exitBtn) this._exitBtn.destroy(true);

        const btnW = 82;
        const btnH = 34;
        const margin = 10;
        const x = width - margin - btnW / 2;
        const y = margin + btnH / 2;

        const btn = this.add.container(x, y).setScrollFactor(0).setDepth(3600);

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.45);
        shadow.fillRoundedRect(-btnW / 2 + 3, -btnH / 2 + 4, btnW, btnH, 10);

        const bg = this.add.graphics();
        bg.fillStyle(0xcc1111, 1);
        bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);

        const label = this.add.text(0, 0, 'EXIT', {
            fontSize: '18px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        btn.add([shadow, bg, label]);
        btn.setSize(btnW, btnH);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => this._openPauseMenu());
        this._exitBtn = btn;
        this._exitBtnSize = { w: btnW, h: btnH, margin };
    }

    _clearPauseInputZones() {
        if (this._pauseInputZones) {
            this._pauseInputZones.forEach(zone => {
                if (zone && zone.active) zone.destroy();
            });
        }

        this._pauseInputZones = [];
        this._pauseNavButtons = [];
        this._pauseFocusIndex = 0;
    }

    _createPauseButton(container, x, y, text, color, onClick, w = 260, h = 50, fz = 22) {
        const btn = this.add.container(x, y).setScrollFactor(0).setDepth((container.depth || 9500) + 2);
        const bg = this.add.graphics();

        const draw = (fillColor) => {
            bg.clear();
            bg.fillStyle(fillColor, 1);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 4);
            bg.lineStyle(4, 0xffffff, 0.45);
            bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 4);
        };

        draw(color);

        const readableFz = Math.max(fz, 18);
        const label = this.add.text(0, 0, text, {
            fontSize: `${readableFz}px`,
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: Math.max(4, Math.round(readableFz * 0.18)),
            align: 'center',
            wordWrap: { width: w - 16 }
        }).setOrigin(0.5);

        btn.add([bg, label]);
        container.add(btn);

        // Use a standalone input Zone instead of making the Container interactive.
        // Phaser containers inside modal overlays can fail hit testing on some Rosebud builds.
        const zone = this.add.zone(x, y, w, h)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth((container.depth || 9500) + 10)
            .setInteractive({ useHandCursor: true });

        btn._pauseDraw = draw;
        btn._pauseBaseColor = color;
        btn._pauseAction = onClick;

        zone.on('pointerover', () => {
            this._setPauseFocusByButton(btn);
            draw(Phaser.Display.Color.IntegerToColor(color).lighten(18).color);
        });
        zone.on('pointerout', () => {
            btn.setScale(1);
            this._drawPauseButtonFocus(btn);
        });
        zone.on('pointerdown', () => {
            btn.setScale(0.92);
            onClick();
        });
        zone.on('pointerup', () => {
            if (btn && btn.active) btn.setScale(1);
        });

        if (!this._pauseInputZones) this._pauseInputZones = [];
        this._pauseInputZones.push(zone);
        this._registerPauseNavButton(btn);

        return btn;
    }

    _registerPauseNavButton(btn) {
        if (!btn) return btn;

        if (!this._pauseNavButtons) this._pauseNavButtons = [];
        if (!this._pauseNavButtons.includes(btn)) {
            this._pauseNavButtons.push(btn);
        }

        this._drawPauseButtonFocus(btn);
        return btn;
    }

    _drawPauseButtonFocus(btn) {
        if (!btn || !btn._pauseDraw) return;

        const focused = this._pauseNavButtons?.[this._pauseFocusIndex] === btn;
        btn._pauseDraw(btn._pauseBaseColor, focused ? 0xffdd00 : 0xffffff);
        btn.setScale(focused ? 1.04 : 1);
    }

    _focusFirstPauseButton() {
        if (!this._pauseNavButtons || this._pauseNavButtons.length === 0) return;
        this._pauseFocusIndex = 0;
        this._pauseNavButtons.forEach(btn => this._drawPauseButtonFocus(btn));
    }

    _setPauseFocusByButton(btn) {
        const index = this._pauseNavButtons?.indexOf(btn) ?? -1;
        if (index >= 0) {
            this._pauseFocusIndex = index;
            this._pauseNavButtons.forEach(button => this._drawPauseButtonFocus(button));
        }
    }

    _movePauseFocus(step) {
        if (!this._pauseContainer || !this._pauseNavButtons || this._pauseNavButtons.length === 0) return;

        this._pauseFocusIndex = (this._pauseFocusIndex + step + this._pauseNavButtons.length) % this._pauseNavButtons.length;
        this._pauseNavButtons.forEach(btn => this._drawPauseButtonFocus(btn));
    }

    _activatePauseFocus() {
        if (!this._pauseContainer || !this._pauseNavButtons || this._pauseNavButtons.length === 0) return;

        const btn = this._pauseNavButtons[this._pauseFocusIndex];
        btn?._pauseAction?.();
    }

    _pollPauseGamepadStick(time) {
        if (!this._pauseContainer) return;

        const pad = this.input?.gamepad?.getPad?.(0);
        if (!pad || time - (this._lastPauseGamepadMoveAt || 0) < 220) return;

        const axisX = pad.axes?.[0]?.getValue?.() ?? 0;
        const axisY = pad.axes?.[1]?.getValue?.() ?? 0;

        if (Math.abs(axisX) < 0.55 && Math.abs(axisY) < 0.55) return;

        if (Math.abs(axisX) > Math.abs(axisY)) {
            this._movePauseFocus(axisX > 0 ? 1 : -1);
        } else {
            this._movePauseFocus(axisY > 0 ? 1 : -1);
        }

        this._lastPauseGamepadMoveAt = time;
    }

    _openPauseMenu() {
        if (this.isEnding || this.isDead) return;
        if (this._pauseContainer) return;
        this._clearPauseInputZones();

        this._wasPhysicsPausedByMenu = this.physics.world.isPaused;
        this.physics.world.pause();
        if (this.player && this.player.body) this.player.body.setVelocity(0, 0);

        const { width, height } = this.scale;
        const c = this.add.container(0, 0).setScrollFactor(0).setDepth(9500);
        this._pauseContainer = c;

        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72);
        const panelW = Math.min(480, width - 28);
        const panelH = Math.min(380, height - 40);
        const top = height / 2 - panelH / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x151015, 0.97);
        panel.fillRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 22);
        panel.lineStyle(4, 0xffdd00, 0.75);
        panel.strokeRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 22);

        const title = this.add.text(width / 2, top + 52, 'WHAT NOW?', {
            fontSize: '40px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 7
        }).setOrigin(0.5);

        c.add([shade, panel, title]);

        this._createPauseButton(c, width / 2, top + 125, 'KEEP CRAWLIN’', 0x2d7d32, () => this._closePauseMenu());
        this._createPauseButton(c, width / 2, top + 190, 'SET IT UP', 0x5a1a6a, () => this._openGameOptionsMenu());
        this._createPauseButton(c, width / 2, top + 255, 'GIVE IT UP', 0xaa1111, () => this._quitToTitleWithoutSaving());
        this._focusFirstPauseButton();
    }

    _closePauseMenu() {
        this._clearPauseInputZones();
        if (this._pauseContainer) {
            this._pauseContainer.destroy(true);
            this._pauseContainer = null;
        }

        if (!this._wasPhysicsPausedByMenu) {
            this.physics.world.resume();
        }
    }

    _quitToTitleWithoutSaving() {
        stopAmbientMusic();
        this._clearPauseInputZones();
        if (this._pauseContainer) {
            this._pauseContainer.destroy(true);
            this._pauseContainer = null;
        }
        this.isEnding = true;
        this.scene.start('MenuScene');
    }

    _openGameOptionsMenu() {
        this._clearPauseInputZones();
        if (this._pauseContainer) {
            this._pauseContainer.destroy(true);
            this._pauseContainer = null;
        }

        const { width, height } = this.scale;
        const c = this.add.container(0, 0).setScrollFactor(0).setDepth(9600);
        this._pauseContainer = c;

        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.74);
        const panelW = Math.min(520, width - 28);
        const panelH = Math.min(560, height - 34);
        const top = height / 2 - panelH / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x151015, 0.98);
        panel.fillRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 22);
        panel.lineStyle(4, 0x8a44ff, 0.8);
        panel.strokeRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 22);

        const title = this.add.text(width / 2, top + 42, 'SET IT UP', {
            fontSize: '38px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 7
        }).setOrigin(0.5);

        const controlLabel = this.add.text(width / 2, top + 92, 'CONTROL SCHEME', {
            fontSize: '20px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        c.add([shade, panel, title, controlLabel]);

        const modes = [
            { label: 'TOUCH', value: 'touch', x: width / 2 - 130 },
            { label: 'KEYBOARD', value: 'keyboard', x: width / 2 },
            { label: 'GAMEPAD', value: 'gamepad', x: width / 2 + 130 }
        ];

        modes.forEach(mode => {
            const selected = this.controlMode === mode.value;
            this._createPauseButton(c, mode.x, top + 132, mode.label, selected ? 0xffdd00 : 0x333333, () => {
                this.controlMode = mode.value;
                this.settings.controlMode = mode.value;
                this._saveSettings();
                this.handleResize(this.scale);
                this._openGameOptionsMenu();
            }, 118, 40, 16);
        });

        const makeVolumeRow = (label, key, y) => {
            const rowLabel = this.add.text(width / 2 - 88, y, `${label}: ${this._formatVolume(this.settings[key])}`, {
                fontSize: '20px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);
            c.add(rowLabel);

            this._createPauseButton(c, width / 2 + 88, y, '–', 0x333333, () => {
                this.settings[key] = this._clamp01((this.settings[key] ?? 1) - 0.1);
                this._saveSettings();
                this._openGameOptionsMenu();
            }, 42, 36, 24);

            this._createPauseButton(c, width / 2 + 146, y, '+', 0x333333, () => {
                this.settings[key] = this._clamp01((this.settings[key] ?? 1) + 0.1);
                this._saveSettings();
                this._openGameOptionsMenu();
            }, 42, 36, 24);
        };

        makeVolumeRow('MASTER', 'masterVolume', top + 210);
        makeVolumeRow('MUSIC', 'musicVolume', top + 268);
        makeVolumeRow('SFX', 'sfxVolume', top + 326);

        this._createPauseButton(c, width / 2, top + panelH - 114, 'BACK', 0x444444, () => {
            this._clearPauseInputZones();
            if (this._pauseContainer) {
                this._pauseContainer.destroy(true);
                this._pauseContainer = null;
            }
            this._openPauseMenu();
        }, 190, 44, 20);

        this._createPauseButton(c, width / 2, top + panelH - 58, 'KEEP CRAWLIN’', 0x2d7d32, () => this._closePauseMenu(), 220, 44, 20);
        this._focusFirstPauseButton();
    }

    _applyDebugOptions() {
        if (!this.debugMode) return;

        const opts = this.debugOptions || {};
        const label = opts.label || 'Debug Run';

        this._debugDisableScoreSaving = opts.disableScoreSaving !== false;

        if (opts.invincible && this.player && !this.player._debugInvinciblePatched) {
            this.player._debugInvinciblePatched = true;
            const originalTakeDamage = typeof this.player.takeDamage === 'function'
                ? this.player.takeDamage.bind(this.player)
                : null;
            this.player._debugOriginalTakeDamage = originalTakeDamage;
            this.player.takeDamage = (amount = 0, attacker = null) => {
                if (attacker && attacker.active && typeof attacker.takeDamage === 'function') {
                    const counterDmg = Math.max(25, Math.round(amount * 2));
                    attacker.takeDamage(counterDmg, this.player);
                    this.createImpactEffect(attacker.x, attacker.y, 0xffff00, 'punch', counterDmg, false);
                }
                this.showFeedback('INVINCIBLE', 0x00ffff, this.player.x, this.player.y - 80);
            };
        }

        if (opts.giveHighStr && this.player) {
            const desiredStr = 20;
            const currentStr = this.player.getSTR ? this.player.getSTR() : Math.floor(this.player.strength || this.player.str || 1);
            const diff = desiredStr - currentStr;

            if (diff > 0 && typeof this.player.gainStr === 'function') {
                this.player.gainStr(diff);
            } else if (diff > 0) {
                if (typeof this.player.strength === 'number') this.player.strength += diff;
                else if (typeof this.player.str === 'number') this.player.str += diff;
                else this.player.strength = desiredStr;
            }
        }

        const debugGunPowerup = opts.gunPowerup || (opts.giveRifleAmmo ? 'rifle' : (opts.givePistolAmmo ? 'pistol' : 'none'));
        if (debugGunPowerup === 'pistol') {
            this.pistolAmmo = Math.max(this.pistolAmmo || 0, 50);
            this.rifleAmmo = 0;
        } else if (debugGunPowerup === 'rifle') {
            this.rifleAmmo = Math.max(this.rifleAmmo || 0, 90);
            this.pistolAmmo = 0;
        } else {
            this.pistolAmmo = 0;
            this.rifleAmmo = 0;
        }
        this._updateHeldWeaponVisual?.();

        if (opts.giveFullArmy && this.player) {
            const maxArmy = this.player.getMaxArmySize ? this.player.getMaxArmySize() : 10;
            let guard = 0;

            while (this.player.followers.length < maxArmy && guard < 50) {
                guard += 1;
                const angle = (guard / Math.max(1, maxArmy)) * Math.PI * 2;
                const dist = 90 + guard * 4;
                const unit = this.spawnChigga(
                    Phaser.Math.Clamp(this.player.x + Math.cos(angle) * dist, 100, CONFIG.WORLD_SIZE - 100),
                    Phaser.Math.Clamp(this.player.y + Math.sin(angle) * dist, 100, CONFIG.WORLD_SIZE - 100),
                    CONFIG.FACTIONS.NEUTRAL
                );

                if (unit && typeof this.player.addFollower === 'function') {
                    this.player.addFollower(unit);
                }
            }
        }

        if (opts.captureAllTurfs) {
            this.territories.forEach(turf => {
                if (!turf) return;

                if (typeof turf.setFaction === 'function') {
                    turf.setFaction(CONFIG.FACTIONS.PLAYER);
                } else if (typeof turf.changeFaction === 'function') {
                    turf.changeFaction(CONFIG.FACTIONS.PLAYER);
                } else {
                    turf.faction = CONFIG.FACTIONS.PLAYER;
                }

                if (turf.owner !== undefined) turf.owner = CONFIG.FACTIONS.PLAYER;
                if (turf.capturingFaction !== undefined) turf.capturingFaction = null;
                if (turf.captureProgress !== undefined) turf.captureProgress = 0;
            });

            this._maxTurfsEverHeld = this.territories.length;
        }

        this.showFeedback(`DEBUG: ${label}`, 0xff3333, this.player.x, this.player.y - 140);

        if (opts.triggerBossImmediately) {
            this.time.delayedCall(700, () => {
                if (this.isEnding || this.isDead || this.bossPhaseActive || this.bossDefeated) return;
                this._maxTurfsEverHeld = this.territories.length;
                this.triggerBossPhase();
            });
        }
    }

    _applyResponsiveCameraZoom(width, height) {
        if (!this.cameras || !this.cameras.main) return;

        const isPortrait = height > width;
        const smallScreen = width < 900 || height < 650;

        let targetZoom = 1;

        if (smallScreen && this.controlMode === 'touch') {
            // Portrait needs more map visibility. This is the best compromise before forcing landscape-only gameplay.
            targetZoom = isPortrait ? 0.72 : 0.88;
        } else if (smallScreen) {
            targetZoom = isPortrait ? 0.78 : 0.92;
        }

        this.cameras.main.setZoom(targetZoom);
    }


    _setupAvatarHUD() {
        const panelX = 8;
        const panelY = 8;
        const panelW = 176;
        const panelH = 122;

        this._avatarHud = this.add.container(panelX, panelY).setScrollFactor(0).setDepth(2600);

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.42);
        shadow.fillRoundedRect(5, 5, panelW, panelH, 18);

        const bg = this.add.graphics();
        bg.fillStyle(0xfff200, 0.96);
        bg.fillRoundedRect(0, 0, panelW, panelH, 18);
        bg.lineStyle(5, 0xff0000, 1);
        bg.strokeRoundedRect(0, 0, panelW, panelH, 18);

        const namePlate = this.add.graphics();
        namePlate.fillStyle(0x050505, 0.94);
        namePlate.fillRoundedRect(10, 5, panelW - 20, 24, 12);
        namePlate.lineStyle(2, 0xff0000, 0.95);
        namePlate.strokeRoundedRect(10, 5, panelW - 20, 24, 12);

        const title = this.add.text(panelW / 2, 17, 'MY CHIGGA', {
            fontSize: '15px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        const portraitFrame = this.add.graphics();
        portraitFrame.fillStyle(0x070707, 0.92);
        portraitFrame.fillRoundedRect(14, 32, 88, 78, 16);
        portraitFrame.lineStyle(4, 0xff0000, 1);
        portraitFrame.strokeRoundedRect(14, 32, 88, 78, 16);

        let playerSkin = null;
        let soldierSkin = null;
        try { playerSkin = getEquippedPlayerSkin?.(); } catch (e) {}
        try { soldierSkin = getEquippedSoldierSkin?.(); } catch (e) {}

        const avatarKey = playerSkin?.assetKey || 'player';
        this._avatarHudImage = this.add.image(58, 72, avatarKey);
        this._fitHudImage(this._avatarHudImage, 76, 76);

        const soldierFrame = this.add.graphics();
        soldierFrame.fillStyle(0x070707, 0.92);
        soldierFrame.fillRoundedRect(118, 62, 43, 38, 10);
        soldierFrame.lineStyle(3, 0xff0000, 1);
        soldierFrame.strokeRoundedRect(118, 62, 43, 38, 10);

        this._soldierHudImage = null;
        if (soldierSkin?.assetKey) {
            this._soldierHudImage = this.add.image(139.5, 81, soldierSkin.assetKey);
            this._fitHudImage(this._soldierHudImage, 34, 34);
        }

        const miniLabel = this.add.text(139.5, 107, 'SOLDIER', {
            fontSize: '8px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center'
        }).setOrigin(0.5);

        this._avatarHud.add([shadow, bg, namePlate, title, portraitFrame, this._avatarHudImage, soldierFrame, miniLabel]);
        if (this._soldierHudImage) this._avatarHud.add(this._soldierHudImage);

        this._avatarHudBounds = { x: panelX, y: panelY, w: panelW, h: panelH };
        this._layoutAvatarHUD(this.scale.width, this.scale.height);
    }

    _fitHudImage(image, maxW, maxH) {
        if (!image) return;
        const scale = Math.min(maxW / Math.max(1, image.width || maxW), maxH / Math.max(1, image.height || maxH));
        image.setScale(scale);
    }

    _layoutAvatarHUD(width = this.scale.width, height = this.scale.height) {
        const small = width < 900 || height < 650;
        const scale = small ? 0.78 : 1;

        if (this._avatarHud) {
            this._avatarHud.setPosition(small ? 8 : 8, small ? 6 : 8);
            this._avatarHud.setScale(scale);
        }

        const textX = small ? 150 : 198;
        const topY = small ? 12 : 18;

        if (this.armyText) this.armyText.setPosition(textX, topY);
        if (this.armyXpText) this.armyXpText.setPosition(textX + (small ? 118 : 150), topY + (small ? 18 : 21));
        if (this.strText) this.strText.setPosition(textX, topY + (small ? 44 : 48));
        if (this.territoryText) this.territoryText.setPosition(textX, topY + (small ? 70 : 78));
    }

    _initRandomWeatherVisuals() {
        if (this._weatherVisualsInitialized) return;
        this._weatherVisualsInitialized = true;

        if (this.currentWeather === 'rain' || this.currentWeather === 'sweat') {
            this._startRainVisuals();
            return;
        }

        if (this.currentWeather === 'snow' || this.currentWeather === 'shiver') {
            this._startSnowVisuals();
            return;
        }

        const roll = Math.random();
        if (roll < 0.18) this._startRainVisuals();
        else if (roll < 0.30) this._startSnowVisuals();
    }

    _startRainVisuals() {
        const count = 70;
        this._weatherVisuals = [];

        for (let i = 0; i < count; i++) {
            const drop = this.add.line(
                Math.random() * this.scale.width,
                Math.random() * this.scale.height,
                0,
                0,
                -10,
                26,
                0x7fd6ff,
                0.42
            ).setScrollFactor(0).setDepth(5200);

            drop._weatherSpeed = 700 + Math.random() * 420;
            drop._weatherDrift = -110 + Math.random() * 50;
            this._weatherVisuals.push(drop);
        }
    }

    _startSnowVisuals() {
        const count = 52;
        this._weatherVisuals = [];

        for (let i = 0; i < count; i++) {
            const flake = this.add.circle(
                Math.random() * this.scale.width,
                Math.random() * this.scale.height,
                1.6 + Math.random() * 2.5,
                0xffffff,
                0.58
            ).setScrollFactor(0).setDepth(5200);

            flake._weatherSpeed = 35 + Math.random() * 75;
            flake._weatherDrift = -22 + Math.random() * 44;
            flake._weatherPhase = Math.random() * Math.PI * 2;
            this._weatherVisuals.push(flake);
        }
    }

    _updateWeatherVisuals(delta) {
        if (!this._weatherVisuals || this._weatherVisuals.length === 0) return;

        const w = this.scale.width;
        const h = this.scale.height;
        const dt = Math.max(0.001, delta / 1000);

        this._weatherVisuals.forEach(fx => {
            if (!fx || !fx.active) return;

            if (fx.type === 'Line') {
                fx.x += (fx._weatherDrift || -90) * dt;
                fx.y += (fx._weatherSpeed || 900) * dt;
            } else {
                fx.x += (fx._weatherDrift || 0) * dt + Math.sin((this.time.now * 0.002) + (fx._weatherPhase || 0)) * 0.5;
                fx.y += (fx._weatherSpeed || 60) * dt;
            }

            if (fx.y > h + 30 || fx.x < -40 || fx.x > w + 40) {
                fx.x = Math.random() * w;
                fx.y = -20 - Math.random() * 60;
            }
        });
    }

    _getInputHelpText() {
        if (this.controlMode === 'gamepad') {
            const prompts = [
                getSteamInputPromptLabel('move', 'Move', { actionSet: 'gameplay' }),
                getSteamInputPromptLabel('recruit', 'Recruit', { actionSet: 'gameplay' }),
                getSteamInputPromptLabel('eat', 'Eat', { actionSet: 'gameplay' }),
                getSteamInputPromptLabel('charge', 'Charge', { actionSet: 'gameplay' }),
                getSteamInputPromptLabel('shoot', 'Shoot', { actionSet: 'gameplay' })
            ];
            return prompts.join(' | ');
        }

        if (this.controlMode === 'keyboard') {
            const keyLabel = (action, fallback) => keyboardCodeToLabel(getPrimaryKeyboardCode('gameplay', action) || fallback);
            return `WASD: Move | ${keyLabel('recruit', 'Space')}: Recruit | ${keyLabel('eat', 'ShiftLeft')}: Eat | ${keyLabel('charge', 'KeyC')}: Charge | ${keyLabel('shoot', 'KeyF')}: Shoot`;
        }

        return '';
    }

    _refreshInputHelpText() {
        if (!this.inputHelpText) return;

        const helpText = this._getInputHelpText();
        this.inputHelpText.setText(helpText);
        this.inputHelpText.setVisible(Boolean(helpText) && (this.controlMode === 'keyboard' || this.controlMode === 'gamepad'));
    }


    _getBrowserGamepadFallback() {
        try {
            return getPrimaryBrowserGamepad() || null;
        } catch (_error) {
            return null;
        }
    }

    _readBrowserGamepadAxes(pad) {
        const axes = Array.from(pad?.axes || []);
        return {
            x: Number(axes[0] || 0),
            y: Number(axes[1] || 0),
            rx: Number(axes[2] || 0),
            ry: Number(axes[3] || 0)
        };
    }

    _browserGamepadActionDown(actionName, pad = null) {
        const activePad = pad || this._getBrowserGamepadFallback();
        if (!activePad) return false;

        if (isGamepadActionPressed(activePad, 'gameplay', actionName)) return true;

        // Steam/Desktop fallback: some controllers report through the browser Gamepad API
        // before Steam Input action origins are available. Keep common Xbox-style defaults
        // active so the player can still test real gameplay input.
        const fallbackButtons = {
            recruit: [0],
            eat: [1],
            charge: [2],
            shoot: [7, 3],
            pause: [9, 8],
            back: [1]
        };

        return (fallbackButtons[actionName] || []).some(index => !!activePad.buttons?.[index]?.pressed || Number(activePad.buttons?.[index]?.value || 0) > 0.35);
    }

    _pollBrowserGamepadActionEdges(actionNames = [], pad = null) {
        this._browserGamepadPreviousButtons = this._browserGamepadPreviousButtons || {};
        const result = {};
        const activePad = pad || this._getBrowserGamepadFallback();

        actionNames.forEach(actionName => {
            const down = activePad ? this._browserGamepadActionDown(actionName, activePad) : false;
            const wasDown = !!this._browserGamepadPreviousButtons[actionName];
            result[actionName] = down && !wasDown;
            this._browserGamepadPreviousButtons[actionName] = down;
        });

        return result;
    }

    _getNativeSteamInputState(actionSet = 'gameplay') {
        try {
            const bridge = typeof window !== 'undefined' ? window.ChiggasSteamInput : null;
            if (!bridge || typeof bridge.getLastActionState !== 'function') return null;

            if (typeof bridge.setActionSet === 'function') {
                bridge.setActionSet(actionSet);
            }

            const state = bridge.getLastActionState();
            if (!state || !state.ok || !state.connected) return null;
            return state;
        } catch (_error) {
            return null;
        }
    }

    _readNativeSteamAxes(state, axisName = 'move') {
        const axis = state?.axes?.[axisName] || null;
        return {
            x: Number(axis?.x || 0),
            y: Number(axis?.y || 0)
        };
    }

    _nativeSteamActionDown(actionName, state = null) {
        const activeState = state || this._getNativeSteamInputState('gameplay');
        return !!activeState?.buttons?.[actionName];
    }

    _pollNativeSteamActionEdges(actionNames = [], actionSet = 'gameplay') {
        this._nativeSteamPreviousButtons = this._nativeSteamPreviousButtons || {};
        const state = this._getNativeSteamInputState(actionSet);
        const result = {};

        actionNames.forEach(actionName => {
            const down = !!state?.buttons?.[actionName];
            const wasDown = !!this._nativeSteamPreviousButtons[`${actionSet}.${actionName}`];
            result[actionName] = down && !wasDown;
            this._nativeSteamPreviousButtons[`${actionSet}.${actionName}`] = down;
        });

        return { edges: result, state };
    }

    _pollNativeSteamPauseInput(time) {
        if (this.controlMode !== 'gamepad') return;

        const { edges, state } = this._pollNativeSteamActionEdges(['pause', 'back', 'confirm', 'recruit'], 'gameplay');
        if (!state) return;

        if (edges.pause) {
            this._togglePauseMenu();
            return;
        }

        if (!this._pauseContainer) return;

        if (edges.confirm || edges.recruit) {
            this._activatePauseFocus();
            return;
        }

        if (edges.back) {
            this._closePauseMenu();
            return;
        }

        if (time - (this._lastNativePauseGamepadMoveAt || 0) < 220) return;
        const axes = this._readNativeSteamAxes(state, 'move');
        if (Math.abs(axes.x) < 0.55 && Math.abs(axes.y) < 0.55) return;

        if (Math.abs(axes.x) > Math.abs(axes.y)) {
            this._movePauseFocus(axes.x > 0 ? 1 : -1);
        } else {
            this._movePauseFocus(axes.y > 0 ? 1 : -1);
        }

        this._lastNativePauseGamepadMoveAt = time;
    }

    _pollBrowserGamepadPauseInput(time) {
        if (this.controlMode !== 'gamepad') return;
        const pad = this._getBrowserGamepadFallback();
        if (!pad) return;

        const pauseEdge = this._pollBrowserGamepadActionEdges(['pause'], pad);
        if (pauseEdge.pause) {
            this._togglePauseMenu();
            return;
        }

        if (!this._pauseContainer) return;

        const menuEdges = this._pollBrowserGamepadActionEdges(['back', 'recruit'], pad);
        if (menuEdges.recruit) {
            this._activatePauseFocus();
            return;
        }

        if (menuEdges.back) {
            this._closePauseMenu();
            return;
        }

        if (time - (this._lastBrowserPauseGamepadMoveAt || 0) < 220) return;
        const axes = this._readBrowserGamepadAxes(pad);
        const buttonUp = !!pad.buttons?.[12]?.pressed;
        const buttonDown = !!pad.buttons?.[13]?.pressed;
        const buttonLeft = !!pad.buttons?.[14]?.pressed;
        const buttonRight = !!pad.buttons?.[15]?.pressed;

        if (axes.y < -0.45 || axes.x < -0.45 || buttonUp || buttonLeft) {
            this._movePauseFocus(-1);
            this._lastBrowserPauseGamepadMoveAt = time;
        } else if (axes.y > 0.45 || axes.x > 0.45 || buttonDown || buttonRight) {
            this._movePauseFocus(1);
            this._lastBrowserPauseGamepadMoveAt = time;
        }
    }

    handleResize(gameSize) {
        const { width, height } = gameSize;
        const safe = getSafeBounds(this, 10);

        this._setupMinimap(width, height, true);
        this._applyResponsiveCameraZoom(width, height);

        const smallScreen = width < 900 || height < 600;
        const actionRadius = smallScreen ? 34 : 27;
        const actionFont = smallScreen ? '11px' : '11px';

        const minimapCenterX = this._mmOriginX + this._mmW / 2;
        const minimapTopY = this._mmOriginY;
        const gap = smallScreen ? 48 : 58;

        const resizeActionBtn = (btn, x, y) => {
            if (!btn) return;

            if (btn.button) {
                btn.button.setPosition(x, y);
                btn.button.setDepth(3004);
                if (btn.button.setRadius) btn.button.setRadius(actionRadius);
                if (btn.button.input?.hitArea?.radius !== undefined) {
                    btn.button.input.hitArea.radius = actionRadius;
                }
            }

            if (btn.text) {
                btn.text.setPosition(x, y);
                btn.text.setFontSize(actionFont);
                btn.text.setDepth(3006);
            }

            this._styleMobileActionButton(btn, actionRadius);
        };

        const touchLandscape = this.controlMode === 'touch' && width > height;
        if (touchLandscape) {
            // Landscape phone layouts do not have enough vertical room to stack four action
            // buttons above the minimap. Put them in a bottom action row between the
            // joystick and minimap so CHARGE never sits under the score/stage timer.
            const joystickRight = this.joystick?.base
                ? this.joystick.base.x + (this.joystick.baseRadius || 60) + 20
                : safe.left + safe.width * 0.26;
            const minimapLeft = Number.isFinite(this._mmOriginX) ? this._mmOriginX : safe.right - 140;
            const usableLeft = Math.max(safe.left + actionRadius + 10, joystickRight);
            const usableRight = Math.min(safe.right - actionRadius - 10, minimapLeft - 24);
            const rowButtons = [this.recruitBtn, this.eatBtn, this.chargeBtn, this.shootBtn];
            const minStep = actionRadius * 2 + 14;
            const rowY = safe.bottom - actionRadius - Math.max(28, safe.height * 0.07);
            const available = usableRight - usableLeft;

            if (available >= minStep * (rowButtons.length - 1)) {
                const rowWidth = Math.min(available, Math.max(minStep * (rowButtons.length - 1), Math.min(340, safe.width * 0.42)));
                const preferredCenter = safe.centerX + safe.width * 0.12;
                const rowCenter = Phaser.Math.Clamp(preferredCenter, usableLeft + rowWidth / 2, usableRight - rowWidth / 2);
                const startX = rowCenter - rowWidth / 2;
                const step = rowWidth / Math.max(1, rowButtons.length - 1);

                rowButtons.forEach((btn, index) => resizeActionBtn(btn, startX + step * index, rowY));
            } else {
                // Very narrow fallback: keep a compact 2x2 cluster low on the right side.
                const clusterX = Math.max(safe.centerX, Math.min(safe.right - 120, minimapLeft - 96));
                const topY = safe.bottom - actionRadius * 2 - gap - 12;
                resizeActionBtn(this.recruitBtn, clusterX - gap / 2, topY);
                resizeActionBtn(this.eatBtn,     clusterX + gap / 2, topY);
                resizeActionBtn(this.chargeBtn,  clusterX - gap / 2, topY + gap);
                resizeActionBtn(this.shootBtn,   clusterX + gap / 2, topY + gap);
            }
        } else {
            const btnX = minimapCenterX;
            const btnY4 = minimapTopY - actionRadius - 10;
            const btnY3 = btnY4 - gap;
            const btnY2 = btnY3 - gap;
            const btnY1 = Math.max(safe.top + 112, btnY2 - gap);

            resizeActionBtn(this.chargeBtn, btnX, btnY1);
            resizeActionBtn(this.shootBtn, btnX, btnY2);
            resizeActionBtn(this.recruitBtn, btnX, btnY3);
            resizeActionBtn(this.eatBtn, btnX, btnY4);
        }

        this._layoutJoystick(width, height);

        if (this.inputHelpText) {
            this.inputHelpText.setPosition(safe.centerX, safe.top + 38);
            this._refreshInputHelpText();
        }

        if (this.scoreText) this.scoreText.setPosition(safe.right - 10, safe.top + 44);
        if (this.timeText) this.timeText.setPosition(safe.right - 10, safe.top + 74);

        if (this._bossWarningBg) {
            this._bossWarningBg.clear();
            this._bossWarningBg.fillStyle(0x000000, 0.6);
            const bannerWidth = Math.min(400, safe.width - 20);
            this._bossWarningBg.fillRoundedRect(safe.centerX - bannerWidth / 2, safe.bottom - 54, bannerWidth, 36, 10);
        }

        if (this._bossWarningText) this._bossWarningText.setPosition(safe.centerX, safe.bottom - 36);
        if (this.bossAlertText) this.bossAlertText.setPosition(safe.centerX, safe.centerY - 60);
        if (this.bossSubText) this.bossSubText.setPosition(safe.centerX, safe.centerY + 10);
        if (this.stageBadge) this.stageBadge.setPosition(safe.centerX, safe.top + 10);
        this._positionSpawnProtectionUI?.();
        if (this._exitBtn) {
            const size = this._exitBtnSize || { w: 82, h: 34, margin: 10 };
            this._exitBtn.setPosition(safe.right - size.margin - size.w / 2, safe.top + size.margin + size.h / 2);
        }

        this._applyMobileHUDCleanup(width, height);
    }

    _isMobileHUDLayout(width = this.scale.width, height = this.scale.height) {
        return width < 900 || height < 650;
    }

    _applyMobileHUDCleanup(width = this.scale.width, height = this.scale.height) {
        const hideCenterHud = this._isMobileHUDLayout(width, height);

        // On mobile, remove non-essential center HUD text to preserve gameplay space.
        // Left stats, score/time, minimap, touch controls, and exit remain visible.
        if (this.stageBadge) {
            this.stageBadge.setVisible(!hideCenterHud);
        }

        if (this._bossWarningText) {
            this._bossWarningText.setVisible(!hideCenterHud);
        }

        if (this._bossWarningBg) {
            this._bossWarningBg.setVisible(!hideCenterHud);
        }
    }

    _attachCustomActionButtonArt(btn, textureKey) {
        if (!btn || !btn.button || !textureKey || !this.textures.exists(textureKey)) return;

        btn.customArtKey = textureKey;

        if (!btn.customArt || !btn.customArt.active) {
            btn.customArt = this.add.image(btn.button.x, btn.button.y, textureKey)
                .setScrollFactor(0)
                .setDepth(3008);
        }

        if (!btn._customArtInputBound) {
            const press = () => {
                if (btn.customArt) btn.customArt.setScale(0.96);
            };
            const release = () => {
                if (btn.customArt) btn.customArt.setScale(1);
            };

            btn.button.on('pointerdown', press);
            btn.button.on('pointerup', release);
            btn.button.on('pointerout', release);
            btn._customArtInputBound = true;
        }
    }

    _styleMobileActionButton(btn, radiusOverride = null) {
        if (!btn || !btn.button) return;

        const radius = radiusOverride || btn.button.radius || btn.button.geom?.radius || 27;
        const baseColor = btn.color || btn.button.fillColor || 0x4444ff;
        const compactMobile = this.controlMode === 'touch' && this._isMobileHUDLayout();

        if (btn.customArt) {
            btn.customArt.setVisible(false);
            btn.customArt.setScale(1);
        }

        btn.button.setAlpha(0.94);
        btn.button.setFillStyle(baseColor, 0.94);
        btn.button.setStrokeStyle(compactMobile ? 4 : 3, 0xffffff, 0.98);
        btn.button.setDepth(3005);

        if (!btn.shadow || !btn.shadow.active) {
            btn.shadow = this.add.circle(btn.button.x + 4, btn.button.y + 5, radius, 0x000000, 0.45)
                .setScrollFactor(0)
                .setDepth(3003);
        }

        btn.shadow.setPosition(btn.button.x + 4, btn.button.y + 5);
        if (btn.shadow.setRadius) btn.shadow.setRadius(radius + (compactMobile ? 1 : 0));
        btn.shadow.setVisible(btn.button.visible && btn.button.alpha > 0.01);
        btn.shadow.setAlpha(btn.button.visible ? 0.34 : 0);

        if (btn.text) {
            const compactLabel = String(btn.text?.text || btn.label || '').replace(/[^A-Za-z]/g, '');
            const isLongLabel = compactLabel.length >= 6;
            const fontSize = compactMobile
                ? (isLongLabel ? Math.max(15, Math.round(radius * 0.53)) : Math.max(17, Math.round(radius * 0.68)))
                : Math.max(11, Math.round(radius * 0.44));

            btn.text.setStyle({
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ffffff',
                align: 'center'
            });
            btn.text.setPadding(0, 0, 0, 0);
            btn.text.setStroke('#000000', compactMobile ? 1 : 4);
            btn.text.setShadow(0, 0, '#000000', 0, false, false);
            btn.text.setDepth(3007);
            btn.text.setFontSize(fontSize);
            btn.text.setPosition(btn.button.x, btn.button.y);
            btn.text.setOrigin(0.5, 0.5);
            btn.text.setResolution?.(2);
            btn.text.setVisible(btn.button.visible && btn.button.alpha > 0.01);
        }
    }

    _syncMobileActionButtonEffects() {
        if (!this._mobileActionButtons) return;

        this._mobileActionButtons.forEach(btn => {
            if (!btn || !btn.button) return;
            const radius = btn.button.radius || btn.button.geom?.radius || 27;
            this._styleMobileActionButton(btn, radius);
            if (btn.shadow) {
                btn.shadow.setPosition(btn.button.x + 4, btn.button.y + 5);
                btn.shadow.setVisible(btn.button.visible && btn.button.alpha > 0.01);
            }
        });
    }

    _flipPlayerVisual(faceLeft) {
        if (!this.player) return;

        if (typeof this.player.setFlipX === 'function') {
            this.player.setFlipX(faceLeft);
            return;
        }

        const possibleVisuals = [
            this.player.sprite,
            this.player.bodySprite,
            this.player.visual,
            this.player.image,
            this.player.avatar,
            this.player.character,
            this.player.mainSprite
        ];

        const visual = possibleVisuals.find(v => v && typeof v.setFlipX === 'function');
        if (visual) {
            visual.setFlipX(faceLeft);
            return;
        }

        const absScaleX = Math.abs(this.player.scaleX || 1);
        this.player.scaleX = faceLeft ? -absScaleX : absScaleX;
        if (this.player.scaleY !== undefined) this.player.scaleY = Math.abs(this.player.scaleY || 1);
    }

    _layoutJoystick(width, height) {
        if (!this.joystick || !this.joystick.base || !this.joystick.knob) return;

        const safe = getSafeBounds(this, 10);
        const showJoystick = this.controlMode === 'touch';
        const baseRadius = Math.max(48, Math.min(72, Math.min(width, height) * 0.12));
        const knobRadius = Math.max(22, baseRadius * 0.45);
        const x = Math.max(safe.left + baseRadius + 8, safe.left + safe.width * 0.13);
        const y = safe.bottom - baseRadius - Math.max(10, safe.height * 0.035);

        this.joystick.base.setVisible(showJoystick);
        this.joystick.knob.setVisible(showJoystick);

        this.joystick.base.setPosition(x, y);
        this.joystick.knob.setPosition(x, y);

        if (this.joystick.base.setRadius) this.joystick.base.setRadius(baseRadius);
        if (this.joystick.knob.setRadius) this.joystick.knob.setRadius(knobRadius);

        this.joystick.baseRadius = baseRadius;
        this.joystick.knobRadius = knobRadius;
        this.joystick.maxDistance = baseRadius * 0.82;

        if (!showJoystick) {
            this.joystick.vector = { x: 0, y: 0 };
            this.joystick.activePointer = null;
        }
    }

    _setupMinimap(width, height, isResize = false) {
        const isPortrait = height > width;

        const MM_W = Math.max(76, Math.min(
            isPortrait ? width * 0.24 : width * 0.13,
            isPortrait ? 120 : 130
        ));

        const MM_H = MM_W;
        const SCALE = MM_W / CONFIG.WORLD_SIZE;
        const safe = getSafeBounds(this, 10);

        const originX = safe.right - MM_W - 4;
        const originY = safe.bottom - MM_H - 4;

        if (isResize) {
            if (!this._mmBg) return;

            this._mmBg.clear();

            if (this._mmLabel) {
                this._mmLabel.setPosition(originX + MM_W / 2, originY - 4);
            }

            if (this._mmLegend1) this._mmLegend1.setVisible(false);
            if (this._mmLegend2) this._mmLegend2.setVisible(false);
        } else {
            this._mmBg = this.add.graphics().setScrollFactor(0).setDepth(3000);
            this._mmGfx = this.add.graphics().setScrollFactor(0).setDepth(3001);

            this._mmLabel = this.add.text(originX + MM_W / 2, originY - 4, 'MAP', {
                fontSize: '12px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#aaaaaa',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(3002);

            this._mmLegend1 = null;
            this._mmLegend2 = null;
        }

        const mmBg = this._mmBg;
        mmBg.fillStyle(0x000000, 0.65);
        mmBg.fillRoundedRect(originX - 6, originY - 6, MM_W + 12, MM_H + 12, 8);
        mmBg.lineStyle(2, 0xffffff, 0.3);
        mmBg.strokeRoundedRect(originX - 6, originY - 6, MM_W + 12, MM_H + 12, 8);

        this._mmOriginX = originX;
        this._mmOriginY = originY;
        this._mmScale = SCALE;
        this._mmW = MM_W;
        this._mmH = MM_H;
    }

    _setupBossWarning(width, height, stage) {
        const bossName = stage.bossName ?? 'BOSS';
        const turfs = stage.turfs;
        const safe = getSafeBounds(this, 10);

        const bannerY = safe.bottom - 36;
        const bannerBg = this.add.graphics().setScrollFactor(0).setDepth(2500);
        bannerBg.fillStyle(0x000000, 0.6);
        const bannerWidth = Math.min(520, safe.width - 20);
        bannerBg.fillRoundedRect(safe.centerX - bannerWidth / 2, bannerY - 18, bannerWidth, 36, 10);

        this._bossWarningText = this.add.text(safe.centerX, bannerY, ' ', {
            fontSize: '20px', fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif', color: '#ff4400',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2501);

        this._bossWarningBg = bannerBg;
        this._bossWarningName = bossName;
        this._bossWarningTurfs = turfs;

        this.tweens.add({
            targets: this._bossWarningText,
            alpha: 0.5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
    }

    _getFactionMapColor(faction) {
        return faction === CONFIG.FACTIONS.PLAYER ? 0xff3333 :
               faction === CONFIG.FACTIONS.BLUE ? 0x4488ff :
               faction === CONFIG.FACTIONS.GREEN ? 0x44ff44 :
               faction === CONFIG.FACTIONS.PURPLE ? 0xcc44ff :
               faction === CONFIG.FACTIONS.ORANGE ? 0xff9900 : 0x888888;
    }

    _updateMinimap() {
        const gfx = this._mmGfx;
        if (!gfx) return;
        gfx.clear();

        const ox = this._mmOriginX;
        const oy = this._mmOriginY;
        const s  = this._mmScale;

        gfx.fillStyle(0x3a1f0a, 0.9);
        gfx.fillRect(ox, oy, this._mmW, this._mmH);

        this.territories.forEach(t => {
            const mx = ox + t.x * s;
            const my = oy + t.y * s;
            const col = this._getFactionMapColor(t.faction);
            gfx.fillStyle(col, 0.9);
            gfx.fillCircle(mx, my, 5);
        });

        this.enemies.forEach(e => {
            if (!e.active) return;
            const mx = ox + e.x * s;
            const my = oy + e.y * s;
            const col = this._getFactionMapColor(e.faction);
            gfx.fillStyle(col, 1);
            gfx.fillTriangle(mx, my - 7, mx - 6, my + 5, mx + 6, my + 5);
            gfx.lineStyle(1, 0xffffff, 0.75);
            gfx.strokeCircle(mx, my, 7);
        });

        if (this.boss && this.boss.active && !this.boss.isDead && this.boss.scene) {
            const mx = ox + this.boss.x * s;
            const my = oy + this.boss.y * s;

            // Boss marker: animated rainbow target so it stands apart from red Chigga spawns,
            // claimed turfs, and future enemy colors.
            const pulse = 1 + Math.sin(this.time.now * 0.012) * 0.22;
            const colors = [0xff0044, 0xffaa00, 0xffff00, 0x00ff66, 0x00ccff, 0x8844ff];

            colors.forEach((color, index) => {
                const radius = (8 - index * 0.8) * pulse;
                gfx.lineStyle(2, color, 0.95);
                gfx.strokeCircle(mx, my, radius);
            });

            // Bright center diamond for readability even when the rings overlap other markers.
            gfx.fillStyle(0xffffff, 1);
            gfx.fillTriangle(mx, my - 6, mx - 6, my, mx, my + 6);
            gfx.fillTriangle(mx, my - 6, mx + 6, my, mx, my + 6);

            gfx.lineStyle(2, 0x000000, 0.85);
            gfx.strokeCircle(mx, my, 9 * pulse);
        }

        if (this.powerup && this.powerup.active) {
            const mx = ox + this.powerup.x * s;
            const my = oy + this.powerup.y * s;
            gfx.fillStyle(0xffdd00, 1);
            gfx.fillTriangle(mx, my - 6, mx - 5, my, mx + 5, my);
            gfx.fillTriangle(mx - 5, my, mx + 5, my, mx, my + 6);
            gfx.lineStyle(1, 0x000000, 0.8);
            gfx.strokeCircle(mx, my, 6);
        }

        const px = ox + this.player.x * s;
        const py = oy + this.player.y * s;
        gfx.fillStyle(0xffffff, 1);
        gfx.fillCircle(px, py, 4);
        gfx.lineStyle(1, 0xffffff, 0.5);
        gfx.strokeCircle(px, py, 6);

        this.units.children.entries.forEach(u => {
            if (!u.active) return;
            if (u.faction === CONFIG.FACTIONS.NEUTRAL || (u.faction === CONFIG.FACTIONS.PLAYER && !u.isRecruited)) {
                const mx = ox + u.x * s;
                const my = oy + u.y * s;
                gfx.fillStyle(0xff0000, 1);
                gfx.fillCircle(mx, my, 1.5);
            }
        });

        gfx.lineStyle(1, 0xffffff, 0.25);
        gfx.strokeRect(ox, oy, this._mmW, this._mmH);
    }

    _updateBossWarning(playerTerritories) {
        if (!this._bossWarningText) return;

        if (this._isMobileHUDLayout()) {
            this._bossWarningText.setText('');
            this._bossWarningText.setVisible(false);
            if (this._bossWarningBg) this._bossWarningBg.setVisible(false);
            return;
        }

        if (this.bossDefeated || this.isEnding) {
            this._bossWarningText.setText('');
            this._bossWarningBg.setVisible(false);
            return;
        }

        if (this._bossCountdownStarted && !this.bossPhaseActive) {
            const remainingSeconds = Math.max(0, Math.ceil((this._bossCountdownEndsAt - this.time.now) / 1000));
            this._bossWarningBg.setVisible(true);
            this._bossWarningText.setVisible(true);
            this._bossWarningText.setColor('#ffdd00');
            this._bossWarningText.setText(`⚠ ${this._bossWarningName} arrives in ${remainingSeconds}s — get strong! ⚠`);
            return;
        }

        if (this.bossPhaseActive) {
            this._bossWarningBg.setVisible(true);
            this._bossWarningText.setVisible(true);
            this._bossWarningText.setColor('#ff0000');
            if (this.boss && this.boss.active && !this.boss.isDead) {
                const pct = Math.round((this.boss.health / this.boss.maxHealth) * 100);
                this._bossWarningText.setText(`☠ ${this._bossWarningName} — ${pct}% HP — FIGHT! ☠`);
            } else {
                this._bossWarningText.setText(`☠ ${this._bossWarningName} INCOMING... ☠`);
            }
            return;
        }

        const remaining = this._bossWarningTurfs - playerTerritories;
        if (remaining <= 0) {
            this._bossWarningBg.setVisible(true);
            this._bossWarningText.setVisible(true);
            this._bossWarningText.setColor('#ffdd00');
            this._bossWarningText.setText(`⚠ ${this._bossWarningName} AWAKENS... ⚠`);
        } else {
            this._bossWarningBg.setVisible(true);
            this._bossWarningText.setVisible(true);
            this._bossWarningText.setColor('#ff4400');
            this._bossWarningText.setText(
                `⚠ ${this._bossWarningName} AWAITS — ${remaining} turf${remaining !== 1 ? 's' : ''} left`
            );
        }
    }

    _getSpawnEconomySettings() {
        const stage = this.stageIndex || 0;

        if (this.difficulty === 0) {
            return {
                wildRespawnDelay: Math.max(9500, 14500 - stage * 450),
                neutralRespawnDelay: Math.max(4700, 6200 - stage * 180),
                wildBurstMin: 1,
                wildBurstMax: 1,
                neutralBurstMin: 1,
                neutralBurstMax: 2,
                wildMapCapBonus: 2,
                neutralMapCapBonus: 0
            };
        }

        if (this.difficulty === 2) {
            return {
                wildRespawnDelay: Math.max(5600, 8800 - stage * 500),
                neutralRespawnDelay: Math.max(7200, 9400 - stage * 260),
                wildBurstMin: 2,
                wildBurstMax: 4,
                neutralBurstMin: 1,
                neutralBurstMax: 1,
                wildMapCapBonus: 8,
                neutralMapCapBonus: -4
            };
        }

        return {
            wildRespawnDelay: Math.max(7400, 11000 - stage * 420),
            neutralRespawnDelay: Math.max(5600, 7600 - stage * 220),
            wildBurstMin: 1,
            wildBurstMax: 3,
            neutralBurstMin: 1,
            neutralBurstMax: 2,
            wildMapCapBonus: 4,
            neutralMapCapBonus: -2
        };
    }

    _countUnitsByFaction(faction) {
        if (!this.units || !this.units.children) return 0;
        return this.units.children.entries.filter(u => {
            return u && u.active && !u.isDead && u.faction === faction;
        }).length;
    }

    _spawnRandomMapChigga(faction, padding = 500) {
        const x = padding + Math.random() * (CONFIG.WORLD_SIZE - padding * 2);
        const y = padding + Math.random() * (CONFIG.WORLD_SIZE - padding * 2);
        return this.spawnChigga(x, y, faction);
    }

    spawnEnemies(count) {
        const difficultyBonus = this.difficultySettings?.enemyCommanderBonus ?? 0;
        const guaranteed = Math.max(1, Math.max(count + difficultyBonus, this.stageIndex + 1 + difficultyBonus));
        const W = CONFIG.WORLD_SIZE;
        const fallbackPositions = [
            { x: 500,     y: 500 },
            { x: W - 500, y: W - 500 },
            { x: W - 500, y: 500 },
            { x: 500,     y: W - 500 },
            { x: W / 2,   y: 500 },
            { x: W / 2,   y: W - 500 }
        ];

        const factions = this.stageIndex >= 4
            ? [CONFIG.FACTIONS.BLUE, CONFIG.FACTIONS.GREEN, CONFIG.FACTIONS.PURPLE, CONFIG.FACTIONS.ORANGE, CONFIG.FACTIONS.ORANGE, CONFIG.FACTIONS.PURPLE]
            : this.stageIndex >= 1
                ? [CONFIG.FACTIONS.BLUE, CONFIG.FACTIONS.GREEN, CONFIG.FACTIONS.PURPLE, CONFIG.FACTIONS.BLUE, CONFIG.FACTIONS.GREEN]
                : [CONFIG.FACTIONS.BLUE, CONFIG.FACTIONS.GREEN, CONFIG.FACTIONS.BLUE, CONFIG.FACTIONS.GREEN, CONFIG.FACTIONS.BLUE];

        const usedTurfs = new Set();

        for (let i = 0; i < guaranteed; i++) {
            const fac = factions[i % factions.length];
            this._gangStartingFactions.add(fac);

            let turf = null;
            const available = this.territories.filter(t => t && t.faction === CONFIG.FACTIONS.NEUTRAL && !usedTurfs.has(t));

            if (available.length > 0) {
                turf = available[Math.floor(Math.random() * available.length)];
                usedTurfs.add(turf);
                turf.setFaction(fac);
                turf.captureProgress = 0;
                turf.capturingFaction = null;
            }

            const fallback = fallbackPositions[i % fallbackPositions.length];
            const x = turf ? turf.x : fallback.x;
            const y = turf ? turf.y : fallback.y;

            const commander = new EnemyCommander(this, x, y, fac);
            commander.homeTurfX = x;
            commander.homeTurfY = y;
            commander._isStagedAtHome = true;
            commander._gangReleaseAt = this.time.now + 10000;
            commander.state = 'DEFENDING';
            commander.targetPoint = { x, y };
            commander.stateTimer = 10000;

            this.enemies.push(commander);
        }

        if (this.enemies.length > 0) {
            this.time.delayedCall(600, () => {
                if (!this.isEnding && !this.isDead) {
                    this.showFeedback('ENEMY GANGS HOLD THEIR TURF!', 0xffdd00, this.player.x, this.player.y - 140);
                }
            });
        }
    }

    spawnTerritories(count) {
        const padding = 1000;
        const minSpacing = 500;

        for (let i = 0; i < count; i++) {
            let attempts = 0;
            let x, y;
            let valid = false;
            while (!valid && attempts < 2000) {
                x = padding + Math.random() * (CONFIG.WORLD_SIZE - padding * 2);
                y = padding + Math.random() * (CONFIG.WORLD_SIZE - padding * 2);
                valid = true;
                for (const t of this.territories) {
                    if (Phaser.Math.Distance.Between(x, y, t.x, t.y) < minSpacing) {
                        valid = false;
                        break;
                    }
                }
                attempts++;
            }
            if (!valid || x === undefined || y === undefined) {
                x = padding + Math.random() * (CONFIG.WORLD_SIZE - padding * 2);
                y = padding + Math.random() * (CONFIG.WORLD_SIZE - padding * 2);
            }
            this.territories.push(new Territory(this, x, y));
        }
    }

    spawnChigga(x, y, faction) {
        const chigga = new Chigga(this, x, y, faction);
        this.units.add(chigga);
        return chigga;
    }

    spawnPowerup(x, y) {
        let type = 'speed'; // Default
        const isWeapon = Math.random() > 0.5;
        if (isWeapon) {
            if (this.stageIndex >= 2 && Math.random() < 0.25) { // 25% of weapon spawns is the rare rifle on Stage 3+
                type = 'rifle';
            } else if (this.stageIndex >= 1) { // Pistol starts spawning from Stage 2 (stageIndex >= 1)
                type = 'pistol';
            }
        }

        const key = type === 'rifle' ? 'powerup-rifle' : (type === 'pistol' ? 'powerup-pistol' : 'powerup-speed');

        this.powerup = this.physics.add.sprite(x, y, key);
        this.powerup.setDisplaySize(60, 60);
        this.powerup.setDepth(500);
        this.tweens.add({
            targets: this.powerup,
            y: y - 15,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        this.physics.add.overlap(this.player, this.powerup, () => {
            this.powerup.destroy();
            this.powerup = null;
            if (type === 'rifle') {
                this.rifleAmmo = (this.rifleAmmo || 0) + 30; // Holds 30 bullets!
                this.showFeedback('RIFLE AMMO +30!', 0xff1744, this.player.x, this.player.y);
            } else if (type === 'pistol') {
                this.pistolAmmo += 6;
                this.showFeedback('PISTOL AMMO!', 0xffffff, this.player.x, this.player.y);
            } else {
                this.player.applySpeedBoost();
                this.showFeedback('SPEED UP!', 0x00ffff, this.player.x, this.player.y);
                playSpeedGush(1.05);

// CHIGGAS_STEAM_PASS_53_FIRST_SPEED_BOOST_GAME_SCENE_BEGIN
        try {
            if (!this._chiggasSteamFirstSpeedBoostRequested && typeof window !== 'undefined') {
                this._chiggasSteamFirstSpeedBoostRequested = true;
                const detail = {
                    achievement: 'FIRST_SPEED_BOOST',
                    source: 'GameScene_playSpeedGush_side_effect',
                    scene: 'GameScene',
                    event: 'first_speed_boost_wind_gush',
                    reason: 'playSpeedGush_called',
                    speedMultiplier: this.player && this.player.speedMultiplier,
                    storeShouldShow: 'TEST BUY',
                    pass: 'steam_desktop_wrapper_pass_53',
                    hook: 'playSpeedGush_side_effect_53'
                };
                window.dispatchEvent(new CustomEvent('chiggas-steam-achievement-unlock-request', { detail }));
                window.dispatchEvent(new CustomEvent('chiggas-first-speed-boost', { detail }));
            }
        } catch (_) {}
// CHIGGAS_STEAM_PASS_53_FIRST_SPEED_BOOST_GAME_SCENE_END
            }
            playHit(1);
        });
    }


    _startBossCountdown(delayMs, reason = 'Boss countdown') {
        if (this.bossPhaseActive || this.bossDefeated || this.isEnding || this._bossCountdownStarted) return;

        this._bossCountdownStarted = true;
        this._bossCountdownDelayMs = delayMs;
        this._bossCountdownEndsAt = this.time.now + delayMs;

        const seconds = Math.ceil(delayMs / 1000);
        const stage = CONFIG.STAGES[this.stageIndex] ?? CONFIG.STAGES[0];
        const bossName = stage.bossName ?? 'BOSS';

        console.log(`[BOSS] Countdown started: stage=${this.stageIndex + 1} boss=${bossName} delay=${seconds}s reason=${reason}`);

        if (this.showFeedback && this.player) {
            this.showFeedback(`${bossName} IN ${seconds}s!`, 0xffdd00, this.player.x, this.player.y - 150);
        }

        this.time.delayedCall(delayMs, () => {
            if (this.isEnding || this.isDead || this.bossPhaseActive || this.bossDefeated) return;
            this.triggerBossPhase();
        });
    }

    triggerBossPhase() {
        if (this.bossPhaseActive || this.bossDefeated || this.isEnding) return;
        this.bossPhaseActive = true;

        const stage = CONFIG.STAGES[this.stageIndex] ?? CONFIG.STAGES[0];
        const bossName = stage.bossName ?? 'BOSS';
        console.log(`[BOSS] Triggering boss phase for stage ${this.stageIndex + 1}: ${bossName}`);

        this.bossAlertText.setText(`⚠ ${bossName} INCOMING ⚠`).setVisible(true).setAlpha(1);
        this.bossSubText.setText(stage.bossDesc ?? 'A boss is coming for your turfs!').setVisible(true).setAlpha(1);

        this.cameras.main.shake(400, 0.015);

        if (this.stageIndex === 5) {
            this._showRoachCzarEntranceWarning(stage);
        }

        this.tweens.add({
            targets: [this.bossAlertText, this.bossSubText],
            alpha: 0,
            duration: 300, yoyo: true, repeat: 5,
            onComplete: () => {
                if (this.bossAlertText) this.bossAlertText.setVisible(false);
                if (this.bossSubText) this.bossSubText.setVisible(false);
            }
        });

        this.time.delayedCall(2500, () => {
            if (this.isEnding || this.bossDefeated) {
                console.warn('[BOSS] Spawn skipped: scene ended or boss already defeated');
                this.bossPhaseActive = false;
                return;
            }
            try {
                this._spawnBoss();
            } catch (err) {
                console.error('[BOSS] Spawn failed:', err);
                this.bossPhaseActive = false;
            }
        });
    }

    _spawnBoss() {
        this.units.children.iterate(u => {
            if (u && u._raidTarget) {
                u._raidTarget = null;
                u._raidExpiry = 0;
            }
        });

        const edge = Math.floor(Math.random() * 4);
        let bx, by;
        const margin = 300;
        if (edge === 0) { bx = margin; by = Math.random() * CONFIG.WORLD_SIZE; }
        else if (edge === 1) { bx = CONFIG.WORLD_SIZE - margin; by = Math.random() * CONFIG.WORLD_SIZE; }
        else if (edge === 2) { bx = Math.random() * CONFIG.WORLD_SIZE; by = margin; }
        else { bx = Math.random() * CONFIG.WORLD_SIZE; by = CONFIG.WORLD_SIZE - margin; }

        if (this.stageIndex === 1) {
            console.log('[BOSS] Spawning TickBoss at', bx, by);
            this.boss = new TickBoss(this, bx, by, this.stageIndex);
        } else if (this.stageIndex === 2) {
            console.log('[BOSS] Spawning MiteOverlord at', bx, by);
            this.boss = new MiteOverlord(this, bx, by, this.stageIndex);
        } else if (this.stageIndex === 3) {
            console.log('[BOSS] Spawning LiceBoss at', bx, by);
            this.boss = new LiceBoss(this, bx, by, this.stageIndex);
        } else if (this.stageIndex === 4) {
            console.log('[BOSS] Spawning TickTwins at', bx, by);
            this.boss = new TickTwins(this, bx, by, this.stageIndex);
        } else if (this.stageIndex === 5) {
            console.log('[BOSS] Spawning CockroachBoss at', bx, by);
            this.boss = new CockroachBoss(this, bx, by, this.stageIndex);
            this._showRoachCzarSpawnBurst(bx, by);
        } else {
            console.log('[BOSS] Spawning BossChigga at', bx, by);
            this.boss = new BossChigga(this, bx, by, this.stageIndex);
        }
        this._applyDynamicBossScaling(this.boss);

        this.showFeedback('BOSS SPAWNED!', 0xff0000, this.player.x, this.player.y - 120);
        console.log('[BOSS] Spawn complete. boss=', this.boss, 'active=', this.boss?.active);
    }

    _showRoachCzarEntranceWarning(stage) {
        if (!this.cameras || !this.cameras.main || this.isEnding) return;

        const { width, height } = this.scale;

        const depth = 6100;
        const banner = this.add.container(width / 2, height * 0.28)
            .setScrollFactor(0)
            .setDepth(depth)
            .setAlpha(0);

        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.88);
        bg.fillRoundedRect(-Math.min(430, width - 42) / 2, -54, Math.min(430, width - 42), 108, 18);
        bg.lineStyle(5, 0x39ff14, 0.95);
        bg.strokeRoundedRect(-Math.min(430, width - 42) / 2, -54, Math.min(430, width - 42), 108, 18);

        const title = this.add.text(0, -20, '☣ ROACH CZAR HAS ENTERED THE LAWN ☣', {
            fontSize: width < 700 ? '24px' : '34px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#39ff14',
            stroke: '#000000',
            strokeThickness: 7,
            align: 'center',
            wordWrap: { width: Math.min(390, width - 70) }
        }).setOrigin(0.5);

        const sub = this.add.text(0, 27, stage?.bossDesc || 'The final infestation has arrived.', {
            fontSize: width < 700 ? '14px' : '18px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffeeaa',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: Math.min(390, width - 70) }
        }).setOrigin(0.5);

        banner.add([bg, title, sub]);

        this.cameras.main.flash(450, 57, 255, 20);
        this.cameras.main.shake(650, 0.018);

        this.tweens.add({
            targets: banner,
            alpha: 1,
            y: height * 0.28 - 10,
            duration: 360,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: banner,
                    alpha: 0,
                    y: banner.y - 12,
                    delay: 1500,
                    duration: 500,
                    ease: 'Sine.easeInOut',
                    onComplete: () => {
                        if (banner && banner.active) banner.destroy(true);
                    }
                });
            }
        });
    }

    _showRoachCzarSpawnBurst(x, y) {
        if (!this.cameras || !this.cameras.main || this.isEnding) return;

        this.cameras.main.shake(900, 0.028);
        this.cameras.main.flash(250, 57, 255, 20);

        const ring = this.add.graphics().setDepth(905);
        ring.x = x;
        ring.y = y;
        ring._radius = 10;
        ring._alpha = 1;

        this.tweens.add({
            targets: ring,
            _radius: 430,
            _alpha: 0,
            duration: 900,
            ease: 'Quad.easeOut',
            onUpdate: () => {
                if (!ring || !ring.active) return;
                ring.clear();
                ring.lineStyle(7, 0x39ff14, ring._alpha);
                ring.strokeCircle(0, 0, ring._radius);
                ring.lineStyle(3, 0xffdd00, ring._alpha * 0.7);
                ring.strokeCircle(0, 0, ring._radius * 0.72);
            },
            onComplete: () => {
                if (ring && ring.active) ring.destroy();
            }
        });

        for (let i = 0; i < 26; i++) {
            const angle = (i / 26) * Math.PI * 2;
            const dist = 90 + Math.random() * 240;
            const dot = this.add.circle(x, y, 6 + Math.random() * 9, i % 2 === 0 ? 0x39ff14 : 0x5a3d28, 0.9)
                .setDepth(906);

            this.tweens.add({
                targets: dot,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                alpha: 0,
                scale: 0.15,
                duration: 650 + Math.random() * 500,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    if (dot && dot.active) dot.destroy();
                }
            });
        }

        if (this.showFeedback) {
            this.showFeedback('FINAL BOSS!', 0x39ff14, x, y - 150);
        }
    }

    _applyDynamicBossScaling(boss) {
        if (!boss || !boss.active || !this.player) return;

        const playerStr = this.player.getSTR
            ? this.player.getSTR()
            : Math.max(1, Number(this.player.strength ?? this.player.str ?? 1));

        const armySize = Array.isArray(this.player.followers)
            ? this.player.followers.filter(f => f && f.active && !f.isDead).length
            : 0;

        const stageNum = (this.stageIndex || 0) + 1;
        const difficultyHpMult = this.difficulty === 2 ? 1.35 : (this.difficulty === 0 ? 0.82 : 1.0);
        const difficultyDmgMult = this.difficulty === 2 ? 1.25 : (this.difficulty === 0 ? 0.78 : 1.0);

        const strHpBonus = Math.min(2.4, Math.max(0, playerStr - 1) * 0.045);
        const armyHpBonus = Math.min(1.65, armySize * 0.095);
        const stageHpBonus = Math.max(0, stageNum - 1) * 0.08;

        const hpMultiplier = Phaser.Math.Clamp(
            (1 + strHpBonus + armyHpBonus + stageHpBonus) * difficultyHpMult,
            0.85,
            this.difficulty === 2 ? 5.25 : 4.25
        );

        const strDmgBonus = Math.min(1.1, Math.max(0, playerStr - 1) * 0.018);
        const armyDmgBonus = Math.min(0.6, armySize * 0.035);
        const stageDmgBonus = Math.max(0, stageNum - 1) * 0.045;

        const damageMultiplier = Phaser.Math.Clamp(
            (1 + strDmgBonus + armyDmgBonus + stageDmgBonus) * difficultyDmgMult,
            0.75,
            this.difficulty === 2 ? 2.8 : 2.25
        );

        const scaleHealthObject = (target) => {
            if (!target || !target.active) return;

            if (typeof target.maxHealth === 'number') {
                target.maxHealth = Math.max(1, Math.round(target.maxHealth * hpMultiplier));
            }

            if (typeof target.health === 'number') {
                target.health = Math.max(1, Math.round(target.health * hpMultiplier));
            }

            if (typeof target.attackDamage === 'number') {
                target.attackDamage = Math.max(1, Math.round(target.attackDamage * damageMultiplier));
            }

            if (typeof target.baseDamage === 'number') {
                target.baseDamage = Math.max(1, Math.round(target.baseDamage * damageMultiplier));
            }

            if (typeof target.damage === 'number') {
                target.damage = Math.max(1, Math.round(target.damage * damageMultiplier));
            }

            if (typeof target.contactDamage === 'number') {
                target.contactDamage = Math.max(1, Math.round(target.contactDamage * damageMultiplier));
            }
        };

        scaleHealthObject(boss);

        // TickTwins is a container that can hold separate twin entities depending on the version.
        ['twinA', 'twinB', 'leftTwin', 'rightTwin', 'bossA', 'bossB'].forEach(key => {
            if (boss[key]) scaleHealthObject(boss[key]);
        });

        if (Array.isArray(boss.twins)) {
            boss.twins.forEach(twin => scaleHealthObject(twin));
        }

        console.log('[BOSS] Dynamic scaling applied:', {
            stage: stageNum,
            playerStr: Math.round(playerStr * 100) / 100,
            armySize,
            hpMultiplier: Math.round(hpMultiplier * 100) / 100,
            damageMultiplier: Math.round(damageMultiplier * 100) / 100,
            bossHp: boss.health,
            bossMaxHp: boss.maxHealth
        });
    }

    onBossFled() {
        this.bossPhaseActive = false;
        this.boss = null;
        this.bossAlertText.setText('BOSS FLED!').setVisible(true);
        this.bossSubText.setText('Recapture all turfs to draw him back...').setVisible(true);
        this.tweens.add({
            targets: [this.bossAlertText, this.bossSubText],
            alpha: 0, duration: 400, yoyo: true, repeat: 3,
            onComplete: () => {
                this.bossAlertText.setVisible(false);
                this.bossSubText.setVisible(false);
            }
        });
    }

    onBossDefeated() {
        if (this.bossDefeated || this.isEnding) return;
        this.bossDefeated = true;
        this.runStats.bossesDefeated += 1;
        this.runStats.kills += 1;
        this.bossPhaseActive = false;
        this.boss = null;

        this.showFeedback('BOSS DEFEATED!', 0xffdd00, this.player.x, this.player.y - 140);
        this.cameras.main.shake(500, 0.02);

        this.enemies.forEach(e => {
            if (e && e.active) e.takeDamage(9999);
        });
        
        const toKill = [];
        this.units.children.iterate(u => {
            if (u && u.active && !u.isDead && (u.faction === CONFIG.FACTIONS.BLUE || u.faction === CONFIG.FACTIONS.GREEN || u.faction === CONFIG.FACTIONS.WILD)) {
                toKill.push(u);
            }
        });
        toKill.forEach(u => u.takeDamage(9999));
        
        if (this._larvae) {
            const larvaeSnapshot = this._larvae.slice();
            larvaeSnapshot.forEach(l => {
                if (l && l.active && !l._dead && l._fizzle) l._fizzle();
            });
            this._larvae = [];
        }

        this.time.delayedCall(2200, () => {
            if (this.isEnding || this.isDead) return;
            this.advanceStage();
        });
    }

    handlePlayerDeath() {
        if (this.isDead || this.isEnding) return;
        this.isDead = true;
        // CHIGGAS_STEAM_PASS_66C_REVENGE_DEATH_FLAG_GAME_BEGIN
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('chiggas_steam_revenge_run_pending', 'true');
                window.localStorage.setItem('chiggas_steam_revenge_run_death_at', new Date().toISOString());
            }
        } catch (_) {}
        // CHIGGAS_STEAM_PASS_66C_REVENGE_DEATH_FLAG_GAME_END
        playDeath();

        // CHIGGAS_CLEANUP_PASS_80A_UNALIVED_CONTINUE_CALL_BEGIN
        try { this._installUnalivedContinueFallback(); } catch (_) {}
        // CHIGGAS_CLEANUP_PASS_80A_UNALIVED_CONTINUE_CALL_END

// CHIGGAS_STEAM_PASS_65_FIRST_DEATH_GAME_BEGIN
        try {
            if (!this.__chiggasSteamFirstDeathSent && typeof window !== 'undefined' && window.dispatchEvent) {
                this.__chiggasSteamFirstDeathSent = true;
                const detail = {
                    achievement: 'FIRST_DEATH',
                    source: 'GameScene_handlePlayerDeath_side_effect',
                    scene: 'GameScene',
                    event: 'first_death_player_death',
                    reason: 'handlePlayerDeath_set_isDead_true_playDeath_called',
                    isDead: !!this.isDead,
                    elapsedTime: Number(this.elapsedTime || 0),
                    stageIndex: Number(this.stageIndex || 0),
                    storeShouldShow: 'TEST BUY',
                    pass: 'steam_desktop_wrapper_pass_65',
                    hook: 'handlePlayerDeath_side_effect_65'
                };
                window.dispatchEvent(new CustomEvent('chiggas-steam-achievement-unlock-request', { detail }));
                window.dispatchEvent(new CustomEvent('chiggas-first-death', { detail }));
            }
        } catch (_) {}
// CHIGGAS_STEAM_PASS_65_FIRST_DEATH_GAME_END

        this.cameras.main.shake(250, 0.012);
        this.cameras.main.flash(250, 120, 0, 0);
        this.time.delayedCall(300, () => this.gameOver());
    }

    gameOver() {
        if (this.isEnding) return;
        this.isEnding = true;
        stopAmbientMusic();

        if (this.cameras && this.cameras.main && this.cameras.main.resetFX) {
            this.cameras.main.resetFX();
        }

        this._finalizeRunStats();
        const records = this._debugDisableScoreSaving ? this._loadDebugPreviewRecord() : this._saveRunRecord();

        const { width, height } = this.scale;
        const diffLabel = this._getDifficultyLabel();
        const runTime = this._formatDuration(Math.max(0, Math.floor((this.time.now - this.startTime) / 1000)));

        if (this.cameras && this.cameras.main) {
            this.cameras.main.stopFollow();
        }

        const overlayDepth = 9000;

        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.92)
            .setScrollFactor(0)
            .setDepth(overlayDepth);

        const bodySize = width < 700 ? '16px' : '24px';
        const smallSize = width < 700 ? '15px' : '20px';

        const deathTitle = this.add.text(width / 2, height * 0.12, "YOU'VE BEEN UNALIVED", {
            fontSize: width < 700 ? '34px' : '56px',
            fontFamily: 'Chiller, Creepster, Dhurjati, fantasy',
            color: '#ff66ff',
            stroke: '#000000',
            strokeThickness: 10,
            shadow: {
                offsetX: 4,
                offsetY: 4,
                color: '#220022',
                blur: 8,
                fill: true
            }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(overlayDepth + 1);

        this.tweens.add({
            targets: deathTitle,
            y: deathTitle.y - 8,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.add.text(width / 2, height * 0.205, `${diffLabel.toUpperCase()} RUN`, {
            fontSize: bodySize,
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(overlayDepth + 1);

        const summary = [
            `Current Score: ${Math.round(this.score)}`,
            `Best Score: ${records.bestScore}`,
            `Stage Reached: ${this.runStats.stageReached}`,
            `Best Stage: ${records.bestStage}`,
            `Run Time: ${runTime}`,
            '',
            `This Run: ${this.runStats.kills} Kills | ${this.runStats.recruits} Recruits | ${this.runStats.turfsClaimed} Turfs`,
            `All Time: ${records.totalKills} Kills | ${records.totalRecruits} Recruits | ${records.totalTurfsClaimed} Turfs`
        ];

        this.add.text(width / 2, height * 0.50, summary.join('\n'), {
            fontSize: bodySize,
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            lineSpacing: 5,
            wordWrap: { width: Math.min(width - 36, 760) }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(overlayDepth + 1);

        const continueText = this.add.text(width / 2, height * 0.88, 'PRESS ANY KEY OR TAP TO RETURN TO TITLE SCREEN', {
            fontSize: smallSize,
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#aaaaaa',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            wordWrap: { width: width - 40 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(overlayDepth + 1);

        this.tweens.add({
            targets: continueText,
            alpha: 0.25,
            duration: 700,
            yoyo: true,
            repeat: -1
        });

        const returnToMenu = () => {
            if (this._returningToMenu) return;
            this._returningToMenu = true;
            this.input.keyboard.off('keydown', returnToMenu);
            this.input.off('pointerdown', returnToMenu);
            if (this.input.gamepad) this.input.gamepad.off('down', returnToMenu);
            this.scene.start('MenuScene');
        };

        this.input.keyboard.once('keydown', returnToMenu);
        this.input.once('pointerdown', returnToMenu);
        if (this.input.gamepad) this.input.gamepad.once('down', returnToMenu);
    }

    _getDifficultyKey() {
        return `difficulty_${this.difficulty}`;
    }

    _getDifficultyLabel() {
        if (this.difficulty === 0) return 'Too Easy';
        if (this.difficulty === 2) return "You Gotta Be Kiddin' Me";
        return 'Straight Up Basic';
    }

    _getDefaultRecord() {
        return {
            bestScore: 0,
            bestStage: 0,
            bestKills: 0,
            bestRecruits: 0,
            bestTurfsClaimed: 0,
            totalRuns: 0,
            totalKills: 0,
            totalRecruits: 0,
            totalEaten: 0,
            totalTurfsClaimed: 0,
            totalBossesDefeated: 0
        };
    }

    _loadAllRecords() {
        try {
            const raw = window.localStorage.getItem('chiggas_records_v1');
            if (!raw) return {};
            return JSON.parse(raw) || {};
        } catch (err) {
            console.warn('[Stats] Could not load records:', err);
            return {};
        }
    }

    _saveAllRecords(records) {
        try {
            window.localStorage.setItem('chiggas_records_v1', JSON.stringify(records));
        } catch (err) {
            console.warn('[Stats] Could not save records:', err);
        }
    }

    _finalizeRunStats() {
        this.runStats.stageReached = Math.max(this.runStats.stageReached || 1, this.stageIndex + 1);
        this.runStats.score = Math.round(this.score);
    }

    _loadDebugPreviewRecord() {
        const allRecords = this._loadAllRecords();
        const key = this._getDifficultyKey();
        return { ...this._getDefaultRecord(), ...(allRecords[key] || {}) };
    }

    _saveRunRecord() {
        const allRecords = this._loadAllRecords();
        const key = this._getDifficultyKey();
        const record = { ...this._getDefaultRecord(), ...(allRecords[key] || {}) };

        record.totalRuns += 1;
        record.totalKills += this.runStats.kills || 0;
        record.totalRecruits += this.runStats.recruits || 0;
        record.totalEaten += this.runStats.eaten || 0;
        record.totalTurfsClaimed += this.runStats.turfsClaimed || 0;
        record.totalBossesDefeated += this.runStats.bossesDefeated || 0;

        record.bestScore = Math.max(record.bestScore || 0, Math.round(this.score));
        record.bestStage = Math.max(record.bestStage || 0, this.runStats.stageReached || 1);
        record.bestKills = Math.max(record.bestKills || 0, this.runStats.kills || 0);
        record.bestRecruits = Math.max(record.bestRecruits || 0, this.runStats.recruits || 0);
        record.bestTurfsClaimed = Math.max(record.bestTurfsClaimed || 0, this.runStats.turfsClaimed || 0);

        allRecords[key] = record;
        this._saveAllRecords(allRecords);
        return record;
    }

    _formatDuration(totalSeconds) {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    _getHostileStatId(obj) {
        if (!obj) return null;
        if (!obj._statId) obj._statId = `h_${this._nextStatId++}`;
        return obj._statId;
    }

    _trackHostileStats() {
        if (!this.units || !this.units.children || this.isEnding) return;

        const current = new Set();

        const registerHostile = (obj) => {
            if (!obj || !obj.active || obj.isDead) return;
            const isHostile =
                this._isHostileGangOrWildFaction(obj.faction) ||
                obj.faction === 'BOSS';

            if (!isHostile) return;
            const id = this._getHostileStatId(obj);
            if (id) current.add(id);
        };

        this.units.children.entries.forEach(registerHostile);
        this.enemies.forEach(registerHostile);
        if (this.boss && this.boss.active && !this.boss.isDead) registerHostile(this.boss);

        this._lastHostileIds.forEach(id => {
            if (!current.has(id) && this._seenHostileIds.has(id)) {
                this.runStats.kills += 1;
            }
        });

        current.forEach(id => this._seenHostileIds.add(id));
        this._lastHostileIds = current;
    }

    _isHostileGangOrWildFaction(faction) {
        return faction === CONFIG.FACTIONS.BLUE ||
            faction === CONFIG.FACTIONS.GREEN ||
            faction === CONFIG.FACTIONS.PURPLE ||
            faction === CONFIG.FACTIONS.ORANGE ||
            faction === CONFIG.FACTIONS.WILD;
    }

    _isGangFaction(faction) {
        return faction === CONFIG.FACTIONS.BLUE ||
            faction === CONFIG.FACTIONS.GREEN ||
            faction === CONFIG.FACTIONS.PURPLE ||
            faction === CONFIG.FACTIONS.ORANGE;
    }

    _getGangName(faction) {
        if (faction === CONFIG.FACTIONS.BLUE) return 'Blue Gang';
        if (faction === CONFIG.FACTIONS.GREEN) return 'Green Gang';
        if (faction === CONFIG.FACTIONS.PURPLE) return 'Purple Gang';
        if (faction === CONFIG.FACTIONS.ORANGE) return 'Orange Gang';
        return 'Gang';
    }

    _getGangColor(faction) {
        if (faction === CONFIG.FACTIONS.BLUE) return 0x00aaff;
        if (faction === CONFIG.FACTIONS.GREEN) return 0x39ff14;
        if (faction === CONFIG.FACTIONS.PURPLE) return 0xb044ff;
        if (faction === CONFIG.FACTIONS.ORANGE) return 0xff8800;
        return 0xffffff;
    }

    _hasGangPresence(faction) {
        if (!this._isGangFaction(faction)) return false;
        if (this.enemies?.some(e => e && e.active && !e.isDead && e.faction === faction)) return true;
        if (this.territories?.some(t => t && t.faction === faction)) return true;

        let found = false;
        this.units?.children?.entries?.forEach(u => {
            if (!found && u && u.active && !u.isDead && u.faction === faction) found = true;
        });

        return found;
    }

    _checkGangWipeouts() {
        if (this.isEnding || !this._gangStartingFactions) return;

        this._gangStartingFactions.forEach(faction => {
            if (this._gangWipeoutAnnounced.has(faction)) return;
            if (this._hasGangPresence(faction)) return;

            this._gangWipeoutAnnounced.add(faction);
            this._showGangWipeoutNotice(faction);
        });
    }

    _showGangWipeoutNotice(faction) {
        const { width, height } = this.scale;
        const color = this._getGangColor(faction);
        const name = this._getGangName(faction).toUpperCase();
        const depth = 7600;

        const overlay = this.add.container(0, 0).setScrollFactor(0).setDepth(depth);
        const flash = this.add.rectangle(width / 2, height / 2, width, height, color, 0.16);
        const ring = this.add.graphics();
        ring.lineStyle(10, color, 0.95);
        ring.strokeCircle(width / 2, height / 2, Math.min(width, height) * 0.12);

        const text = this.add.text(width / 2, height / 2, `${name}\nHAS BEEN WIPED OUT!`, {
            fontSize: width < 760 ? '34px' : '58px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: width < 760 ? 8 : 12,
            align: 'center'
        }).setOrigin(0.5).setScale(0.25).setAlpha(0);

        const sub = this.add.text(width / 2, height / 2 + (width < 760 ? 86 : 122), '+1000 SCORE', {
            fontSize: width < 760 ? '24px' : '38px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: width < 760 ? 6 : 9,
            align: 'center'
        }).setOrigin(0.5).setAlpha(0);

        overlay.add([flash, ring, text, sub]);

        for (let i = 0; i < 16; i++) {
            const shard = this.add.triangle(
                width / 2,
                height / 2,
                0, -10,
                -8, 8,
                8, 8,
                i % 2 === 0 ? color : 0xffdd00,
                0.96
            ).setDepth(depth + 1);

            overlay.add(shard);

            const angle = (i / 16) * Math.PI * 2;
            const dist = Math.min(width, height) * (0.28 + Math.random() * 0.22);
            this.tweens.add({
                targets: shard,
                x: width / 2 + Math.cos(angle) * dist,
                y: height / 2 + Math.sin(angle) * dist,
                rotation: angle + Math.PI * 2,
                alpha: 0,
                duration: 900,
                ease: 'Cubic.easeOut',
                onComplete: () => shard.destroy()
            });
        }

        this.addScore(1000, this.player?.x || width / 2, this.player?.y || height / 2);
        this.cameras?.main?.shake(450, 0.018);
        this.cameras?.main?.flash(220, 255, 255, 255);

        this.tweens.add({
            targets: text,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 360,
            ease: 'Back.easeOut'
        });

        this.tweens.add({
            targets: sub,
            alpha: 1,
            y: sub.y + 10,
            duration: 260,
            delay: 240,
            ease: 'Sine.easeOut'
        });

        this.tweens.add({
            targets: ring,
            scaleX: 4.5,
            scaleY: 4.5,
            alpha: 0,
            duration: 900,
            ease: 'Cubic.easeOut'
        });

        this.tweens.add({
            targets: overlay,
            alpha: 0,
            duration: 420,
            delay: 1450,
            ease: 'Sine.easeInOut',
            onComplete: () => overlay.destroy(true)
        });
    }

    onTurfCaptured(turf, faction) {
        if (faction === CONFIG.FACTIONS.PLAYER) {
            this.runStats.turfsClaimed += 1;
            playTurfCapture();
            this.addScore(150, turf.x, turf.y);
            this.showFeedback('TURF CLAIMED!', 0xff3333, turf.x, turf.y - 80);
        }
    }

    _unlockCosmeticAchievements(isFinalClear = false) {
        if (this.debugMode) return [];

        const unlocked = [];

        const addRewards = (achievementId) => {
            const rewards = unlockAchievementRewards(achievementId);
            if (rewards && rewards.length) unlocked.push(...rewards);
        };

        if ((this.runStats.recruits || 0) >= 100) addRewards('recruit_100');
        if ((this.runStats.turfsClaimed || 0) >= 50) addRewards('capture_50_turfs');
        if ((this.runStats.kills || 0) >= 500) addRewards('kill_500');

        if (isFinalClear) {
            addRewards('boss_slayer');
            if ((this.difficulty || 0) >= 1) addRewards('beat_basic');
            if ((this.difficulty || 0) >= 2) addRewards('beat_hard');
        }

        return unlocked;
    }

    _calculateTurfControlBonus() {
        const remainingTurfs = this.territories?.filter(t => t && t.faction === CONFIG.FACTIONS.PLAYER).length ?? 0;
        if (remainingTurfs <= 0) return 0;

        // Turfs become a stage-end score multiplier.
        // Later stages reward held turf more because keeping control is harder.
        const stageMultiplier = Math.max(1, this.stageIndex + 1);
        return Math.round(remainingTurfs * 100 * stageMultiplier);
    }

    advanceStage() {
        if (this.isEnding) return;
        this.isEnding = true;
        stopAmbientMusic();
        playStageAdvance();

        const nextIndex = this.stageIndex + 1;
        const parTime = (this.stageIndex + 1) * 120;
        let timeBonus = 0;

        if (this.elapsedTime < parTime) {
            timeBonus = (parTime - this.elapsedTime) * 10;
            this.score += timeBonus;
        }

        const turfBonus = this._calculateTurfControlBonus();
        if (turfBonus > 0) {
            this.score += turfBonus;
        }

        const mins = Math.floor(this.elapsedTime / 60);
        const secs = this.elapsedTime % 60;
        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        const isFinalClear = nextIndex >= CONFIG.STAGES.length;
        const nextStage = !isFinalClear ? CONFIG.STAGES[nextIndex] : null;

        const stageUnlocks = this.debugMode ? [] : [
            ...unlockStageRewards(this.stageIndex),
            ...this.__pass95AHandleBaseUnlocks('stage_clear', {
                completedStage: this.stageIndex + 1,
                stageReached: this.stageIndex + 2,
                isFinalClear
            }, false)
        ];
        const achievementUnlocks = this._unlockCosmeticAchievements(isFinalClear);
        const cosmeticUnlocks = [...stageUnlocks, ...achievementUnlocks];

        this._showStageClearedPanel({
            nextIndex,
            nextStage,
            isFinalClear,
            timeBonus,
            turfBonus,
            timeStr,
            cosmeticUnlocks,
            onContinue: () => {
                if (isFinalClear) {
                    this._playVictoryVideoBeforeFinalScore(timeBonus, timeStr);
                    return;
                }

                const nextGameData = {
                    stageIndex: nextIndex,
                    score: this.score,
                    difficulty: this.difficulty,
                    controlMode: this.controlMode,
                    runStats: this.runStats,
                    debugMode: this.debugMode,
                    debugOptions: this.debugMode ? {
                        ...this.debugOptions,
                        triggerBossImmediately: false,
                        captureAllTurfs: false,
                        label: `${this.debugOptions?.label || 'Debug Run'} Continued`
                    } : undefined
                };

                if (!this.debugMode && (this.stageIndex === 1 || this.stageIndex === 3)) {
                    this.scene.start('MiniGamePromptScene', {
                        triggerStageIndex: this.stageIndex,
                        targetGameData: nextGameData
                    });
                    return;
                }

                if (this.debugMode) {
                    this.scene.start('GameScene', nextGameData);
                } else {
                    this.scene.start('StageIntroScene', { targetGameData: nextGameData });
                }
            }
        });
    }

    _showStageClearedPanel({ nextIndex, nextStage, isFinalClear, timeBonus, turfBonus = 0, timeStr, cosmeticUnlocks = [], onContinue }) {
        const { width, height } = this.scale;
        const compact = width < 760 || height < 620;
        const overlayDepth = 4300;

        if (this.cameras && this.cameras.main) {
            this.cameras.main.stopFollow();
            this.cameras.main.flash(260, 255, 221, 0);
        }

        const overlay = this.add.container(0, 0)
            .setScrollFactor(0)
            .setDepth(overlayDepth)
            .setAlpha(0);

        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.84);
        const panelW = Math.min(width - 30, compact ? 440 : 680);
        const panelH = Math.min(height - 34, compact ? 420 : 500);
        const panelX = width / 2;
        const panelY = height / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x111111, 0.97);
        panel.fillRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 24);
        panel.lineStyle(5, isFinalClear ? 0x39ff14 : 0xffdd00, 0.92);
        panel.strokeRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 24);

        const stageLabel = isFinalClear
            ? 'FINAL STAGE CLEARED!'
            : `STAGE ${this.stageIndex + 1} CLEARED!`;

        const title = this.add.text(panelX, panelY - panelH / 2 + (compact ? 34 : 48), stageLabel, {
            fontSize: compact ? '32px' : '50px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: isFinalClear ? '#39ff14' : '#ffdd00',
            stroke: '#000000',
            strokeThickness: compact ? 7 : 9,
            align: 'center',
            wordWrap: { width: panelW - 34 }
        }).setOrigin(0.5);

        const survived = this.player?.followers?.filter(f => f && f.active && !f.isDead).length ?? 0;
        const maxArmy = this.player?.getMaxArmySize ? this.player.getMaxArmySize() : survived;
        const turfsHeld = this.territories?.filter(t => t && t.faction === CONFIG.FACTIONS.PLAYER).length ?? 0;
        const totalTurfs = this.territories?.length ?? 0;
        const scoreBonus = Math.round(timeBonus || 0);
        const turfScoreBonus = Math.round(turfBonus || 0);
        const totalScore = Math.round(this.score || 0);

        const preTurfScore = Math.max(0, totalScore - turfScoreBonus);

        const soldiersRecruited = this.runStats?.recruits ?? survived;

        const buildSummaryText = (animatedTurfCount = 0, animatedTurfBonus = 0) => {
            const summaryLines = [
                `Time: ${timeStr}`,
                `Time Bonus: +${scoreBonus}`,
                `Regular Score: ${preTurfScore}`,
                `Turfs Held: ${animatedTurfCount}/${totalTurfs}`,
                `Turf Score: +${animatedTurfBonus}`,
                `Soldiers Recruited: ${soldiersRecruited}`
            ];

            if (cosmeticUnlocks.length > 0) {
                const names = cosmeticUnlocks.slice(0, 2).map(s => s.name).join(', ');
                const extra = cosmeticUnlocks.length > 2 ? ` +${cosmeticUnlocks.length - 2} more` : '';
                summaryLines.push(`Unlocked: ${names}${extra}`);
            }

            return summaryLines.join('\n');
        };

        const summaryLines = buildSummaryText(0, 0).split('\n');

        const summary = this.add.text(panelX, panelY - (compact ? 46 : 38), summaryLines.join('\n'), {
            fontSize: compact ? '17px' : '22px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            lineSpacing: compact ? 0 : 4,
            wordWrap: { width: panelW - 70 }
        }).setOrigin(0.5);

        const totalScoreText = this.add.text(panelX, panelY + (compact ? 94 : 118), `TOTAL SCORE: ${preTurfScore}`, {
            fontSize: compact ? '25px' : '38px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: compact ? 6 : 8,
            align: 'center',
            wordWrap: { width: panelW - 50 }
        }).setOrigin(0.5);
        let unlockVisuals = [];
        if (cosmeticUnlocks.length > 0) {
            unlockVisuals = this._createCosmeticUnlockNotification({
                skins: cosmeticUnlocks,
                x: width / 2,
                y: height - (compact ? 106 : 124),
                maxWidth: Math.min(width - 36, compact ? 360 : 520),
                compact
            });
        }

        const nextText = isFinalClear
            ? 'NEXT: VICTORY'
            : `NEXT: STAGE ${nextStage?.level ?? nextIndex + 1} - ${(nextStage?.name || 'UNKNOWN').toUpperCase()}`;

        const next = this.add.text(panelX, panelY + panelH / 2 - (compact ? 88 : 104), nextText, {
            fontSize: compact ? '17px' : '24px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: isFinalClear ? '#39ff14' : '#ffaa44',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center',
            wordWrap: { width: panelW - 40 }
        }).setOrigin(0.5);

        const descText = isFinalClear
            ? 'The infestation has been crushed.'
            : `"${nextStage?.description || 'Keep pushing forward.'}"`;

        const desc = this.add.text(panelX, next.y + (compact ? 26 : 32), descText, {
            fontSize: compact ? '14px' : '18px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#cccccc',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            wordWrap: { width: panelW - 54 }
        }).setOrigin(0.5);

        const buttonW = compact ? 170 : 230;
        const buttonH = compact ? 38 : 50;
        const buttonY = panelY + panelH / 2 - (compact ? 24 : 34);
        const continueButton = this._createStageClearButton(panelX, buttonY, isFinalClear ? 'VICTORY' : 'CONTINUE', isFinalClear ? 0x1f7a1f : 0xaa1111, () => {
            finish();
        }, overlay, buttonW, buttonH, compact ? 18 : 24);

        const autoText = this.add.text(panelX, buttonY + (compact ? 34 : 44), 'Counting turf bonus...', {
            fontSize: compact ? '14px' : '16px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#aaaaaa',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5);

        overlay.add([shade, panel, title, summary, totalScoreText, ...unlockVisuals, next, desc, continueButton, autoText]);

        this.tweens.add({
            targets: overlay,
            alpha: 1,
            duration: 350,
            ease: 'Sine.easeOut'
        });

        const runTurfScoreAnimation = (onDone) => {
            if (!summary || !summary.active) {
                onDone?.();
                return;
            }

            if (turfScoreBonus <= 0 || turfsHeld <= 0) {
                summary.setText(buildSummaryText(turfsHeld, turfScoreBonus));
                totalScoreText.setText(`TOTAL SCORE: ${totalScore}`);
                onDone?.();
                return;
            }

            const countText = this.add.text(panelX, panelY, 'TURF COUNT', {
                fontSize: compact ? '42px' : '76px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#39ff14',
                stroke: '#000000',
                strokeThickness: compact ? 8 : 12,
                align: 'center'
            }).setOrigin(0.5).setDepth(overlayDepth + 20).setScrollFactor(0).setScale(0.1).setAlpha(0);

            const countNumber = this.add.text(panelX, panelY + (compact ? 48 : 76), '0', {
                fontSize: compact ? '52px' : '96px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ffdd00',
                stroke: '#000000',
                strokeThickness: compact ? 8 : 12,
                align: 'center'
            }).setOrigin(0.5).setDepth(overlayDepth + 20).setScrollFactor(0).setAlpha(0);

            overlay.add([countText, countNumber]);

            this.tweens.add({
                targets: [countText, countNumber],
                alpha: 1,
                scaleX: 1,
                scaleY: 1,
                duration: 420,
                ease: 'Back.easeOut',
                onComplete: () => {
                    const perTurf = turfsHeld > 0 ? Math.round(turfScoreBonus / turfsHeld) : 0;
                    let count = 0;

                    const tick = () => {
                        count += 1;
                        const shownBonus = Math.min(turfScoreBonus, count * perTurf);
                        const shownTotal = Math.min(totalScore, preTurfScore + shownBonus);

                        countNumber.setText(`${count}/${turfsHeld}`);
                        countNumber.setScale(1.24);
                        summary.setText(buildSummaryText(count, shownBonus));
                        totalScoreText.setText(`TOTAL SCORE: ${shownTotal}`);

                        try {
                            playTurfCapture();
                        } catch (e) {}

                        this.tweens.add({
                            targets: countNumber,
                            scaleX: 1,
                            scaleY: 1,
                            duration: 160,
                            ease: 'Back.easeOut'
                        });

                        if (count < turfsHeld) {
                            this.time.delayedCall(360, tick);
                            return;
                        }

                        summary.setText(buildSummaryText(turfsHeld, turfScoreBonus));
                totalScoreText.setText(`TOTAL SCORE: ${totalScore}`);

                        const bonusText = this.add.text(panelX, panelY + (compact ? 108 : 150), `+${turfScoreBonus} TURF SCORE`, {
                            fontSize: compact ? '28px' : '44px',
                            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                            color: '#ffdd00',
                            stroke: '#000000',
                            strokeThickness: compact ? 6 : 9,
                            align: 'center'
                        }).setOrigin(0.5).setDepth(overlayDepth + 22).setScrollFactor(0).setScale(0.4).setAlpha(0);

                        overlay.add(bonusText);

                        this.tweens.add({
                            targets: bonusText,
                            alpha: 1,
                            scaleX: 1,
                            scaleY: 1,
                            duration: 300,
                            ease: 'Back.easeOut',
                            onComplete: () => {
                                try {
                                    playTurfCapture();
                                } catch (e) {}

                                this.tweens.add({
                                    targets: bonusText,
                                    y: totalScoreText.y,
                                    scaleX: 0.45,
                                    scaleY: 0.45,
                                    alpha: 0,
                                    duration: 620,
                                    ease: 'Sine.easeInOut',
                                    onComplete: () => {
                                        bonusText.destroy();
                                        this.tweens.add({
                                            targets: [countText, countNumber],
                                            alpha: 0,
                                            scaleX: 0.86,
                                            scaleY: 0.86,
                                            duration: 300,
                                            onComplete: () => {
                                                countText.destroy();
                                                countNumber.destroy();
                                                onDone?.();
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    };

                    this.time.delayedCall(300, tick);
                }
            });
        };

        let completed = false;
        let inputEnabled = false;

        const cleanupInputs = () => {
            try {
                this.input.keyboard.off('keydown', finish);
                this.input.off('pointerdown', finish);
                if (this.input.gamepad) this.input.gamepad.off('down', finish);
            } catch (e) {}
        };

        const finish = () => {
            if (completed || !inputEnabled) return;
            completed = true;
            cleanupInputs();

            this.tweens.add({
                targets: overlay,
                alpha: 0,
                duration: 260,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    if (overlay && overlay.active) overlay.destroy(true);
                    onContinue?.();
                }
            });
        };

        const enableContinue = () => {
            if (completed || inputEnabled) return;
            inputEnabled = true;
            autoText.setText('Press any key, tap, or press CONTINUE');
            this.input.keyboard.once('keydown', finish);
            this.input.once('pointerdown', finish);
            if (this.input.gamepad) this.input.gamepad.once('down', finish);
        };

        this.time.delayedCall(520, () => {
            runTurfScoreAnimation(enableContinue);
        });
    }

    _createCosmeticUnlockNotification({ skins = [], x, y, maxWidth = 520, compact = false } = {}) {
        const visuals = [];
        if (!skins || skins.length <= 0) return visuals;

        const primarySkin = skins[0];
        const extraCount = Math.max(0, skins.length - 1);
        const cardW = Math.min(maxWidth, compact ? 340 : 500);
        const cardH = compact ? 70 : 86;
        const imgSize = compact ? 46 : 58;

        const bg = this.add.graphics();
        bg.fillStyle(0x050505, 0.94);
        bg.fillRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, 18);
        bg.lineStyle(3, 0x39ff14, 0.92);
        bg.strokeRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, 18);
        visuals.push(bg);

        const glow = this.add.graphics();
        glow.lineStyle(2, 0xffdd00, 0.55);
        glow.strokeRoundedRect(x - cardW / 2 + 5, y - cardH / 2 + 5, cardW - 10, cardH - 10, 15);
        visuals.push(glow);

        let img = null;
        const imgX = x - cardW / 2 + (compact ? 42 : 52);
        if (primarySkin?.assetKey && this.textures.exists(primarySkin.assetKey)) {
            img = this.add.image(imgX, y, primarySkin.assetKey);
        }

        if (img) {
            const scale = Math.min(imgSize / Math.max(1, img.width), imgSize / Math.max(1, img.height));
            img.setScale(scale);
            visuals.push(img);
        }

        const title = this.add.text(x - cardW / 2 + (compact ? 82 : 96), y - (compact ? 18 : 24), 'NEW CHIGGA WEAR UNLOCKED!', {
            fontSize: compact ? '16px' : '20px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#39ff14',
            stroke: '#000000',
            strokeThickness: compact ? 3 : 5,
            align: 'left',
            wordWrap: { width: cardW - (compact ? 100 : 120) }
        }).setOrigin(0, 0.5);
        visuals.push(title);

        const rarity = (primarySkin?.rarity || 'rare').toUpperCase();
        const moreText = extraCount > 0 ? `  +${extraCount} MORE` : '';
        const body = this.add.text(x - cardW / 2 + (compact ? 82 : 96), y + (compact ? 13 : 18), `${primarySkin?.name || 'New Cosmetic'}  |  ${rarity}${moreText}`, {
            fontSize: compact ? '14px' : '17px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'left',
            wordWrap: { width: cardW - (compact ? 100 : 120) }
        }).setOrigin(0, 0.5);
        visuals.push(body);

        visuals.forEach(obj => {
            obj.setScrollFactor(0);
            obj.setDepth(9800);
            obj.setAlpha(0);
        });

        this.tweens.add({
            targets: visuals,
            alpha: 1,
            y: '-=10',
            duration: 320,
            ease: 'Back.easeOut'
        });

        this.tweens.add({
            targets: visuals,
            alpha: 0,
            y: '-=12',
            duration: 450,
            delay: this.debugMode ? 1800 : 3200,
            ease: 'Sine.easeIn',
            onComplete: () => {
                visuals.forEach(obj => {
                    if (obj && obj.active) obj.destroy();
                });
            }
        });

        return visuals;
    }


    _createStageClearButton(x, y, text, color, onClick, container, w = 230, h = 50, fz = 24) {
        const btn = this.add.container(x, y);
        const bg = this.add.graphics();

        const draw = (fillColor, lineColor = 0xffffff) => {
            bg.clear();
            bg.fillStyle(fillColor, 1);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 4);
            bg.lineStyle(4, lineColor, 0.72);
            bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 4);
        };

        draw(color);

        const label = this.add.text(0, 0, text, {
            fontSize: `${fz}px`,
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: Math.max(3, Math.round(fz * 0.2)),
            align: 'center'
        }).setOrigin(0.5);

        btn.add([bg, label]);
        btn.setSize(w, h);
        btn.setInteractive({ useHandCursor: true });

        const hoverColor = Phaser.Display.Color.IntegerToColor(color).lighten(20).color;
        btn.on('pointerover', () => draw(hoverColor));
        btn.on('pointerout', () => draw(color));
        btn.on('pointerdown', () => onClick?.());

        if (container) container.add(btn);
        return btn;
    }


    _playVictoryVideoBeforeFinalScore(timeBonus, timeStr) {


        // CHIGGAS STEAM ACHIEVEMENT PASS 77 MITIEST_SURVIVOR BEGIN


        try {


            if (!this.__chiggasSteamMitiestSurvivorSent && typeof window !== 'undefined' && window.dispatchEvent) {


                this.__chiggasSteamMitiestSurvivorSent = true;


                const detail = {


                    achievement: 'MITIEST_SURVIVOR',


                    source: 'GameScene_final_victory_video_before_final_score',


                    scene: 'GameScene',


                    event: 'mitiest_survivor_final_stage_victory',


                    reason: 'final_stage_clear_play_victory_video_before_final_score',


                    stageIndex: this.stageIndex ?? null,


                    elapsedTime: this.elapsedTime ?? null,


                    score: this.score ?? null,


                    timeBonus: typeof timeBonus !== 'undefined' ? timeBonus : null,


                    timeStr: typeof timeStr !== 'undefined' ? timeStr : null,


                    storeShouldShow: 'TEST BUY',


                    pass: 'steam_desktop_wrapper_pass_77',


                    hook: 'final_victory_video_before_final_score_77'


                };


                window.dispatchEvent(new CustomEvent('chiggas-steam-achievement-unlock-request', { detail }));


                window.dispatchEvent(new CustomEvent('chiggas-steam-pass-77-mitiest-survivor', { detail }));


            }


        } catch (_) {}


        // CHIGGAS STEAM ACHIEVEMENT PASS 77 MITIEST_SURVIVOR END
        this._playDomVideoOverlay('assets/chiggas-you-win.mp4', () => {
            this._showVictoryScoreScreen(timeBonus, timeStr);
        });
    }

    _playDomVideoOverlay(videoPath, onComplete) {
        let completed = false;
        let safetyTimer = null;
        let prompt = null;

        const finish = () => {
            if (completed) return;
            completed = true;

            try {
                this.input.keyboard.off('keydown', finish);
                this.input.off('pointerdown', finish);
                if (this.input.gamepad) this.input.gamepad.off('down', finish);
            } catch (e) {}

            if (safetyTimer) safetyTimer.remove(false);
            if (prompt && prompt.active) prompt.destroy();

            try {
                if (video) {
                    video.pause();
                    video.removeAttribute('src');
                    video.load();
                    if (video.parentElement) video.parentElement.removeChild(video);
                }
            } catch (e) {}

            onComplete?.();
        };

        const canvas = this.game?.canvas;
        const parent = canvas?.parentElement || document.body;
        const video = document.createElement('video');

        video.src = videoPath;
        video.preload = 'auto';
        video.playsInline = true;
        video.muted = false;
        video.autoplay = false;
        video.controls = false;
        video.disablePictureInPicture = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');

        video.style.position = 'absolute';
        video.style.objectFit = 'cover';
        video.style.backgroundColor = 'black';
        video.style.zIndex = '40';
        video.style.pointerEvents = 'none';
        video.style.opacity = '1';

        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.position === 'static') parent.style.position = 'relative';

        const positionVideo = () => {
            if (!canvas || !parent || !video) return;
            const canvasRect = canvas.getBoundingClientRect();
            const parentRect = parent.getBoundingClientRect();
            video.style.left = `${canvasRect.left - parentRect.left}px`;
            video.style.top = `${canvasRect.top - parentRect.top}px`;
            video.style.width = `${canvasRect.width}px`;
            video.style.height = `${canvasRect.height}px`;
        };

        parent.appendChild(video);
        positionVideo();

        const resizeHandler = () => positionVideo();
        window.addEventListener('resize', resizeHandler, { once: false });

        const cleanupAndFinish = () => {
            window.removeEventListener('resize', resizeHandler);
            finish();
        };

        video.addEventListener('ended', cleanupAndFinish, { once: true });
        video.addEventListener('error', cleanupAndFinish, { once: true });

        prompt = this.add.text(this.scale.width / 2, this.scale.height - 34, 'TAP / CLICK / PRESS ANY KEY TO SKIP', {
            fontSize: this.scale.height < 600 ? '18px' : '22px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10000).setAlpha(0.8);

        this.tweens.add({
            targets: prompt,
            alpha: 0.25,
            duration: 850,
            yoyo: true,
            repeat: -1
        });

        const removePromptAndFinish = () => {
            if (prompt && prompt.active) prompt.destroy();
            cleanupAndFinish();
        };

        this.input.keyboard.once('keydown', removePromptAndFinish);
        this.input.once('pointerdown', removePromptAndFinish);
        if (this.input.gamepad) this.input.gamepad.once('down', removePromptAndFinish);

        safetyTimer = this.time.delayedCall(65000, removePromptAndFinish);

        try {
            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {
                    // Browser autoplay may require input. The skip/start prompt remains active.
                });
            }
        } catch (e) {
            removePromptAndFinish();
        }
    }

    _showVictoryScoreScreen(timeBonus, timeStr) {
        const { width, height } = this.scale;
            this._finalizeRunStats();
            this.runStats.stageReached = Math.max(this.runStats.stageReached || 1, CONFIG.STAGES.length);
            this.runStats.fullClears = (this.runStats.fullClears || 0) + 1;

            const records = this._debugDisableScoreSaving ? this._loadDebugPreviewRecord() : this._saveRunRecord();
            const diffLabel = this._getDifficultyLabel();

            if (this.cameras && this.cameras.main) {
                if (this.cameras.main.resetFX) this.cameras.main.resetFX();
                this.cameras.main.stopFollow();
            }

            const overlayDepth = 9000;

            this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.9)
                .setScrollFactor(0)
                .setDepth(overlayDepth);

            const titleSize = width < 700 ? '34px' : '54px';
            const bodySize = width < 700 ? '16px' : '23px';
            const smallSize = width < 700 ? '15px' : '20px';

            const victoryTitle = this.add.text(width / 2, height * 0.12, 'THE ENTIRE SKIN IS YOURS!', {
                fontSize: titleSize,
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ffdd00',
                stroke: '#000000',
                strokeThickness: 8,
                align: 'center',
                wordWrap: { width: width - 40 }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(overlayDepth + 1);

            this.tweens.add({
                targets: victoryTitle,
                y: victoryTitle.y - 6,
                duration: 1200,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.add.text(width / 2, height * 0.215, `${diffLabel.toUpperCase()} FULL CLEAR`, {
                fontSize: bodySize,
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ff8800',
                stroke: '#000000',
                strokeThickness: 5,
                align: 'center'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(overlayDepth + 1);

            const summary = [
                `Final Score: ${Math.round(this.score)}`,
                `Best Score: ${records.bestScore}`,
                `Stages Cleared: ${CONFIG.STAGES.length}`,
                `Best Stage: ${records.bestStage}`,
                `Final Stage Time: ${timeStr}`,
                `Final Time Bonus: +${timeBonus}`,
                '',
                `This Run: ${this.runStats.kills} Kills | ${this.runStats.recruits} Recruits | ${this.runStats.turfsClaimed} Turfs`,
                `Bosses Defeated: ${this.runStats.bossesDefeated || 0}`,
                '',
                `All Time: ${records.totalKills} Kills | ${records.totalRecruits} Recruits | ${records.totalTurfsClaimed} Turfs`,
                `Total Bosses Defeated: ${records.totalBossesDefeated || 0}`
            ];

            this.add.text(width / 2, height * 0.52, summary.join('\n'), {
                fontSize: bodySize,
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center',
                lineSpacing: 5,
                wordWrap: { width: Math.min(width - 36, 780) }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(overlayDepth + 1);

            const continueText = this.add.text(width / 2, height * 0.88, 'PRESS ANY KEY OR TAP TO RETURN TO TITLE SCREEN', {
                fontSize: smallSize,
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#aaaaaa',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'center',
                wordWrap: { width: width - 40 }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(overlayDepth + 1);

            this.tweens.add({
                targets: continueText,
                alpha: 0.25,
                duration: 700,
                yoyo: true,
                repeat: -1
            });

            const returnToMenu = () => {
                if (this._returningToMenu) return;
                this._returningToMenu = true;
                this.input.keyboard.off('keydown', returnToMenu);
                this.input.off('pointerdown', returnToMenu);
                if (this.input.gamepad) this.input.gamepad.off('down', returnToMenu);
                this.scene.start('MenuScene');
            };

            this.input.keyboard.once('keydown', returnToMenu);
            this.input.once('pointerdown', returnToMenu);
            if (this.input.gamepad) this.input.gamepad.once('down', returnToMenu);
    }

    _cleanupKeyboardFallback() {
        if (this._windowKeyDownHandler) {
            window.removeEventListener('keydown', this._windowKeyDownHandler);
            this._windowKeyDownHandler = null;
        }

        if (this._windowKeyUpHandler) {
            window.removeEventListener('keyup', this._windowKeyUpHandler);
            this._windowKeyUpHandler = null;
        }

        this._keyboardState = {};
        this._keyboardPressedLastFrame = {};
    }

    _isKeyboardDown(...codes) {
        return codes.some(code => !!this._keyboardState?.[code]);
    }

    _keyboardJustPressed(actionName, ...codes) {
        const down = this._isKeyboardDown(...codes);
        this._keyboardPressedLastFrame = this._keyboardPressedLastFrame || {};
        const wasDown = !!this._keyboardPressedLastFrame[actionName];
        this._keyboardPressedLastFrame[actionName] = down;
        return down && !wasDown;
    }

    _keyboardActionDown(actionName) {
        const codes = getKeyboardCodes('gameplay', actionName).filter(code => !['WASD', 'ArrowKeys', 'Mouse'].includes(code));
        return this._isKeyboardDown(...codes);
    }

    _keyboardActionJustPressed(actionName) {
        const codes = getKeyboardCodes('gameplay', actionName).filter(code => !['WASD', 'ArrowKeys', 'Mouse'].includes(code));
        return this._keyboardJustPressed(`custom_${actionName}`, ...codes);
    }


    _setupPauseInput() {
        this._pauseNavButtons = [];
        this._pauseFocusIndex = 0;
        this._lastPauseGamepadMoveAt = 0;

        this.input.keyboard?.on('keydown', event => {
            const key = event.key;
            const code = event.code;

            if (getKeyboardCodes('gameplay', 'pause').includes(code) || key === 'p' || key === 'P') {
                this._togglePauseMenu();
                return;
            }

            if (!this._pauseContainer) return;

            if (key === 'ArrowUp' || key === 'w' || key === 'W') {
                this._movePauseFocus(-1);
            } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
                this._movePauseFocus(1);
            } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
                this._movePauseFocus(-1);
            } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
                this._movePauseFocus(1);
            } else if (getKeyboardCodes('menu', 'confirm').includes(code)) {
                this._activatePauseFocus();
            } else if (getKeyboardCodes('menu', 'back').includes(code) || getKeyboardCodes('gameplay', 'back').includes(code)) {
                this._closePauseMenu();
            }
        });

        if (this.input.gamepad) {
            this.input.gamepad.on('down', (pad, button, index) => {
                const buttonIndex = button?.index ?? index;

                if (isGamepadActionButton('gameplay', 'pause', buttonIndex)) {
                    this._togglePauseMenu();
                    return;
                }

                if (!this._pauseContainer) return;

                if (isGamepadActionButton('menu', 'confirm', buttonIndex) || isGamepadActionButton('gameplay', 'recruit', buttonIndex)) {
                    this._activatePauseFocus();
                } else if (isGamepadActionButton('menu', 'back', buttonIndex) || isGamepadActionButton('gameplay', 'back', buttonIndex)) {
                    this._closePauseMenu();
                } else if (buttonIndex === 12 || buttonIndex === 14) {
                    this._movePauseFocus(-1);
                } else if (buttonIndex === 13 || buttonIndex === 15) {
                    this._movePauseFocus(1);
                }
            });
        }
    }

    _togglePauseMenu() {
        if (this._pauseContainer) {
            this._closePauseMenu();
            return;
        }

        this._openPauseMenu();
    }

    update(time, delta) {
        this._pollPauseGamepadStick(time);
        this._pollBrowserGamepadPauseInput(time);
        this._pollNativeSteamPauseInput(time);
        this._updateWeatherVisuals(delta);
        if (this.isDead || this._pauseContainer) return;

        let vx = 0, vy = 0;

        if (this.controlMode === 'touch' && this.joystick) {
            const vector = this.joystick.getVector();
            if (vector.x !== 0 || vector.y !== 0) {
                vx = vector.x;
                vy = vector.y;
            }
        }

        if (this.controlMode === 'keyboard' || this.controlMode === 'gamepad') {
            // Also allow keyboard-style movement in Gamepad mode. This lets Steam Input
            // keyboard/gamepad-emulation layouts drive gameplay even when the browser
            // and steamworks.js controller-handle APIs return zero controllers.
            const leftDown = this.wasd.A.isDown || this.cursors.left.isDown || this._isKeyboardDown('KeyA', 'ArrowLeft');
            const rightDown = this.wasd.D.isDown || this.cursors.right.isDown || this._isKeyboardDown('KeyD', 'ArrowRight');
            const upDown = this.wasd.W.isDown || this.cursors.up.isDown || this._isKeyboardDown('KeyW', 'ArrowUp');
            const downDown = this.wasd.S.isDown || this.cursors.down.isDown || this._isKeyboardDown('KeyS', 'ArrowDown');

            if (leftDown && !rightDown) vx = -1;
            else if (rightDown && !leftDown) vx = 1;

            if (upDown && !downDown) vy = -1;
            else if (downDown && !upDown) vy = 1;
        }

        let gamepadShootHeld = false;
        let phaserGamepadUsed = false;
        let browserGamepadEdges = {};

        if (this.controlMode === 'gamepad' && this.input.gamepad && this.input.gamepad.total > 0) {
            const pad = this.input.gamepad.getPad(0);
            if (pad && pad.axes.length >= 2) {
                const ax = pad.axes[0].getValue();
                const ay = pad.axes[1].getValue();
                if (Math.abs(ax) > 0.1) vx = ax;
                if (Math.abs(ay) > 0.1) vy = ay;
                gamepadShootHeld = isGamepadActionPressed(pad, 'gameplay', 'shoot');
                phaserGamepadUsed = true;
            }
        }

        if (this.controlMode === 'gamepad' && !phaserGamepadUsed) {
            const browserPad = this._getBrowserGamepadFallback();
            if (browserPad) {
                const axes = this._readBrowserGamepadAxes(browserPad);
                if (Math.abs(axes.x) > 0.12) vx = axes.x;
                if (Math.abs(axes.y) > 0.12) vy = axes.y;
                gamepadShootHeld = this._browserGamepadActionDown('shoot', browserPad);
                browserGamepadEdges = this._pollBrowserGamepadActionEdges(['recruit', 'eat', 'charge', 'shoot'], browserPad);
            } else {
                const nativeSteam = this._pollNativeSteamActionEdges(['recruit', 'eat', 'charge', 'shoot'], 'gameplay');
                const nativeState = nativeSteam.state;
                if (nativeState) {
                    const axes = this._readNativeSteamAxes(nativeState, 'move');
                    if (Math.abs(axes.x) > 0.12) vx = axes.x;
                    if (Math.abs(axes.y) > 0.12) vy = axes.y;
                    gamepadShootHeld = this._nativeSteamActionDown('shoot', nativeState);
                    browserGamepadEdges = nativeSteam.edges || {};
                }
            }
        }

        if (vx !== 0 || vy !== 0) {
            const mag = Math.sqrt(vx * vx + vy * vy);
            this.playerAimAngle = Math.atan2(vy, vx);

            if (this.player.setRotation) this.player.setRotation(0);
            else this.player.rotation = 0;

            if (Math.abs(vx) > 0.05) {
                this._flipPlayerVisual(vx > 0);
            }

            let moveSpeed = CONFIG.PLAYER_SPEED * this.player.speedMultiplier;
            if (this.player._webSlowTimer > 0) moveSpeed *= 0.3;
            this.player.body.setVelocity((vx / mag) * moveSpeed, (vy / mag) * moveSpeed);
        } else {
            this.player.body.setVelocity(0, 0);
        }

        if (this._keyboardActionJustPressed('recruit') || browserGamepadEdges.recruit) this.handleRecruit();
        if (this._keyboardActionJustPressed('eat') || browserGamepadEdges.eat) this.handleEat();
        if (this._keyboardActionJustPressed('charge') || browserGamepadEdges.charge) this.handleCharge();
        const now = this.time.now;
        const shootIsDown = this._keyboardActionDown('shoot') || this._shootHeld || gamepadShootHeld;
        if (this.rifleAmmo > 0) {
            if (shootIsDown) {
                this.handleShoot(now);
            }
        } else {
            if (this._keyboardActionJustPressed('shoot') || browserGamepadEdges.shoot || this._shootHeld) {
                this.handleShoot(now);
                this._shootHeld = false;
            }
        }

        this.player.update(time);
        this._updateShootButtonVisual();
        this._updateHeldWeaponPosition();
        if (this.player._webSlowTimer > 0) {
            this.player._webSlowTimer -= delta;
        }
        if (!this._isSpawnProtected()) {
            this.enemies.forEach(e => { if (e.active) e.update(time, delta); });
        }

        if (this.boss && this.boss.active && !this.boss.isDead && this.boss.scene) {
            this.boss.update(time, delta);
        }
        if (this.boss && this.boss.active && !this.boss.isDead && this.boss.scene) {
            this.boss.checkContactDamage(time);
        }

        if (this._larvae && this._larvae.length > 0) {
            for (let i = this._larvae.length - 1; i >= 0; i--) {
                const l = this._larvae[i];
                if (!l || !l.active || l._dead) {
                    this._larvae.splice(i, 1);
                    continue;
                }
                if (l._tick) l._tick(time, delta);
            }
        }

        if (!this._isSpawnProtected()) {
            this.updateCombat(time);
        }
        this.updateHealing(delta);

        let playerTerritories = 0;
        let nearestPlayerTurf = null;
        let nearestUnclaimedTurf = null;
        let minPlayerDist = Infinity;
        let minUnclaimedDist = Infinity;

        this.territories.forEach(t => {
            t.update(time, delta);
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y);
            if (t.faction === CONFIG.FACTIONS.PLAYER) {
                playerTerritories++;
                if (d < minPlayerDist) { minPlayerDist = d; nearestPlayerTurf = t; }
            } else if (t.faction === CONFIG.FACTIONS.NEUTRAL) {
                if (d < minUnclaimedDist) { minUnclaimedDist = d; nearestUnclaimedTurf = t; }
            }
        });

        this.updateCompass(nearestPlayerTurf, nearestUnclaimedTurf);
        this._prunePlayerFollowers();
        this.updateHUD(playerTerritories);
        this.checkNearbyUnits();
        this.updateArmyAggro();
        this._updateMinimap();
        this._updateBossWarning(playerTerritories);
        this._updateSpawnProtectionUI();
        this._trackHostileStats();
        this._checkGangWipeouts();

        if (this.rifleAmmo > 0) {
            this.shootBtn.button.setVisible(true);
            if (this.shootBtn.text) {
                this.shootBtn.text.setVisible(true);
                this.shootBtn.text.setText(`RIFLE (${this.rifleAmmo})`);
            }
        } else if (this.pistolAmmo > 0) {
            this.shootBtn.button.setVisible(true);
            if (this.shootBtn.text) {
                this.shootBtn.text.setVisible(true);
                this.shootBtn.text.setText(`SHOOT (${this.pistolAmmo})`);
            }
        } else {
            this.shootBtn.button.setVisible(false);
            if (this.shootBtn.text) this.shootBtn.text.setVisible(false);
        }

        this._updateShootButtonVisual();
        const hasGunAmmo = (this.pistolAmmo || 0) > 0 || (this.rifleAmmo || 0) > 0;
// CHIGGAS_STEAM_PASS_52C_FIRST_WEAPON_PICKUP_GAME_EVENT_REPAIR_BEGIN
        if (hasGunAmmo && !this.__chiggasSteamFirstWeaponPickup52CSeen) {
            this.__chiggasSteamFirstWeaponPickup52CSeen = true;
            try {
                if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
                    const detail = {
                        achievement: 'FIRST_WEAPON_PICKUP',
                        hasGunAmmo,
                        pistolAmmo: this.pistolAmmo || 0,
                        rifleAmmo: this.rifleAmmo || 0,
                        metadata: {
                            source: 'GameScene_hasGunAmmo_visibility_transition',
                            scene: 'GameScene',
                            event: 'first_weapon_pickup_shoot_button_visible',
                            reason: 'shoot_button_visible_has_gun_ammo',
                            hasGunAmmo,
                            pistolAmmo: this.pistolAmmo || 0,
                            rifleAmmo: this.rifleAmmo || 0,
                            storeShouldShow: 'TEST BUY',
                            pass: 'steam_desktop_wrapper_pass_52c',
                            hook: 'shoot_button_visible_has_gun_ammo_52c'
                        }
                    };
                    window.dispatchEvent(new window.CustomEvent('chiggas-steam-achievement-unlock-request', { detail }));
                    window.dispatchEvent(new window.CustomEvent('chiggas:first-weapon-pickup', { detail }));
                }
            } catch (error) {
                try { console.warn('[Chiggas Steam] Pass 52C FIRST_WEAPON_PICKUP dispatch failed', error); } catch (_) {}
            }
        }
// CHIGGAS_STEAM_PASS_52C_FIRST_WEAPON_PICKUP_GAME_EVENT_REPAIR_END
        // CHIGGAS_STEAM_PASS_52A_FIRST_WEAPON_PICKUP_SHOOT_BUTTON_EVENT_BEGIN
        if (hasGunAmmo && !this.__chiggasSteamFirstWeaponPickupAchievementSent) {
            this.__chiggasSteamFirstWeaponPickupAchievementSent = true;
            try {
                if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
                    window.dispatchEvent(new window.CustomEvent('chiggas-steam-achievement-unlock-request', {
                        detail: {
                            achievement: 'FIRST_WEAPON_PICKUP',
                            hasGunAmmo,
                            pistolAmmo: this.pistolAmmo || 0,
                            rifleAmmo: this.rifleAmmo || 0,
                            metadata: {
                                pass: 'steam_desktop_wrapper_pass_52a',
                                source: 'GameScene_hasGunAmmo_visibility_transition',
                                hook: 'shoot_button_visible_has_gun_ammo'
                            }
                        }
                    }));
                }
            } catch (error) {
                try { console.warn('[Chiggas Steam] FIRST_WEAPON_PICKUP dispatch failed', error); } catch (_) {}
            }
        }
        // CHIGGAS_STEAM_PASS_52A_FIRST_WEAPON_PICKUP_SHOOT_BUTTON_EVENT_END
        this.shootBtn.button.setVisible(hasGunAmmo);
        if (this.shootBtn.text) this.shootBtn.text.setVisible(hasGunAmmo);
        if (this._shootBtnIcon) this._shootBtnIcon.setVisible(hasGunAmmo);
const canCharge = this.player.followers.length > 0;
        this.chargeBtn.button.setVisible(canCharge);
        if (this.chargeBtn.text) this.chargeBtn.text.setVisible(canCharge);
        this._syncMobileActionButtonEffects?.();

        if (this.bullets) {
            const bulletsToDestroy = [];
            const targetsToDamage = [];

            this.bullets.children.each(b => {
                if (!b || !b.active) return;
                if (time > b._lifetime) {
                    bulletsToDestroy.push(b);
                    return;
                }

                if (b._vx !== undefined && b._vy !== undefined) {
                    b.x += (b._vx * delta) / 1000;
                    b.y += (b._vy * delta) / 1000;
                }
                
                let hit = false;
                const checkHit = (target) => {
                    if (hit || !target || !target.active || target.isDead) return;
                    if (Phaser.Math.Distance.Between(b.x, b.y, target.x, target.y) < 40) {
                        hit = true;
                        const isBossTarget = target === this.boss;
                        targetsToDamage.push({
                            target,
                            damage: isBossTarget ? (b._bossDamage ?? 75) : (b._damage ?? 9999),
                            isBossTarget,
                            weaponType: b._weaponType || 'pistol'
                        });
                    }
                };
                
                this.enemies.forEach(e => {
                    if (e && e.active) checkHit(e);
                });
                if (this.units && this.units.children) {
                    this.units.children.each(u => {
                        if (u && u.active && u.faction !== CONFIG.FACTIONS.PLAYER && u.faction !== CONFIG.FACTIONS.NEUTRAL) checkHit(u);
                    });
                }
                if (this.boss && this.boss.active && !this.boss.isDead) checkHit(this.boss);
                
                if (hit) bulletsToDestroy.push(b);
            });

            targetsToDamage.forEach(hitInfo => {
                const target = hitInfo?.target || hitInfo;
                const bulletDamage = hitInfo?.damage ?? 9999;
                if (target && target.active && !target.isDead) {
                    target.takeDamage(bulletDamage, this.player);

                    if (hitInfo?.isBossTarget) {
                        const color = hitInfo.weaponType === 'rifle' ? 0xff1744 : 0xffffff;
                        this.createImpactEffect(target.x, target.y, color, 'punch', bulletDamage, false);

                        // Boss damage is intentionally reduced so guns help without deleting boss fights.
                        if (this.time.now - (this._lastBossGunDamageText || 0) > 450) {
                            this._lastBossGunDamageText = this.time.now;
                            this.showFeedback(`-${Math.round(bulletDamage)}`, color, target.x, target.y - 90);
                        }
                    } else {
                        this.createImpactEffect(target.x, target.y, 0xffffff, 'punch', bulletDamage, false);
                    }
                }
            });
            bulletsToDestroy.forEach(b => {
                if (b && b.active) b.destroy();
            });
        }

        if (this.hazards && this.hazards.children) {
            this.hazards.children.iterate(h => {
                if (!h || !h.active) return;
                if (Phaser.Math.Distance.Between(this.player.x, this.player.y, h.x, h.y) < h.body.radius) {
                    this.player._webSlowTimer = 100;
                }
            });
        }

        this._updatePimpleTraps();

        if (playerTerritories > this._maxTurfsEverHeld) {
            this._maxTurfsEverHeld = playerTerritories;
        }

        if (!this.bossPhaseActive && !this.bossDefeated && !this.isEnding && !this._bossCountdownStarted && this.territories.length > 0) {
            const allCurrentlyHeld = playerTerritories === this.territories.length;
            const wasEverFullyHeld = this._maxTurfsEverHeld >= this.territories.length;
            if (allCurrentlyHeld || wasEverFullyHeld) {
                const delayMs = this.stageIndex === 5 ? 60000 : 30000;
                console.log(`[STAGE] Boss countdown! stage=${this.stageIndex + 1} held=${playerTerritories}/${this.territories.length} maxEver=${this._maxTurfsEverHeld} delay=${delayMs}`);
                this._startBossCountdown(delayMs, 'All required turfs claimed');
            }
        }

        this._updateEnemyRaids(delta);
    }


    _updatePimpleTraps() {
        if (!this.pimples || !this.player || this.isEnding || this.isDead) return;

        const candidates = [this.player];

        this.player.followers?.forEach(follower => {
            if (follower && follower.active && !follower.isDead) candidates.push(follower);
        });

        for (let i = this.pimples.length - 1; i >= 0; i--) {
            const p = this.pimples[i];
            if (!p || !p.active) continue;

            let victim = null;
            for (const candidate of candidates) {
                if (!candidate || !candidate.active || candidate.isDead) continue;
                const radius = (p.triggerRadius || p.radius || 50);
                if (Phaser.Math.Distance.Between(candidate.x, candidate.y, p.x, p.y) < radius) {
                    victim = candidate;
                    break;
                }
            }

            if (!victim) continue;

            const isPlayer = victim === this.player;
            const dmg = isPlayer
                ? 45
                : Math.max(32, Math.ceil((victim.maxHealth || victim.health || 60) * 0.55));
            this._detonatePimple(p, victim, dmg, isPlayer);

            this.pimples.splice(i, 1);
        }
    }

    _detonatePimple(pimple, victim, damage, isPlayer = false) {
        if (!pimple || !pimple.active) return;

        pimple.active = false;
        if (pimple.glow) pimple.glow.destroy();

        this._spawnGooPuddle(pimple.x, pimple.y, pimple.radius || 50);

        const splat = this.add.circle(pimple.x, pimple.y, (pimple.radius || 50) * 2.2, 0x88ff00, 0.78).setDepth(400);
        this.tweens.add({
            targets: splat,
            scale: 2.4,
            alpha: 0,
            duration: 520,
            onComplete: () => splat.destroy()
        });

        playHit(1);

        if (victim && victim.active && !victim.isDead) {
            victim.takeDamage?.(damage, pimple);
            this.createImpactEffect(victim.x, victim.y, 0x88ff00, 'punch', damage, isPlayer);
        }

        if (this.showFeedback) {
            this.showFeedback(isPlayer ? 'PIMPLE BURST!' : 'SOLDIER POPPED!', 0x88ff00, pimple.x, pimple.y - 70);
        }

        if (this.cameras?.main) {
            this.cameras.main.shake(isPlayer ? 140 : 90, isPlayer ? 0.012 : 0.007);
        }

        pimple.destroy();
    }


    _spawnGooPuddle(x, y, radius = 50) {
        const goo = this.add.graphics().setDepth(180);

        const blobCount = 7;
        for (let i = 0; i < blobCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * radius * 0.75;
            const bx = Math.cos(angle) * dist;
            const by = Math.sin(angle) * dist;
            const size = radius * (0.28 + Math.random() * 0.38);

            goo.fillStyle(i % 2 === 0 ? 0x66ff22 : 0x1fd655, 0.48 + Math.random() * 0.18);
            goo.fillEllipse(x + bx, y + by, size * 1.35, size);
        }

        goo.fillStyle(0xd6ff66, 0.36);
        goo.fillCircle(x - radius * 0.18, y - radius * 0.12, radius * 0.22);

        goo.lineStyle(2, 0x99ff44, 0.45);
        goo.strokeCircle(x, y, radius * 0.8);

        this.tweens.add({
            targets: goo,
            alpha: 0,
            duration: 3800,
            delay: 1200,
            ease: 'Sine.easeInOut',
            onComplete: () => goo.destroy()
        });

        return goo;
    }

    _positionSpawnProtectionUI() {
        if (!this._spawnGraceText) return;

        const safe = getSafeBounds(this, 10);
        const small = this._isMobileHUDLayout(this.scale.width, this.scale.height);
        const y = small ? safe.top + 30 : safe.top + 72;

        this._spawnGraceText.setPosition(safe.centerX, y);
        this._spawnGraceText.setDepth(9002);
        this.children?.bringToTop?.(this._spawnGraceText);
    }

    _updateSpawnProtectionUI(forceVisible = false) {
        const isProtected = this._isSpawnProtected();
        if (!isProtected && !forceVisible) {
            if (this._spawnGraceText) {
                this._spawnGraceText.destroy();
                this._spawnGraceText = null;
            }
            return;
        }

        if (!isProtected) return;

        const remainingMs = Math.max(0, this.spawnGraceUntil - this._getSpawnProtectionClockNow());
        const remaining = Math.max(0, Math.ceil(remainingMs / 1000));

        if (!this._spawnGraceText) {
            this._spawnGraceText = this.add.text(0, 0, '', {
                fontSize: this._isMobileHUDLayout(this.scale.width, this.scale.height) ? '20px' : '22px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#00ffff',
                stroke: '#001111',
                strokeThickness: 6,
                shadow: { offsetX: 2, offsetY: 3, color: '#000000', blur: 5, fill: true, stroke: true },
                backgroundColor: '#000000cc',
                padding: { x: 14, y: 5 }
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(9002);
        }

        this._spawnGraceText.setVisible(true).setAlpha(1);
        this._spawnGraceText.setText(`SAFE START: ${remaining}s`);
        this._positionSpawnProtectionUI();
    }

    _updateEnemyRaids(delta) {
        if (this.isEnding || this.isDead || this._isSpawnProtected()) return;
        if (this.bossPhaseActive || this.bossDefeated) return;
        this._raidTimer += delta;

        this._tickActiveRaids(delta);

        if (this._raidTimer < this._raidInterval) return;

        this._raidTimer = 0;
        this._raidInterval = this._randomRange(
            this.difficultySettings.raidMin,
            this.difficultySettings.raidMax
        );

        const eligible = this.enemies.filter(e => e.active && e.followers.length >= 3);
        if (eligible.length === 0) return;

        const raider = eligible[Math.floor(Math.random() * eligible.length)];

        let bestTurf  = null;
        let bestScore = Infinity;

        this.territories.forEach(t => {
            if (t.faction === raider.faction) return;

            const defenderCount = this.units.children.entries.filter(u =>
                u && u.active &&
                (u.faction === t.faction || u.faction === CONFIG.FACTIONS.PLAYER) &&
                Phaser.Math.Distance.Between(t.x, t.y, u.x, u.y) < t.radius
            ).length;

            let playerDefs = 0;
            if (t.faction === CONFIG.FACTIONS.PLAYER) {
                playerDefs = this.player.followers.filter(pf =>
                    pf && pf.active &&
                    Phaser.Math.Distance.Between(t.x, t.y, pf.x, pf.y) < t.radius
                ).length;
            }

            const totalDefs  = defenderCount + playerDefs;
            const distToTurf = Phaser.Math.Distance.Between(raider.x, raider.y, t.x, t.y);
            const score = totalDefs * 1000 + distToTurf * 0.1;
            if (score < bestScore) { bestScore = score; bestTurf = t; }
        });

        if (!bestTurf) return;

        const maxRaiders = this.difficultySettings?.maxRaiders ?? 3;
        const sendCount = Math.min(maxRaiders, Math.min(
            Math.floor(raider.followers.length / 2),
            1 + Math.floor(Math.random() * maxRaiders)
        ));
        if (sendCount <= 0) return;

        const raidSquad = raider.followers.slice(0, sendCount);
        raidSquad.forEach(u => {
            if (!u || !u.active) return;
            u._raidTarget = bestTurf;
            u._raidExpiry = this.time.now + 15000;
            u.body.setImmovable(false);
        });

        this.showFeedback(
            `RAID! ${raider.faction.toUpperCase()} → ${bestTurf.faction.toUpperCase()} TURF`,
            raider.faction === CONFIG.FACTIONS.BLUE ? 0x4488ff : 0x44ff44,
            raider.x, raider.y - 80
        );
    }

    _tickActiveRaids() {
        const now = this.time.now;
        const marchSpeed = CONFIG.CHIGGA_SPEED * 0.9 * (this.difficultySettings?.raidMarchSpeedMultiplier ?? 1);

        this.units.children.iterate(unit => {
            if (!unit || !unit.active || !unit._raidTarget) return;

            if (now > unit._raidExpiry) {
                unit._raidTarget = null;
                unit._raidExpiry = 0;
                return;
            }

            const t = unit._raidTarget;
            if (!t || t.faction === unit.faction) {
                unit._raidTarget = null;
                return;
            }

            const dx = t.x - unit.x;
            const dy = t.y - unit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > t.radius * 0.6) {
                const ang = Math.atan2(dy, dx);
                unit.body.setVelocity(Math.cos(ang) * marchSpeed, Math.sin(ang) * marchSpeed);
            } else {
                unit.body.setVelocity(0, 0);
            }
        });
    }

    updateHealing(delta) {
        this.player.followers.forEach(pf => {
            if (!pf || !pf.active || pf.isDead || pf.health >= pf.maxHealth) return;
            let inTurf = false;
            for (const t of this.territories) {
                if (t.faction === CONFIG.FACTIONS.PLAYER && Phaser.Math.Distance.Between(pf.x, pf.y, t.x, t.y) < t.radius) {
                    inTurf = true;
                    break;
                }
            }
            if (inTurf) {
                pf.heal(delta * 0.02);
            }
        });
    }

    updateHUD(playerTerritories) {
        const maxArmy = this.player.getMaxArmySize();
        const progress = this.player.getArmyLevelProgress ? this.player.getArmyLevelProgress() : {
            level: 1,
            xp: 0,
            required: 3,
            pct: 0
        };

        this.armyText.setText(`Army Lv.${progress.level}: ${this.player.followers.length}/${maxArmy}`);
        this.strText.setText(`STR: ${this.player.getSTR()}`);
        this.territoryText.setText(`Turf: ${playerTerritories}/${this.territories.length}`);
        this._updateArmyLevelBar(progress);
        // CHIGGAS_STEAM_PASS_58A_FIRST_CHIGGA_SOLDIER_RECRUITED_GAME_BEGIN
        try {
            const __chiggasFollowers = (this.player && Array.isArray(this.player.followers)) ? this.player.followers : [];
            const __chiggasArmySize = __chiggasFollowers.filter(f => f && f.active && !f.isDead).length;
            const __chiggasHadLastArmySize = typeof this.__chiggasSteamPass58aLastArmySize === 'number';
            const __chiggasPreviousArmySize = __chiggasHadLastArmySize ? this.__chiggasSteamPass58aLastArmySize : __chiggasArmySize;

            if (!this.__chiggasSteamFirstSoldierRecruitedSent && __chiggasHadLastArmySize && __chiggasArmySize > __chiggasPreviousArmySize && typeof window !== 'undefined' && window.dispatchEvent) {
                this.__chiggasSteamFirstSoldierRecruitedSent = true;
                const __chiggasSoldierRecruitMetadata = {
                    source: 'GameScene_army_size_increase_updateHUD',
                    scene: 'GameScene',
                    event: 'first_chigga_soldier_recruited_army_size_increase',
                    reason: 'active_player_followers_count_increased',
                    previousArmySize: __chiggasPreviousArmySize,
                    armySize: __chiggasArmySize,
                    storeShouldShow: 'TEST BUY',
                    pass: 'steam_desktop_wrapper_pass_58a',
                    hook: 'army_size_increase_updateHUD_58a'
                };
                window.dispatchEvent(new CustomEvent('chiggas-steam-achievement-unlock-request', {
                    detail: {
                        achievement: 'FIRST_CHIGGA_SOLDIER_RECRUITED',
                        metadata: __chiggasSoldierRecruitMetadata
                    }
                }));
            }

            this.__chiggasSteamPass58aLastArmySize = __chiggasArmySize;
        } catch (_) {}
        // CHIGGAS_STEAM_PASS_58A_FIRST_CHIGGA_SOLDIER_RECRUITED_GAME_END
        // CHIGGAS_STEAM_PASS_57_FIRST_MUNCH_COUNTER_GAME_BEGIN
        try {
            const __chiggasMunchProgress = progress || {};
            const __chiggasMunchXp = Number(__chiggasMunchProgress.xp || 0);
            const __chiggasMunchRequired = Number(__chiggasMunchProgress.required || 0);
            const __chiggasMunchLevel = Number(__chiggasMunchProgress.level || 0);
            const __chiggasHadLastMunch = typeof this.__chiggasSteamPass57LastMunchXp === 'number';

            const __chiggasMunchProgressAdvanced =
                (__chiggasHadLastMunch && __chiggasMunchXp > this.__chiggasSteamPass57LastMunchXp) ||
                (__chiggasHadLastMunch && __chiggasMunchLevel > (this.__chiggasSteamPass57LastMunchLevel || 0)) ||
                (!__chiggasHadLastMunch && __chiggasMunchXp > 0);

            if (!this.__chiggasSteamFirstMunchSent && __chiggasMunchProgressAdvanced && typeof window !== 'undefined' && window.dispatchEvent) {
                this.__chiggasSteamFirstMunchSent = true;
                window.dispatchEvent(new CustomEvent('chiggas-steam-achievement-unlock-request', {
                    detail: {
                        achievement: 'FIRST_MUNCH',
                        metadata: {
                            source: 'GameScene_army_level_eat_counter_progress',
                            scene: 'GameScene',
                            event: 'first_munch_eat_counter_progress',
                            reason: 'army_level_eat_counter_progress_advanced',
                            xp: __chiggasMunchXp,
                            required: __chiggasMunchRequired,
                            level: __chiggasMunchLevel,
                            storeShouldShow: 'TEST BUY',
                            pass: 'steam_desktop_wrapper_pass_57',
                            hook: 'army_level_eat_counter_progress_57'
                        }
                    }
                }));
            }

            this.__chiggasSteamPass57LastMunchXp = __chiggasMunchXp;
            this.__chiggasSteamPass57LastMunchLevel = __chiggasMunchLevel;
        } catch (_) {}
        // CHIGGAS_STEAM_PASS_57_FIRST_MUNCH_COUNTER_GAME_END

        if (!this.isEnding && !this.isDead) {
            this.elapsedTime = Math.floor((this.time.now - this.startTime) / 1000);

            // CHIGGAS STEAM ACHIEVEMENT PASS 75 FIVE_MINUTE_RUN BEGIN
            try {
                const __chiggasElapsed = Number(this.elapsedTime || 0);
                const __chiggasDead = Boolean(this.isDead);
                if (!this.__chiggasSteamFiveMinuteRunSent && !__chiggasDead && __chiggasElapsed >= 300 && typeof window !== 'undefined' && window.dispatchEvent) {
                    this.__chiggasSteamFiveMinuteRunSent = true;
                    const detail = {
                        achievement: 'FIVE_MINUTE_RUN',
                        source: 'GameScene_elapsedTime_five_minute_run',
                        scene: 'GameScene',
                        event: 'five_minute_run_elapsed_time_threshold',
                        reason: 'elapsedTime_reached_300_seconds',
                        elapsedTime: __chiggasElapsed,
                        threshold: 300,
                        isDead: __chiggasDead,
                        stageIndex: this.stageIndex ?? null,
                        storeShouldShow: 'TEST BUY',
                        pass: 'steam_desktop_wrapper_pass_75',
                        hook: 'elapsed_time_300_seconds_75'
                    };
                    window.dispatchEvent(new CustomEvent('chiggas-steam-achievement-unlock-request', { detail }));
                    window.dispatchEvent(new CustomEvent('chiggas-steam-pass-75-five-minute-run', { detail }));
                }
            } catch (_) {}
            // CHIGGAS STEAM ACHIEVEMENT PASS 75 FIVE_MINUTE_RUN END
        // CHIGGAS_STEAM_PASS_63A_FIRST_SURVIVAL_MINUTE_GAME_BEGIN
        try {
            const __chiggasElapsedTime = Number(this.elapsedTime || 0);
            if (!this.__chiggasSteamFirstSurvivalMinuteSent && !this.isEnding && !this.isDead && __chiggasElapsedTime >= 60 && typeof window !== 'undefined' && window.dispatchEvent) {
                this.__chiggasSteamFirstSurvivalMinuteSent = true;
                window.dispatchEvent(new CustomEvent('chiggas-steam-pass-63a-first-survival-minute', {
                    detail: {
                        achievement: 'FIRST_SURVIVAL_MINUTE',
                        elapsedTime: __chiggasElapsedTime,
                        metadata: {
                            source: 'GameScene_elapsedTime_threshold',
                            scene: 'GameScene',
                            event: 'first_survival_minute_elapsed_time',
                            reason: 'elapsedTime_reached_60_seconds',
                            elapsedTime: __chiggasElapsedTime,
                            threshold: 60,
                            storeShouldShow: 'TEST BUY',
                            pass: 'steam_desktop_wrapper_pass_63a',
                            hook: 'elapsedTime_threshold_63a'
                        }
                    }
                }));
            }
        } catch (_) {}
        // CHIGGAS_STEAM_PASS_63A_FIRST_SURVIVAL_MINUTE_GAME_END

        
        }
        const mins = Math.floor(this.elapsedTime / 60);
        const secs = this.elapsedTime % 60;
        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

        if (!this.scoreText) {
            const uiStyle = { fontSize: '24px', fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif', color: '#ffffff', stroke: '#000000', strokeThickness: 4 };
            this.scoreText = this.add.text(0, 0, '', uiStyle).setOrigin(1, 0).setScrollFactor(0).setDepth(2000);
            this.timeText = this.add.text(0, 0, '', uiStyle).setOrigin(1, 0).setScrollFactor(0).setDepth(2000);
        }

        const safe = getSafeBounds(this, 10);
        this.scoreText.setPosition(safe.right - 10, safe.top + 44);
        this.timeText.setPosition(safe.right - 10, safe.top + 74);
        this.scoreText.setText(`Score: ${this.score}`);
        this.timeText.setText(`Time: ${timeStr}`);
    }

    _updateArmyLevelBar(progress) {
        if (!this.armyXpBarBg || !this.armyXpBarFill) return;

        const small = this.scale.width < 900 || this.scale.height < 650;
        const x = small ? 152 : 200;
        const y = small ? 40 : 46;
        const w = small ? 126 : 158;
        const h = 10;
        const pct = Phaser.Math.Clamp(progress?.pct ?? 0, 0, 1);
        const maxed = this.player.getMaxArmySize && this.player.getMaxArmySize() >= CONFIG.MAX_ARMY_LIMIT;

        this.armyXpBarBg.clear();
        this.armyXpBarBg.fillStyle(0x000000, 0.72);
        this.armyXpBarBg.fillRoundedRect(x, y, w, h, 5);
        this.armyXpBarBg.lineStyle(2, maxed ? 0xffdd00 : 0xffffff, 0.78);
        this.armyXpBarBg.strokeRoundedRect(x, y, w, h, 5);

        this.armyXpBarFill.clear();
        this.armyXpBarFill.fillStyle(maxed ? 0xffdd00 : 0x39ff14, 0.96);
        this.armyXpBarFill.fillRoundedRect(x + 2, y + 2, Math.max(0, (w - 4) * pct), h - 4, 4);

        if (this.armyXpText) {
            this.armyXpText.setText(maxed ? 'MAX ARMY' : `Eat: ${progress.xp}/${progress.required}`);
            this.armyXpText.setPosition(x + w + 8, y - 8);
            this.armyXpText.setColor(maxed ? '#ffdd00' : '#39ff14');
        }
    }

    addScore(points, x, y) {
        this.score += points;
        if (x && y) {
            const fx = this.add.text(x, y - 40, (points > 0 ? '+' : '') + points, {
                fontSize: '22px', fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif', color: points > 0 ? '#ffff00' : '#ff0000', stroke: '#000000', strokeThickness: 3
            }).setOrigin(0.5).setDepth(3000);
            this.tweens.add({ targets: fx, y: fx.y - 40, alpha: 0, duration: 800, onComplete: () => fx.destroy() });
        }
    }

    _normalizeLooseHostileUnitCombatState(unit) {
        if (!unit || !unit.active || unit.isDead) return;
        if (!this._isHostileGangOrWildFaction(unit.faction)) return;

        if (!Number.isFinite(unit.maxHealth) || unit.maxHealth <= 0) {
            unit.maxHealth = unit.faction === CONFIG.FACTIONS.PURPLE ? 63 : 50;
        }

        if (!Number.isFinite(unit.health) || unit.health <= 0) {
            unit.health = unit.maxHealth;
        }

        if (!Number.isFinite(unit.baseDamage) || unit.baseDamage <= 0) {
            unit.baseDamage = unit.faction === CONFIG.FACTIONS.PURPLE ? 10 : 8;
        }

        if (unit.body) {
            unit.body.enable = true;
            unit.body.setImmovable(false);
        }
    }

    updateCombat(time) {
        const now = time;
        const CONTACT_COOLDOWN = 700;

        const canDamage = (idA, idB) => {
            const key = `${idA}_${idB}`;
            const last = this._contactCooldowns.get(key) || 0;
            if (now - last >= CONTACT_COOLDOWN) {
                this._contactCooldowns.set(key, now);
                return true;
            }
            return false;
        };

        const str = this.player.getSTR();
        const PLAYER_DMG_MULT = 1 + (str - 1) * 0.15;

        this.enemies.forEach(enemy => {
            if (!enemy.active || !enemy.scene) return;

            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            if (dist < 55 && canDamage(`ec_${enemy.faction}`, 'player')) {
                this.player.takeDamage(8, enemy);
                this.createImpactEffect(enemy.x, enemy.y, 0xff4400, 'punch', 8, true);
            }

            enemy.followers.forEach((ef, i) => {
                if (!ef || !ef.active) return;
                const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, ef.x, ef.y);
                if (d < 45 && canDamage(`ef_${enemy.faction}_${i}`, 'player')) {
                    this.player.takeDamage(5, ef);
                    this.createImpactEffect(ef.x, ef.y, 0xff4400, 'punch', 5, true);
                }
            });

            enemy.followers.forEach((ef, ei) => {
                if (!ef || !ef.active) return;
                this.player.followers.forEach((pf, pi) => {
                    if (!pf || !pf.active) return;
                    const d = Phaser.Math.Distance.Between(pf.x, pf.y, ef.x, ef.y);
                    if (d < 45 && canDamage(`ef_${enemy.faction}_${ei}`, `pf_${pi}`)) {
                        const efDmg = Math.round(8 * PLAYER_DMG_MULT);
                        ef.takeDamage(efDmg, pf);
                        pf.takeDamage(10, ef);
                        this.createImpactEffect((pf.x + ef.x) / 2, (pf.y + ef.y) / 2, 0xffff00, 'punch', efDmg, false);
                    }
                });
            });

            this.player.followers.forEach((pf, pi) => {
                if (!pf || !pf.active) return;
                const d = Phaser.Math.Distance.Between(pf.x, pf.y, enemy.x, enemy.y);
                if (d < 55 && canDamage(`pf_${pi}`, `ec_${enemy.faction}`)) {
                    const ecDmg = Math.round(10 * PLAYER_DMG_MULT);
                    enemy.takeDamage(ecDmg, pf);
                    pf.takeDamage(8, enemy);
                    this.createImpactEffect(enemy.x, enemy.y, 0xffaa00, 'punch', ecDmg, false);
                }
            });
        });

        this.units.children.iterate(unit => {
            if (!unit || !unit.active) return;
            this._normalizeLooseHostileUnitCombatState(unit);
            if (!this._isHostileGangOrWildFaction(unit.faction)) return;

            const dp = Phaser.Math.Distance.Between(this.player.x, this.player.y, unit.x, unit.y);
            if (dp < 45 && canDamage(`guard_${unit.uid}`, 'player_body')) {
                this.player.takeDamage(6, unit);
                const gDmg = Math.round(8 * PLAYER_DMG_MULT);
                unit.takeDamage(gDmg, this.player);
                this.createImpactEffect(unit.x, unit.y, 0xff4400, unit.faction === CONFIG.FACTIONS.WILD ? 'bite' : 'punch', gDmg, false);
            }

            this.player.followers.forEach((pf, pi) => {
                if (!pf || !pf.active) return;
                const df = Phaser.Math.Distance.Between(pf.x, pf.y, unit.x, unit.y);
                if (df < 45 && canDamage(`guard_${unit.uid}`, `pf_${pi}`)) {
                    pf.takeDamage(10, unit);
                    const gDmg2 = Math.round(12 * PLAYER_DMG_MULT);
                    unit.takeDamage(gDmg2, pf);
                    this.createImpactEffect((pf.x + unit.x) / 2, (pf.y + unit.y) / 2, 0xffaa00, unit.faction === CONFIG.FACTIONS.WILD ? 'bite' : 'punch', gDmg2, false);
                }
            });
        });

        this.updateLooseEnemies(now);
        this.enemies = this.enemies.filter(e => e && e.active);
    }

    updateLooseEnemies(now) {
        const GUARD_AGGRO_RANGE = 300;
        const GUARD_ATTACK_RANGE = 45;
        const GUARD_COOLDOWN = 800;
        const PLAYER_DMG_MULT = 1 + (this.player.getSTR() - 1) * 0.15;

        this.units.children.iterate(unit => {
            if (!unit || !unit.active) return;
            this._normalizeLooseHostileUnitCombatState(unit);
            if (unit.faction === CONFIG.FACTIONS.NEUTRAL) return;
            if (unit.faction === CONFIG.FACTIONS.PLAYER && unit.isRecruited) return;

            let closestThreat = null;
            let closestDist = GUARD_AGGRO_RANGE;

            const checkThreat = (threat) => {
                if (!threat || !threat.active || threat.isDead) return;
                const d = Phaser.Math.Distance.Between(unit.x, unit.y, threat.x, threat.y);
                if (d < closestDist) {
                    closestDist = d;
                    closestThreat = threat;
                }
            };

            if (unit.faction === CONFIG.FACTIONS.PLAYER) {
                this.enemies.forEach(checkThreat);
                this.units.children.iterate(other => {
                    if (other !== unit && other.active && !other.isDead && this._isHostileGangOrWildFaction(other.faction)) {
                        checkThreat(other);
                    }
                });
                if (this.boss && this.boss.active && !this.boss.isDead) checkThreat(this.boss);
            } else {
                this.player.followers.forEach(checkThreat);
                checkThreat(this.player);
                this.enemies.forEach(e => {
                    if (e.faction !== unit.faction) checkThreat(e);
                });
                this.units.children.iterate(other => {
                    if (other !== unit && other.active && !other.isDead && other.faction !== unit.faction && other.faction !== CONFIG.FACTIONS.NEUTRAL) {
                        checkThreat(other);
                    }
                });
                // Non-player map enemies should not attack Roach Czar.
                // Final-stage ants, gnats, BLUE, and GREEN enemies are hostile to the player,
                // but they are part of the same hostile ecosystem as the final boss.
            }

            if (closestThreat && unit.faction !== CONFIG.FACTIONS.PLAYER && closestThreat.faction === 'BOSS') {
                closestThreat = null;
            }

            if (closestThreat) {
                const angle = Phaser.Math.Angle.Between(unit.x, unit.y, closestThreat.x, closestThreat.y);
                unit.stopFloat();
                unit.body.setImmovable(false);
                let speed = 240;
                if (unit.customWildType === 'ant') speed = 180;
                else if (unit.customWildType === 'gnat') speed = 330;
                unit.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

                if (closestDist < GUARD_ATTACK_RANGE) {
                    const key = `guard_${unit.uid}_threat`;
                    const last = this._contactCooldowns.get(key) || 0;
                    if (now - last >= GUARD_COOLDOWN) {
                        this._contactCooldowns.set(key, now);
                        const dmgMultiplier = unit.faction === CONFIG.FACTIONS.PLAYER ? PLAYER_DMG_MULT : (unit.strMult || 1);
                        const dmg = Math.round(8 * dmgMultiplier);
                        const isWild = unit.faction === CONFIG.FACTIONS.WILD;
                        
                        if (closestThreat === this.player) {
                            this.player.takeDamage(dmg, unit);
                            this.createImpactEffect(this.player.x, this.player.y, 0xff4400, isWild ? 'bite' : 'punch', dmg, true);
                        } else if (closestThreat.takeDamage) {
                            closestThreat.takeDamage(dmg, unit);
                            this.createImpactEffect(closestThreat.x, closestThreat.y, unit.faction === CONFIG.FACTIONS.PLAYER ? 0xffaa00 : 0xff4400, isWild ? 'bite' : 'punch', dmg, false);
                        }
                    }
                }
            } else if (unit.homeTurf && unit.faction !== CONFIG.FACTIONS.WILD) {
                const distToHome = Phaser.Math.Distance.Between(unit.x, unit.y, unit.homeTurf.x, unit.homeTurf.y);
                if (distToHome > unit.homeTurf.radius * 1.5) {
                    const angle = Phaser.Math.Angle.Between(unit.x, unit.y, unit.homeTurf.x, unit.homeTurf.y);
                    unit.stopFloat();
                    unit.body.setImmovable(false);
                    unit.body.setVelocity(Math.cos(angle) * 150, Math.sin(angle) * 150);
                } else {
                    unit.body.setVelocity(0, 0);
                    unit.body.setImmovable(true);
                }
            } else if (unit.faction === CONFIG.FACTIONS.WILD) {
                if (!unit._nextWander || now > unit._nextWander) {
                    unit._nextWander = now + 2000 + Math.random() * 3000;
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 40 + Math.random() * 60;
                    unit.stopFloat();
                    unit.body.setImmovable(false);
                    unit.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
                }
            }
        });
    }

    _prunePlayerFollowers() {
        if (!this.player || !Array.isArray(this.player.followers)) return;

        this.player.followers = this.player.followers.filter(follower => {
            return follower && follower.active && !follower.isDead && follower.scene === this;
        });
    }

    updateArmyAggro() {
        if (!this.player || !this.player.followers) return;

        const AGGRO_RANGE = 260;
        const ATTACK_RANGE = 45;
        const now = this.time.now;

        this.player.followers.forEach((follower, idx) => {
            if (!follower || !follower.active || follower.isDead) return;

            let closestThreat = null;
            let closestDist = AGGRO_RANGE;

            const check = (target) => {
                if (!target || !target.active || target.isDead) return;
                this._normalizeLooseHostileUnitCombatState(target);
                const d = Phaser.Math.Distance.Between(follower.x, follower.y, target.x, target.y);
                if (d < closestDist) {
                    closestDist = d;
                    closestThreat = target;
                }
            };

            this.enemies.forEach(check);
            this.units.children.iterate(u => {
                if (!u || !u.active || u.isDead) return;
                if (this._isHostileGangOrWildFaction(u.faction)) {
                    check(u);
                }
            });

            if (this.boss && this.boss.active && !this.boss.isDead) check(this.boss);
            if (!closestThreat) return;

            const angle = Phaser.Math.Angle.Between(follower.x, follower.y, closestThreat.x, closestThreat.y);
            follower.stopFloat();
            follower.body.setImmovable(false);
            follower.body.setVelocity(Math.cos(angle) * CONFIG.CHIGGA_SPEED * 1.25, Math.sin(angle) * CONFIG.CHIGGA_SPEED * 1.25);

            if (closestDist < ATTACK_RANGE) {
                const key = `army_${idx}_${closestThreat.uid || closestThreat.faction || 'boss'}`;
                const last = this._contactCooldowns.get(key) || 0;
                if (now - last > 700) {
                    this._contactCooldowns.set(key, now);
                    const dmg = 10 + Math.floor(this.player.getSTR() * 2);
                    if (closestThreat.takeDamage) {
                        closestThreat.takeDamage(dmg, follower);
                        this.createImpactEffect(closestThreat.x, closestThreat.y, 0xffdd00, 'punch', dmg, false);
                    }
                }
            }
        });
    }

    checkNearbyUnits() {
        const player = this.player;
        const nearby = [];

        this.units.children.entries.forEach(unit => {
            if (!unit || !unit.active || unit.isRecruited || unit.isDead) return;

            const canInteract =
                unit.faction === CONFIG.FACTIONS.NEUTRAL ||
                (unit.faction === CONFIG.FACTIONS.PLAYER && !unit.isRecruited);

            if (!canInteract) return;

            const dist = Phaser.Math.Distance.Between(player.x, player.y, unit.x, unit.y);
            if (dist < CONFIG.RECRUIT_RANGE) nearby.push(unit);
        });

        const hasNearby = nearby.length > 0;
        this.recruitBtn.button.setVisible(hasNearby);
        this.eatBtn.button.setVisible(hasNearby);
        if (this.recruitBtn.text) this.recruitBtn.text.setVisible(hasNearby);
        if (this.eatBtn.text) this.eatBtn.text.setVisible(hasNearby);
        this.nearbyUnits = nearby;
    }

    handleRecruit() {
        if (!this.nearbyUnits || this.nearbyUnits.length === 0) return;

        if (this.player.canRecruit && !this.player.canRecruit()) {
            this.showFeedback('CREW FULL!', 0xffdd00, this.player.x, this.player.y - 60);
            return;
        }

        const unit = this.nearbyUnits.find(u => u && u.active && !u.isDead);
        if (!unit) return;

        this.player.addFollower(unit);
        this.runStats.recruits += 1;
        playRecruit();
        this.addScore(50, unit.x, unit.y);
        this.showFeedback('+ CREW', 0x00ff00, unit.x, unit.y);
    }

    handleEat() {
        if (!this.nearbyUnits || this.nearbyUnits.length === 0) return;

        const unit = this.nearbyUnits.find(u => u && u.active && !u.isDead);
        if (!unit) return;

        if (this.player.eatFollower) {
            this.player.eatFollower(unit);
            this.addScore(90, this.player.x, this.player.y);
        } else {
            unit.destroy();
            if (this.player.gainStr) this.player.gainStr(1);
            playBite();
            this.addScore(100, this.player.x, this.player.y);
        }

        this.runStats.eaten += 1;
        this.nearbyUnits = this.nearbyUnits.filter(u => u && u.active && u !== unit);
        this.showFeedback('MUNCHED!', 0xff0000, this.player.x, this.player.y);
    }

    handleCharge() {
        if (!this.player || !this.player.followers || this.player.followers.length === 0) return;

        const now = this.time.now;
        const chargeDuration = 650;
        const chargeSpeed = CONFIG.CHIGGA_SPEED * 3.2;

        let angle = this.playerAimAngle ?? 0;

        if (this.player.body && (Math.abs(this.player.body.velocity.x) > 1 || Math.abs(this.player.body.velocity.y) > 1)) {
            angle = Math.atan2(this.player.body.velocity.y, this.player.body.velocity.x);
        }

        const chargeVec = {
            x: Math.cos(angle) * chargeSpeed,
            y: Math.sin(angle) * chargeSpeed
        };

        this.player.followers.forEach((follower, index) => {
            if (!follower || !follower.active || follower.isDead || !follower.body) return;

            follower.stopFloat();
            follower.body.setImmovable(false);
            follower._chargeExpiry = now + chargeDuration + index * 35;
            follower._chargeVec = chargeVec;
        });

        this.showFeedback('CHARGE!', 0xffaa00, this.player.x, this.player.y - 80);
        playChargeCry(1);
    }

    _getEquippedGunType() {
        if ((this.rifleAmmo || 0) > 0) return 'rifle';
        if ((this.pistolAmmo || 0) > 0) return 'pistol';
        return 'none';
    }

    _getGunTextureKey(type = this._getEquippedGunType()) {
        if (type === 'rifle') return 'powerup-rifle';
        if (type === 'pistol') return 'powerup-pistol';
        return null;
    }

    _getHeldWeaponScale(type = this._getEquippedGunType()) {
        return type === 'rifle' ? 0.085 : 0.06;
    }

    _getShootButtonIconScale(type = this._getEquippedGunType()) {
        return type === 'rifle' ? 0.07 : 0.05;
    }

    _updateHeldWeaponVisual() {
        const type = this._getEquippedGunType();
        const textureKey = this._getGunTextureKey(type);

        this._equippedGunType = type;

        if (!textureKey || !this.textures.exists(textureKey)) {
            if (this._heldWeaponSprite) this._heldWeaponSprite.setVisible(false);
            if (this._shootBtnIcon) this._shootBtnIcon.setVisible(false);
            return;
        }

        if (!this._heldWeaponSprite) {
            this._heldWeaponSprite = this.add.image(this.player.x, this.player.y, textureKey)
                .setDepth(1500)
                .setVisible(false);
        }

        this._heldWeaponSprite
            .setTexture(textureKey)
            .setVisible(true)
            .setScale(this._getHeldWeaponScale(type), this._getHeldWeaponScale(type))
            .setFlipX(false);

        if (this.shootBtn?.button && !this._shootBtnIcon) {
            this._shootBtnIcon = this.add.image(this.shootBtn.button.x, this.shootBtn.button.y - 10, textureKey)
                .setScrollFactor(0)
                .setDepth(1002)
                .setVisible(false);
        }

        if (this._shootBtnIcon) {
            this._shootBtnIcon
                .setTexture(textureKey)
                .setVisible(true)
                .setScale(this._getShootButtonIconScale(type), this._getShootButtonIconScale(type))
                .setFlipX(false)
                .setRotation(0)
                .setPosition(this.shootBtn.button.x, this.shootBtn.button.y);
        }
    }

    _updateHeldWeaponPosition() {
        const type = this._getEquippedGunType();
        if (type === 'none') {
            if (this._heldWeaponSprite) this._heldWeaponSprite.setVisible(false);
            if (this._shootBtnIcon) this._shootBtnIcon.setVisible(false);
            return;
        }

        this._updateHeldWeaponVisual();

        if (!this._heldWeaponSprite || !this.player) return;

        const angle = this.playerAimAngle ?? 0;
        const facingLeft = Math.cos(angle) < 0;
        const horizontalDir = facingLeft ? -1 : 1;

        const baseScale = this._getHeldWeaponScale(type);
        const forwardOffset = type === 'rifle' ? 32 : 24;
        const verticalOffset = type === 'rifle' ? 2 : 3;

        const gx = this.player.x + horizontalDir * forwardOffset;
        const gy = this.player.y + verticalOffset;

        this._heldWeaponSprite
            .setPosition(gx, gy)
            .setRotation(0)
            .setFlipX(false)
            .setScale(facingLeft ? -baseScale : baseScale, baseScale)
            .setDepth((this.player.depth || 1000) + 3)
            .setVisible(true);
    }

    _updateShootButtonVisual() {
        if (!this.shootBtn?.button) return;

        const type = this._getEquippedGunType();
        const ammo = type === 'rifle' ? this.rifleAmmo : (type === 'pistol' ? this.pistolAmmo : 0);

        if (this.shootBtn.text) {
            if (type === 'rifle') this.shootBtn.text.setText(`RIFLE ${ammo}`);
            else if (type === 'pistol') this.shootBtn.text.setText(`PISTOL ${ammo}`);
            else this.shootBtn.text.setText('SHOOT');

            this._styleMobileActionButton(this.shootBtn);
        }

        if (type === 'none' && this._shootBtnIcon) {
            this._shootBtnIcon.setVisible(false);
        } else if (type !== 'none' && this._shootBtnIcon) {
            this._shootBtnIcon.setVisible(true);
        }
    }


    handleShoot(now = this.time.now) {
        const usingRifle = (this.rifleAmmo || 0) > 0;

        if (usingRifle) {
            if (now - (this._lastRifleShotTime || 0) < (this._rifleFireDelay || 82)) return;
            this._lastRifleShotTime = now;
            this.rifleAmmo = Math.max(0, (this.rifleAmmo || 0) - 1);

            this._spawnPlayerBullet({
                speed: 1180,
                lifetime: 1500,
                width: 22,
                height: 9,
                damage: 9999,
                bossDamage: 35,
                weaponType: 'rifle',
                feedback: 'RAT-A-TAT!',
                feedbackColor: 0xff1744,
                soundVolume: 0.7,
                spread: Phaser.Math.FloatBetween(-0.035, 0.035)
            });

            this._updateShootButtonVisual();
            this._updateHeldWeaponVisual();

            if (this.rifleAmmo <= 0) {
                this._shootHeld = false;
            }

            return;
        }

        if ((this.pistolAmmo || 0) <= 0) {
            this._updateShootButtonVisual();
            return;
        }

        this.pistolAmmo = Math.max(0, (this.pistolAmmo || 0) - 1);
        this._spawnPlayerBullet({
            speed: 900,
            lifetime: 2000,
            width: 24,
            height: 12,
            damage: 9999,
            bossDamage: 95,
            weaponType: 'pistol',
            feedback: 'BANG!',
            feedbackColor: 0xffffff,
            soundVolume: 1.5,
            spread: 0
        });

        this._updateShootButtonVisual();
        this._updateHeldWeaponVisual();
    }


    _spawnPlayerBullet({ speed = 900, lifetime = 2000, width = 24, height = 12, damage = 9999, bossDamage = 75, weaponType = 'pistol', feedback = 'BANG!', feedbackColor = 0xffffff, soundVolume = 1, spread = 0 } = {}) {
        const angle = (this.playerAimAngle ?? 0) + spread;
        const spawnDistance = 72;
        const bx = this.player.x + Math.cos(angle) * spawnDistance;
        const by = this.player.y + Math.sin(angle) * spawnDistance;

        const bullet = this.physics.add.sprite(bx, by, 'bullet');
        bullet.setDisplaySize(width, height);
        bullet.setRotation(angle);
        bullet.setDepth(800);
        bullet._lifetime = this.time.now + lifetime;
        bullet._damage = damage;
        bullet._bossDamage = bossDamage;
        bullet._weaponType = weaponType;
        bullet._vx = Math.cos(angle) * speed;
        bullet._vy = Math.sin(angle) * speed;

        if (bullet.body) {
            bullet.body.setAllowGravity(false);
            bullet.body.setVelocity(bullet._vx, bullet._vy);
            bullet.body.setCircle(Math.max(6, Math.round(height * 0.65)), Math.max(2, width * 0.12), Math.max(1, height * 0.08));
        }

        this.bullets.add(bullet);

        // Avoid flooding the screen with rifle text every 95ms.
        if (feedback !== 'RAT-A-TAT!' || Math.random() < 0.28) {
            this.showFeedback(feedback, feedbackColor, this.player.x, this.player.y - 60);
        }
        const soundNow = this.time.now;
        if (weaponType !== 'rifle' || soundNow - (this._lastGunshotSoundTime || 0) > 65) {
            this._lastGunshotSoundTime = soundNow;
            playGunshot(soundVolume, weaponType);

// CHIGGAS_STEAM_PASS_54_FIRST_SHOT_FIRED_GAME_SCENE_BEGIN
        try {
            if (!this._chiggasSteamFirstShotFiredRequested && typeof window !== 'undefined') {
                this._chiggasSteamFirstShotFiredRequested = true;
                const detail = {
                    achievement: 'FIRST_SHOT_FIRED',
                    source: 'GameScene_playGunshot_side_effect',
                    scene: 'GameScene',
                    event: 'first_shot_fired_gunshot',
                    reason: 'playGunshot_called',
                    weaponType: (typeof weaponType !== 'undefined' ? weaponType : (this._getEquippedGunType ? this._getEquippedGunType() : null)),
                    pistolAmmo: this.pistolAmmo || 0,
                    rifleAmmo: this.rifleAmmo || 0,
                    storeShouldShow: 'TEST BUY',
                    pass: 'steam_desktop_wrapper_pass_54',
                    hook: 'playGunshot_side_effect_54'
                };
                window.dispatchEvent(new CustomEvent('chiggas-steam-achievement-unlock-request', { detail }));
                window.dispatchEvent(new CustomEvent('chiggas-first-shot-fired', { detail }));
            }
        } catch (_) {}
// CHIGGAS_STEAM_PASS_54_FIRST_SHOT_FIRED_GAME_SCENE_END
        }
    }

    updateCompass(playerTurf, unclaimedTurf) {
        this.compass.clear();
        this.compassWhite.clear();

        const drawArrow = (gfx, target, color) => {
            if (!target) return;
            const cam = this.cameras.main;
            const cx = cam.width / 2;
            const cy = cam.height / 2;
            const dx = target.x - this.player.x;
            const dy = target.y - this.player.y;
            const angle = Math.atan2(dy, dx);
            const radius = Math.min(cam.width, cam.height) * 0.42;
            const ax = cx + Math.cos(angle) * radius;
            const ay = cy + Math.sin(angle) * radius;
            gfx.fillStyle(color, 0.85);
            gfx.fillTriangle(
                ax + Math.cos(angle) * 18, ay + Math.sin(angle) * 18,
                ax + Math.cos(angle + 2.5) * 12, ay + Math.sin(angle + 2.5) * 12,
                ax + Math.cos(angle - 2.5) * 12, ay + Math.sin(angle - 2.5) * 12
            );
        };

        drawArrow(this.compass, playerTurf, 0xff3333);
        drawArrow(this.compassWhite, unclaimedTurf, 0xffffff);
    }

    initWeather(stage) {
        const forced = this.debugOptions?.forceWeather || null;
        const weather = forced || stage.weather || 'clear';
        this.currentWeather = weather;

        if (!this.hazards) {
            this.hazards = this.physics.add.staticGroup();
        }

        if (weather === 'rain' || weather === 'sweat') {
            this._startRainVisuals();
            initAudio().then(() => startRainAmbience(0.82)).catch(() => {});

            for (let i = 0; i < 16; i++) {
                this.createSweatPuddle(Math.random() * CONFIG.WORLD_SIZE, Math.random() * CONFIG.WORLD_SIZE);
            }

            this.time.addEvent({
                delay: 7600,
                loop: true,
                callback: () => {
                    if (this.isEnding || this.isDead) return;
                    this.createSweatPuddle(Math.random() * CONFIG.WORLD_SIZE, Math.random() * CONFIG.WORLD_SIZE);
                }
            });
        } else if (weather === 'snow' || weather === 'shiver') {
            this._startSnowVisuals();
            initAudio().then(() => startSnowWindAmbience(0.82)).catch(() => {});
            this._spawnSnowHazards(18);

            this.time.addEvent({
                delay: 9800,
                loop: true,
                callback: () => {
                    if (this.isEnding || this.isDead) return;
                    this._spawnSnowHazards(3);
                }
            });
        } else if (weather === 'heat') {
            const overlay = this.add.rectangle(CONFIG.WORLD_SIZE/2, CONFIG.WORLD_SIZE/2, CONFIG.WORLD_SIZE, CONFIG.WORLD_SIZE, 0xffaa00, 0.05).setDepth(1000);
            this.tweens.add({ targets: overlay, alpha: 0.15, duration: 2000, yoyo: true, repeat: -1 });
            this.time.addEvent({
                delay: 2000,
                loop: true,
                callback: () => {
                    if (this.isEnding || this.isDead || this._isSpawnProtected()) return;
                    const inTurf = this.territories.some(t => t.faction === CONFIG.FACTIONS.PLAYER && Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y) < t.radius);
                    if (!inTurf) {
                        this.player.takeDamage(2);
                        this.createImpactEffect(this.player.x, this.player.y, 0xff6600, 'punch', 2, true);
                    }
                }
            });
        } else if (weather === 'wind') {
            initAudio().then(() => startSnowWindAmbience(0.7)).catch(() => {});
            this.time.addEvent({
                delay: 100,
                loop: true,
                callback: () => {
                    if (this.isEnding || this.isDead || !this.player.body || this._isSpawnProtected()) return;
                    this.player.body.velocity.x += 10;
                }
            });
        }
    }

    _spawnSnowHazards(count = 10) {
        if (!this.hazards) this.hazards = this.physics.add.staticGroup();

        for (let i = 0; i < count; i++) {
            const x = Math.random() * CONFIG.WORLD_SIZE;
            const y = Math.random() * CONFIG.WORLD_SIZE;
            const patch = this.add.ellipse(x, y, 150, 82, 0xdff7ff, 0.30).setDepth(340);
            patch._hazardType = 'snow';
            this.physics.add.existing(patch, true);
            patch.body.setCircle(72);
            this.hazards.add(patch);

            this.tweens.add({
                targets: patch,
                alpha: 0.06,
                duration: 13000,
                delay: 16000,
                onComplete: () => patch.destroy()
            });
        }
    }

    _handleWeatherHazardOverlap(entity, hazard) {
        if (!entity || !hazard || this._isSpawnProtected()) return;
        if (!entity.body) return;

        const now = this.time.now;
        const key = hazard._hazardType === 'snow' ? '_snowSlowUntil' : '_rainSlowUntil';
        entity[key] = now + 500;

        const slow = hazard._hazardType === 'snow' ? 0.42 : 0.68;
        entity.body.velocity.scale(slow);

        if (!hazard._lastWeatherTick || now - hazard._lastWeatherTick > 900) {
            hazard._lastWeatherTick = now;
            const label = hazard._hazardType === 'snow' ? 'CHILLED' : 'SLIPPED';
            this.showFeedback?.(label, hazard._hazardType === 'snow' ? 0xbbeeff : 0x66ccff, entity.x, entity.y - 30);
        }
    }

    createSweatPuddle(x, y) {
        if (!this.hazards) this.hazards = this.physics.add.staticGroup();

        const puddle = this.add.ellipse(x, y, 120, 60, 0x00ccff, 0.35).setDepth(350);
        puddle._hazardType = 'rain';
        this.physics.add.existing(puddle, true);
        puddle.body.setCircle(60);
        this.hazards.add(puddle);
        this.tweens.add({ targets: puddle, alpha: 0, duration: 12000, onComplete: () => puddle.destroy() });
    }

    createImpactEffect(x, y, color = 0xffffff, type = 'punch', damage = 0, hitPlayer = false) {
        if (type === 'bite') playBite(); else playHit(hitPlayer ? 0.6 : 1);
        const ring = this.add.circle(x, y, 10, color, 0.8).setDepth(3000);
        this.tweens.add({
            targets: ring,
            scale: 3,
            alpha: 0,
            duration: 300,
            ease: 'Quad.easeOut',
            onComplete: () => ring.destroy()
        });
        
        if (damage > 0) {
            const textColor = hitPlayer ? '#ff3333' : '#ffff00';
            const dmgText = this.add.text(x, y - 20, damage.toString(), {
                fontSize: '18px', fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif', color: textColor, stroke: '#000000', strokeThickness: 3
            }).setOrigin(0.5).setDepth(3000);
            
            this.tweens.add({
                targets: dmgText,
                y: y - 40,
                alpha: 0,
                duration: 600,
                ease: 'Quad.easeOut',
                onComplete: () => dmgText.destroy()
            });
        }
    }

    showFeedback(text, color, x, y) {
        const fx = this.add.text(
            x ?? this.player.x,
            (y ?? this.player.y) - 100,
            text, {
                fontSize: '28px', fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#' + color.toString(16).padStart(6, '0'),
                stroke: '#000000', strokeThickness: 4
            }
        ).setOrigin(0.5).setDepth(3000);
        this.tweens.add({
            targets: fx, y: fx.y - 60, alpha: 0, duration: 600,
            onComplete: () => fx.destroy()
        });
    }

    // CHIGGAS_CLEANUP_PASS_80A_UNALIVED_CONTINUE_METHOD_BEGIN
    _installUnalivedContinueFallback() {
        try {
            if (this._chiggasUnalivedContinueFallbackCleanup) {
                try { this._chiggasUnalivedContinueFallbackCleanup(); } catch (_) {}
            }

            let armed = false;
            let handled = false;
            const scene = this;
            const cleanups = [];

            const arm = () => { armed = true; };

            const continueAfterDeath = (source = 'unknown') => {
                if (!armed || handled) return;
                if (!scene || !scene.scene || !scene.isDead) return;

                handled = true;

                try {
                    if (scene._chiggasUnalivedContinueFallbackCleanup) {
                        scene._chiggasUnalivedContinueFallbackCleanup();
                    }
                } catch (_) {}

                try { if (scene.physics && scene.physics.world && scene.physics.world.isPaused) scene.physics.world.resume(); } catch (_) {}
                try { if (scene.sound && scene.sound.resumeAll) scene.sound.resumeAll(); } catch (_) {}

                try {
                    if (typeof window !== 'undefined') {
                        window.__chiggasLastUnalivedContinueSource = source;
                    }
                } catch (_) {}

                try {
                    scene.scene.start('MenuScene');
                } catch (_) {
                    try { scene.scene.restart(); } catch (_) {}
                }
            };

            const onPointer = () => continueAfterDeath('pointerdown');
            const onKey = () => continueAfterDeath('keydown');
            const onGamepad = () => continueAfterDeath('gamepad');

            try {
                if (this.input) {
                    this.input.once('pointerdown', onPointer);
                    cleanups.push(() => { try { this.input.off('pointerdown', onPointer); } catch (_) {} });

                    if (this.input.keyboard) {
                        this.input.keyboard.once('keydown', onKey);
                        cleanups.push(() => { try { this.input.keyboard.off('keydown', onKey); } catch (_) {} });
                    }

                    if (this.input.gamepad) {
                        this.input.gamepad.once('down', onGamepad);
                        cleanups.push(() => { try { this.input.gamepad.off('down', onGamepad); } catch (_) {} });
                    }
                }
            } catch (_) {}

            const winKey = () => continueAfterDeath('window_keydown');
            const winPointer = () => continueAfterDeath('window_pointerdown');

            try {
                if (typeof window !== 'undefined') {
                    window.addEventListener('keydown', winKey, { once: true, capture: true });
                    window.addEventListener('pointerdown', winPointer, { once: true, capture: true });
                    cleanups.push(() => { try { window.removeEventListener('keydown', winKey, true); } catch (_) {} });
                    cleanups.push(() => { try { window.removeEventListener('pointerdown', winPointer, true); } catch (_) {} });
                }
            } catch (_) {}

            let armTimer = null;
            try {
                armTimer = this.time && this.time.delayedCall
                    ? this.time.delayedCall(350, arm)
                    : setTimeout(arm, 350);
                cleanups.push(() => {
                    try {
                        if (armTimer && typeof armTimer.remove === 'function') armTimer.remove(false);
                        else if (armTimer) clearTimeout(armTimer);
                    } catch (_) {}
                });
            } catch (_) {
                armed = true;
            }

            this._chiggasUnalivedContinueFallbackCleanup = () => {
                const pending = cleanups.splice(0);
                pending.forEach(fn => { try { fn(); } catch (_) {} });
                this._chiggasUnalivedContinueFallbackCleanup = null;
            };

            try {
                this.events.once('shutdown', () => {
                    try {
                        if (this._chiggasUnalivedContinueFallbackCleanup) this._chiggasUnalivedContinueFallbackCleanup();
                    } catch (_) {}
                });
            } catch (_) {}
        } catch (_) {}
    }
    // CHIGGAS_CLEANUP_PASS_80A_UNALIVED_CONTINUE_METHOD_END

}

// CHIGGAS_GAMEPLAY_STABILITY_PASS_92A_REPAIR_GAME_BEGIN
try {
    if (!GameScene.prototype.__chiggasPass92ARepairInstalled) {
        GameScene.prototype.__chiggasPass92ARepairInstalled = true;

        GameScene.prototype.__pass92AReturnToMenuNow = function() {
            try {
                if (this.__pass92AReturningToMenu) return;
                this.__pass92AReturningToMenu = true;
                this._returningToMenu = true;
                this.scene.start('MenuScene');
            } catch (_) {}
        };

        GameScene.prototype.__pass92AInstallDeathFailsafe = function() {
            try {
                if (this.__pass92ADeathFailsafeInstalled) return;
                this.__pass92ADeathFailsafeInstalled = true;

                const go = () => this.__pass92AReturnToMenuNow();

                try { this.input?.keyboard?.on?.('keydown', go); } catch (_) {}
                try { this.input?.on?.('pointerdown', go); } catch (_) {}
                try { this.input?.gamepad?.on?.('down', go); } catch (_) {}

                try {
                    this.__pass92ADeathPoller = this.time.addEvent({
                        delay: 120,
                        loop: true,
                        callback: () => {
                            try {
                                const pad = this.input?.gamepad?.getPad?.(0);
                                if (!pad) return;
                                const pressed = [0, 1, 8, 9].some(i => !!pad.buttons?.[i]?.pressed);
                                if (pressed) go();
                            } catch (_) {}
                        }
                    });
                } catch (_) {}

                try {
                    this.events.once('shutdown', () => {
                        try { this.input?.keyboard?.off?.('keydown', go); } catch (_) {}
                        try { this.input?.off?.('pointerdown', go); } catch (_) {}
                        try { this.input?.gamepad?.off?.('down', go); } catch (_) {}
                        try { this.__pass92ADeathPoller?.remove?.(false); } catch (_) {}
                    });
                } catch (_) {}
            } catch (_) {}
        };

        const __pass92AOrigGameOver = GameScene.prototype.gameOver;
        if (typeof __pass92AOrigGameOver === 'function') {
            GameScene.prototype.gameOver = function(...args) {
                const result = __pass92AOrigGameOver.apply(this, args);
                try { this.__pass92AInstallDeathFailsafe(); } catch (_) {}
                return result;
            };
        }

        const __pass92AOrigScaling = GameScene.prototype._applyDynamicBossScaling;
        if (typeof __pass92AOrigScaling === 'function') {
            GameScene.prototype._applyDynamicBossScaling = function(boss, ...args) {
                const result = __pass92AOrigScaling.call(this, boss, ...args);
                try {
                    // Stage 3 boss is stageIndex 2. Too Easy should be beatable during achievement grinding.
                    if (boss && this.stageIndex === 2 && this.difficulty === 0 && !boss.__pass92AStage3TooEasyHpAdjusted) {
                        boss.__pass92AStage3TooEasyHpAdjusted = true;
                        const mult = 0.58;
                        if (typeof boss.maxHealth === 'number') boss.maxHealth = Math.max(1, Math.round(boss.maxHealth * mult));
                        if (typeof boss.health === 'number') boss.health = Math.min(Math.max(1, Math.round(boss.health * mult)), boss.maxHealth || boss.health);
                        if (typeof boss.attackDamage === 'number') boss.attackDamage = Math.max(1, Math.round(boss.attackDamage * 0.82));
                        if (typeof boss.damage === 'number') boss.damage = Math.max(1, Math.round(boss.damage * 0.82));
                        if (typeof boss.contactDamage === 'number') boss.contactDamage = Math.max(1, Math.round(boss.contactDamage * 0.82));
                    }
                } catch (_) {}
                return result;
            };
        }

        const __pass92AOrigUpdate = GameScene.prototype.update;
        if (typeof __pass92AOrigUpdate === 'function') {
            GameScene.prototype.update = function(time, delta) {
                let bossBefore = null;
                try {
                    if (this.boss && this.boss.active && this.stageIndex === 1 && !['BURROWING', 'SURFACING'].includes(String(this.boss.state || ''))) {
                        bossBefore = { x: this.boss.x, y: this.boss.y };
                    }
                } catch (_) {}

                const result = __pass92AOrigUpdate.call(this, time, delta);

                try {
                    const boss = this.boss;
                    if (boss && bossBefore && boss.active && !boss.isDead && !['BURROWING', 'SURFACING'].includes(String(boss.state || ''))) {
                        const moved = Phaser.Math.Distance.Between(bossBefore.x, bossBefore.y, boss.x, boss.y);
                        const maxStep = Math.max(70, (Number(delta || 16) / 1000) * 620);
                        if (moved > maxStep) {
                            const angle = Phaser.Math.Angle.Between(bossBefore.x, bossBefore.y, boss.x, boss.y);
                            boss.setPosition(bossBefore.x + Math.cos(angle) * maxStep, bossBefore.y + Math.sin(angle) * maxStep);
                            if (boss.body) boss.body.setVelocity(Math.cos(angle) * Math.min(360, Math.abs(boss.body.velocity?.x || 0)), Math.sin(angle) * Math.min(360, Math.abs(boss.body.velocity?.y || 0)));
                        }

                        const player = this.player;
                        if (player && player.active) {
                            const d = Phaser.Math.Distance.Between(boss.x, boss.y, player.x, player.y);
                            if (d > 0 && d < 46) {
                                const a = Phaser.Math.Angle.Between(player.x, player.y, boss.x, boss.y);
                                boss.setPosition(player.x + Math.cos(a) * 46, player.y + Math.sin(a) * 46);
                            }
                        }
                    }
                } catch (_) {}

                return result;
            };
        }
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Stability Pass 92A Game repair failed safely:', error);
}
// CHIGGAS_GAMEPLAY_STABILITY_PASS_92A_REPAIR_GAME_END


// CHIGGAS_GAMEPLAY_STABILITY_PASS_92B_FIXED_BOSS_BEGIN
try {
    if (!GameScene.prototype.__chiggasPass92BFixedBossInstalled) {
        GameScene.prototype.__chiggasPass92BFixedBossInstalled = true;

        const __pass92BOrigScaling = GameScene.prototype._applyDynamicBossScaling;
        if (typeof __pass92BOrigScaling === 'function') {
            GameScene.prototype._applyDynamicBossScaling = function(boss, ...args) {
                const result = __pass92BOrigScaling.call(this, boss, ...args);
                try {
                    if (boss && this.stageIndex === 2 && !boss.__pass92BStage3HpAdjusted) {
                        boss.__pass92BStage3HpAdjusted = true;
                        const hpMult = this.difficulty === 0 ? 0.72 : (this.difficulty === 1 ? 0.84 : 0.92);
                        const damageMult = this.difficulty === 0 ? 0.9 : 0.96;
                        const adjustOne = (target) => {
                            if (!target) return;
                            if (typeof target.maxHealth === 'number') target.maxHealth = Math.max(1, Math.round(target.maxHealth * hpMult));
                            if (typeof target.health === 'number') target.health = Math.min(Math.max(1, Math.round(target.health * hpMult)), target.maxHealth || target.health);
                            if (typeof target.attackDamage === 'number') target.attackDamage = Math.max(1, Math.round(target.attackDamage * damageMult));
                            if (typeof target.damage === 'number') target.damage = Math.max(1, Math.round(target.damage * damageMult));
                            if (typeof target.contactDamage === 'number') target.contactDamage = Math.max(1, Math.round(target.contactDamage * damageMult));
                        };
                        adjustOne(boss);
                        ['twinA', 'twinB', 'leftTwin', 'rightTwin', 'bossA', 'bossB'].forEach(key => adjustOne(boss[key]));
                        if (Array.isArray(boss.twins)) boss.twins.forEach(adjustOne);
                        try { console.log('[PASS 92B] Stage 3 boss HP adjusted', { difficulty: this.difficulty, hpMult, bossHp: boss.health, bossMaxHp: boss.maxHealth }); } catch (_) {}
                    }
                } catch (_) {}
                return result;
            };
        }

        const __pass92BOrigOnBossFled = GameScene.prototype.onBossFled;
        if (typeof __pass92BOrigOnBossFled === 'function') {
            GameScene.prototype.onBossFled = function(...args) {
                const result = __pass92BOrigOnBossFled.apply(this, args);
                try {
                    this._bossCountdownStarted = false;
                    this._bossCountdownEndsAt = 0;
                    this._bossCountdownDelayMs = 0;
                    this.__pass92BBossFledNeedsReturf = true;
                    this.__pass92BBossFledAt = this.time?.now || Date.now();
                    this.__pass92BBossReturnStarted = false;
                    if (this.territories && this.territories.length) {
                        this._maxTurfsEverHeld = Math.min(this._maxTurfsEverHeld || 0, this.territories.length - 1);
                    }
                } catch (_) {}
                return result;
            };
        }

        GameScene.prototype.__pass92BCheckBossReturnAfterFled = function() {
            try {
                if (!this.__pass92BBossFledNeedsReturf || this.__pass92BBossReturnStarted) return;
                if (this.isEnding || this.isDead || this.bossDefeated || this.bossPhaseActive || this._bossCountdownStarted) return;
                if (!this.territories || this.territories.length <= 0) return;
                const playerFaction = CONFIG?.FACTIONS?.PLAYER || 'player';
                const held = this.territories.filter(t => t && t.faction === playerFaction).length;
                if (held < this.territories.length) return;
                this.__pass92BBossReturnStarted = true;
                this.__pass92BBossFledNeedsReturf = false;
                this._maxTurfsEverHeld = this.territories.length;
                const stage = CONFIG.STAGES[this.stageIndex] || CONFIG.STAGES[0];
                const bossName = stage?.bossName || 'BOSS';
                this.showFeedback?.(bossName + ' RETURNS!', 0xff4400, this.player?.x || this.scale.width / 2, (this.player?.y || this.scale.height / 2) - 140);
                this._startBossCountdown?.(5000, 'All turfs recaptured after boss fled');
            } catch (_) {}
        };

        const __pass92BOrigUpdate = GameScene.prototype.update;
        if (typeof __pass92BOrigUpdate === 'function') {
            GameScene.prototype.update = function(time, delta) {
                const result = __pass92BOrigUpdate.call(this, time, delta);
                try { this.__pass92BCheckBossReturnAfterFled(); } catch (_) {}
                return result;
            };
        }
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Stability Pass 92B boss repair failed safely:', error);
}
// CHIGGAS_GAMEPLAY_STABILITY_PASS_92B_FIXED_BOSS_END

// CHIGGAS_GAMEPLAY_STABILITY_PASS_92C_VOLUME_OPTIONS_GAME_BEGIN
try {
    if (!GameScene.prototype.__chiggasPass92CVolumeOptionsInstalled) {
        GameScene.prototype.__chiggasPass92CVolumeOptionsInstalled = true;

        GameScene.prototype.__pass92CCalibrateVolumeSettings = function() {
            try {
                const raw = window.localStorage.getItem('chiggas_settings_v1');
                const parsed = raw ? JSON.parse(raw) : {};
                let changed = false;
                if (!parsed.__volumeCalibrated92C) {
                    ['masterVolume', 'musicVolume', 'sfxVolume'].forEach(key => {
                        const current = Number(parsed[key]);
                        if (!Number.isFinite(current) || current >= 0.74) { parsed[key] = 1; changed = true; }
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

        const __pass92COrigCreate = GameScene.prototype.create;
        if (typeof __pass92COrigCreate === 'function') {
            GameScene.prototype.create = function(...args) {
                try { this.__pass92CCalibrateVolumeSettings(); } catch (_) {}
                const result = __pass92COrigCreate.apply(this, args);
                try { this.__pass92CCalibrateVolumeSettings(); refreshAudioVolumes?.(); } catch (_) {}
                return result;
            };
        }

        const __pass92COrigOpenOptions = GameScene.prototype._openGameOptionsMenu;
        if (typeof __pass92COrigOpenOptions === 'function') {
            GameScene.prototype._openGameOptionsMenu = function(...args) {
                const result = __pass92COrigOpenOptions.apply(this, args);
                try {
                    this.__pass92CCalibrateVolumeSettings();
                    this.__pass92CBuildPauseOptionsGrid();
                } catch (_) {}
                return result;
            };
        }

        GameScene.prototype.__pass92CPauseButtonLabel = function(btn) {
            try {
                const list = btn?.list || [];
                const textObj = list.find(child => typeof child?.text === 'string');
                return String(textObj?.text || '').trim().toUpperCase();
            } catch (_) { return ''; }
        };

        GameScene.prototype.__pass92CBuildPauseOptionsGrid = function() {
            try {
                const buttons = (this._pauseNavButtons || []).filter(btn => btn && btn.active !== false && btn.visible !== false);
                const rows = [];
                const byLabel = label => buttons.filter(btn => this.__pass92CPauseButtonLabel(btn) === label);
                const modeRow = ['TOUCH', 'KEYBOARD', 'GAMEPAD'].map(label => byLabel(label)[0]).filter(Boolean);
                if (modeRow.length) rows.push(modeRow);
                const volumeButtons = buttons
                    .filter(btn => ['+', '–', '-'].includes(this.__pass92CPauseButtonLabel(btn)))
                    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
                for (let i = 0; i < volumeButtons.length; i += 2) {
                    const row = volumeButtons.slice(i, i + 2).sort((a, b) => a.x - b.x);
                    if (row.length) rows.push(row);
                }
                const back = byLabel('BACK')[0];
                const keep = buttons.find(btn => this.__pass92CPauseButtonLabel(btn).includes('KEEP'));
                if (back) rows.push([back]);
                if (keep) rows.push([keep]);
                this.__pass92CPauseOptionsGrid = rows;
                this.__pass92CPauseOptionsRow = 0;
                this.__pass92CPauseOptionsCol = 0;
                if (rows[0]?.[0]) this._setPauseFocusByButton(rows[0][0]);
            } catch (_) {}
        };

        GameScene.prototype.__pass92CMovePauseOptionsGrid = function(step) {
            const rows = this.__pass92CPauseOptionsGrid;
            if (!rows || !rows.length) return false;
            const asDirection = typeof step === 'string' ? step : (step < 0 ? 'up' : 'down');
            let row = Phaser.Math.Clamp(this.__pass92CPauseOptionsRow || 0, 0, rows.length - 1);
            let col = Phaser.Math.Clamp(this.__pass92CPauseOptionsCol || 0, 0, Math.max(0, rows[row].length - 1));
            if (asDirection === 'up') row = Phaser.Math.Wrap(row - 1, 0, rows.length);
            else if (asDirection === 'down') row = Phaser.Math.Wrap(row + 1, 0, rows.length);
            else if (asDirection === 'left') col = Phaser.Math.Wrap(col - 1, 0, rows[row].length);
            else if (asDirection === 'right') col = Phaser.Math.Wrap(col + 1, 0, rows[row].length);
            col = Phaser.Math.Clamp(col, 0, Math.max(0, rows[row].length - 1));
            this.__pass92CPauseOptionsRow = row;
            this.__pass92CPauseOptionsCol = col;
            this._setPauseFocusByButton(rows[row][col]);
            return true;
        };

        const __pass92COrigMovePause = GameScene.prototype._movePauseFocus;
        GameScene.prototype._movePauseFocus = function(step) {
            if (this.__pass92CPauseOptionsGrid?.length) {
                if (this.__pass92CMovePauseOptionsGrid(step)) return;
            }
            return __pass92COrigMovePause.call(this, step);
        };

        const __pass92COrigPollPauseStick = GameScene.prototype._pollPauseGamepadStick;
        GameScene.prototype._pollPauseGamepadStick = function(time) {
            if (this.__pass92CPauseOptionsGrid?.length) {
                const pad = this.input?.gamepad?.getPad?.(0);
                if (!pad || time - (this._lastPauseGamepadMoveAt || 0) < 220) return;
                const axisX = pad.axes?.[0]?.getValue?.() ?? 0;
                const axisY = pad.axes?.[1]?.getValue?.() ?? 0;
                if (Math.abs(axisX) < 0.55 && Math.abs(axisY) < 0.55) return;
                if (Math.abs(axisX) > Math.abs(axisY)) this.__pass92CMovePauseOptionsGrid(axisX > 0 ? 'right' : 'left');
                else this.__pass92CMovePauseOptionsGrid(axisY > 0 ? 'down' : 'up');
                this._lastPauseGamepadMoveAt = time;
                return;
            }
            return __pass92COrigPollPauseStick.call(this, time);
        };

        const __pass92COrigActivatePause = GameScene.prototype._activatePauseFocus;
        GameScene.prototype._activatePauseFocus = function() {
            if (this.__pass92CPauseOptionsGrid?.length) {
                const now = this.time?.now || Date.now();
                if (now < (this.__pass92CPauseActivateLockUntil || 0)) return;
                this.__pass92CPauseActivateLockUntil = now + 220;
            }
            return __pass92COrigActivatePause.call(this);
        };
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Stability Pass 92C game/pause hotfix failed safely:', error);
}
// CHIGGAS_GAMEPLAY_STABILITY_PASS_92C_VOLUME_OPTIONS_GAME_END

/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92H_PAUSE_OPTIONS_BEGIN */
try {
    if (!GameScene.prototype.__chiggasPass92HPauseOptionsInstalled) {
        GameScene.prototype.__chiggasPass92HPauseOptionsInstalled = true;

        GameScene.prototype._openGameOptionsMenu = function() {
            try { window.__chiggasPass92HPauseOptionsActive = true; } catch (_) {}

            this._clearPauseInputZones();
            if (this._pauseContainer) {
                this._pauseContainer.destroy(true);
                this._pauseContainer = null;
            }

            const { width, height } = this.scale;
            const c = this.add.container(0, 0).setScrollFactor(0).setDepth(9600);
            this._pauseContainer = c;

            const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.74);
            const panelW = Math.min(520, width - 28);
            const panelH = Math.min(560, height - 34);
            const top = height / 2 - panelH / 2;

            const panel = this.add.graphics();
            panel.fillStyle(0x151015, 0.98);
            panel.fillRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 22);
            panel.lineStyle(4, 0x8a44ff, 0.8);
            panel.strokeRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 22);

            const title = this.add.text(width / 2, top + 42, 'SET IT UP', {
                fontSize: '38px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ffdd00',
                stroke: '#000000',
                strokeThickness: 7
            }).setOrigin(0.5);

            const controlLabel = this.add.text(width / 2, top + 92, 'CONTROL SCHEME', {
                fontSize: '20px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);

            c.add([shade, panel, title, controlLabel]);

            const createTaggedPauseButton = (x, y, text, color, onClick, w = 260, h = 50, fz = 22) => {
                const btn = this._createPauseButton(c, x, y, text, color, onClick, w, h, fz);
                try {
                    btn.__pass92HPauseOptionsButton = true;
                    btn.__pass92HLabel = String(text || '').trim().toUpperCase();
                } catch (_) {}
                return btn;
            };

            const modes = [
                { label: 'TOUCH', value: 'touch', x: width / 2 - 130 },
                { label: 'KEYBOARD', value: 'keyboard', x: width / 2 },
                { label: 'GAMEPAD', value: 'gamepad', x: width / 2 + 130 }
            ];

            modes.forEach(mode => {
                const selected = this.controlMode === mode.value;
                const btn = createTaggedPauseButton(mode.x, top + 132, mode.label, selected ? 0xffdd00 : 0x333333, () => {
                    this.controlMode = mode.value;
                    this.settings.controlMode = mode.value;
                    this._saveSettings();
                    this.handleResize(this.scale);
                    this._openGameOptionsMenu();
                }, 118, 40, 16);

                try {
                    btn.__pass92HControlModeButton = true;
                    btn.__pass92HControlModeValue = mode.value;
                } catch (_) {}
            });

            const makeVolumeRow = (label, key, y) => {
                const rowLabel = this.add.text(width / 2 - 88, y, `${label}: ${this._formatVolume(this.settings[key])}`, {
                    fontSize: '20px',
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

                    this.__pass92HLastPauseVolumeFocus = focusBtn || null;
                    this.__pass92HLastPauseVolumePressAt = this.time?.now || Date.now();

                    // Critical 92H fix:
                    // Do not call _openGameOptionsMenu() after volume changes.
                    // Redrawing the in-game Set It Up page resets gamepad focus to TOUCH.
                    this._saveSettings();

                    try {
                        if (focusBtn && this._pauseNavButtons?.includes(focusBtn)) {
                            this._setPauseFocusByButton(focusBtn);
                        }
                    } catch (_) {}
                };

                minusBtn = createTaggedPauseButton(width / 2 + 88, y, '–', 0x333333, () => {
                    applyVolumeDelta(-0.1, minusBtn);
                }, 42, 36, 24);

                plusBtn = createTaggedPauseButton(width / 2 + 146, y, '+', 0x333333, () => {
                    applyVolumeDelta(0.1, plusBtn);
                }, 42, 36, 24);

                try {
                    minusBtn.__pass92HVolumeButton = true;
                    minusBtn.__pass92HVolumeKey = key;
                    minusBtn.__pass92HVolumeDirection = -1;
                    minusBtn.__pass92HLabel = label + ' -';

                    plusBtn.__pass92HVolumeButton = true;
                    plusBtn.__pass92HVolumeKey = key;
                    plusBtn.__pass92HVolumeDirection = 1;
                    plusBtn.__pass92HLabel = label + ' +';
                } catch (_) {}
            };

            makeVolumeRow('MASTER', 'masterVolume', top + 210);
            makeVolumeRow('MUSIC', 'musicVolume', top + 268);
            makeVolumeRow('SFX', 'sfxVolume', top + 326);

            createTaggedPauseButton(width / 2, top + panelH - 114, 'BACK', 0x444444, () => {
                this._clearPauseInputZones();
                if (this._pauseContainer) {
                    this._pauseContainer.destroy(true);
                    this._pauseContainer = null;
                }
                this._openPauseMenu();
            }, 190, 44, 20);

            createTaggedPauseButton(width / 2, top + panelH - 58, 'KEEP CRAWLIN’', 0x2d7d32, () => this._closePauseMenu(), 220, 44, 20);

            this._focusFirstPauseButton();
        };

        const __pass92HOrigActivatePauseFocus = GameScene.prototype._activatePauseFocus;
        GameScene.prototype._activatePauseFocus = function(...args) {
            const btn = this._pauseNavButtons?.[this._pauseFocusIndex];
            const now = this.time?.now || Date.now();

            if (this._pauseContainer && btn?.__pass92HControlModeButton && (now - (this.__pass92HLastPauseVolumePressAt || 0)) < 420) {
                try {
                    if (this.__pass92HLastPauseVolumeFocus && this._pauseNavButtons?.includes(this.__pass92HLastPauseVolumeFocus)) {
                        this._setPauseFocusByButton(this.__pass92HLastPauseVolumeFocus);
                    }
                } catch (_) {}
                return;
            }

            const result = __pass92HOrigActivatePauseFocus.apply(this, args);

            try {
                if (btn?.__pass92HVolumeButton && this._pauseNavButtons?.includes(btn)) {
                    this.__pass92HLastPauseVolumeFocus = btn;
                    this.__pass92HLastPauseVolumePressAt = this.time?.now || Date.now();
                    this._setPauseFocusByButton(btn);
                }
            } catch (_) {}

            return result;
        };
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Stability Pass 92H in-game pause options failed safely:', error);
}
/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92H_PAUSE_OPTIONS_END */

/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92I_PAUSE_NAV_START_BEGIN */
try {
    if (!GameScene.prototype.__chiggasPass92IPauseNavStartInstalled) {
        GameScene.prototype.__chiggasPass92IPauseNavStartInstalled = true;

        GameScene.prototype.__pass92IPauseButtonWorldPos = function(btn) {
            try {
                let x = btn?.x || 0;
                let y = btn?.y || 0;
                let current = btn?.parentContainer;
                while (current) {
                    x += current.x || 0;
                    y += current.y || 0;
                    current = current.parentContainer;
                }
                return { x, y };
            } catch (_) {
                return { x: btn?.x || 0, y: btn?.y || 0 };
            }
        };

        GameScene.prototype.__pass92IMovePauseFocusDirectional = function(direction) {
            try {
                if (!this._pauseContainer || !this._pauseNavButtons || this._pauseNavButtons.length === 0) return false;

                const current = this._pauseNavButtons[this._pauseFocusIndex] || this._pauseNavButtons[0];
                if (!current) return false;

                const currentPos = this.__pass92IPauseButtonWorldPos(current);
                let best = null;
                let bestScore = Infinity;

                this._pauseNavButtons.forEach(candidate => {
                    if (!candidate || candidate === current || candidate.active === false || candidate.visible === false) return;

                    const pos = this.__pass92IPauseButtonWorldPos(candidate);
                    const dx = pos.x - currentPos.x;
                    const dy = pos.y - currentPos.y;

                    if (direction === 'right' && dx <= 8) return;
                    if (direction === 'left' && dx >= -8) return;
                    if (direction === 'down' && dy <= 8) return;
                    if (direction === 'up' && dy >= -8) return;

                    const primary = (direction === 'left' || direction === 'right') ? Math.abs(dx) : Math.abs(dy);
                    const secondary = (direction === 'left' || direction === 'right') ? Math.abs(dy) : Math.abs(dx);

                    // Directional scoring: same-row +/- movement beats moving down the column.
                    const score = primary * 1000 + secondary * 28;
                    if (score < bestScore) {
                        bestScore = score;
                        best = candidate;
                    }
                });

                if (best) {
                    this._setPauseFocusByButton(best);
                    return true;
                }
            } catch (_) {}

            return false;
        };

        const __pass92IOrigMovePauseFocus = GameScene.prototype._movePauseFocus;
        GameScene.prototype._movePauseFocus = function(stepOrDirection) {
            try {
                if (typeof stepOrDirection === 'string') {
                    if (this.__pass92IMovePauseFocusDirectional(stepOrDirection)) return;
                }
            } catch (_) {}
            return __pass92IOrigMovePauseFocus.apply(this, arguments);
        };

        const __pass92IOrigTogglePause = GameScene.prototype._togglePauseMenu;
        GameScene.prototype._togglePauseMenu = function(...args) {
            try {
                const now = this.time?.now || Date.now();
                if (now < (this.__pass92IPauseToggleLockUntil || 0)) return;
                this.__pass92IPauseToggleLockUntil = now + 260;
                window.__chiggasPass92ILastPauseToggleAt = now;
            } catch (_) {}
            return __pass92IOrigTogglePause.apply(this, args);
        };

        GameScene.prototype.__pass92ISetupPauseInputDirectional = function() {
            if (this.__pass92IDirectionalPauseInputInstalled) return;
            this.__pass92IDirectionalPauseInputInstalled = true;

            this._pauseNavButtons = this._pauseNavButtons || [];
            this._pauseFocusIndex = this._pauseFocusIndex || 0;
            this._lastPauseGamepadMoveAt = 0;

            this.input.keyboard?.on('keydown', event => {
                const key = event.key;
                const code = event.code;

                if (getKeyboardCodes('gameplay', 'pause').includes(code) || key === 'p' || key === 'P') {
                    this._togglePauseMenu();
                    return;
                }

                if (!this._pauseContainer) return;

                if (key === 'ArrowUp' || key === 'w' || key === 'W') {
                    this._movePauseFocus('up');
                } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
                    this._movePauseFocus('down');
                } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
                    this._movePauseFocus('left');
                } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
                    this._movePauseFocus('right');
                } else if (getKeyboardCodes('menu', 'confirm').includes(code)) {
                    this._activatePauseFocus();
                } else if (getKeyboardCodes('menu', 'back').includes(code) || getKeyboardCodes('gameplay', 'back').includes(code)) {
                    this._closePauseMenu();
                }
            });

            if (this.input.gamepad) {
                this.input.gamepad.on('down', (pad, button, index) => {
                    const buttonIndex = button?.index ?? index;

                    if (isGamepadActionButton('gameplay', 'pause', buttonIndex)) {
                        this._togglePauseMenu();
                        return;
                    }

                    if (!this._pauseContainer) return;

                    if (isGamepadActionButton('menu', 'confirm', buttonIndex) || isGamepadActionButton('gameplay', 'recruit', buttonIndex)) {
                        this._activatePauseFocus();
                    } else if (isGamepadActionButton('menu', 'back', buttonIndex) || isGamepadActionButton('gameplay', 'back', buttonIndex)) {
                        this._closePauseMenu();
                    } else if (buttonIndex === 12) {
                        this._movePauseFocus('up');
                    } else if (buttonIndex === 13) {
                        this._movePauseFocus('down');
                    } else if (buttonIndex === 14) {
                        this._movePauseFocus('left');
                    } else if (buttonIndex === 15) {
                        this._movePauseFocus('right');
                    }
                });
            }
        };

        GameScene.prototype._setupPauseInput = function() {
            this.__pass92ISetupPauseInputDirectional();
        };

        const __pass92IOrigBrowserPause = GameScene.prototype._pollBrowserGamepadPauseInput;
        GameScene.prototype._pollBrowserGamepadPauseInput = function(time) {
            if (this.controlMode !== 'gamepad') return;
            const pad = this._getBrowserGamepadFallback?.();
            if (!pad) return;

            const pauseEdge = this._pollBrowserGamepadActionEdges?.(['pause'], pad) || {};
            if (pauseEdge.pause) {
                this._togglePauseMenu();
                return;
            }

            if (!this._pauseContainer) return;

            const menuEdges = this._pollBrowserGamepadActionEdges?.(['back', 'recruit'], pad) || {};
            if (menuEdges.recruit) {
                this._activatePauseFocus();
                return;
            }

            if (menuEdges.back) {
                this._closePauseMenu();
                return;
            }

            if (time - (this._lastBrowserPauseGamepadMoveAt || 0) < 220) return;
            const axes = this._readBrowserGamepadAxes?.(pad) || { x: 0, y: 0 };
            const buttonUp = !!pad.buttons?.[12]?.pressed;
            const buttonDown = !!pad.buttons?.[13]?.pressed;
            const buttonLeft = !!pad.buttons?.[14]?.pressed;
            const buttonRight = !!pad.buttons?.[15]?.pressed;

            if (buttonUp || axes.y < -0.45) {
                this._movePauseFocus('up');
                this._lastBrowserPauseGamepadMoveAt = time;
            } else if (buttonDown || axes.y > 0.45) {
                this._movePauseFocus('down');
                this._lastBrowserPauseGamepadMoveAt = time;
            } else if (buttonLeft || axes.x < -0.45) {
                this._movePauseFocus('left');
                this._lastBrowserPauseGamepadMoveAt = time;
            } else if (buttonRight || axes.x > 0.45) {
                this._movePauseFocus('right');
                this._lastBrowserPauseGamepadMoveAt = time;
            }
        };

        const __pass92IOrigNativePause = GameScene.prototype._pollNativeSteamPauseInput;
        GameScene.prototype._pollNativeSteamPauseInput = function(time) {
            if (this.controlMode !== 'gamepad') return;

            const polled = this._pollNativeSteamActionEdges?.(['pause', 'back', 'confirm', 'recruit'], 'gameplay') || {};
            const edges = polled.edges;
            const state = polled.state;
            if (!state) return;

            if (edges.pause) {
                this._togglePauseMenu();
                return;
            }

            if (!this._pauseContainer) return;

            if (edges.confirm || edges.recruit) {
                this._activatePauseFocus();
                return;
            }

            if (edges.back) {
                this._closePauseMenu();
                return;
            }

            if (time - (this._lastNativePauseGamepadMoveAt || 0) < 220) return;
            const axes = this._readNativeSteamAxes?.(state, 'move') || { x: 0, y: 0 };
            if (Math.abs(axes.x) < 0.55 && Math.abs(axes.y) < 0.55) return;

            if (Math.abs(axes.x) > Math.abs(axes.y)) {
                this._movePauseFocus(axes.x > 0 ? 'right' : 'left');
            } else {
                this._movePauseFocus(axes.y > 0 ? 'down' : 'up');
            }

            this._lastNativePauseGamepadMoveAt = time;
        };

        const __pass92IOrigPollPauseStick = GameScene.prototype._pollPauseGamepadStick;
        GameScene.prototype._pollPauseGamepadStick = function(time) {
            if (!this._pauseContainer) return;
            const pad = this.input?.gamepad?.getPad?.(0);
            if (!pad || time - (this._lastPauseGamepadMoveAt || 0) < 220) return;

            const axisX = pad.axes?.[0]?.getValue?.() ?? 0;
            const axisY = pad.axes?.[1]?.getValue?.() ?? 0;

            if (Math.abs(axisX) < 0.55 && Math.abs(axisY) < 0.55) return;

            if (Math.abs(axisX) > Math.abs(axisY)) {
                this._movePauseFocus(axisX > 0 ? 'right' : 'left');
            } else {
                this._movePauseFocus(axisY > 0 ? 'down' : 'up');
            }

            this._lastPauseGamepadMoveAt = time;
        };
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Stability Pass 92I pause nav/start failed safely:', error);
}
/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92I_PAUSE_NAV_START_END */

/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92J_PAUSE_SPATIAL_BEGIN */
try {
    if (!GameScene.prototype.__chiggasPass92JPauseSpatialInstalled) {
        GameScene.prototype.__chiggasPass92JPauseSpatialInstalled = true;

        GameScene.prototype.__pass92JPauseButtonWorldPos = function(btn) {
            try {
                let x = btn?.x || 0;
                let y = btn?.y || 0;
                let current = btn?.parentContainer;
                while (current) {
                    x += current.x || 0;
                    y += current.y || 0;
                    current = current.parentContainer;
                }
                return { x, y };
            } catch (_) {
                return { x: btn?.x || 0, y: btn?.y || 0 };
            }
        };

        GameScene.prototype.__pass92JMovePauseSpatial = function(direction) {
            try {
                if (!this._pauseContainer || !this._pauseNavButtons || !this._pauseNavButtons.length) return false;

                const buttons = this._pauseNavButtons.filter(btn => btn && btn.active !== false && btn.visible !== false);
                if (!buttons.length) return false;

                const current = this._pauseNavButtons[this._pauseFocusIndex] || buttons[0];
                const currentPos = this.__pass92JPauseButtonWorldPos(current);
                const horizontal = direction === 'left' || direction === 'right';
                const sign = (direction === 'right' || direction === 'down') ? 1 : -1;

                const viable = [];
                for (const btn of buttons) {
                    if (!btn || btn === current) continue;
                    const pos = this.__pass92JPauseButtonWorldPos(btn);
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
                        this._setPauseFocusByButton(preferred[0].btn);
                        return true;
                    }
                } else {
                    preferred = viable.filter(item => Math.abs(item.dx) <= columnTolerance);
                    if (preferred.length) {
                        preferred.sort((a, b) => Math.abs(a.dy) - Math.abs(b.dy) || Math.abs(a.dx) - Math.abs(b.dx));
                        this._setPauseFocusByButton(preferred[0].btn);
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

                this._setPauseFocusByButton(viable[0].btn);
                return true;
            } catch (_) {
                return false;
            }
        };

        const __pass92JOrigMovePauseFocus = GameScene.prototype._movePauseFocus;
        GameScene.prototype._movePauseFocus = function(stepOrDirection) {
            try {
                if (['left', 'right', 'up', 'down'].includes(stepOrDirection)) {
                    if (this.__pass92JMovePauseSpatial(stepOrDirection)) return;
                }
            } catch (_) {}
            return __pass92JOrigMovePauseFocus.apply(this, arguments);
        };

        const __pass92JOrigTogglePause = GameScene.prototype._togglePauseMenu;
        GameScene.prototype._togglePauseMenu = function(...args) {
            try {
                const now = this.time?.now || Date.now();
                if (now < (this.__pass92JPauseToggleLockUntil || 0)) return;
                this.__pass92JPauseToggleLockUntil = now + 280;
                window.__chiggasPass92JLastPauseToggleAt = now;
            } catch (_) {}
            return __pass92JOrigTogglePause.apply(this, args);
        };

        const __pass92JOrigSetupPauseInput = GameScene.prototype._setupPauseInput;
        GameScene.prototype._setupPauseInput = function(...args) {
            // Keep any existing setup, but the handlers below use strict directional movement.
            const result = typeof __pass92JOrigSetupPauseInput === 'function'
                ? __pass92JOrigSetupPauseInput.apply(this, args)
                : undefined;

            try {
                if (this.__pass92JDirectionalInputAdded) return result;
                this.__pass92JDirectionalInputAdded = true;

                this.input.keyboard?.on('keydown', event => {
                    if (!this._pauseContainer) return;
                    const key = event.key;
                    if (key === 'ArrowUp' || key === 'w' || key === 'W') this._movePauseFocus('up');
                    else if (key === 'ArrowDown' || key === 's' || key === 'S') this._movePauseFocus('down');
                    else if (key === 'ArrowLeft' || key === 'a' || key === 'A') this._movePauseFocus('left');
                    else if (key === 'ArrowRight' || key === 'd' || key === 'D') this._movePauseFocus('right');
                });

                this.input.gamepad?.on('down', (_pad, button, index) => {
                    if (!this._pauseContainer) return;
                    const buttonIndex = button?.index ?? index;
                    if (buttonIndex === 12) this._movePauseFocus('up');
                    else if (buttonIndex === 13) this._movePauseFocus('down');
                    else if (buttonIndex === 14) this._movePauseFocus('left');
                    else if (buttonIndex === 15) this._movePauseFocus('right');
                });
            } catch (_) {}

            return result;
        };

        const __pass92JOrigPollPauseStick = GameScene.prototype._pollPauseGamepadStick;
        GameScene.prototype._pollPauseGamepadStick = function(time) {
            if (!this._pauseContainer) return;
            const pad = this.input?.gamepad?.getPad?.(0);
            if (!pad || time - (this._lastPauseGamepadMoveAt || 0) < 220) return;

            const axisX = pad.axes?.[0]?.getValue?.() ?? 0;
            const axisY = pad.axes?.[1]?.getValue?.() ?? 0;

            if (Math.abs(axisX) < 0.55 && Math.abs(axisY) < 0.55) return;

            if (Math.abs(axisX) > Math.abs(axisY)) this._movePauseFocus(axisX > 0 ? 'right' : 'left');
            else this._movePauseFocus(axisY > 0 ? 'down' : 'up');

            this._lastPauseGamepadMoveAt = time;
        };
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Stability Pass 92J pause spatial failed safely:', error);
}
/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92J_PAUSE_SPATIAL_END */


/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92K_INGAME_SHARED_OPTIONS_BEGIN */
try {
    if (!GameScene.prototype.__chiggasPass92KInGameSharedOptionsInstalled) {
        GameScene.prototype.__chiggasPass92KInGameSharedOptionsInstalled = true;

        GameScene.prototype.__pass92KFocusOptionsButton = function(btn) {
            try {
                if (!btn) return;
                this.__pass92KFocusedOptionButton = btn;
                if (this._pauseNavButtons?.includes(btn)) {
                    this._setPauseFocusByButton(btn);
                } else {
                    this._pauseFocusIndex = 0;
                }
            } catch (_) {}
        };

        GameScene.prototype.__pass92KGetFocusedOptionPosition = function() {
            try {
                for (let r = 0; r < this.__pass92KOptionRows.length; r++) {
                    const row = this.__pass92KOptionRows[r];
                    for (let c = 0; c < row.length; c++) {
                        if (row[c] === this.__pass92KFocusedOptionButton) return { r, c };
                    }
                }
            } catch (_) {}
            return { r: 0, c: 0 };
        };

        GameScene.prototype.__pass92KMoveOptionsFocus = function(direction) {
            try {
                const rows = this.__pass92KOptionRows || [];
                if (!rows.length) return false;

                let { r, c } = this.__pass92KGetFocusedOptionPosition();
                if (!rows[r] || !rows[r][c]) {
                    r = 0;
                    c = 0;
                }

                if (direction === 'right') {
                    c = Math.min(c + 1, rows[r].length - 1);
                } else if (direction === 'left') {
                    c = Math.max(c - 1, 0);
                } else if (direction === 'down') {
                    r = Math.min(r + 1, rows.length - 1);
                    c = Math.min(c, rows[r].length - 1);
                } else if (direction === 'up') {
                    r = Math.max(r - 1, 0);
                    c = Math.min(c, rows[r].length - 1);
                }

                this.__pass92KFocusOptionsButton(rows[r][c]);
                return true;
            } catch (_) {
                return false;
            }
        };

        GameScene.prototype.__pass92KActivateOptionsFocus = function() {
            try {
                const btn = this.__pass92KFocusedOptionButton;
                if (!btn) return false;

                if (typeof btn.__pass92KAction === 'function') {
                    btn.__pass92KAction();
                    return true;
                }

                if (this._pauseNavButtons?.includes(btn)) {
                    this._setPauseFocusByButton(btn);
                    this._activatePauseFocus();
                    return true;
                }
            } catch (_) {}

            return false;
        };

        GameScene.prototype.__pass92KCloseOptionsToPauseMenu = function() {
            try {
                this.__pass92KOptionsActive = false;
                this.__pass92KOptionRows = null;
                this.__pass92KFocusedOptionButton = null;

                this._clearPauseInputZones?.();
                if (this._pauseContainer) {
                    this._pauseContainer.destroy(true);
                    this._pauseContainer = null;
                }
                this._openPauseMenu();
            } catch (_) {}
        };

        GameScene.prototype._openGameOptionsMenu = function() {
            try { window.__chiggasPass92KInGameSharedOptionsActive = true; } catch (_) {}

            this._clearPauseInputZones?.();
            if (this._pauseContainer) {
                this._pauseContainer.destroy(true);
                this._pauseContainer = null;
            }

            const { width, height } = this.scale;
            const c = this.add.container(0, 0).setScrollFactor(0).setDepth(9600);
            this._pauseContainer = c;
            this.__pass92KOptionsActive = true;
            this.__pass92KOptionRows = [];
            this.__pass92KFocusedOptionButton = null;

            const compact = width < 760 || height < 560;
            const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.74);
            const panelW = Math.min(compact ? 440 : 560, width - 28);
            const panelH = Math.min(height - 24, compact ? 430 : 540);
            const top = height / 2 - panelH / 2;

            const panel = this.add.graphics();
            panel.fillStyle(0x151015, 0.98);
            panel.fillRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 22);
            panel.lineStyle(4, 0x8a44ff, 0.8);
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

            const makeBtn = (x, y, text, color, action, w = 112, h = 38, fz = 16) => {
                const btn = this._createPauseButton(c, x, y, text, color, action, w, h, fz);
                try {
                    btn.__pass92KOptionButton = true;
                    btn.__pass92KAction = action;
                    btn.__pass92KLabel = String(text || '').trim().toUpperCase();
                } catch (_) {}
                return btn;
            };

            const modeGap = Math.min(compact ? 116 : 140, panelW * 0.29);
            const modeW = compact ? 112 : 130;
            const modeY = top + (compact ? 106 : 132);

            const touchBtn = makeBtn(width / 2 - modeGap, modeY, 'TOUCH', this.controlMode === 'touch' ? 0xffdd00 : 0x333333, () => {
                this.controlMode = 'touch';
                this.settings.controlMode = 'touch';
                this._saveSettings();
                this.handleResize(this.scale);
                this._openGameOptionsMenu();
            }, modeW, compact ? 38 : 44, compact ? 16 : 18);

            const keyboardBtn = makeBtn(width / 2, modeY, 'KEYBOARD', this.controlMode === 'keyboard' ? 0xffdd00 : 0x333333, () => {
                this.controlMode = 'keyboard';
                this.settings.controlMode = 'keyboard';
                this._saveSettings();
                this.handleResize(this.scale);
                this._openGameOptionsMenu();
            }, modeW, compact ? 38 : 44, compact ? 16 : 18);

            const gamepadBtn = makeBtn(width / 2 + modeGap, modeY, 'GAMEPAD', this.controlMode === 'gamepad' ? 0xffdd00 : 0x333333, () => {
                this.controlMode = 'gamepad';
                this.settings.controlMode = 'gamepad';
                this._saveSettings();
                this.handleResize(this.scale);
                this._openGameOptionsMenu();
            }, modeW, compact ? 38 : 44, compact ? 16 : 18);

            const volumeStart = top + (compact ? 190 : 236);
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
                    this._saveSettings();

                    try {
                        this.__pass92KFocusOptionsButton(focusBtn);
                    } catch (_) {}
                };

                minusBtn = makeBtn(width / 2 + (compact ? 72 : 92), y, '–', 0x333333, () => {
                    applyVolumeDelta(-0.1, minusBtn);
                }, compact ? 40 : 44, compact ? 34 : 36, compact ? 22 : 24);

                plusBtn = makeBtn(width / 2 + (compact ? 126 : 150), y, '+', 0x333333, () => {
                    applyVolumeDelta(0.1, plusBtn);
                }, compact ? 40 : 44, compact ? 34 : 36, compact ? 22 : 24);

                return [minusBtn, plusBtn];
            };

            const masterRow = makeVolumeRow('MASTER', 'masterVolume', volumeStart);
            const musicRow = makeVolumeRow('MUSIC', 'musicVolume', volumeStart + volumeGap);
            const sfxRow = makeVolumeRow('SFX', 'sfxVolume', volumeStart + volumeGap * 2);

            const backBtn = makeBtn(width / 2, top + panelH - (compact ? 82 : 104), 'BACK', 0x444444, () => {
                this.__pass92KCloseOptionsToPauseMenu();
            }, 205, compact ? 40 : 48, compact ? 20 : 22);

            const keepBtn = makeBtn(width / 2, top + panelH - (compact ? 34 : 48), 'KEEP CRAWLIN’', 0x2d7d32, () => {
                this.__pass92KOptionsActive = false;
                this._closePauseMenu();
            }, 220, compact ? 40 : 48, compact ? 20 : 22);

            this.__pass92KOptionRows = [
                [touchBtn, keyboardBtn, gamepadBtn],
                masterRow,
                musicRow,
                sfxRow,
                [backBtn, keepBtn]
            ];

            this.__pass92KFocusOptionsButton(touchBtn);
        };

        const __pass92KOrigMovePauseFocus = GameScene.prototype._movePauseFocus;
        GameScene.prototype._movePauseFocus = function(stepOrDirection) {
            try {
                if (this.__pass92KOptionsActive && ['left', 'right', 'up', 'down'].includes(stepOrDirection)) {
                    if (this.__pass92KMoveOptionsFocus(stepOrDirection)) return;
                }
            } catch (_) {}
            return __pass92KOrigMovePauseFocus.apply(this, arguments);
        };

        const __pass92KOrigActivatePauseFocus = GameScene.prototype._activatePauseFocus;
        GameScene.prototype._activatePauseFocus = function(...args) {
            try {
                if (this.__pass92KOptionsActive) {
                    if (this.__pass92KActivateOptionsFocus()) return;
                }
            } catch (_) {}
            return __pass92KOrigActivatePauseFocus.apply(this, args);
        };

        const __pass92KOrigSetupPauseInput = GameScene.prototype._setupPauseInput;
        GameScene.prototype._setupPauseInput = function(...args) {
            const result = typeof __pass92KOrigSetupPauseInput === 'function'
                ? __pass92KOrigSetupPauseInput.apply(this, args)
                : undefined;

            try {
                if (this.__pass92KInputInstalled) return result;
                this.__pass92KInputInstalled = true;

                this.input.gamepad?.on('down', (_pad, button, index) => {
                    if (!this.__pass92KOptionsActive) return;
                    const buttonIndex = button?.index ?? index;
                    if (buttonIndex === 12) this.__pass92KMoveOptionsFocus('up');
                    else if (buttonIndex === 13) this.__pass92KMoveOptionsFocus('down');
                    else if (buttonIndex === 14) this.__pass92KMoveOptionsFocus('left');
                    else if (buttonIndex === 15) this.__pass92KMoveOptionsFocus('right');
                    else if (buttonIndex === 0 || buttonIndex === 9) this.__pass92KActivateOptionsFocus();
                    else if (buttonIndex === 1 || buttonIndex === 8) this.__pass92KCloseOptionsToPauseMenu();
                });

                this.input.keyboard?.on('keydown', event => {
                    if (!this.__pass92KOptionsActive) return;
                    const key = event.key;
                    if (key === 'ArrowUp' || key === 'w' || key === 'W') this.__pass92KMoveOptionsFocus('up');
                    else if (key === 'ArrowDown' || key === 's' || key === 'S') this.__pass92KMoveOptionsFocus('down');
                    else if (key === 'ArrowLeft' || key === 'a' || key === 'A') this.__pass92KMoveOptionsFocus('left');
                    else if (key === 'ArrowRight' || key === 'd' || key === 'D') this.__pass92KMoveOptionsFocus('right');
                    else if (key === 'Enter' || key === ' ') this.__pass92KActivateOptionsFocus();
                    else if (key === 'Escape' || key === 'Backspace') this.__pass92KCloseOptionsToPauseMenu();
                });
            } catch (_) {}

            return result;
        };

        const __pass92KOrigPollPauseStick = GameScene.prototype._pollPauseGamepadStick;
        GameScene.prototype._pollPauseGamepadStick = function(time) {
            if (!this.__pass92KOptionsActive) {
                return __pass92KOrigPollPauseStick.apply(this, arguments);
            }

            const pad = this.input?.gamepad?.getPad?.(0);
            if (!pad || time - (this.__pass92KLastStickMoveAt || 0) < 220) return;

            const axisX = pad.axes?.[0]?.getValue?.() ?? 0;
            const axisY = pad.axes?.[1]?.getValue?.() ?? 0;

            if (Math.abs(axisX) < 0.55 && Math.abs(axisY) < 0.55) return;

            if (Math.abs(axisX) > Math.abs(axisY)) {
                this.__pass92KMoveOptionsFocus(axisX > 0 ? 'right' : 'left');
            } else {
                this.__pass92KMoveOptionsFocus(axisY > 0 ? 'down' : 'up');
            }

            this.__pass92KLastStickMoveAt = time;
        };
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Stability Pass 92K in-game shared options failed safely:', error);
}
/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92K_INGAME_SHARED_OPTIONS_END */

/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92L_GAME_DIRECT_OVERRIDE_BEGIN */
try {
    if (!GameScene.prototype.__chiggasPass92LGameDirectInstalled) {
        GameScene.prototype.__chiggasPass92LGameDirectInstalled = true;

        GameScene.prototype._openGameOptionsMenu = function() {
        try { window.__chiggasPass92LInGameOptionsActive = true; } catch (_) {}

        this._clearPauseInputZones();
        if (this._pauseContainer) {
            this._pauseContainer.destroy(true);
            this._pauseContainer = null;
        }

        const { width, height } = this.scale;
        const compact = width < 760 || height < 560;
        const c = this.add.container(0, 0).setScrollFactor(0).setDepth(9600);
        this._pauseContainer = c;
        this.__pass92LActiveOptionGrid = true;
        this.__pass92LOptionRows = [];
        this.__pass92LGridPos = { row: 0, col: 0 };

        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.74);
        const panelW = Math.min(compact ? 440 : 560, width - 28);
        const panelH = Math.min(height - 24, compact ? 430 : 540);
        const top = height / 2 - panelH / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x151015, 0.98);
        panel.fillRoundedRect(width / 2 - panelW / 2, top, panelW, panelH, 22);
        panel.lineStyle(4, 0x8a44ff, 0.8);
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

        const makeBtn = (x, y, text, color, action, w = 112, h = 38, fz = 16) => {
            const btn = this._createPauseButton(c, x, y, text, color, action, w, h, fz);
            try {
                btn.__pass92LOptionButton = true;
                btn.__pass92LLabel = String(text || '').trim().toUpperCase();
            } catch (_) {}
            return btn;
        };

        const focusGridButton = (btn) => {
            try {
                this.__pass92LOptionRows.forEach((row, rowIndex) => {
                    const colIndex = row.indexOf(btn);
                    if (colIndex >= 0) this.__pass92LGridPos = { row: rowIndex, col: colIndex };
                });
                this._setPauseFocusByButton(btn);
            } catch (_) {}
        };

        const modeGap = Math.min(compact ? 116 : 140, panelW * 0.29);
        const modeW = compact ? 112 : 130;
        const modeY = top + (compact ? 106 : 132);

        const touchBtn = makeBtn(width / 2 - modeGap, modeY, 'TOUCH', this.controlMode === 'touch' ? 0xffdd00 : 0x333333, () => {
            this.controlMode = 'touch';
            this.settings.controlMode = 'touch';
            this._saveSettings();
            this.handleResize(this.scale);
            this._openGameOptionsMenu();
        }, modeW, compact ? 38 : 44, compact ? 16 : 18);

        const keyboardBtn = makeBtn(width / 2, modeY, 'KEYBOARD', this.controlMode === 'keyboard' ? 0xffdd00 : 0x333333, () => {
            this.controlMode = 'keyboard';
            this.settings.controlMode = 'keyboard';
            this._saveSettings();
            this.handleResize(this.scale);
            this._openGameOptionsMenu();
        }, modeW, compact ? 38 : 44, compact ? 16 : 18);

        const gamepadBtn = makeBtn(width / 2 + modeGap, modeY, 'GAMEPAD', this.controlMode === 'gamepad' ? 0xffdd00 : 0x333333, () => {
            this.controlMode = 'gamepad';
            this.settings.controlMode = 'gamepad';
            this._saveSettings();
            this.handleResize(this.scale);
            this._openGameOptionsMenu();
        }, modeW, compact ? 38 : 44, compact ? 16 : 18);

        const volumeStart = top + (compact ? 190 : 236);
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
                this._saveSettings();
                focusGridButton(focusBtn);
            };

            minusBtn = makeBtn(width / 2 + (compact ? 72 : 92), y, '–', 0x333333, () => {
                applyVolumeDelta(-0.1, minusBtn);
            }, compact ? 40 : 44, compact ? 34 : 36, compact ? 22 : 24);

            plusBtn = makeBtn(width / 2 + (compact ? 126 : 150), y, '+', 0x333333, () => {
                applyVolumeDelta(0.1, plusBtn);
            }, compact ? 40 : 44, compact ? 34 : 36, compact ? 22 : 24);

            try {
                minusBtn.__pass92LVolumeButton = true;
                plusBtn.__pass92LVolumeButton = true;
            } catch (_) {}

            return [minusBtn, plusBtn];
        };

        const masterRow = makeVolumeRow('MASTER', 'masterVolume', volumeStart);
        const musicRow = makeVolumeRow('MUSIC', 'musicVolume', volumeStart + volumeGap);
        const sfxRow = makeVolumeRow('SFX', 'sfxVolume', volumeStart + volumeGap * 2);

        const backBtn = makeBtn(width / 2, top + panelH - (compact ? 82 : 104), 'BACK', 0x444444, () => {
            this.__pass92LActiveOptionGrid = false;
            this.__pass92LOptionRows = [];
            this.__pass92LGridPos = { row: 0, col: 0 };
            this._clearPauseInputZones();
            if (this._pauseContainer) {
                this._pauseContainer.destroy(true);
                this._pauseContainer = null;
            }
            this._openPauseMenu();
        }, 205, compact ? 40 : 48, compact ? 20 : 22);

        const keepBtn = makeBtn(width / 2, top + panelH - (compact ? 34 : 48), 'KEEP CRAWLIN’', 0x2d7d32, () => {
            this.__pass92LActiveOptionGrid = false;
            this.__pass92LOptionRows = [];
            this.__pass92LGridPos = { row: 0, col: 0 };
            this._closePauseMenu();
        }, 220, compact ? 40 : 48, compact ? 20 : 22);

        this.__pass92LOptionRows = [
            [touchBtn, keyboardBtn, gamepadBtn],
            masterRow,
            musicRow,
            sfxRow,
            [backBtn, keepBtn]
        ];

        focusGridButton(touchBtn);
    
        };

        GameScene.prototype._movePauseFocus = function(step) {
        if (!this._pauseContainer || !this._pauseNavButtons || this._pauseNavButtons.length === 0) return;

        if (this.__pass92LActiveOptionGrid && typeof step === 'string' && this.__pass92LOptionRows?.length) {
            let row = this.__pass92LGridPos?.row ?? 0;
            let col = this.__pass92LGridPos?.col ?? 0;
            const rows = this.__pass92LOptionRows;

            row = Phaser.Math.Clamp(row, 0, rows.length - 1);
            col = Phaser.Math.Clamp(col, 0, rows[row].length - 1);

            if (step === 'right') {
                col = Math.min(col + 1, rows[row].length - 1);
            } else if (step === 'left') {
                col = Math.max(col - 1, 0);
            } else if (step === 'down') {
                row = Math.min(row + 1, rows.length - 1);
                col = Math.min(col, rows[row].length - 1);
            } else if (step === 'up') {
                row = Math.max(row - 1, 0);
                col = Math.min(col, rows[row].length - 1);
            }

            this.__pass92LGridPos = { row, col };
            this._setPauseFocusByButton(rows[row][col]);
            return;
        }

        if (typeof step === 'string') {
            const current = this._pauseNavButtons[this._pauseFocusIndex] || this._pauseNavButtons[0];
            if (!current) return;

            let best = null;
            let bestScore = Infinity;
            const cx = current.x || 0;
            const cy = current.y || 0;
            const horizontal = step === 'left' || step === 'right';
            const sign = (step === 'right' || step === 'down') ? 1 : -1;

            this._pauseNavButtons.forEach(candidate => {
                if (!candidate || candidate === current || candidate.active === false || candidate.visible === false) return;
                const dx = (candidate.x || 0) - cx;
                const dy = (candidate.y || 0) - cy;

                if (horizontal) {
                    if (sign > 0 && dx <= 8) return;
                    if (sign < 0 && dx >= -8) return;
                } else {
                    if (sign > 0 && dy <= 8) return;
                    if (sign < 0 && dy >= -8) return;
                }

                const primary = horizontal ? Math.abs(dx) : Math.abs(dy);
                const secondary = horizontal ? Math.abs(dy) : Math.abs(dx);
                const score = primary + secondary * 4;

                if (score < bestScore) {
                    bestScore = score;
                    best = candidate;
                }
            });

            if (best) this._setPauseFocusByButton(best);
            return;
        }

        this._pauseFocusIndex = (this._pauseFocusIndex + step + this._pauseNavButtons.length) % this._pauseNavButtons.length;
        this._pauseNavButtons.forEach(btn => this._drawPauseButtonFocus(btn));
    
        };

        GameScene.prototype._activatePauseFocus = function() {
        if (!this._pauseContainer || !this._pauseNavButtons || this._pauseNavButtons.length === 0) return;

        const btn = this._pauseNavButtons[this._pauseFocusIndex];
        btn?._pauseAction?.();
    
        };

        GameScene.prototype._pollPauseGamepadStick = function(time) {
        if (!this._pauseContainer) return;

        const pad = this.input?.gamepad?.getPad?.(0);
        if (!pad || time - (this._lastPauseGamepadMoveAt || 0) < 220) return;

        const axisX = pad.axes?.[0]?.getValue?.() ?? 0;
        const axisY = pad.axes?.[1]?.getValue?.() ?? 0;

        if (Math.abs(axisX) < 0.55 && Math.abs(axisY) < 0.55) return;

        if (Math.abs(axisX) > Math.abs(axisY)) {
            this._movePauseFocus(axisX > 0 ? 'right' : 'left');
        } else {
            this._movePauseFocus(axisY > 0 ? 'down' : 'up');
        }

        this._lastPauseGamepadMoveAt = time;
    
        };

        GameScene.prototype._setupPauseInput = function() {
        this._pauseNavButtons = [];
        this._pauseFocusIndex = 0;
        this._lastPauseGamepadMoveAt = 0;

        this.input.keyboard?.on('keydown', event => {
            const key = event.key;
            const code = event.code;

            if (getKeyboardCodes('gameplay', 'pause').includes(code) || key === 'p' || key === 'P') {
                this._togglePauseMenu();
                return;
            }

            if (!this._pauseContainer) return;

            if (key === 'ArrowUp' || key === 'w' || key === 'W') {
                this._movePauseFocus('up');
            } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
                this._movePauseFocus('down');
            } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
                this._movePauseFocus('left');
            } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
                this._movePauseFocus('right');
            } else if (getKeyboardCodes('menu', 'confirm').includes(code)) {
                this._activatePauseFocus();
            } else if (getKeyboardCodes('menu', 'back').includes(code) || getKeyboardCodes('gameplay', 'back').includes(code)) {
                if (this.__pass92LActiveOptionGrid) {
                    this.__pass92LActiveOptionGrid = false;
                    this.__pass92LOptionRows = [];
                    this.__pass92LGridPos = { row: 0, col: 0 };
                    this._clearPauseInputZones();
                    if (this._pauseContainer) {
                        this._pauseContainer.destroy(true);
                        this._pauseContainer = null;
                    }
                    this._openPauseMenu();
                } else {
                    this._closePauseMenu();
                }
            }
        });

        if (this.input.gamepad) {
            this.input.gamepad.on('down', (pad, button, index) => {
                const buttonIndex = button?.index ?? index;

                if (isGamepadActionButton('gameplay', 'pause', buttonIndex)) {
                    this._togglePauseMenu();
                    return;
                }

                if (!this._pauseContainer) return;

                if (isGamepadActionButton('menu', 'confirm', buttonIndex) || isGamepadActionButton('gameplay', 'recruit', buttonIndex)) {
                    this._activatePauseFocus();
                } else if (isGamepadActionButton('menu', 'back', buttonIndex) || isGamepadActionButton('gameplay', 'back', buttonIndex)) {
                    if (this.__pass92LActiveOptionGrid) {
                        this.__pass92LActiveOptionGrid = false;
                        this.__pass92LOptionRows = [];
                        this.__pass92LGridPos = { row: 0, col: 0 };
                        this._clearPauseInputZones();
                        if (this._pauseContainer) {
                            this._pauseContainer.destroy(true);
                            this._pauseContainer = null;
                        }
                        this._openPauseMenu();
                    } else {
                        this._closePauseMenu();
                    }
                } else if (buttonIndex === 12) {
                    this._movePauseFocus('up');
                } else if (buttonIndex === 13) {
                    this._movePauseFocus('down');
                } else if (buttonIndex === 14) {
                    this._movePauseFocus('left');
                } else if (buttonIndex === 15) {
                    this._movePauseFocus('right');
                }
            });
        }
    
        };

        GameScene.prototype._togglePauseMenu = function() {
        const now = this.time?.now || Date.now();
        if (now < (this.__pass92LPauseToggleLockUntil || 0)) return;
        this.__pass92LPauseToggleLockUntil = now + 280;

        if (this._pauseContainer) {
            this._closePauseMenu();
            return;
        }

        this._openPauseMenu();
    
        };
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Stability Pass 92L direct game override failed safely:', error);
}
/* CHIGGAS_GAMEPLAY_STABILITY_PASS_92L_GAME_DIRECT_OVERRIDE_END */

/* CHIGGAS_GAMEPLAY_TUNING_PASS_93A_BEGIN */
try {
    if (!GameScene.prototype.__chiggasPass93ATuningInstalled) {
        GameScene.prototype.__chiggasPass93ATuningInstalled = true;

        GameScene.prototype.__pass93AEnemyFactions = function() {
            return [
                CONFIG.FACTIONS.BLUE,
                CONFIG.FACTIONS.GREEN,
                CONFIG.FACTIONS.PURPLE,
                CONFIG.FACTIONS.ORANGE,
                CONFIG.FACTIONS.WILD
            ];
        };

        GameScene.prototype.__pass93AIsEnemyFaction = function(faction) {
            return this.__pass93AEnemyFactions().includes(faction);
        };

        GameScene.prototype.__pass93AChooseRandomWeatherStage = function(stage = {}) {
            try {
                if (this.debugOptions?.forceWeather) return stage;

                const current = stage?.weather || 'clear';
                if (current && current !== 'clear' && current !== 'none') return stage;

                const difficulty = this.difficulty ?? 1;
                const stageIndex = this.stageIndex ?? 0;
                const baseChance = difficulty === 0 ? 0.28 : (difficulty === 2 ? 0.58 : 0.42);
                const stageBonus = Math.min(0.16, stageIndex * 0.035);
                const weatherChance = Phaser.Math.Clamp(baseChance + stageBonus, 0.20, 0.72);

                const roll = Math.random();
                if (roll > weatherChance) {
                    this.__pass93AWeatherRoll = { randomized: false, weather: 'clear', roll, weatherChance };
                    return { ...stage, weather: 'clear' };
                }

                const weatherRoll = Math.random();
                let weather = 'rain';
                if (weatherRoll < 0.34) weather = 'rain';
                else if (weatherRoll < 0.58) weather = 'snow';
                else if (weatherRoll < 0.80) weather = 'wind';
                else weather = 'heat';

                this.__pass93AWeatherRoll = {
                    randomized: true,
                    weather,
                    roll,
                    weatherChance,
                    weatherRoll,
                    difficulty,
                    stageIndex
                };

                return { ...stage, weather, _pass93ARandomWeather: true };
            } catch (_) {
                return stage;
            }
        };

        const __pass93AOrigInitWeather = GameScene.prototype.initWeather;
        if (typeof __pass93AOrigInitWeather === 'function') {
            GameScene.prototype.initWeather = function(stage) {
                const tunedStage = this.__pass93AChooseRandomWeatherStage(stage || {});
                const result = __pass93AOrigInitWeather.call(this, tunedStage);

                try {
                    if (tunedStage?._pass93ARandomWeather && tunedStage.weather && tunedStage.weather !== 'clear') {
                        this.time?.delayedCall?.(900, () => {
                            if (!this.isEnding && !this.isDead) {
                                const label = tunedStage.weather === 'rain'
                                    ? 'SLICK WEATHER!'
                                    : tunedStage.weather === 'snow'
                                        ? 'COLD SNAP!'
                                        : tunedStage.weather === 'wind'
                                            ? 'GUSTY TURF!'
                                            : 'HEAT WAVE!';
                                this.showFeedback?.(label, 0x66ccff, this.player?.x || this.scale.width / 2, (this.player?.y || this.scale.height / 2) - 120);
                            }
                        });
                    }
                } catch (_) {}

                return result;
            };
        }

        GameScene.prototype.__pass93ACommanderFactionPool = function() {
            if ((this.stageIndex ?? 0) >= 4) {
                return [CONFIG.FACTIONS.BLUE, CONFIG.FACTIONS.GREEN, CONFIG.FACTIONS.PURPLE, CONFIG.FACTIONS.ORANGE];
            }
            if ((this.stageIndex ?? 0) >= 1) {
                return [CONFIG.FACTIONS.BLUE, CONFIG.FACTIONS.GREEN, CONFIG.FACTIONS.PURPLE];
            }
            return [CONFIG.FACTIONS.BLUE, CONFIG.FACTIONS.GREEN];
        };

        GameScene.prototype.__pass93ACommanderSpawnPoint = function() {
            const padding = 560;
            const hostileTurfs = (this.territories || []).filter(t => t && t.faction && t.faction !== CONFIG.FACTIONS.PLAYER);
            const neutralTurfs = (this.territories || []).filter(t => t && t.faction === CONFIG.FACTIONS.NEUTRAL);
            const pool = hostileTurfs.length ? hostileTurfs : neutralTurfs;

            if (pool.length) {
                const t = pool[Math.floor(Math.random() * pool.length)];
                return {
                    x: Phaser.Math.Clamp(t.x + (Math.random() - 0.5) * 240, padding, CONFIG.WORLD_SIZE - padding),
                    y: Phaser.Math.Clamp(t.y + (Math.random() - 0.5) * 240, padding, CONFIG.WORLD_SIZE - padding),
                    turf: t
                };
            }

            return {
                x: padding + Math.random() * (CONFIG.WORLD_SIZE - padding * 2),
                y: padding + Math.random() * (CONFIG.WORLD_SIZE - padding * 2),
                turf: null
            };
        };

        GameScene.prototype.__pass93ASpawnExtraCommander = function(faction = null) {
            try {
                const pool = this.__pass93ACommanderFactionPool();
                const fac = faction || pool[Math.floor(Math.random() * pool.length)];
                const point = this.__pass93ACommanderSpawnPoint();

                const commander = new EnemyCommander(this, point.x, point.y, fac);
                commander.homeTurfX = point.turf?.x || point.x;
                commander.homeTurfY = point.turf?.y || point.y;
                commander._isStagedAtHome = true;
                commander._gangReleaseAt = this.time.now + 6500 + Math.random() * 3500;
                commander.state = 'DEFENDING';
                commander.targetPoint = { x: commander.homeTurfX, y: commander.homeTurfY };
                commander.stateTimer = 8500;
                commander.__pass93AExtraCommander = true;

                if (typeof commander.maxFollowers === 'number') {
                    commander.maxFollowers += this.difficulty === 2 ? 3 : 2;
                }

                this.enemies.push(commander);
                this.__pass93ASeedCommanderEscorts(commander, true);
                return commander;
            } catch (error) {
                console.warn('[Chiggas] Pass 93A extra commander spawn failed safely:', error);
                return null;
            }
        };

        GameScene.prototype.__pass93ASeedCommanderEscorts = function(commander, guaranteed = false) {
            try {
                if (!commander || !commander.active || commander.__pass93AEscortsSeeded) return;
                commander.__pass93AEscortsSeeded = true;

                const difficulty = this.difficulty ?? 1;
                const stageIndex = this.stageIndex ?? 0;
                const chance = guaranteed ? 1 : (difficulty === 0 ? 0.35 : (difficulty === 2 ? 0.78 : 0.56));
                if (Math.random() > chance) return;

                const base = difficulty === 0 ? 1 : (difficulty === 2 ? 2 : 1);
                const stageBonus = stageIndex >= 3 ? 1 : 0;
                const count = Phaser.Math.Clamp(base + stageBonus + (Math.random() < 0.45 ? 1 : 0), 1, difficulty === 2 ? 5 : 4);

                for (let i = 0; i < count; i++) {
                    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.35;
                    const dist = 90 + Math.random() * 90;
                    const x = Phaser.Math.Clamp(commander.x + Math.cos(angle) * dist, 80, CONFIG.WORLD_SIZE - 80);
                    const y = Phaser.Math.Clamp(commander.y + Math.sin(angle) * dist, 80, CONFIG.WORLD_SIZE - 80);
                    const unit = this.spawnChigga(x, y, CONFIG.FACTIONS.NEUTRAL);
                    unit.__pass93ACommanderEscort = true;

                    this.time?.delayedCall?.(120 + i * 80, () => {
                        try {
                            if (unit && unit.active && commander && commander.active && typeof commander.recruit === 'function') {
                                commander.recruit(unit);
                            }
                        } catch (_) {}
                    });
                }
            } catch (error) {
                console.warn('[Chiggas] Pass 93A commander escort seed failed safely:', error);
            }
        };

        const __pass93AOrigSpawnEnemies = GameScene.prototype.spawnEnemies;
        if (typeof __pass93AOrigSpawnEnemies === 'function') {
            GameScene.prototype.spawnEnemies = function(count) {
                const result = __pass93AOrigSpawnEnemies.call(this, count);

                try {
                    if (this.__pass93ACommanderTuningApplied) return result;
                    this.__pass93ACommanderTuningApplied = true;

                    const difficulty = this.difficulty ?? 1;
                    const stageIndex = this.stageIndex ?? 0;

                    let extra = 0;
                    if (difficulty === 1) extra = stageIndex >= 2 ? 1 : 0;
                    if (difficulty === 2) extra = 1 + Math.floor(Math.max(0, stageIndex) / 2);
                    extra = Phaser.Math.Clamp(extra, 0, difficulty === 2 ? 3 : 1);

                    for (let i = 0; i < extra; i++) {
                        this.__pass93ASpawnExtraCommander();
                    }

                    const commanders = (this.enemies || []).filter(e => e && e.active && Array.isArray(e.followers));
                    commanders.forEach(commander => this.__pass93ASeedCommanderEscorts(commander, false));

                    if (extra > 0 || commanders.some(c => c.__pass93AEscortsSeeded)) {
                        this.time?.delayedCall?.(1200, () => {
                            if (!this.isEnding && !this.isDead) {
                                this.showFeedback?.('COMMANDERS MOB UP!', 0xffaa00, this.player?.x || this.scale.width / 2, (this.player?.y || this.scale.height / 2) - 145);
                            }
                        });
                    }
                } catch (error) {
                    console.warn('[Chiggas] Pass 93A commander scaling failed safely:', error);
                }

                return result;
            };
        }

        GameScene.prototype.__pass93AFindBlockingSoldier = function(attacker = null) {
            try {
                if (!this.player || !Array.isArray(this.player.followers)) return null;
                const living = this.player.followers.filter(f => f && f.active && !f.isDead);
                if (!living.length) return null;

                let best = null;
                let bestScore = Infinity;

                living.forEach(follower => {
                    const playerDist = Phaser.Math.Distance.Between(follower.x, follower.y, this.player.x, this.player.y);
                    const attackerDist = attacker ? Phaser.Math.Distance.Between(follower.x, follower.y, attacker.x, attacker.y) : Infinity;

                    // "Close" means the soldier is close enough to physically intercept.
                    if (playerDist > 118 && attackerDist > 135) return;

                    const score = playerDist + attackerDist * 0.42;
                    if (score < bestScore) {
                        bestScore = score;
                        best = follower;
                    }
                });

                return best;
            } catch (_) {
                return null;
            }
        };

        GameScene.prototype.__pass93AIsHostileDamageSource = function(source) {
            try {
                if (!source || source === this.player) return false;
                const faction = source.faction;
                if (!faction) return false;
                if (faction === CONFIG.FACTIONS.PLAYER || faction === CONFIG.FACTIONS.NEUTRAL) return false;
                return this.__pass93AIsEnemyFaction(faction) || faction === 'BOSS';
            } catch (_) {
                return false;
            }
        };

        GameScene.prototype.__pass93AApplyDirectPlayerDamage = function(amount, attacker, reason = 'exposed') {
            try {
                if (!this.player || this.isDead) return;

                const now = this.time?.now || Date.now();
                if (now < (this.__pass93ADirectDamageCooldownUntil || 0)) return;
                this.__pass93ADirectDamageCooldownUntil = now + 320;

                const damage = Math.max(1, Math.round(amount));
                this.player.strength = Math.max(0, (this.player.strength ?? this.player.getSTR?.() ?? 1) - damage);

                this.createImpactEffect?.(this.player.x, this.player.y, 0xff2200, 'punch', damage, true);
                this.cameras?.main?.shake?.(100, 0.01);

                if (now > (this.__pass93ALastExposeNoticeAt || 0) + 900) {
                    this.__pass93ALastExposeNoticeAt = now;
                    this.showFeedback?.(reason === 'charge' ? 'EXPOSED! -STR' : 'HIT! -STR', 0xff2222, this.player.x, this.player.y - 85);
                }

                this.updateHUD?.();

                if (this.player.strength <= 0) {
                    this.handlePlayerDeath?.();
                }
            } catch (error) {
                console.warn('[Chiggas] Pass 93A direct damage failed safely:', error);
            }
        };

        GameScene.prototype.__pass93AWrapPlayerDamage = function() {
            try {
                if (!this.player || typeof this.player.takeDamage !== 'function' || this.player.__pass93ADamageWrapped) return;

                const scene = this;
                const originalTakeDamage = this.player.takeDamage.bind(this.player);
                this.player.__pass93ADamageWrapped = true;
                this.player.__pass93AOriginalTakeDamage = originalTakeDamage;

                this.player.takeDamage = function(amount, attacker = null) {
                    try {
                        if (!scene.__pass93AIsHostileDamageSource(attacker)) {
                            return originalTakeDamage(amount, attacker);
                        }

                        const blocker = scene.__pass93AFindBlockingSoldier(attacker);
                        if (blocker && blocker.active && !blocker.isDead) {
                            blocker.takeDamage?.(amount, attacker);
                            scene.createImpactEffect?.(blocker.x, blocker.y, 0xffcc00, 'punch', amount, true);

                            const now = scene.time?.now || Date.now();
                            if (now > (scene.__pass93ALastBlockNoticeAt || 0) + 850) {
                                scene.__pass93ALastBlockNoticeAt = now;
                                scene.showFeedback?.('SOLDIER BLOCK!', 0xffdd00, blocker.x, blocker.y - 55);
                            }

                            return;
                        }

                        const chargeRisk = (scene.time?.now || Date.now()) < (scene.__pass93AChargeRiskUntil || 0);
                        if (chargeRisk) {
                            const exposedDamage = Math.max(amount + 2, Math.round(amount * 1.55));
                            scene.__pass93AApplyDirectPlayerDamage(exposedDamage, attacker, 'charge');
                            return;
                        }

                        return originalTakeDamage(amount, attacker);
                    } catch (_) {
                        return originalTakeDamage(amount, attacker);
                    }
                };
            } catch (error) {
                console.warn('[Chiggas] Pass 93A player damage wrapper failed safely:', error);
            }
        };

        const __pass93AOrigCreate = GameScene.prototype.create;
        if (typeof __pass93AOrigCreate === 'function') {
            GameScene.prototype.create = function(...args) {
                const result = __pass93AOrigCreate.apply(this, args);
                try { this.__pass93AWrapPlayerDamage(); } catch (_) {}
                return result;
            };
        }

        const __pass93AOrigHandleCharge = GameScene.prototype.handleCharge;
        if (typeof __pass93AOrigHandleCharge === 'function') {
            GameScene.prototype.handleCharge = function(...args) {
                const result = __pass93AOrigHandleCharge.apply(this, args);
                try {
                    this.__pass93AChargeRiskUntil = (this.time?.now || Date.now()) + 2200;
                    this.__pass93AChargeRiskStartedAt = this.time?.now || Date.now();
                } catch (_) {}
                return result;
            };
        }

        GameScene.prototype.__pass93ARedirectThreatsToNearbySoldiers = function() {
            try {
                if (!this.player || !Array.isArray(this.player.followers)) return;

                const living = this.player.followers.filter(f => f && f.active && !f.isDead);
                if (!living.length) return;

                const chooseGuard = (threat, maxDist = 320) => {
                    let best = null;
                    let bestScore = Infinity;

                    living.forEach(f => {
                        const dThreat = Phaser.Math.Distance.Between(f.x, f.y, threat.x, threat.y);
                        const dPlayer = Phaser.Math.Distance.Between(f.x, f.y, this.player.x, this.player.y);
                        if (dThreat > maxDist && dPlayer > 130) return;
                        const score = dThreat + dPlayer * 0.55;
                        if (score < bestScore) {
                            bestScore = score;
                            best = f;
                        }
                    });

                    return best;
                };

                (this.enemies || []).forEach(enemy => {
                    if (!enemy || !enemy.active || enemy.isDead) return;
                    const dPlayer = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
                    if (dPlayer > 360) return;
                    const guard = chooseGuard(enemy, 360);
                    if (!guard) return;

                    if (Array.isArray(enemy.followers) && enemy.state !== 'CLAIMING_TURF') {
                        enemy._currentTarget = guard;
                        enemy.targetPoint = { x: guard.x, y: guard.y };
                        enemy.state = 'ATTACKING';
                        enemy.stateTimer = Math.max(enemy.stateTimer || 0, 550);
                    }
                });

                this.units?.children?.iterate?.(unit => {
                    if (!unit || !unit.active || unit.isDead) return;
                    if (!this.__pass93AIsEnemyFaction(unit.faction)) return;

                    const dPlayer = Phaser.Math.Distance.Between(unit.x, unit.y, this.player.x, this.player.y);
                    if (dPlayer > 280) return;
                    const guard = chooseGuard(unit, 300);
                    if (!guard) return;

                    unit.target = guard;
                });
            } catch (_) {}
        };

        const __pass93AOrigUpdateCombat = GameScene.prototype.updateCombat;
        if (typeof __pass93AOrigUpdateCombat === 'function') {
            GameScene.prototype.updateCombat = function(time) {
                try {
                    this.__pass93AWrapPlayerDamage();
                    this.__pass93ARedirectThreatsToNearbySoldiers();
                } catch (_) {}
                return __pass93AOrigUpdateCombat.call(this, time);
            };
        }

        const __pass93AOrigBossScaling = GameScene.prototype._applyDynamicBossScaling;
        if (typeof __pass93AOrigBossScaling === 'function') {
            GameScene.prototype._applyDynamicBossScaling = function(boss, ...args) {
                const result = __pass93AOrigBossScaling.call(this, boss, ...args);

                try {
                    if (boss && this.stageIndex === 2 && !boss.__pass93AStage3HpTrimmed) {
                        boss.__pass93AStage3HpTrimmed = true;
                        const mult = this.difficulty === 0 ? 0.90 : 0.94;

                        const trim = target => {
                            if (!target) return;
                            if (typeof target.maxHealth === 'number') target.maxHealth = Math.max(1, Math.round(target.maxHealth * mult));
                            if (typeof target.health === 'number') target.health = Math.min(Math.max(1, Math.round(target.health * mult)), target.maxHealth || target.health);
                        };

                        trim(boss);
                        ['twinA', 'twinB', 'leftTwin', 'rightTwin', 'bossA', 'bossB'].forEach(key => trim(boss[key]));
                        if (Array.isArray(boss.twins)) boss.twins.forEach(trim);

                        console.log('[PASS 93A] Stage 3 HP trimmed slightly', { mult, bossHp: boss.health, bossMaxHp: boss.maxHealth });
                    }
                } catch (_) {}

                return result;
            };
        }

        const __pass93AOrigOnBossFled = GameScene.prototype.onBossFled;
        if (typeof __pass93AOrigOnBossFled === 'function') {
            GameScene.prototype.onBossFled = function(...args) {
                const result = __pass93AOrigOnBossFled.apply(this, args);
                try {
                    this.__pass93ABossFledNeedsReturf = true;
                    this.__pass93ABossReturnStarted = false;
                    this._bossCountdownStarted = false;
                    this._bossCountdownEndsAt = 0;
                } catch (_) {}
                return result;
            };
        }

        GameScene.prototype.__pass93ACheckBossReturfReturn = function() {
            try {
                if (!this.__pass93ABossFledNeedsReturf || this.__pass93ABossReturnStarted) return;
                if (this.isEnding || this.isDead || this.bossDefeated || this.bossPhaseActive || this._bossCountdownStarted) return;
                if (!this.territories || !this.territories.length) return;

                const held = this.territories.filter(t => t && t.faction === CONFIG.FACTIONS.PLAYER).length;
                if (held < this.territories.length) return;

                this.__pass93ABossReturnStarted = true;
                this.__pass93ABossFledNeedsReturf = false;

                const stage = CONFIG.STAGES[this.stageIndex] || CONFIG.STAGES[0];
                const bossName = stage?.bossName || 'BOSS';
                this.showFeedback?.(bossName + ' RETURNS!', 0xff4400, this.player?.x || this.scale.width / 2, (this.player?.y || this.scale.height / 2) - 140);
                this._startBossCountdown?.(3500, 'Pass 93A returf return after boss fled');
            } catch (_) {}
        };

        const __pass93AOrigUpdate = GameScene.prototype.update;
        if (typeof __pass93AOrigUpdate === 'function') {
            GameScene.prototype.update = function(time, delta) {
                const result = __pass93AOrigUpdate.call(this, time, delta);
                try {
                    this.__pass93ACheckBossReturfReturn();
                } catch (_) {}
                return result;
            };
        }
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Tuning Pass 93A failed safely:', error);
}
/* CHIGGAS_GAMEPLAY_TUNING_PASS_93A_END */

/* CHIGGAS_STEAM_ACHIEVEMENT_WATCHDOG_PASS_94A_BEGIN */
try {
    if (!GameScene.prototype.__chiggasPass94AAchievementWatchdogInstalled) {
        GameScene.prototype.__chiggasPass94AAchievementWatchdogInstalled = true;

        GameScene.prototype.__pass94AUnlockAchievement = function(achievement, metadata = {}) {
            try {
                if (!achievement || typeof window === 'undefined') return;

                const detail = {
                    achievement,
                    metadata: {
                        ...metadata,
                        source: metadata.source || 'GameScene_pass94a_achievement_watchdog',
                        scene: 'GameScene',
                        pass: 'steam_achievement_watchdog_pass_94a',
                        appId: 4788490,
                        storeShouldShow: 'TEST BUY'
                    }
                };

                window.__chiggasPass94ALastAchievementWatchdog = {
                    achievement,
                    metadata: detail.metadata,
                    time: new Date().toISOString()
                };

                if (window.ChiggasAchievementHelper && typeof window.ChiggasAchievementHelper.unlockOnce === 'function') {
                    Promise.resolve(window.ChiggasAchievementHelper.unlockOnce(achievement, detail.metadata))
                        .then(result => {
                            window.__chiggasPass94ALastAchievementWatchdogResult = {
                                achievement,
                                result,
                                time: new Date().toISOString()
                            };
                        })
                        .catch(error => {
                            window.__chiggasPass94ALastAchievementWatchdogResult = {
                                achievement,
                                ok: false,
                                error: String(error && error.message ? error.message : error),
                                time: new Date().toISOString()
                            };
                        });
                } else {
                    window.dispatchEvent(new CustomEvent('chiggas-steam-achievement-unlock-request', { detail }));
                    window.__chiggasPass94ALastAchievementWatchdogResult = {
                        achievement,
                        fallbackDispatch: true,
                        time: new Date().toISOString()
                    };
                }

                window.dispatchEvent(new CustomEvent('chiggas-steam-pass-94a-achievement-watchdog', { detail }));
            } catch (error) {
                try {
                    window.__chiggasPass94ALastAchievementWatchdogResult = {
                        achievement,
                        ok: false,
                        error: String(error && error.message ? error.message : error),
                        time: new Date().toISOString()
                    };
                } catch (_) {}
            }
        };

        GameScene.prototype.__pass94AReadRecords = function() {
            try {
                if (typeof window === 'undefined' || !window.localStorage) return {};
                const raw = window.localStorage.getItem('chiggas_records_v1');
                return raw ? JSON.parse(raw) : {};
            } catch (_) {
                return {};
            }
        };

        GameScene.prototype.__pass94AInitRunWatchdog = function() {
            try {
                this.runStats = this.runStats || {};
                if (typeof this.runStats.__pass94AActiveSurvivalSeconds !== 'number') {
                    this.runStats.__pass94AActiveSurvivalSeconds = Math.max(0, Number(this.elapsedTime || 0));
                }
                if (typeof this.runStats.__pass94ALastTickAt !== 'number') {
                    this.runStats.__pass94ALastTickAt = Number(this.time?.now || 0);
                }
                if (typeof this.runStats.startedAt !== 'number') {
                    this.runStats.startedAt = Date.now();
                }

                window.__chiggasPass94AAchievementWatchdogReady = true;
                window.__chiggasPass94ACurrentGameScene = this;
            } catch (_) {}
        };

        GameScene.prototype.__pass94AGetRunKillCount = function() {
            try {
                const runKills = Number(this.runStats?.kills || 0);
                const sceneCounter = Number(this.__chiggasSteamEnemyDefeatedCount || 0);
                const records = this.__pass94AReadRecords();
                const allTimeKills = Number(records.totalKills || 0);
                const bestKills = Number(records.bestKills || 0);
                return {
                    runKills,
                    sceneCounter,
                    allTimeKills,
                    bestKills,
                    highest: Math.max(runKills, sceneCounter, allTimeKills, bestKills)
                };
            } catch (_) {
                return { runKills: 0, sceneCounter: 0, allTimeKills: 0, bestKills: 0, highest: 0 };
            }
        };

        GameScene.prototype.__pass94AUpdateActiveSurvivalTime = function(time) {
            try {
                this.runStats = this.runStats || {};
                const now = Number(time || this.time?.now || 0);
                const last = Number(this.runStats.__pass94ALastTickAt || now);
                let deltaSeconds = Math.max(0, (now - last) / 1000);

                // Avoid counting long pause/background gaps.
                if (deltaSeconds > 1.25) deltaSeconds = 0;

                this.runStats.__pass94ALastTickAt = now;

                if (!this.isDead && !this.isEnding && !this._pauseContainer) {
                    this.runStats.__pass94AActiveSurvivalSeconds =
                        Math.max(0, Number(this.runStats.__pass94AActiveSurvivalSeconds || 0)) + deltaSeconds;
                }

                const stageElapsed = Number(this.elapsedTime || 0);
                if (stageElapsed > Number(this.runStats.__pass94AActiveSurvivalSeconds || 0)) {
                    this.runStats.__pass94AActiveSurvivalSeconds = stageElapsed;
                }

                return Number(this.runStats.__pass94AActiveSurvivalSeconds || 0);
            } catch (_) {
                return Number(this.elapsedTime || 0);
            }
        };

        GameScene.prototype.__pass94ACheckLongAchievements = function(time) {
            try {
                this.__pass94AInitRunWatchdog();

                const activeSurvivalSeconds = this.__pass94AUpdateActiveSurvivalTime(time);
                const killInfo = this.__pass94AGetRunKillCount();

                window.__chiggasPass94AAchievementWatchdogStatus = {
                    pass: 'steam_achievement_watchdog_pass_94a',
                    activeSurvivalSeconds: Math.floor(activeSurvivalSeconds),
                    stageElapsedTime: Number(this.elapsedTime || 0),
                    runStatsKills: killInfo.runKills,
                    sceneEnemyCounter: killInfo.sceneCounter,
                    allTimeKills: killInfo.allTimeKills,
                    bestKills: killInfo.bestKills,
                    highestKillCount: killInfo.highest,
                    fiveMinuteSent: !!this.runStats.__pass94AFiveMinuteSent,
                    hundredEnemiesSent: !!this.runStats.__pass94AHundredEnemiesSent,
                    helperAvailable: !!(window.ChiggasAchievementHelper && typeof window.ChiggasAchievementHelper.unlockOnce === 'function'),
                    isDead: !!this.isDead,
                    isEnding: !!this.isEnding,
                    stageIndex: this.stageIndex ?? null,
                    time: new Date().toISOString()
                };

                if (!this.runStats.__pass94AFiveMinuteSent && !this.isDead && activeSurvivalSeconds >= 300) {
                    this.runStats.__pass94AFiveMinuteSent = true;
                    this.__pass94AUnlockAchievement('FIVE_MINUTE_RUN', {
                        event: 'five_minute_run_cumulative_active_survival_threshold',
                        reason: 'cumulative_active_survival_seconds_reached_300',
                        activeSurvivalSeconds: Math.floor(activeSurvivalSeconds),
                        stageElapsedTime: Number(this.elapsedTime || 0),
                        threshold: 300,
                        stageIndex: this.stageIndex ?? null,
                        runStartedAt: this.runStats.startedAt || null,
                        source: 'GameScene_pass94a_cumulative_survival_watchdog'
                    });
                }

                if (!this.runStats.__pass94AHundredEnemiesSent && killInfo.highest >= 100) {
                    this.runStats.__pass94AHundredEnemiesSent = true;
                    this.__pass94AUnlockAchievement('HUNDRED_ENEMIES_DEFEATED', {
                        event: 'hundred_enemies_defeated_run_stats_threshold',
                        reason: 'run_or_saved_kill_count_reached_100',
                        runKills: killInfo.runKills,
                        sceneEnemyCounter: killInfo.sceneCounter,
                        allTimeKills: killInfo.allTimeKills,
                        bestKills: killInfo.bestKills,
                        highestKillCount: killInfo.highest,
                        threshold: 100,
                        stageIndex: this.stageIndex ?? null,
                        source: 'GameScene_pass94a_kill_count_watchdog'
                    });
                }
            } catch (error) {
                try {
                    window.__chiggasPass94AAchievementWatchdogError = String(error && error.message ? error.message : error);
                } catch (_) {}
            }
        };

        const __pass94AOrigCreate = GameScene.prototype.create;
        GameScene.prototype.create = function(...args) {
            const result = __pass94AOrigCreate.apply(this, args);
            try {
                this.__pass94AInitRunWatchdog();
                this.__pass94ACheckLongAchievements(this.time?.now || 0);
            } catch (_) {}
            return result;
        };

        const __pass94AOrigUpdate = GameScene.prototype.update;
        GameScene.prototype.update = function(time, delta) {
            const result = __pass94AOrigUpdate.call(this, time, delta);
            try {
                this.__pass94ACheckLongAchievements(time);
            } catch (_) {}
            return result;
        };

        const __pass94AOrigSaveRunRecord = GameScene.prototype._saveRunRecord;
        if (typeof __pass94AOrigSaveRunRecord === 'function') {
            GameScene.prototype._saveRunRecord = function(...args) {
                const result = __pass94AOrigSaveRunRecord.apply(this, args);
                try {
                    this.__pass94ACheckLongAchievements(this.time?.now || 0);
                } catch (_) {}
                return result;
            };
        }
    }
} catch (error) {
    console.warn('[Chiggas] Steam Achievement Watchdog Pass 94A failed safely:', error);
}
/* CHIGGAS_STEAM_ACHIEVEMENT_WATCHDOG_PASS_94A_END */

/* CHIGGAS_WEAR_UNLOCK_LOGIC_PASS_95A_GAME_BEGIN */
try {
    if (!GameScene.prototype.__chiggasPass95ABaseUnlockInstalled) {
        GameScene.prototype.__chiggasPass95ABaseUnlockInstalled = true;

        GameScene.prototype.__pass95ABuildProgress = function(event = 'catchup', extra = {}) {
            let records = {};
            try { records = this._loadAllRecords?.() || {}; } catch (_) {}

            const runStats = {
                ...(this.runStats || {}),
                stageReached: Math.max(
                    Number(this.runStats?.stageReached || 0),
                    Number(extra.stageReached || 0),
                    Number(this.stageIndex || 0) + 1
                )
            };

            return {
                event,
                difficulty: this.difficulty,
                stageIndex: this.stageIndex,
                stageReached: Math.max(Number(extra.stageReached || 0), Number(runStats.stageReached || 0)),
                completedStage: Number(extra.completedStage || 0),
                isFinalClear: !!extra.isFinalClear,
                finalStageCount: CONFIG.STAGES?.length || 5,
                runStats,
                records
            };
        };

        GameScene.prototype.__pass95AUnlockAllBaseSteamAchievement = function(completion, source = 'base_unlock_watchdog') {
            try {
                if (!completion?.allUnlocked) return;
                if (typeof window === 'undefined' || !window.localStorage) return;

                const sentKey = 'chiggas_steam_all_base_chiggas_unlock_sent';
                if (window.localStorage.getItem(sentKey) === 'true') return;
                window.localStorage.setItem(sentKey, 'true');

                const detail = {
                    achievement: 'ALL_BASE_CHIGGAS_UNLOCKED',
                    metadata: {
                        source,
                        pass: 'chigga_wear_unlock_logic_pass_95a',
                        event: 'all_base_chigga_wear_unlocked',
                        total: completion.total,
                        unlocked: completion.unlocked,
                        locked: completion.locked,
                        storeShouldShow: 'TEST BUY'
                    }
                };

                window.__chiggasPass95ALastAllBaseUnlock = {
                    ...detail,
                    time: new Date().toISOString()
                };

                if (window.ChiggasAchievementHelper && typeof window.ChiggasAchievementHelper.unlockOnce === 'function') {
                    Promise.resolve(window.ChiggasAchievementHelper.unlockOnce('ALL_BASE_CHIGGAS_UNLOCKED', detail.metadata))
                        .then(result => {
                            window.__chiggasPass95ALastAllBaseUnlockResult = { ok: true, result, time: new Date().toISOString() };
                        })
                        .catch(error => {
                            window.__chiggasPass95ALastAllBaseUnlockResult = { ok: false, error: String(error?.message || error), time: new Date().toISOString() };
                        });
                } else {
                    window.dispatchEvent(new CustomEvent('chiggas-steam-achievement-unlock-request', { detail }));
                    window.__chiggasPass95ALastAllBaseUnlockResult = { ok: true, fallbackDispatch: true, time: new Date().toISOString() };
                }
            } catch (error) {
                try {
                    window.__chiggasPass95ALastAllBaseUnlockResult = { ok: false, error: String(error?.message || error), time: new Date().toISOString() };
                } catch (_) {}
            }
        };

        GameScene.prototype.__pass95AHandleBaseUnlocks = function(event = 'catchup', extra = {}, showFeedback = false) {
            if (this.debugMode) return [];

            try {
                const result = pass95AUnlockBaseChiggaWear(this.__pass95ABuildProgress(event, extra));
                const newlyUnlocked = result?.newlyUnlocked || [];

                window.__chiggasPass95ABaseUnlockGameStatus = {
                    pass: 'chigga_wear_unlock_logic_pass_95a',
                    event,
                    newlyUnlocked: newlyUnlocked.map(s => s.id),
                    completion: result?.completion || null,
                    progress: result?.progress || null,
                    time: new Date().toISOString()
                };

                if (newlyUnlocked.length && showFeedback && this.player) {
                    const first = newlyUnlocked[0];
                    const suffix = newlyUnlocked.length > 1 ? ` +${newlyUnlocked.length - 1}` : '';
                    this.showFeedback?.(`WEAR UNLOCKED: ${first.name}${suffix}`, 0xffdd00, this.player.x, this.player.y - 150);
                }

                this.__pass95AUnlockAllBaseSteamAchievement(result?.completion, event);

                return newlyUnlocked;
            } catch (error) {
                try {
                    window.__chiggasPass95ABaseUnlockGameError = String(error?.message || error);
                } catch (_) {}
                return [];
            }
        };

        const __pass95AOrigCreate = GameScene.prototype.create;
        GameScene.prototype.create = function(...args) {
            const result = __pass95AOrigCreate.apply(this, args);
            try {
                this.__pass95AHandleBaseUnlocks('game_create_catchup', {}, false);
            } catch (_) {}
            return result;
        };

        const __pass95AOrigOnTurfCaptured = GameScene.prototype.onTurfCaptured;
        GameScene.prototype.onTurfCaptured = function(turf, faction) {
            const result = __pass95AOrigOnTurfCaptured.call(this, turf, faction);
            try {
                if (faction === CONFIG.FACTIONS.PLAYER) this.__pass95AHandleBaseUnlocks('turf_captured', {}, true);
            } catch (_) {}
            return result;
        };

        const __pass95AOrigHandleRecruit = GameScene.prototype.handleRecruit;
        GameScene.prototype.handleRecruit = function(...args) {
            const before = Number(this.runStats?.recruits || 0);
            const result = __pass95AOrigHandleRecruit.apply(this, args);
            try {
                if (Number(this.runStats?.recruits || 0) > before) this.__pass95AHandleBaseUnlocks('soldier_recruited', {}, true);
            } catch (_) {}
            return result;
        };

        const __pass95AOrigOnBossDefeated = GameScene.prototype.onBossDefeated;
        GameScene.prototype.onBossDefeated = function(...args) {
            const result = __pass95AOrigOnBossDefeated.apply(this, args);
            try {
                this.__pass95AHandleBaseUnlocks('boss_defeated', {}, true);
            } catch (_) {}
            return result;
        };

        const __pass95AOrigSaveRunRecord = GameScene.prototype._saveRunRecord;
        if (typeof __pass95AOrigSaveRunRecord === 'function') {
            GameScene.prototype._saveRunRecord = function(...args) {
                const result = __pass95AOrigSaveRunRecord.apply(this, args);
                try {
                    this.__pass95AHandleBaseUnlocks('run_record_saved', {}, false);
                } catch (_) {}
                return result;
            };
        }

        const __pass95AOrigVictoryScore = GameScene.prototype._showVictoryScoreScreen;
        if (typeof __pass95AOrigVictoryScore === 'function') {
            GameScene.prototype._showVictoryScoreScreen = function(...args) {
                try {
                    this.__pass95AHandleBaseUnlocks('final_clear', {
                        completedStage: CONFIG.STAGES?.length || 5,
                        stageReached: CONFIG.STAGES?.length || 5,
                        isFinalClear: true
                    }, true);
                } catch (_) {}
                return __pass95AOrigVictoryScore.apply(this, args);
            };
        }
    }
} catch (error) {
    console.warn('[Chiggas] Chigga Wear Unlock Logic Pass 95A failed safely:', error);
}
/* CHIGGAS_WEAR_UNLOCK_LOGIC_PASS_95A_GAME_END */

/* CHIGGAS_GAMEPLAY_TUNING_PASS_93B_STR_DAMAGE_BALANCE_BEGIN */
try {
    if (!GameScene.prototype.__chiggasPass93BStrDamageBalanceInstalled) {
        GameScene.prototype.__chiggasPass93BStrDamageBalanceInstalled = true;

        GameScene.prototype.__pass93BGetBalancedContactDamage = function(attacker = null, reason = 'exposed') {
            try {
                const difficulty = Number(this.difficulty || 0);
                const isBoss = !!(attacker && (
                    attacker.isBoss ||
                    attacker.bossName ||
                    attacker.type === 'boss' ||
                    attacker.constructor?.name?.toLowerCase?.().includes('boss')
                ));

                // STR is also HP. Enemy contact should chip the player down, not one-shot them.
                // Normal exposed contact = 1 STR.
                // Hard difficulty, boss contact, or Charge-risk exposure = 2 STR max.
                if (reason === 'charge') return difficulty >= 2 ? 2 : 2;
                if (isBoss) return 2;
                if (difficulty >= 2) return 2;
                return 1;
            } catch (_) {
                return 1;
            }
        };

        GameScene.prototype.__pass93AApplyDirectPlayerDamage = function(amount, attacker, reason = 'exposed') {
            try {
                if (!this.player || this.isDead) return;

                const now = this.time?.now || Date.now();
                if (now < (this.__pass93BDirectDamageCooldownUntil || 0)) return;

                // Slightly longer cooldown so one collision overlap cannot chew through STR instantly.
                this.__pass93BDirectDamageCooldownUntil = now + 720;

                const currentStr = Math.max(
                    0,
                    Number(this.player.strength ?? this.player.getSTR?.() ?? 1)
                );

                const damage = Math.max(1, Math.min(2, this.__pass93BGetBalancedContactDamage(attacker, reason)));
                const newStr = Math.max(0, currentStr - damage);

                this.player.strength = newStr;

                window.__chiggasPass93BLastDirectStrDamage = {
                    pass: 'gameplay_tuning_pass_93b_str_damage_balance',
                    reason,
                    requestedAmount: Number(amount || 0),
                    appliedDamage: damage,
                    beforeStr: currentStr,
                    afterStr: newStr,
                    cooldownMs: 720,
                    difficulty: this.difficulty ?? null,
                    attackerType: attacker?.constructor?.name || null,
                    time: new Date().toISOString()
                };

                this.createImpactEffect?.(this.player.x, this.player.y, 0xff2200, 'punch', damage, true);
                this.cameras?.main?.shake?.(70, 0.006);

                if (now > (this.__pass93BLastExposeNoticeAt || 0) + 850) {
                    this.__pass93BLastExposeNoticeAt = now;
                    const label = reason === 'charge' ? `EXPOSED! -${damage} STR` : `HIT! -${damage} STR`;
                    this.showFeedback?.(label, 0xff2222, this.player.x, this.player.y - 85);
                }

                this.updateHUD?.();

                if (newStr <= 0) {
                    this.handlePlayerDeath?.();
                }
            } catch (error) {
                console.warn('[Chiggas] Pass 93B balanced direct damage failed safely:', error);
            }
        };

        const __pass93BOrigCreate = GameScene.prototype.create;
        GameScene.prototype.create = function(...args) {
            const result = __pass93BOrigCreate.apply(this, args);
            try {
                window.__chiggasPass93BStrDamageBalanceReady = true;
                window.__chiggasPass93BStrDamageBalanceStatus = {
                    pass: 'gameplay_tuning_pass_93b_str_damage_balance',
                    status: 'ready',
                    maxDirectContactDamage: 2,
                    normalContactDamage: 1,
                    cooldownMs: 720,
                    time: new Date().toISOString()
                };
            } catch (_) {}
            return result;
        };
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Tuning Pass 93B STR damage balance failed safely:', error);
}
/* CHIGGAS_GAMEPLAY_TUNING_PASS_93B_STR_DAMAGE_BALANCE_END */

/* CHIGGAS_STEAM_PASS_97A_TICK_TWINS_TARGET_AND_MINIMAP_FIX_BEGIN */
try {
    if (!GameScene.prototype.__chiggasPass97ATickTwinsTargetFixInstalled) {
        GameScene.prototype.__chiggasPass97ATickTwinsTargetFixInstalled = true;

        GameScene.prototype.__pass97AIsAliveBossTarget = function(target) {
            return !!(
                target &&
                target.active &&
                !target.isDead &&
                target.scene &&
                !target._isDying
            );
        };

        GameScene.prototype.__pass97AGetBossTargets = function() {
            try {
                const boss = this.boss;
                if (!boss || !boss.active || boss.isDead) return [];

                if (boss.isTwins) {
                    if (typeof boss.getActiveTargets === 'function') {
                        return boss.getActiveTargets().filter(t => this.__pass97AIsAliveBossTarget(t));
                    }

                    const candidates = [
                        boss.twin1,
                        boss.twin2,
                        boss.twinA,
                        boss.twinB,
                        boss.leftTwin,
                        boss.rightTwin,
                        boss.bossA,
                        boss.bossB
                    ];

                    if (Array.isArray(boss.twins)) candidates.push(...boss.twins);

                    const targets = candidates.filter(t => this.__pass97AIsAliveBossTarget(t));
                    if (targets.length) return targets;
                }

                return this.__pass97AIsAliveBossTarget(boss) ? [boss] : [];
            } catch (_) {
                return [];
            }
        };

        GameScene.prototype.__pass97ADrawBossMinimapMarker = function(target, index = 0) {
            try {
                const gfx = this._mmGfx;
                if (!gfx || !target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;

                const ox = this._mmOriginX;
                const oy = this._mmOriginY;
                const s = this._mmScale;
                const w = this._mmW;
                const h = this._mmH;

                if (!Number.isFinite(ox) || !Number.isFinite(oy) || !Number.isFinite(s)) return;

                const mx = Phaser.Math.Clamp(ox + target.x * s, ox + 2, ox + w - 2);
                const my = Phaser.Math.Clamp(oy + target.y * s, oy + 2, oy + h - 2);

                const pulse = 1 + Math.sin((this.time?.now || Date.now()) * 0.012 + index * 0.9) * 0.22;
                const colors = index % 2 === 0
                    ? [0xff0044, 0xffaa00, 0xffff00, 0xffffff]
                    : [0x8844ff, 0x00ccff, 0xff66ff, 0xffffff];

                colors.forEach((color, colorIndex) => {
                    const radius = (9 - colorIndex * 1.2) * pulse;
                    gfx.lineStyle(2, color, 0.95);
                    gfx.strokeCircle(mx, my, radius);
                });

                gfx.fillStyle(0xffffff, 1);
                gfx.fillTriangle(mx, my - 6, mx - 6, my, mx, my + 6);
                gfx.fillTriangle(mx, my - 6, mx + 6, my, mx, my + 6);

                gfx.lineStyle(2, 0x000000, 0.85);
                gfx.strokeCircle(mx, my, 10 * pulse);
            } catch (error) {
                try { console.warn('[Chiggas] Pass 97A boss minimap marker failed safely:', error); } catch (_) {}
            }
        };

        const __pass97AOrigSpawnBoss = GameScene.prototype._spawnBoss;
        if (typeof __pass97AOrigSpawnBoss === 'function') {
            GameScene.prototype._spawnBoss = function(...args) {
                const result = __pass97AOrigSpawnBoss.apply(this, args);
                try {
                    if (this.boss && this.boss.isTwins && typeof this.boss.__pass97AUpdateManagerPosition === 'function') {
                        this.boss.__pass97AUpdateManagerPosition();
                    }
                } catch (_) {}
                return result;
            };
        }

        const __pass97AOrigUpdateMinimap = GameScene.prototype._updateMinimap;
        if (typeof __pass97AOrigUpdateMinimap === 'function') {
            GameScene.prototype._updateMinimap = function(...args) {
                const realBoss = this.boss;
                const isTickTwins = !!(realBoss && realBoss.isTwins);

                if (!isTickTwins) {
                    return __pass97AOrigUpdateMinimap.apply(this, args);
                }

                let result;
                try {
                    // Hide the manager from the legacy minimap code so it cannot draw a fake boss at 0,0.
                    this.boss = null;
                    result = __pass97AOrigUpdateMinimap.apply(this, args);
                } finally {
                    this.boss = realBoss;
                }

                try {
                    const targets = this.__pass97AGetBossTargets();
                    targets.forEach((target, index) => this.__pass97ADrawBossMinimapMarker(target, index));
                } catch (error) {
                    try { console.warn('[Chiggas] Pass 97A Tick Twins minimap draw failed safely:', error); } catch (_) {}
                }

                return result;
            };
        }

        GameScene.prototype.__pass97ATickTwinsArmyAggro = function() {
            try {
                if (!this.player || !Array.isArray(this.player.followers)) return;

                const bossTargets = this.__pass97AGetBossTargets();
                if (!bossTargets.length) return;

                const AGGRO_RANGE = 620;
                const now = this.time?.now || Date.now();

                this.player.followers.forEach((follower, idx) => {
                    if (!follower || !follower.active || follower.isDead || !follower.body) return;

                    let closestTarget = null;
                    let closestDist = AGGRO_RANGE;

                    bossTargets.forEach(target => {
                        if (!this.__pass97AIsAliveBossTarget(target)) return;
                        const d = Phaser.Math.Distance.Between(follower.x, follower.y, target.x, target.y);
                        if (d < closestDist) {
                            closestDist = d;
                            closestTarget = target;
                        }
                    });

                    if (!closestTarget) return;

                    const angle = Phaser.Math.Angle.Between(follower.x, follower.y, closestTarget.x, closestTarget.y);
                    follower.stopFloat?.();
                    follower.body.setImmovable(false);
                    follower.body.setVelocity(
                        Math.cos(angle) * CONFIG.CHIGGA_SPEED * 1.25,
                        Math.sin(angle) * CONFIG.CHIGGA_SPEED * 1.25
                    );

                    const targetRadius = Math.max(
                        70,
                        Number(closestTarget.baseSize || 75) * Number(closestTarget.sizeMultiplier || 1) * 0.9
                    );

                    if (closestDist < targetRadius) {
                        const key = `army_${idx}_tick_twins_${closestTarget.twinName || closestTarget.uid || 'target'}`;
                        const last = this._contactCooldowns?.get(key) || 0;

                        if (now - last > 700) {
                            this._contactCooldowns?.set(key, now);
                            const dmg = 10 + Math.floor(this.player.getSTR?.() * 2 || 2);

                            if (typeof closestTarget.takeDamage === 'function') {
                                closestTarget.takeDamage(dmg, follower);
                                this.createImpactEffect?.(
                                    closestTarget.x,
                                    closestTarget.y,
                                    0xffdd00,
                                    'punch',
                                    dmg,
                                    false
                                );
                            }
                        }
                    }
                });
            } catch (error) {
                try { console.warn('[Chiggas] Pass 97A Tick Twins army aggro failed safely:', error); } catch (_) {}
            }
        };

        const __pass97AOrigUpdateArmyAggro = GameScene.prototype.updateArmyAggro;
        if (typeof __pass97AOrigUpdateArmyAggro === 'function') {
            GameScene.prototype.updateArmyAggro = function(...args) {
                const realBoss = this.boss;
                const isTickTwins = !!(realBoss && realBoss.isTwins);

                let result;
                if (isTickTwins) {
                    try {
                        // Hide manager from legacy aggro so soldiers do not chase a fake target.
                        this.boss = null;
                        result = __pass97AOrigUpdateArmyAggro.apply(this, args);
                    } finally {
                        this.boss = realBoss;
                    }

                    this.__pass97ATickTwinsArmyAggro();
                    return result;
                }

                return __pass97AOrigUpdateArmyAggro.apply(this, args);
            };
        }

        const __pass97AOrigTrackHostileStats = GameScene.prototype._trackHostileStats;
        if (typeof __pass97AOrigTrackHostileStats === 'function') {
            GameScene.prototype._trackHostileStats = function(...args) {
                const realBoss = this.boss;
                const isTickTwins = !!(realBoss && realBoss.isTwins);

                if (!isTickTwins) return __pass97AOrigTrackHostileStats.apply(this, args);

                try {
                    // Hide manager so run-stat tracking does not treat the empty TickTwins manager as a separate 0,0 hostile.
                    this.boss = null;
                    return __pass97AOrigTrackHostileStats.apply(this, args);
                } finally {
                    this.boss = realBoss;
                }
            };
        }

        try {
            window.__chiggasPass97ATickTwinsTargetFixReady = true;
        } catch (_) {}
    }
} catch (error) {
    console.warn('[Chiggas] Steam Pass 97A Tick Twins target/minimap fix failed safely:', error);
}
/* CHIGGAS_STEAM_PASS_97A_TICK_TWINS_TARGET_AND_MINIMAP_FIX_END */
