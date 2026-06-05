import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { getEquippedSoldierSkin } from '../scenes/SkinRegistry.js';

let _chiggaIdCounter = 0;

function getEquippedSoldierTexture(scene) {
    try {
        const skin = getEquippedSoldierSkin();
        if (skin && skin.assetKey && scene?.textures?.exists(skin.assetKey)) {
            return skin.assetKey;
        }
    } catch (e) {}

    return scene?.textures?.exists('chigga-neutral') ? 'chigga-neutral' : 'player';
}

function getFactionTexture(scene, faction) {
    if (faction === CONFIG.FACTIONS.BLUE) return 'chigga-blue';
    if (faction === CONFIG.FACTIONS.GREEN) return 'chigga-green';
    // Regular minions use small optimized versions of the gang art.
    // Commanders still use the larger full-detail commander artwork.
    if (faction === CONFIG.FACTIONS.PURPLE) return scene?.textures?.exists('purple-gang-minion') ? 'purple-gang-minion' : 'chigga-blue';
    if (faction === CONFIG.FACTIONS.ORANGE) return scene?.textures?.exists('orange-gang-minion') ? 'orange-gang-minion' : 'chigga-green';
    if (faction === CONFIG.FACTIONS.WILD) return 'mite-wild';

    // Neutral recruits and player-owned army soldiers use the selected Soldier cosmetic.
    // Enemy factions still use their own faction sprites.
    return getEquippedSoldierTexture(scene);
}

function isEnemyFaction(faction) {
    return faction === CONFIG.FACTIONS.BLUE ||
           faction === CONFIG.FACTIONS.GREEN ||
           faction === CONFIG.FACTIONS.PURPLE ||
           faction === CONFIG.FACTIONS.ORANGE;
}

function getFactionTint(faction) {
    // Purple and Orange minions have their own optimized art, so they do not need color tint.
    return null;
}

function getEnemyFactionProfile(faction) {
    if (faction === CONFIG.FACTIONS.GREEN) {
        return { healthMult: 0.82, damageMult: 0.86, speedMult: 1.05, sizeMult: 0.96 };
    }
    if (faction === CONFIG.FACTIONS.PURPLE) {
        return { healthMult: 1.25, damageMult: 1.25, speedMult: 1.03, sizeMult: 1.04 };
    }
    if (faction === CONFIG.FACTIONS.ORANGE) {
        return { healthMult: 1.05, damageMult: 1.12, speedMult: 1.18, sizeMult: 1.0 };
    }
    return { healthMult: 1, damageMult: 1, speedMult: 1, sizeMult: 1 };
}

export default class Chigga extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, faction = CONFIG.FACTIONS.NEUTRAL) {
        let texture = getFactionTexture(scene, faction);

        let customWildType = null;
        if (faction === CONFIG.FACTIONS.WILD && scene.stageIndex === 5) {
            customWildType = Math.random() > 0.5 ? 'ant' : 'gnat';
            texture = customWildType;
        }

        super(scene, x, y, texture);

        this.scene = scene;
        this.faction = faction;
        this.isRecruited = false;

        const factionTint = getFactionTint(faction);
        if (factionTint) {
            this._baseTint = factionTint;
            this.setTint(factionTint);
        }
        this.customWildType = customWildType;
        this.hitFlashActive = false;
        this.gfx = null;

        const diffMult = scene.difficulty === 0 ? 0.8 : (scene.difficulty === 2 ? 1.3 : 1.0);

        this.baseSize = faction === CONFIG.FACTIONS.WILD ? 35 : 60;
        if (customWildType === 'ant') {
            this.baseSize = 65;
        } else if (customWildType === 'gnat') {
            this.baseSize = 42;
        }

        this.maxHealth = 50;
        if (faction === CONFIG.FACTIONS.WILD) {
            this.maxHealth = customWildType === 'ant' ? 120 : (customWildType === 'gnat' ? 50 : 20);
        }

        if (faction === CONFIG.FACTIONS.WILD || isEnemyFaction(faction)) {
            const extraHp = scene.stageIndex * 10;
            const profile = getEnemyFactionProfile(faction);
            this.maxHealth = (this.maxHealth + extraHp) * diffMult * profile.healthMult;
            this.baseDamage = (8 + scene.stageIndex * 2) * diffMult * profile.damageMult;
            this.enemySpeedMult = profile.speedMult;
            this.baseSize *= profile.sizeMult;
        } else {
            this.baseDamage = 8;
            this.enemySpeedMult = 1;
        }

        this.health = this.maxHealth;
        this.target = null;
        this.isDead = false;
        this.floatTween = null;
        this.uid = ++_chiggaIdCounter;

        this.hunger = 100;
        this.maxHunger = 100;
        this.hungerDamageMult = 1;
        this.hungerSpeedMult = 1;
        this._baseStrMult = 1;
        this._hungerInitialized = false;
        this._lastHungerStage = 'healthy';

        this.setDisplaySize(this.baseSize, this.baseSize);
        if (faction === CONFIG.FACTIONS.WILD) {
            const stageLvl = scene.stageIndex || 0;
            if (stageLvl >= 1) {
                const colors = [0xffffff, 0xffaa00, 0xaa00ff, 0x00ffaa, 0xff0044];
                this._baseTint = colors[Math.floor(Math.random() * Math.min(colors.length, stageLvl + 1))];
                this.setTint(this._baseTint);
            }
        }

        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.body.setCircle(25, 5, 5);
        this.body.setImmovable(true);

        if (customWildType === 'ant' || customWildType === 'gnat') {
            this.gfx = scene.add.graphics();
            this.gfx.setDepth(901);
            this.setVisible(false);
        }

        this.startFloat(y);
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        if (this.gfx) {
            this.gfx.clear();
            if (this.isDead || !this.active || !this.scene) {
                this.gfx.destroy();
                this.gfx = null;
                return;
            }
            this._drawProcedural(time, delta);
        }
    }

    _drawProcedural(time, delta) {
        const r = this.baseSize * 0.5;
        let angle = 0;
        if (this.body && (Math.abs(this.body.velocity.x) > 5 || Math.abs(this.body.velocity.y) > 5)) {
            angle = Math.atan2(this.body.velocity.y, this.body.velocity.x);
        } else if (this.target && this.target.active) {
            angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
        }

        this.gfx.setPosition(this.x, this.y);
        this.gfx.setRotation(angle);

        if (this.customWildType === 'ant') {
            this._drawAnt(time, delta, r);
        } else if (this.customWildType === 'gnat') {
            this._drawGnat(time, delta, r);
        }
    }

    _drawAnt(time, delta, r) {
        const speed = this.body ? Math.sqrt(this.body.velocity.x ** 2 + this.body.velocity.y ** 2) : 0;
        const walkPhase = speed > 10 ? time * 0.016 : time * 0.004;
        const swing = Math.sin(walkPhase) * r * 0.28;

        const bodyColor = this.hitFlashActive ? 0xffffff : 0x3d2719;
        const headColor = this.hitFlashActive ? 0xffffff : 0x2b1d11;
        const abdomenColor = this.hitFlashActive ? 0xffffff : 0x1d120a;

        this.gfx.fillStyle(0x000000, 0.22);
        this.gfx.fillEllipse(0, r * 0.4, r * 1.5, r * 0.8);

        this.gfx.lineStyle(3.2, bodyColor, 1);
        this.gfx.beginPath();
        this.gfx.moveTo(-r * 0.1, -r * 0.1);
        this.gfx.lineTo(-r * 0.4, -r * 0.5 + swing);
        this.gfx.lineTo(-r * 0.7, -r * 0.3 + swing);
        this.gfx.moveTo(-r * 0.1, r * 0.1);
        this.gfx.lineTo(-r * 0.4, r * 0.5 - swing);
        this.gfx.lineTo(-r * 0.7, r * 0.3 - swing);
        this.gfx.moveTo(0, -r * 0.1);
        this.gfx.lineTo(0, -r * 0.6 - swing);
        this.gfx.lineTo(r * 0.1, -r * 0.7 - swing);
        this.gfx.moveTo(0, r * 0.1);
        this.gfx.lineTo(0, r * 0.6 + swing);
        this.gfx.lineTo(r * 0.1, r * 0.7 + swing);
        this.gfx.moveTo(r * 0.1, -r * 0.1);
        this.gfx.lineTo(r * 0.5, -r * 0.5 + swing);
        this.gfx.lineTo(r * 0.9, -r * 0.2 + swing);
        this.gfx.moveTo(r * 0.1, r * 0.1);
        this.gfx.lineTo(r * 0.5, r * 0.5 - swing);
        this.gfx.lineTo(r * 0.9, r * 0.2 - swing);
        this.gfx.strokePath();

        this.gfx.fillStyle(abdomenColor, 1);
        this.gfx.fillEllipse(r * 0.45, 0, r * 0.45, r * 0.35);

        this.gfx.lineStyle(1.5, 0x000000, 0.45);
        this.gfx.beginPath();
        this.gfx.moveTo(r * 0.25, -r * 0.2);
        this.gfx.lineTo(r * 0.25, r * 0.2);
        this.gfx.moveTo(r * 0.45, -r * 0.3);
        this.gfx.lineTo(r * 0.45, r * 0.3);
        this.gfx.moveTo(r * 0.65, -r * 0.25);
        this.gfx.lineTo(r * 0.65, r * 0.25);
        this.gfx.strokePath();

        this.gfx.fillStyle(bodyColor, 1);
        this.gfx.fillCircle(0, 0, r * 0.25);

        this.gfx.fillStyle(headColor, 1);
        const headX = -r * 0.45;
        this.gfx.fillCircle(headX, 0, r * 0.28);

        this.gfx.lineStyle(2, headColor, 1);
        const antSwing = Math.sin(time * 0.008) * 0.15;
        this.gfx.beginPath();
        this.gfx.moveTo(headX - r * 0.15, -r * 0.1);
        this.gfx.lineTo(headX - r * 0.4, -r * 0.3 + antSwing * r);
        this.gfx.lineTo(headX - r * 0.65, -r * 0.2 + antSwing * r);
        this.gfx.moveTo(headX - r * 0.15, r * 0.1);
        this.gfx.lineTo(headX - r * 0.4, r * 0.3 - antSwing * r);
        this.gfx.lineTo(headX - r * 0.65, r * 0.2 - antSwing * r);
        this.gfx.strokePath();

        this.gfx.fillStyle(0xff1744, 1);
        this.gfx.fillCircle(headX - r * 0.12, -r * 0.14, 2.5);
        this.gfx.fillCircle(headX - r * 0.12, r * 0.14, 2.5);

        this.gfx.lineStyle(2.5, 0x110500, 1);
        this.gfx.beginPath();
        this.gfx.moveTo(headX - r * 0.2, -r * 0.05);
        this.gfx.lineTo(headX - r * 0.42, -r * 0.15);
        this.gfx.lineTo(headX - r * 0.38, r * 0.05);
        this.gfx.moveTo(headX - r * 0.2, r * 0.05);
        this.gfx.lineTo(headX - r * 0.42, r * 0.15);
        this.gfx.lineTo(headX - r * 0.38, -r * 0.05);
        this.gfx.strokePath();
    }

    _drawGnat(time, delta, r) {
        const flap = Math.sin(time * 0.09) * r * 0.75;
        const bodyColor = this.hitFlashActive ? 0xffffff : 0x222222;
        const headColor = this.hitFlashActive ? 0xffffff : 0x3e2723;
        const wingColor = 0xb4f0ff;
        const ox = Math.sin(time * 0.06) * 1.5;
        const oy = Math.cos(time * 0.05) * 1.5;

        this.gfx.fillStyle(0x000000, 0.16);
        this.gfx.fillEllipse(ox, oy + r * 0.6, r * 0.9, r * 0.55);

        this.gfx.lineStyle(1.5, 0x111111, 0.85);
        const legSway = Math.sin(time * 0.012) * 6;
        this.gfx.beginPath();
        this.gfx.moveTo(ox - r * 0.1, oy);
        this.gfx.lineTo(ox - r * 0.35, oy - r * 0.4 + legSway);
        this.gfx.moveTo(ox, oy);
        this.gfx.lineTo(ox - r * 0.1, oy - r * 0.45 - legSway);
        this.gfx.moveTo(ox + r * 0.1, oy);
        this.gfx.lineTo(ox + r * 0.2, oy - r * 0.4 + legSway);
        this.gfx.moveTo(ox - r * 0.1, oy);
        this.gfx.lineTo(ox - r * 0.35, oy + r * 0.4 - legSway);
        this.gfx.moveTo(ox, oy);
        this.gfx.lineTo(ox - r * 0.1, oy + r * 0.45 + legSway);
        this.gfx.moveTo(ox + r * 0.1, oy);
        this.gfx.lineTo(ox + r * 0.2, oy + r * 0.4 - legSway);
        this.gfx.strokePath();

        this.gfx.fillStyle(wingColor, 0.65);
        this.gfx.fillEllipse(ox, oy - r * 0.25 - flap * 0.2, r * 1.2, r * 0.44);
        this.gfx.lineStyle(1.5, 0xffffff, 0.8);
        this.gfx.strokeEllipse(ox, oy - r * 0.25 - flap * 0.2, r * 1.2, r * 0.44);
        this.gfx.fillStyle(wingColor, 0.45);
        this.gfx.fillEllipse(ox + r * 0.12, oy - r * 0.3 - flap * 0.15, r * 0.8, r * 0.32);
        this.gfx.strokeEllipse(ox + r * 0.12, oy - r * 0.3 - flap * 0.15, r * 0.8, r * 0.32);
        this.gfx.fillStyle(wingColor, 0.65);
        this.gfx.fillEllipse(ox, oy + r * 0.25 + flap * 0.2, r * 1.2, r * 0.44);
        this.gfx.strokeEllipse(ox, oy + r * 0.25 + flap * 0.2, r * 1.2, r * 0.44);
        this.gfx.fillStyle(wingColor, 0.45);
        this.gfx.fillEllipse(ox + r * 0.12, oy + r * 0.3 + flap * 0.15, r * 0.8, r * 0.32);
        this.gfx.strokeEllipse(ox + r * 0.12, oy + r * 0.3 + flap * 0.15, r * 0.8, r * 0.32);

        this.gfx.fillStyle(bodyColor, 1);
        this.gfx.fillEllipse(ox, oy, r * 0.42, r * 0.28);
        this.gfx.fillStyle(0x111111, 1);
        this.gfx.fillCircle(ox + r * 0.35, oy, r * 0.18);
        this.gfx.fillCircle(ox + r * 0.52, oy, r * 0.12);
        this.gfx.fillStyle(headColor, 1);
        const headX = ox - r * 0.38;
        this.gfx.fillCircle(headX, oy, r * 0.25);
        this.gfx.fillStyle(0xd50000, 1);
        this.gfx.fillCircle(headX - r * 0.08, oy - r * 0.14, r * 0.12);
        this.gfx.fillCircle(headX - r * 0.08, oy + r * 0.14, r * 0.12);
    }

    initializeHunger() {
        this.maxHunger = 100;
        this.hunger = 100;
        this.hungerDamageMult = 1;
        this.hungerSpeedMult = 1;
        this._hungerInitialized = true;
        this._lastHungerStage = 'healthy';
        this.refreshVisualState();
    }

    feed(amount = 25) {
        if (!this.active || this.isDead || !this.isRecruited) return;
        if (!this._hungerInitialized) this.initializeHunger();
        this.hunger = Phaser.Math.Clamp((this.hunger ?? 100) + amount, 0, this.maxHunger || 100);
        this.refreshVisualState();
    }

    updateHunger(dt, options = {}) {
        if (!this.isRecruited || this.isDead || !this.active) return;
        if (!this._hungerInitialized) this.initializeHunger();

        const drainPerSecond = options.drainPerSecond ?? 0.95;
        const chargeMult = options.charging ? 2.2 : 1;
        const bossMult = options.inBossFight ? 1.35 : 1;
        this.hunger = Phaser.Math.Clamp(this.hunger - dt * drainPerSecond * chargeMult * bossMult, 0, this.maxHunger || 100);

        this.refreshVisualState();

        if (this.hunger <= 0) {
            this.starvePoof();
        }
    }

    refreshVisualState() {
        if (!this.active || this.isDead) return;
        const hunger = typeof this.hunger === 'number' ? this.hunger : 100;
        let stage = 'healthy';
        let sizeMult = 1;
        this.hungerDamageMult = 1;
        this.hungerSpeedMult = 1;

        if (this.isRecruited) {
            if (hunger < 20) {
                stage = 'starving';
                sizeMult = 0.58;
                this.hungerDamageMult = 0.42;
                this.hungerSpeedMult = 0.62;
            } else if (hunger < 45) {
                stage = 'hungry';
                sizeMult = 0.76;
                this.hungerDamageMult = 0.68;
                this.hungerSpeedMult = 0.78;
            } else if (hunger < 70) {
                stage = 'peckish';
                sizeMult = 0.9;
                this.hungerDamageMult = 0.86;
                this.hungerSpeedMult = 0.9;
            }
        }

        const healthPercent = Math.max(0.3, this.health / Math.max(1, this.maxHealth));
        const visualSize = this.baseSize * healthPercent * sizeMult;
        this.setDisplaySize(visualSize, visualSize);

        if (this.isRecruited && stage !== this._lastHungerStage && this.scene?.showFeedback) {
            if (stage === 'hungry') this.scene.showFeedback('HUNGRY', 0xffaa00, this.x, this.y - 50);
            if (stage === 'starving') this.scene.showFeedback('STARVING', 0xff3333, this.x, this.y - 50);
        }
        this._lastHungerStage = stage;
    }

    starvePoof() {
        if (this.isDead || !this.scene) return;
        this.isDead = true;

        // CHIGGAS_STEAM_PASS_61_TEN_ENEMIES_DEFEATED_CHIGGA_BEGIN
        try {
            const __chiggasConfig = (typeof CONFIG !== 'undefined') ? CONFIG : null;
            const __chiggasFactions = __chiggasConfig && __chiggasConfig.FACTIONS ? __chiggasConfig.FACTIONS : {};
            const __chiggasFaction = this.faction;
            const __chiggasIsEnemyFaction = (typeof isEnemyFaction === 'function') ? isEnemyFaction(__chiggasFaction) : false;
            const __chiggasIsWildFaction = __chiggasFaction === __chiggasFactions.WILD;
            const __chiggasIsPlayerFaction = __chiggasFaction === __chiggasFactions.PLAYER;
            if (!__chiggasIsPlayerFaction && (__chiggasIsWildFaction || __chiggasIsEnemyFaction) && this.scene && typeof window !== 'undefined' && window.dispatchEvent) {
                if (typeof this.scene.__chiggasSteamEnemyDefeatedCount !== 'number') this.scene.__chiggasSteamEnemyDefeatedCount = 0;
                this.scene.__chiggasSteamEnemyDefeatedCount += 1;
                const __chiggasEnemyDefeatedCount = this.scene.__chiggasSteamEnemyDefeatedCount;
                if (!this.scene.__chiggasSteamTenEnemiesDefeatedSent && __chiggasEnemyDefeatedCount >= 10) {
                    this.scene.__chiggasSteamTenEnemiesDefeatedSent = true;
                    window.dispatchEvent(new CustomEvent('chiggas-steam-achievement-unlock-request', {
                        detail: {
                            achievement: 'TEN_ENEMIES_DEFEATED',
                            metadata: {
                                source: 'Chigga_enemy_death_count_side_effect',
                                scene: 'GameScene',
                                event: 'ten_enemies_defeated_chigga_death_count',
                                reason: 'enemy_or_wild_chigga_death_count_reached_10',
                                defeatedCount: __chiggasEnemyDefeatedCount,
                                threshold: 10,
                                faction: String(__chiggasFaction || ''),
                                isWildFaction: Boolean(__chiggasIsWildFaction),
                                isEnemyFaction: Boolean(__chiggasIsEnemyFaction),
                                x: Math.round(Number(this.x || 0)),
                                y: Math.round(Number(this.y || 0)),
                                storeShouldShow: 'TEST BUY',
                                pass: 'steam_desktop_wrapper_pass_61',
                                hook: 'chigga_enemy_death_count_61'
                            }
                        }
                    }));
                }
            }
        } catch (_) {}
        // CHIGGAS_STEAM_PASS_61_TEN_ENEMIES_DEFEATED_CHIGGA_END

        // CHIGGAS_STEAM_PASS_60_FIRST_ENEMY_DEFEATED_CHIGGA_BEGIN
        try {
            const __chiggasConfig = (typeof CONFIG !== 'undefined') ? CONFIG : null;
            const __chiggasFactions = __chiggasConfig && __chiggasConfig.FACTIONS ? __chiggasConfig.FACTIONS : {};
            const __chiggasFaction = this.faction;
            const __chiggasIsEnemyFaction = (typeof isEnemyFaction === 'function') ? isEnemyFaction(__chiggasFaction) : false;
            const __chiggasIsWildFaction = __chiggasFaction === __chiggasFactions.WILD;
            const __chiggasIsPlayerFaction = __chiggasFaction === __chiggasFactions.PLAYER;
            if (!__chiggasIsPlayerFaction && (__chiggasIsWildFaction || __chiggasIsEnemyFaction) && this.scene && !this.scene.__chiggasSteamFirstEnemyDefeatedSent && typeof window !== 'undefined' && window.dispatchEvent) {
                this.scene.__chiggasSteamFirstEnemyDefeatedSent = true;
                const __chiggasEnemyDefeatedMetadata = {
                    source: 'Chigga_enemy_death_side_effect',
                    scene: 'GameScene',
                    event: 'first_enemy_defeated_chigga_death',
                    reason: 'enemy_or_wild_chigga_isDead_set_true',
                    faction: String(__chiggasFaction || ''),
                    isWildFaction: Boolean(__chiggasIsWildFaction),
                    isEnemyFaction: Boolean(__chiggasIsEnemyFaction),
                    x: Math.round(Number(this.x || 0)),
                    y: Math.round(Number(this.y || 0)),
                    storeShouldShow: 'TEST BUY',
                    pass: 'steam_desktop_wrapper_pass_60',
                    hook: 'chigga_enemy_death_60'
                };
                window.dispatchEvent(new CustomEvent('chiggas-steam-achievement-unlock-request', {
                    detail: {
                        achievement: 'FIRST_ENEMY_DEFEATED',
                        metadata: __chiggasEnemyDefeatedMetadata
                    }
                }));
            }
        } catch (_) {}
        // CHIGGAS_STEAM_PASS_60_FIRST_ENEMY_DEFEATED_CHIGGA_END
        if (this.scene.player?.followers) {
            this.scene.player.followers = this.scene.player.followers.filter(f => f !== this);
        }
        this.scene.createImpactEffect?.(this.x, this.y, 0x777777, 'punch');
        this.scene.showFeedback?.('STARVED!', 0xaaaaaa, this.x, this.y - 40);
        this.stopFloat();
        if (this.gfx) {
            this.gfx.destroy();
            this.gfx = null;
        }
        this.destroy();
    }

    startFloat(originY) {
        if (this.floatTween) {
            this.floatTween.destroy();
            this.floatTween = null;
        }
        this.floatTween = this.scene.tweens.add({
            targets: this,
            y: originY - 8,
            duration: 1200 + Math.random() * 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    stopFloat() {
        if (this.floatTween) {
            this.floatTween.stop();
            this.floatTween.destroy();
            this.floatTween = null;
        }
    }

    setFaction(faction) {
        this.faction = faction;
        const texture = getFactionTexture(this.scene, faction);

        if (faction !== CONFIG.FACTIONS.WILD) {
            this.customWildType = null;
            if (this.gfx) {
                this.gfx.destroy();
                this.gfx = null;
            }
            this.setVisible(true);
        }

        this.setTexture(texture);

        const factionTint = getFactionTint(faction);
        if (factionTint) {
            this._baseTint = factionTint;
            this.clearTint();
            this.setTint(factionTint);
        } else {
            this._baseTint = null;
            if (faction === CONFIG.FACTIONS.PLAYER || faction === CONFIG.FACTIONS.NEUTRAL || faction === CONFIG.FACTIONS.BLUE || faction === CONFIG.FACTIONS.GREEN) {
                this.clearTint();
            }
        }

        if (isEnemyFaction(faction)) {
            const profile = getEnemyFactionProfile(faction);
            const oldPct = this.maxHealth > 0 ? this.health / this.maxHealth : 1;
            this.maxHealth = Math.max(1, Math.round(50 * profile.healthMult));
            this.health = Math.max(1, this.maxHealth * oldPct);
            this.baseDamage = Math.max(1, 8 * profile.damageMult);
            this.enemySpeedMult = profile.speedMult;
            this.setDisplaySize(this.baseSize * profile.sizeMult, this.baseSize * profile.sizeMult);
        }
    }

    applyStrBoost(str) {
        const mult = 1 + (str - 1) * 0.08;
        this._baseStrMult = mult;
        const oldPct = this.maxHealth > 0 ? this.health / this.maxHealth : 1;
        this.maxHealth = Math.round(50 * mult);
        this.health = Math.max(1, this.maxHealth * oldPct);
        this.strMult = mult;
        this.refreshVisualState();
    }

    takeDamage(amount, attacker) {
        if (this.isDead) return;
        this.health -= amount;

        this.hitFlashActive = true;
        this.setTintFill(0xffffff);
        this.scene.time.delayedCall(80, () => {
            this.hitFlashActive = false;
            if (this.active && !this.isDead) {
                if (this._baseTint) {
                    this.clearTint();
                    this.setTint(this._baseTint);
                } else {
                    this.clearTint();
                }
            }
        });

        this.refreshVisualState();
        if (this.health <= 0) this.poof(attacker);
    }

    heal(amount) {
        if (this.isDead || this.health >= this.maxHealth) return;
        this.health = Math.min(this.maxHealth, this.health + amount);
        this.refreshVisualState();
    }

    poof(attacker) {
        if (this.isDead) return;
        this.isDead = true;

        // CHIGGAS_STEAM_PASS_61_TEN_ENEMIES_DEFEATED_CHIGGA_BEGIN
        try {
            const __chiggasConfig = (typeof CONFIG !== 'undefined') ? CONFIG : null;
            const __chiggasFactions = __chiggasConfig && __chiggasConfig.FACTIONS ? __chiggasConfig.FACTIONS : {};
            const __chiggasFaction = this.faction;
            const __chiggasIsEnemyFaction = (typeof isEnemyFaction === 'function') ? isEnemyFaction(__chiggasFaction) : false;
            const __chiggasIsWildFaction = __chiggasFaction === __chiggasFactions.WILD;
            const __chiggasIsPlayerFaction = __chiggasFaction === __chiggasFactions.PLAYER;
            if (!__chiggasIsPlayerFaction && (__chiggasIsWildFaction || __chiggasIsEnemyFaction) && this.scene && typeof window !== 'undefined' && window.dispatchEvent) {
                if (typeof this.scene.__chiggasSteamEnemyDefeatedCount !== 'number') this.scene.__chiggasSteamEnemyDefeatedCount = 0;
                this.scene.__chiggasSteamEnemyDefeatedCount += 1;
                const __chiggasEnemyDefeatedCount = this.scene.__chiggasSteamEnemyDefeatedCount;
                if (!this.scene.__chiggasSteamTenEnemiesDefeatedSent && __chiggasEnemyDefeatedCount >= 10) {
                    this.scene.__chiggasSteamTenEnemiesDefeatedSent = true;
                    window.dispatchEvent(new CustomEvent('chiggas-steam-achievement-unlock-request', {
                        detail: {
                            achievement: 'TEN_ENEMIES_DEFEATED',
                            metadata: {
                                source: 'Chigga_enemy_death_count_side_effect',
                                scene: 'GameScene',
                                event: 'ten_enemies_defeated_chigga_death_count',
                                reason: 'enemy_or_wild_chigga_death_count_reached_10',
                                defeatedCount: __chiggasEnemyDefeatedCount,
                                threshold: 10,
                                faction: String(__chiggasFaction || ''),
                                isWildFaction: Boolean(__chiggasIsWildFaction),
                                isEnemyFaction: Boolean(__chiggasIsEnemyFaction),
                                x: Math.round(Number(this.x || 0)),
                                y: Math.round(Number(this.y || 0)),
                                storeShouldShow: 'TEST BUY',
                                pass: 'steam_desktop_wrapper_pass_61',
                                hook: 'chigga_enemy_death_count_61'
                            }
                        }
                    }));
                }
            }
        } catch (_) {}
        // CHIGGAS_STEAM_PASS_61_TEN_ENEMIES_DEFEATED_CHIGGA_END

        // CHIGGAS_STEAM_PASS_60_FIRST_ENEMY_DEFEATED_CHIGGA_BEGIN
        try {
            const __chiggasConfig = (typeof CONFIG !== 'undefined') ? CONFIG : null;
            const __chiggasFactions = __chiggasConfig && __chiggasConfig.FACTIONS ? __chiggasConfig.FACTIONS : {};
            const __chiggasFaction = this.faction;
            const __chiggasIsEnemyFaction = (typeof isEnemyFaction === 'function') ? isEnemyFaction(__chiggasFaction) : false;
            const __chiggasIsWildFaction = __chiggasFaction === __chiggasFactions.WILD;
            const __chiggasIsPlayerFaction = __chiggasFaction === __chiggasFactions.PLAYER;
            if (!__chiggasIsPlayerFaction && (__chiggasIsWildFaction || __chiggasIsEnemyFaction) && this.scene && !this.scene.__chiggasSteamFirstEnemyDefeatedSent && typeof window !== 'undefined' && window.dispatchEvent) {
                this.scene.__chiggasSteamFirstEnemyDefeatedSent = true;
                const __chiggasEnemyDefeatedMetadata = {
                    source: 'Chigga_enemy_death_side_effect',
                    scene: 'GameScene',
                    event: 'first_enemy_defeated_chigga_death',
                    reason: 'enemy_or_wild_chigga_isDead_set_true',
                    faction: String(__chiggasFaction || ''),
                    isWildFaction: Boolean(__chiggasIsWildFaction),
                    isEnemyFaction: Boolean(__chiggasIsEnemyFaction),
                    x: Math.round(Number(this.x || 0)),
                    y: Math.round(Number(this.y || 0)),
                    storeShouldShow: 'TEST BUY',
                    pass: 'steam_desktop_wrapper_pass_60',
                    hook: 'chigga_enemy_death_60'
                };
                window.dispatchEvent(new CustomEvent('chiggas-steam-achievement-unlock-request', {
                    detail: {
                        achievement: 'FIRST_ENEMY_DEFEATED',
                        metadata: __chiggasEnemyDefeatedMetadata
                    }
                }));
            }
        } catch (_) {}
        // CHIGGAS_STEAM_PASS_60_FIRST_ENEMY_DEFEATED_CHIGGA_END
        if (this.scene.createImpactEffect) {
            this.scene.createImpactEffect(this.x, this.y, 0xff4400, 'punch');
        }

        if (attacker && attacker.faction === CONFIG.FACTIONS.PLAYER) {
            if (this.scene.player) {
                if (this.faction === CONFIG.FACTIONS.WILD) {
                    const gain = this.scene.player.gainStrFromFood ? this.scene.player.gainStrFromFood(0.20) : 0;
                    this.scene.addScore(50, this.x, this.y);
                } else {
                    const gain = this.scene.player.gainStrFromFood ? this.scene.player.gainStrFromFood(0.05 + (this.strGained || 0) * 0.35) : 0;
                    this.scene.addScore(20, this.x, this.y);
                }
            }

            if (attacker.feed) attacker.feed(this.faction === CONFIG.FACTIONS.WILD ? 34 : 18);
            this._feedNearbyPlayerArmy(attacker, this.faction === CONFIG.FACTIONS.WILD ? 12 : 6);
        }

        if (this.faction === CONFIG.FACTIONS.PLAYER) {
            this.scene.player.followers = this.scene.player.followers.filter(f => f !== this);
        } else {
            this.scene.enemies.forEach(e => {
                e.followers = e.followers.filter(f => f !== this);
            });
        }

        this.stopFloat();
        if (this.gfx) {
            this.gfx.destroy();
            this.gfx = null;
        }
        this.destroy();
    }

    _feedNearbyPlayerArmy(mainFeeder, amount) {
        const followers = this.scene?.player?.followers || [];
        followers.forEach(f => {
            if (!f || !f.active || f === mainFeeder || !f.feed) return;
            const d = Phaser.Math.Distance.Between(this.x, this.y, f.x, f.y);
            if (d <= 320) f.feed(amount);
        });
    }

    updateAttack() {
        if (!this.target || !this.target.active) {
            this.target = null;
            return false;
        }
        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
        const speedMult = (this.hungerSpeedMult || 1) * (this.enemySpeedMult || 1);
        this.body.setVelocity(Math.cos(angle) * 380 * speedMult, Math.sin(angle) * 380 * speedMult);

        const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
        if (dist < 55) {
            const now = this.scene.time.now;
            if (!this.lastAttack || now - this.lastAttack > 600) {
                this.lastAttack = now;
                if (this.target.takeDamage) {
                    const hungerMult = this.hungerDamageMult || 1;
                    const dmg = Math.round((this.baseDamage || 12) * (this.strMult || 1) * hungerMult);
                    this.target.takeDamage(Math.max(1, dmg), this);
                }
            }
        }
        return true;
    }

    destroy(fromScene) {
        if (this.gfx) {
            this.gfx.destroy();
            this.gfx = null;
        }
        this.stopFloat();
        super.destroy(fromScene);
    }
}