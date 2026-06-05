import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { playMunch } from '../audio/AudioManager.js';

export default class Player extends Phaser.GameObjects.Container {
    constructor(scene, x, y) {
        super(scene, x, y);

        this.scene = scene;
        this.faction = CONFIG.FACTIONS.PLAYER;

        this.sprite = scene.add.sprite(0, 0, 'player');
        this.baseDisplaySize = 80;
        this.sprite.setDisplaySize(this.baseDisplaySize, this.baseDisplaySize);
        this.add(this.sprite);

        this.strength = 1;
        this.sizeMultiplier = 1;
        this.followers = [];
        this.chiggasEaten = 0;
        this.enemiesDefeated = 0;

        // Army Level progression controls max army size.
        // STR still controls strength/damage/growth, but no longer controls army capacity.
        this.armyLevel = 1;
        this.armyXp = 0;
        this.armyMaxBonus = 0;

        this.speedMultiplier = 1;
        this.speedBoostTimer = null;
        this._ringPhase = 0;
        this._lastUpdateTime = undefined;
        this._lastArmyStarvingNotice = 0;

        scene.physics.add.existing(this);
        this.body.setCircle(35, -35, -35);
        this.body.setCollideWorldBounds(true);

        scene.add.existing(this);
    }

    getArmyXpRequired() {
        return Math.max(3, 3 + (this.armyLevel - 1) * 2);
    }

    getArmyLevelProgress() {
        const required = this.getArmyXpRequired();
        return {
            level: this.armyLevel,
            xp: this.armyXp,
            required,
            pct: required > 0 ? Phaser.Math.Clamp(this.armyXp / required, 0, 1) : 0
        };
    }

    getMaxArmySize() {
        return Math.min(CONFIG.MAX_ARMY_LIMIT, CONFIG.BASE_ARMY_LIMIT + this.armyMaxBonus);
    }

    canRecruit() {
        return this.followers.length < this.getMaxArmySize();
    }

    addArmyXp(amount = 1) {
        if (this.getMaxArmySize() >= CONFIG.MAX_ARMY_LIMIT) {
            this.armyXp = this.getArmyXpRequired();
            return false;
        }

        this.armyXp += amount;
        let leveled = false;

        while (this.armyXp >= this.getArmyXpRequired() && this.getMaxArmySize() < CONFIG.MAX_ARMY_LIMIT) {
            this.armyXp -= this.getArmyXpRequired();
            this.armyLevel += 1;
            this.armyMaxBonus += 1;
            leveled = true;

            if (this.scene && this.scene.showFeedback) {
                this.scene.showFeedback('ARMY LEVEL UP! MAX +1', 0x39ff14, this.x, this.y - 150);
            }
        }

        if (this.getMaxArmySize() >= CONFIG.MAX_ARMY_LIMIT) {
            this.armyXp = this.getArmyXpRequired();
        }

        return leveled;
    }

    update(time) {
        this.updateFollowers(time);
    }

    _getDifficultyHungerDrain() {
        const difficulty = this.scene?.difficulty ?? 1;
        if (difficulty === 0) return 0.55;
        if (difficulty === 2) return 1.45;
        return 0.95;
    }

    updateFollowers(time) {
        if (this._ringPhase === undefined) this._ringPhase = 0;
        const dt = this._lastUpdateTime !== undefined ? Math.max(0, (time - this._lastUpdateTime) / 1000) : 0;
        this._lastUpdateTime = time;
        this._ringPhase += dt * 0.6;
        if (this._ringPhase > Math.PI * 2) this._ringPhase -= Math.PI * 2;

        const cx = this.x;
        const cy = this.y + 90;
        const orbitRadius = 55 + this.followers.length * 8;

        this.followers = this.followers.filter(f => f && f.active && !f.isDead);

        const total = Math.max(1, this.followers.length);
        const hungerDrain = this._getDifficultyHungerDrain();

        this.followers.forEach((follower, index) => {
            if (!follower || !follower.active) return;

            const distFromPlayer = Phaser.Math.Distance.Between(this.x, this.y, follower.x, follower.y);
            const leashDistance = this.scene?.bossPhaseActive ? 620 : 520;
            const hardRecallDistance = this.scene?.bossPhaseActive ? 900 : 760;
            const shouldRecall = distFromPlayer > leashDistance;
            const shouldHardRecall = distFromPlayer > hardRecallDistance;

            const charging = follower._chargeExpiry && time < follower._chargeExpiry && !shouldRecall;
            if (follower.updateHunger) {
                follower.updateHunger(dt, {
                    drainPerSecond: hungerDrain,
                    charging: !!charging,
                    inBossFight: !!(this.scene?.bossPhaseActive)
                });
            }

            if (!follower.active || follower.isDead) return;

            // Hard leash: the army must disengage and return if the player leaves the fight.
            // This prevents followers from staying latched to bosses while the player dodges safely.
            if (shouldRecall) {
                follower.target = null;
                follower._chargeExpiry = null;
                follower._chargeVec = null;
            }

            if (charging) {
                follower.body.setVelocity(follower._chargeVec.x, follower._chargeVec.y);
                return;
            } else if (follower._chargeExpiry) {
                follower._chargeExpiry = null;
            }

            if (follower.target && !shouldHardRecall) {
                const attacking = follower.updateAttack();
                if (!attacking) follower.target = null;
                return;
            } else if (follower.target) {
                follower.target = null;
            }

            const slotAngle = (index / total) * Math.PI * 2 + this._ringPhase;
            const slotX = cx + Math.cos(slotAngle) * orbitRadius;
            const slotY = cy * 0.6 + this.y * 0.4 + Math.sin(slotAngle) * orbitRadius * 0.7;

            const dx = slotX - follower.x;
            const dy = slotY - follower.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 18) {
                const hungerSpeedMult = follower.hungerSpeedMult || 1;
                const playerSpeedMult = this.speedMultiplier || 1;
                const catchupMult = distFromPlayer > leashDistance ? 1.35 : 1.0;
                const maxFollowSpeed = 500 * playerSpeedMult * catchupMult;
                const desiredFollowSpeed = dist * 4 * playerSpeedMult * catchupMult;
                const spd = Math.min(maxFollowSpeed, desiredFollowSpeed) * hungerSpeedMult;
                follower.body.setVelocity((dx / dist) * spd, (dy / dist) * spd);
            } else {
                follower.body.setVelocity(0, 0);
            }
        });

        this._maybeShowArmyHungerNotice(time);
    }

    _maybeShowArmyHungerNotice(time) {
        if (!this.scene || !this.followers || this.followers.length === 0) return;
        const avg = this.getArmyHungerAverage();
        if (avg >= 35) return;
        if (time - this._lastArmyStarvingNotice < 6000) return;

        this._lastArmyStarvingNotice = time;
        this.scene.showFeedback(
            avg < 18 ? 'ARMY STARVING!' : 'ARMY HUNGRY!',
            avg < 18 ? 0xff3333 : 0xffaa00,
            this.x,
            this.y - 120
        );
    }

    getArmyHungerAverage() {
        const living = this.followers.filter(f => f && f.active && !f.isDead);
        if (living.length === 0) return 100;
        const sum = living.reduce((total, f) => total + (typeof f.hunger === 'number' ? f.hunger : 100), 0);
        return Math.round(sum / living.length);
    }

    takeDamage(amount, attacker = null) {
        if (this._damageCooldown && this.scene.time.now - this._damageCooldown < 300) return;
        this._damageCooldown = this.scene.time.now;

        if (attacker && attacker.active && attacker.takeDamage) {
            const str = this.getSTR();
            const counterDmg = Math.round(amount * (1 + Math.max(0, Math.sqrt(str) - 1) * 0.18));
            attacker.takeDamage(counterDmg, this);
            this.scene.createImpactEffect(attacker.x, attacker.y, 0xffff00, 'punch', counterDmg, false);
        }

        const living = this.followers.filter(f => f && f.active && !f.isDead);
        if (living.length > 0) {
            let shield = living[0];
            if (attacker) {
                let minD = Infinity;
                living.forEach(f => {
                    const d = Phaser.Math.Distance.Between(f.x, f.y, attacker.x, attacker.y);
                    if (d < minD) { minD = d; shield = f; }
                });
            }
            shield.takeDamage(amount, attacker);
            this.scene.createImpactEffect(shield.x, shield.y, 0xff6600, 'punch', amount, true);
            this.scene.cameras.main.shake(60, 0.005);
            this.scene.tweens.add({
                targets: shield, alpha: 0.2, duration: 60, yoyo: true, repeat: 3
            });
            return;
        }

        this.strength = Math.max(0, this.strength - amount);
        this.scene.cameras.main.shake(80, 0.008);
        this.scene.tweens.add({
            targets: this.sprite, alpha: 0.2, duration: 80, yoyo: true, repeat: 2
        });

        if (this.strength <= 0) {
            this.scene.handlePlayerDeath();
        }
    }

    addFollower(follower) {
        follower.stopFloat();
        follower.setFaction(this.faction);
        follower.isRecruited = true;
        follower.body.setImmovable(false);
        follower.target = null;

        if (follower.initializeHunger) follower.initializeHunger();
        if (follower.applyStrBoost) follower.applyStrBoost(this.getSTR());

        this.followers.push(follower);
        if (this.scene && this.scene.addScore) this.scene.addScore(10, follower.x, follower.y);
    }

    eatFollower(follower) {
        if (!follower || !follower.active) return;
        this.chiggasEaten++;
        this.addArmyXp(1);

        const hungerBonus = typeof follower.hunger === 'number' ? follower.hunger / 100 : 1;
        const gain = 0.20 + hungerBonus * 0.22;
        this.gainStrFromFood(gain);

        if (this.scene && this.scene.addScore) this.scene.addScore(10, follower.x, follower.y);
        this.followers = this.followers.filter(f => f !== follower);
        follower.stopFloat();
        follower.isDead = true;
        playMunch(0.8);
        this.scene.createImpactEffect(follower.x, follower.y, 0xffaa00, 'bite');
        follower.destroy();
    }

    gainStrFromFood(baseAmount) {
        const current = Math.max(1, this.strength);
        const difficulty = this.scene?.difficulty ?? 1;
        const diffMult = difficulty === 0 ? 0.95 : (difficulty === 2 ? 0.58 : 0.75);
        const diminishing = 1 / (1 + current * 0.22);
        const finalGain = Math.max(0.015, baseAmount * diffMult * diminishing);
        this.gainStr(finalGain);
        return finalGain;
    }

    gainStr(amount) {
        const oldStr = Math.floor(this.strength);
        this.strength += amount;
        const newStr = Math.floor(this.strength);

        const oldBucket = Math.floor(oldStr / 6);
        const newBucket = Math.floor(newStr / 6);
        if (newBucket > oldBucket) {
            const growthSteps = newBucket - oldBucket;
            this.sizeMultiplier = Math.min(1.85, this.sizeMultiplier + 0.07 * growthSteps);
            const newSize = this.baseDisplaySize * this.sizeMultiplier;
            this.sprite.setDisplaySize(newSize, newSize);
            const r = 35 * this.sizeMultiplier;
            this.body.setCircle(r, -r, -r);
            if (this.scene && this.scene.showFeedback) {
                this.scene.showFeedback('BIGGER!', 0xffaa00, this.x, this.y);
            }
        }

        if (newStr > oldStr) {
            this.followers.forEach(f => {
                if (f && f.applyStrBoost) {
                    const pct = f.maxHealth > 0 ? f.health / f.maxHealth : 1;
                    f.applyStrBoost(newStr);
                    f.health = f.maxHealth * pct;
                    if (f.refreshVisualState) f.refreshVisualState();
                    else if (f.heal) f.heal(0);
                }
            });
        }
    }

    applySpeedBoost() {
        this.speedMultiplier = 2;
        if (this.speedBoostTimer) this.speedBoostTimer.remove();
        this.speedBoostTimer = this.scene.time.addEvent({
            delay: 10000,
            callback: () => {
                this.speedMultiplier = 1;
            }
        });
    }

    getSTR() {
        return Math.floor(this.strength);
    }

    respawn(x, y) {
        this.setPosition(x, y);
        this.strength = Math.max(1, Math.floor(this.strength * 0.5));
        this.sizeMultiplier = 1;
        this.chiggasEaten = 0;
        this.followers = [];
        this.sprite.setDisplaySize(this.baseDisplaySize, this.baseDisplaySize);
        this.body.setCircle(35, -35, -35);
    }
}