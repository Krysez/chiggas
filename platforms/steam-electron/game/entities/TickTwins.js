import Phaser from 'phaser';
import { CONFIG } from '../config.js';

class TickTwinEntity extends Phaser.GameObjects.Container {
    constructor(scene, x, y, name, color, eyeColor, baseSize = 75) {
        super(scene, x, y);

        this.scene = scene;
        this.faction = 'BOSS';
        this.twinName = name;
        this.customColor = color;
        this.customEyeColor = eyeColor;

        const diffMult = scene.difficulty === 0 ? 0.8 : (scene.difficulty === 2 ? 1.3 : 1.0);

        this.maxHealth = Math.round(1100 * diffMult);
        this.health = this.maxHealth;
        this.baseSize = baseSize;
        this.sizeMultiplier = 1;
        this.moveSpeed = 170 * diffMult;
        this.attackDamage = Math.round(16 * diffMult);
        this.attackCooldown = 850;
        this._lastAttack = 0;
        this._lastHitTime = 0;

        this.state = 'HUNTING';
        this.currentTarget = null;
        this.behaviorMode = 'BALANCED'; // BALANCED, TURF_TAKER, PLAYER_HUNTER
        this.isDead = false;
        this._isDying = false;
        this._hitFlash = 0;
        this._rageMode = false;

        this._burrowCooldown = 0;
        this._burrowInterval = 10000 + Math.random() * 5000;
        this._burrowDepth = 0;
        this._burrowTarget = null;
        this._burrowMode = 'normal';
        this._burrowHitCount = 0;
        this._burrowChain = 0;

        this._lungeCooldown = 5500 + Math.random() * 2500;
        this._lungeChargeTimer = 0;
        this._lungeTarget = null;
        this._lungeLatchTime = 0;

        this._legPhase = 0;
        this._bodyBob = 0;
        this._eyeBlink = false;
        this._blinkTimer = 0;
        this._stompScale = 1;
        this._moveTime = 0;
        this._bloodSwell = 0;

        this.gfxShadow = scene.add.graphics();
        this.gfxLegs = scene.add.graphics();
        this.gfxBody = scene.add.graphics();
        this.gfxFace = scene.add.graphics();
        this.gfxHud = scene.add.graphics();
        this.add([this.gfxShadow, this.gfxLegs, this.gfxBody, this.gfxFace, this.gfxHud]);

        this.nameTag = scene.add.text(0, -(this.baseSize + 58), name.toUpperCase(), {
            fontSize: '18px',
            fontFamily: 'Dhurjati',
            color: '#' + color.toString(16).padStart(6, '0'),
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5, 1);
        this.add(this.nameTag);

        this._warningGfx = scene.add.graphics().setDepth(895);

        scene.physics.add.existing(this);
        const r = this.baseSize * 0.85;
        this.body.setCircle(r, -r, -r);
        this.body.setCollideWorldBounds(true);

        scene.add.existing(this);
        this.setDepth(900);
        this._drawAll(0);
    }

    get _legColor() {
        return this.twinName === 'crimson' ? 0x550006 : 0x2a0a3a;
    }

    get _bellyColor() {
        const t = 0.5 + 0.5 * Math.sin(this._bloodSwell);
        const r = this.twinName === 'crimson' ? Math.round(160 + t * 80) : Math.round(90 + t * 80);
        const g = this.twinName === 'crimson' ? Math.round(10 + t * 10) : Math.round(10 + t * 20);
        const b = this.twinName === 'crimson' ? Math.round(20 + t * 20) : Math.round(120 + t * 80);
        return (r << 16) | (g << 8) | b;
    }

    _drawAll(time) {
        const vis = 1 - this._burrowDepth;
        if (vis <= 0) {
            this.gfxShadow.clear();
            this.gfxLegs.clear();
            this.gfxBody.clear();
            this.gfxFace.clear();
            this.gfxHud.clear();
            return;
        }

        const s = this.sizeMultiplier * vis;
        const r = this.baseSize * s;
        const bob = this._bodyBob * s;
        const stomp = this._stompScale;
        const flash = this._hitFlash > 0;
        const bodyColor = flash ? 0xffffff : this.customColor;
        const legColor = flash ? 0xffffff : this._legColor;
        const accent = flash ? 0xffffff : this.customEyeColor;

        this.setScale(1, vis);
        this.setAlpha(Math.max(0.05, vis));

        this.gfxShadow.clear();
        this.gfxShadow.fillStyle(0x000000, 0.3 * vis);
        this.gfxShadow.fillEllipse(0, r * 0.7, r * 2.4, r * 0.6 * vis);

        this.gfxLegs.clear();
        this.gfxLegs.lineStyle(Math.max(3, r * 0.11), legColor, 1);
        const legSpread = r * 1.55;
        for (let i = 0; i < 4; i++) {
            const frac = (i / 3) - 0.5;
            const swing = Math.sin(this._legPhase + i * 0.9) * 16 * s;
            const attachY = bob + frac * r * 0.95;

            this.gfxLegs.beginPath();
            this.gfxLegs.moveTo(-r * 0.65, attachY);
            this.gfxLegs.lineTo(-legSpread, attachY + swing + r * 0.55);
            this.gfxLegs.strokePath();

            this.gfxLegs.beginPath();
            this.gfxLegs.moveTo(r * 0.65, attachY);
            this.gfxLegs.lineTo(legSpread, attachY - swing + r * 0.55);
            this.gfxLegs.strokePath();
        }

        this.gfxBody.clear();
        this.gfxBody.fillStyle(bodyColor, 1);
        this.gfxBody.fillEllipse(0, bob, r * stomp * 2.3, r * (2 - stomp + 0.1) * 2);

        this.gfxBody.fillStyle(this._bellyColor, 0.85);
        this.gfxBody.fillEllipse(0, bob + r * 0.38, r * 1.55, r * 1.1);

        this.gfxBody.fillStyle(legColor, 0.85);
        for (let i = 0; i < 3; i++) {
            this.gfxBody.fillEllipse((i - 1) * r * 0.42, bob - r * 0.22, r * 0.38, r * 0.28);
        }

        this.gfxFace.clear();
        const eyeY = bob - r * 0.22;
        const eyeR = r * 0.19;
        const eyePositions = [
            { x: -r * 0.42, y: eyeY - eyeR * 0.2 },
            { x: r * 0.42, y: eyeY - eyeR * 0.2 },
            { x: -r * 0.18, y: eyeY + eyeR * 0.5 },
            { x: r * 0.18, y: eyeY + eyeR * 0.5 }
        ];

        eyePositions.forEach(ep => {
            this.gfxFace.fillStyle(accent, 1);
            this.gfxFace.fillCircle(ep.x, ep.y, eyeR);
            this.gfxFace.fillStyle(0x000000, 1);
            if (this._eyeBlink) {
                this.gfxFace.fillRect(ep.x - eyeR * 0.6, ep.y - eyeR * 0.1, eyeR * 1.2, eyeR * 0.2);
            } else {
                this.gfxFace.fillCircle(ep.x + eyeR * 0.15, ep.y, eyeR * 0.45);
            }
            this.gfxFace.fillStyle(0xffffff, 0.7);
            this.gfxFace.fillCircle(ep.x - eyeR * 0.25, ep.y - eyeR * 0.3, eyeR * 0.2);
        });

        const mouthY = bob + r * 0.05;
        this.gfxFace.fillStyle(0x1a0a10, 1);
        this.gfxFace.fillTriangle(-r * 0.1, mouthY, r * 0.1, mouthY, 0, mouthY + r * 0.38);

        this.gfxHud.clear();
        const hpW = Math.min(150, r * 1.85);
        const hpH = 11;
        const hpY = bob - r - 26;
        this.gfxHud.fillStyle(0x000000, 0.75);
        this.gfxHud.fillRect(-hpW / 2, hpY, hpW, hpH);
        this.gfxHud.fillStyle(accent, 1);
        this.gfxHud.fillRect(-hpW / 2, hpY, hpW * Math.max(0, this.health / this.maxHealth), hpH);
        this.gfxHud.lineStyle(1, 0xffffff, 0.3);
        this.gfxHud.strokeRect(-hpW / 2, hpY, hpW, hpH);
    }

    _drawWarningRing(time) {
        if (!this._warningGfx) return;
        this._warningGfx.clear();
        if (this.state !== 'BURROWING' && this.state !== 'SURFACING') return;
        if (!this._burrowTarget) return;

        const alpha = 0.3 + 0.3 * Math.sin(time * 0.01);
        const radius = 80 + 20 * Math.sin(time * 0.008);
        this._warningGfx.lineStyle(4, this.customEyeColor, alpha);
        this._warningGfx.strokeCircle(this._burrowTarget.x, this._burrowTarget.y, radius);
        this._warningGfx.fillStyle(this.customEyeColor, alpha * 0.15);
        this._warningGfx.fillCircle(this._burrowTarget.x, this._burrowTarget.y, radius);
    }

    update(time, delta) {
        if (!this.active || this.isDead || this._isDying || !this.scene || this.scene.isEnding) return;

        if (this.scene._isSpawnProtected && this.scene._isSpawnProtected()) {
            if (this.body) this.body.setVelocity(0, 0);
            this._drawAll(time);
            this._drawWarningRing(time);
            return;
        }

        this._moveTime = time;
        this._bloodSwell += delta * 0.002;

        const vel = this.body ? Math.sqrt(this.body.velocity.x ** 2 + this.body.velocity.y ** 2) : 0;
        if (vel > 20) {
            this._legPhase += delta * 0.01;
            this._bodyBob = Math.sin(this._legPhase * 2) * 5;
        } else {
            this._legPhase += delta * 0.003;
            this._bodyBob = Math.sin(this._legPhase) * 2;
        }

        this._blinkTimer += delta;
        if (this._blinkTimer > 2200 + Math.random() * 1800) {
            this._eyeBlink = true;
            this._blinkTimer = 0;
            this.scene.time.delayedCall(90, () => {
                if (this.active && !this.isDead && !this._isDying) this._eyeBlink = false;
            });
        }

        if (this._hitFlash > 0) this._hitFlash -= delta;
        if (this._stompScale < 1) this._stompScale = Math.min(1, this._stompScale + delta * 0.006);

        if (this.state === 'HUNTING' || this.state === 'ATTACKING_TURF') {
            this._burrowCooldown += delta;
            this._lungeCooldown -= delta;
        }

        if (this.nameTag) this.nameTag.y = -(this.baseSize * this.sizeMultiplier + 58);

        this._drawAll(time);
        this._drawWarningRing(time);

        switch (this.state) {
            case 'HUNTING': this._stateHunting(); break;
            case 'ATTACKING_TURF': this._stateAttackingTurf(time); break;
            case 'LUNGE_WINDUP': this._stateLungeWindup(time, delta); break;
            case 'LUNGE_CHARGE': this._stateLungeCharge(delta); break;
            case 'LUNGE_LATCH': this._stateLungeLatch(delta); break;
            case 'BURROWING': this._stateBurrowing(delta); break;
            case 'SURFACING': this._stateSurfacing(delta); break;
            case 'FLEEING': this._stateFleeing(); break;
        }
    }

    _stateHunting() {
        if (!this.scene || this.scene.isEnding || this.isDead || this._isDying) return;

        if (this.behaviorMode === 'PLAYER_HUNTER') {
            this._huntPlayerDirectly();
            return;
        }

        const turfFocused = this.behaviorMode === 'TURF_TAKER';

        if (!turfFocused && this._burrowChain > 0) {
            this._burrowChain--;
            this._startBurrow('chain');
            return;
        }

        if (!turfFocused && this._lungeCooldown <= 0) {
            const player = this.scene.player;
            if (player && player.active) {
                const dp = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                if (dp > 260 && dp < 1000) {
                    this._startLunge(player);
                    return;
                }
            }
        }

        if (!turfFocused && this._burrowCooldown >= this._burrowInterval) {
            this._startBurrow(Math.random() < 0.45 ? 'ambush' : 'normal');
            return;
        }

        let nearest = null;
        let minDist = Infinity;

        this.scene.territories.forEach(t => {
            if (t.faction === CONFIG.FACTIONS.PLAYER) {
                const d = Phaser.Math.Distance.Between(this.x, this.y, t.x, t.y);
                if (d < minDist) {
                    minDist = d;
                    nearest = t;
                }
            }
        });

        if (!nearest) {
            this.state = 'FLEEING';
            return;
        }

        this.currentTarget = nearest;

        if (minDist < this.baseSize * this.sizeMultiplier + nearest.radius * 0.5) {
            this.body.setVelocity(0, 0);
            this._stompScale = 0.72;
            this.state = 'ATTACKING_TURF';
        } else {
            const angle = Phaser.Math.Angle.Between(this.x, this.y, nearest.x, nearest.y);
            this.body.setVelocity(
                Math.cos(angle) * this.moveSpeed * this.sizeMultiplier,
                Math.sin(angle) * this.moveSpeed * this.sizeMultiplier
            );
        }
    }

    _huntPlayerDirectly() {
        const player = this.scene?.player;
        if (!player || !player.active) {
            this.body?.setVelocity(0, 0);
            return;
        }

        const d = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);

        if (d > this.baseSize * this.sizeMultiplier + 48) {
            this.body.setVelocity(
                Math.cos(angle) * this.moveSpeed * this.sizeMultiplier * 1.18,
                Math.sin(angle) * this.moveSpeed * this.sizeMultiplier * 1.18
            );
        } else {
            this.body.setVelocity(0, 0);
        }
    }

    _startLunge(player) {
        if (!this.scene || this.scene.isEnding || this.isDead || this._isDying || !player || !player.active) return;

        this.state = 'LUNGE_WINDUP';
        this._lungeTarget = player;
        this._lungeChargeTimer = 0;
        this.body.setVelocity(0, 0);
        this._stompScale = 1.15;
        this._lungeReticle = this.scene.add.graphics().setDepth(901);
        this.scene.showFeedback('⚠ LUNGE!', this.customEyeColor, this.x, this.y - 80);
    }

    _stateLungeWindup(time, delta) {
        this._lungeChargeTimer += delta;
        const player = this._lungeTarget;

        if (this._lungeReticle && player && player.active) {
            const r = 60 - (this._lungeChargeTimer / 600) * 40;
            const alpha = 0.4 + 0.5 * Math.sin(time * 0.025);
            this._lungeReticle.clear();
            this._lungeReticle.lineStyle(4, this.customEyeColor, alpha);
            this._lungeReticle.strokeCircle(player.x, player.y, Math.max(20, r));
        }

        if (this._lungeChargeTimer >= 600) {
            if (this._lungeReticle) {
                this._lungeReticle.destroy();
                this._lungeReticle = null;
            }

            if (!player || !player.active) {
                this.state = 'HUNTING';
                this._lungeCooldown = 7000 + Math.random() * 3000;
                return;
            }

            const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            const chargeSpeed = this.moveSpeed * 2.45;
            this.body.setVelocity(Math.cos(angle) * chargeSpeed, Math.sin(angle) * chargeSpeed);
            this.state = 'LUNGE_CHARGE';
            this._lungeChargeTimer = 0;
            this._stompScale = 0.9;
        }
    }

    _stateLungeCharge(delta) {
        this._lungeChargeTimer += delta;
        const player = this._lungeTarget;

        if (this._lungeChargeTimer > 1100 || !player || !player.active) {
            this.body.setVelocity(0, 0);
            this.state = 'HUNTING';
            this._lungeCooldown = 7000 + Math.random() * 3000;
            return;
        }

        const dp = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        const contactR = this.baseSize * this.sizeMultiplier + 40;

        if (dp < contactR) {
            this.body.setVelocity(0, 0);
            this.state = 'LUNGE_LATCH';
            this._lungeLatchTime = 0;
            this._stompScale = 1.25;
            this.scene.cameras.main.shake(220, 0.018);
            this.scene.showFeedback('LATCHED!', this.customEyeColor, player.x, player.y - 70);
        }
    }

    _stateLungeLatch(delta) {
        this._lungeLatchTime += delta;
        const player = this._lungeTarget;

        if (player && player.active) {
            const offset = this.baseSize * this.sizeMultiplier * 0.6;
            this.x = player.x;
            this.y = player.y + offset * 0.3;

            if (this.body) {
                this.body.x = this.x - this.body.halfWidth;
                this.body.y = this.y - this.body.halfHeight;
                this.body.setVelocity(0, 0);
            }

            if (!this._lastDrainTick) this._lastDrainTick = 0;
            if (this._lungeLatchTime - this._lastDrainTick >= 250) {
                this._lastDrainTick = this._lungeLatchTime;
                player.takeDamage(this.attackDamage * 0.55, this);
                this.health = Math.min(this.maxHealth, this.health + this.attackDamage * 0.35);
            }
        }

        if (this._lungeLatchTime >= 1350 || !player || !player.active) {
            this._lastDrainTick = 0;
            this._lungeTarget = null;
            this.state = 'HUNTING';
            this._lungeCooldown = 8000 + Math.random() * 4000;
            this._stompScale = 0.9;
        }
    }

    _stateAttackingTurf(time) {
        const t = this.currentTarget;

        if (!t || t.faction !== CONFIG.FACTIONS.PLAYER) {
            this.currentTarget = null;
            this.state = 'HUNTING';
            return;
        }

        this.body.setVelocity(0, 0);

        if (this._burrowCooldown >= this._burrowInterval) {
            this._startBurrow();
            return;
        }

        if (time - this._lastAttack >= this.attackCooldown) {
            this._lastAttack = time;
            this._stompScale = 0.68;
            this.scene.cameras.main.shake(80, 0.007);

            this.scene.units.children.iterate(unit => {
                if (!unit || !unit.active || unit.faction !== CONFIG.FACTIONS.PLAYER) return;
                if (Phaser.Math.Distance.Between(t.x, t.y, unit.x, unit.y) < t.radius * 1.2) {
                    unit.takeDamage(this.attackDamage * 3);
                    this.scene.createImpactEffect(unit.x, unit.y, this.customColor, 'bite', this.attackDamage * 3, true);
                }
            });

            this.scene.player.followers.forEach(pf => {
                if (!pf || !pf.active) return;
                if (Phaser.Math.Distance.Between(t.x, t.y, pf.x, pf.y) < t.radius * 1.2) {
                    pf.takeDamage(this.attackDamage * 2);
                    this.scene.createImpactEffect(pf.x, pf.y, this.customColor, 'bite', this.attackDamage * 2, true);
                }
            });

            const remaining = this.scene.units.children.entries.filter(u =>
                u && u.active && u.faction === CONFIG.FACTIONS.PLAYER &&
                Phaser.Math.Distance.Between(t.x, t.y, u.x, u.y) < t.radius
            );

            if (remaining.length === 0) {
                t.setFaction(CONFIG.FACTIONS.NEUTRAL);
                this.scene.showFeedback('TURF LOST!', 0xff0000, t.x, t.y - 80);
                this.currentTarget = null;
                this.state = 'HUNTING';

                const playerTurfs = this.scene.territories.filter(tr => tr.faction === CONFIG.FACTIONS.PLAYER);
                if (playerTurfs.length === 0) this.state = 'FLEEING';
            }
        }
    }

    _startBurrow(mode = 'normal') {
        if (!this.scene || this.scene.isEnding || this.isDead || this._isDying || !this.body) return;

        this.state = 'BURROWING';
        this._burrowMode = mode;
        this._burrowCooldown = 0;
        this._burrowDepth = 0;
        this._burrowInterval = (mode === 'chain' ? 6500 : 10500) + Math.random() * 5000;

        const player = this.scene.player;
        const playerTurfs = this.scene.territories.filter(t => t.faction === CONFIG.FACTIONS.PLAYER);

        if (mode === 'ambush' && player && player.active) {
            this._burrowTarget = {
                x: Phaser.Math.Clamp(player.x, 200, CONFIG.WORLD_SIZE - 200),
                y: Phaser.Math.Clamp(player.y, 200, CONFIG.WORLD_SIZE - 200)
            };
        } else if (mode === 'chain' && player && player.active) {
            const ang = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            const dist = 250 + Math.random() * 150;
            this._burrowTarget = {
                x: Phaser.Math.Clamp(this.x + Math.cos(ang) * dist, 200, CONFIG.WORLD_SIZE - 200),
                y: Phaser.Math.Clamp(this.y + Math.sin(ang) * dist, 200, CONFIG.WORLD_SIZE - 200)
            };
        } else if (playerTurfs.length > 0) {
            let farthest = playerTurfs[0];
            let maxDist = 0;
            playerTurfs.forEach(t => {
                const d = Phaser.Math.Distance.Between(this.x, this.y, t.x, t.y);
                if (d > maxDist) {
                    maxDist = d;
                    farthest = t;
                }
            });

            const angle = Math.random() * Math.PI * 2;
            const dist = 220 + Math.random() * 180;
            this._burrowTarget = {
                x: Phaser.Math.Clamp(farthest.x + Math.cos(angle) * dist, 200, CONFIG.WORLD_SIZE - 200),
                y: Phaser.Math.Clamp(farthest.y + Math.sin(angle) * dist, 200, CONFIG.WORLD_SIZE - 200)
            };
        } else {
            this._burrowTarget = {
                x: 400 + Math.random() * (CONFIG.WORLD_SIZE - 800),
                y: 400 + Math.random() * (CONFIG.WORLD_SIZE - 800)
            };
        }

        this.body.setVelocity(0, 0);
        this.scene.showFeedback('IT BURROWS!', this.customEyeColor, this.x, this.y - 80);
        this.scene.cameras.main.shake(180, 0.01);
        this._spawnBurrowFX(this.x, this.y, 0x8b5a2b);
    }

    _spawnBurrowFX(x, y, color) {
        if (!this.scene || this.scene.isEnding) return;

        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const speed = 70 + Math.random() * 110;
            const blob = this.scene.add.circle(x, y, 5 + Math.random() * 8, color, 0.9).setDepth(1100);
            this.scene.tweens.add({
                targets: blob,
                x: x + Math.cos(angle) * speed,
                y: y + Math.sin(angle) * speed,
                scaleX: 0,
                scaleY: 0,
                alpha: 0,
                duration: 400 + Math.random() * 300,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    if (blob && blob.active) blob.destroy();
                }
            });
        }
    }

    _stateBurrowing(delta) {
        if (!this._burrowTarget || !this.body) {
            this.state = 'HUNTING';
            return;
        }

        this._burrowDepth += delta / 800;
        if (this._burrowDepth >= 1) {
            this._burrowDepth = 1;
            this.setAlpha(0);
            this.setScale(1, 0);
            this.x = this._burrowTarget.x;
            this.y = this._burrowTarget.y;
            this.body.x = this.x - this.body.halfWidth;
            this.body.y = this.y - this.body.halfHeight;
            this.state = 'SURFACING';
            this.scene.showFeedback('⚠ TICK INCOMING ⚠', this.customEyeColor, this.x, this.y - 100);
            this._spawnBurrowFX(this.x, this.y, this.customEyeColor);
        }
    }

    _stateSurfacing(delta) {
        const riseTime = this._burrowMode === 'chain' ? 500 : 900;
        this._burrowDepth -= delta / riseTime;

        if (this._burrowDepth <= 0) {
            this._burrowDepth = 0;
            this.setAlpha(1);
            this.setScale(1, 1);
            this.state = 'HUNTING';
            this.scene.cameras.main.shake(this._burrowMode === 'chain' ? 150 : 250, 0.013);
            this._spawnBurrowFX(this.x, this.y, this.customColor);

            if (this._burrowMode === 'ambush') this._performAmbushStomp();
            this._burrowMode = 'normal';
        }
    }

    _performAmbushStomp() {
        if (!this.scene || this.scene.isEnding) return;

        const aoeR = this.baseSize * this.sizeMultiplier + 90;
        const player = this.scene.player;
        this.scene.cameras.main.shake(300, 0.018);
        this.scene.showFeedback('💥 SURPRISE! 💥', this.customColor, this.x, this.y - 80);

        const ring = this.scene.add.circle(this.x, this.y, 10, this.customColor, 0.6).setDepth(1099);
        this.scene.tweens.add({
            targets: ring,
            scale: aoeR / 10,
            alpha: 0,
            duration: 400,
            onComplete: () => {
                if (ring && ring.active) ring.destroy();
            }
        });

        if (player && player.active && Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < aoeR) {
            player.takeDamage(this.attackDamage * 1.5, this);
        }
    }

    _stateFleeing() {
        if (!this.scene || this.scene.isEnding || !this.scene.player) return;
        const player = this.scene.player;
        const corners = [
            { x: 200, y: 200 },
            { x: CONFIG.WORLD_SIZE - 200, y: 200 },
            { x: 200, y: CONFIG.WORLD_SIZE - 200 },
            { x: CONFIG.WORLD_SIZE - 200, y: CONFIG.WORLD_SIZE - 200 }
        ];

        let farthest = corners[0];
        let maxDist = 0;
        corners.forEach(c => {
            const d = Phaser.Math.Distance.Between(player.x, player.y, c.x, c.y);
            if (d > maxDist) {
                maxDist = d;
                farthest = c;
            }
        });

        const angle = Phaser.Math.Angle.Between(this.x, this.y, farthest.x, farthest.y);
        this.body.setVelocity(Math.cos(angle) * this.moveSpeed * 1.7, Math.sin(angle) * this.moveSpeed * 1.7);
    }

    takeDamage(amount, attacker) {
        if (this.isDead || this._isDying || !this.active || !this.scene || this.scene.isEnding) return;
        if (this.state === 'BURROWING' || this.state === 'SURFACING') return;

        this._hitFlash = 120;
        this.health = Math.max(0, this.health - amount);
        this.sizeMultiplier = Math.max(0.4, this.health / this.maxHealth);

        this._burrowHitCount++;
        if (this._burrowHitCount >= 5 && this._burrowCooldown > 3000) {
            this._burrowHitCount = 0;
            this._burrowChain = 1;
            this._startBurrow('chain');
        }

        if (this.body && this.body.setCircle) {
            const r = this.baseSize * this.sizeMultiplier * 0.85;
            this.body.setCircle(r, -r, -r);
        }

        this.scene.createImpactEffect(this.x, this.y, this.customColor, 'punch', amount, false);
        if (this.health <= 0) this._die(attacker);
    }

    _die(attacker) {
        if (this.isDead || this._isDying || !this.scene) return;

        this.isDead = true;
        this._isDying = true;
        this.state = 'DEAD';

        if (this.body) {
            this.body.setVelocity(0, 0);
            this.body.enable = false;
        }

        const scene = this.scene;
        const deathX = this.x;
        const deathY = this.y;

        if (attacker && attacker.faction === CONFIG.FACTIONS.PLAYER && scene.player) {
            scene.player.gainStr(15);
            scene.addScore(2500, deathX, deathY);
        }

        if (this._warningGfx && this._warningGfx.active) {
            this._warningGfx.clear();
            this._warningGfx.destroy();
            this._warningGfx = null;
        }

        if (this._lungeReticle && this._lungeReticle.active) {
            this._lungeReticle.clear();
            this._lungeReticle.destroy();
            this._lungeReticle = null;
        }

        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const dist = 50 + Math.random() * 120;
            const blob = scene.add.circle(
                deathX,
                deathY,
                6 + Math.random() * 12,
                [this.customColor, 0x000000, this.customEyeColor][Math.floor(Math.random() * 3)],
                1
            ).setDepth(1100);

            scene.tweens.add({
                targets: blob,
                x: deathX + Math.cos(angle) * dist,
                y: deathY + Math.sin(angle) * dist,
                scaleX: 0,
                scaleY: 0,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    if (blob && blob.active) blob.destroy();
                }
            });
        }

        scene.cameras.main.shake(300, 0.02);

        scene.time.delayedCall(0, () => {
            if (this.parentManager && !this.parentManager.isDead) {
                this.parentManager.onTwinDefeated(this);
            }
            if (this.active) this.destroy();
        });
    }

    checkContactDamage(time) {
        const scene = this.scene;

        if (
            this.isDead || this._isDying || !this.active || !scene ||
            scene.isEnding || !scene.player || !scene._contactCooldowns
        ) return;

        if (
            this.state === 'BURROWING' ||
            this.state === 'SURFACING' ||
            this.state === 'LUNGE_WINDUP' ||
            this.state === 'LUNGE_LATCH'
        ) return;

        const player = scene.player;
        const contactR = this.baseSize * this.sizeMultiplier + 18;

        const dp = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (dp < contactR && time - this._lastHitTime > 600) {
            this._lastHitTime = time;
            player.takeDamage(this.attackDamage, this);
            scene.createImpactEffect(player.x, player.y, this.customColor, 'bite', this.attackDamage, true);
        }

        const followers = Array.isArray(player.followers) ? player.followers.slice() : [];

        for (let i = 0; i < followers.length; i++) {
            if (this.isDead || this._isDying || !this.active || !this.scene) return;
            const pf = followers[i];
            if (!pf || !pf.active || pf.isDead || pf.scene !== scene) continue;

            const df = Phaser.Math.Distance.Between(this.x, this.y, pf.x, pf.y);
            const key = `boss_pf_${this.twinName}_${i}`;
            const last = scene._contactCooldowns.get(key) || 0;
            if (df < contactR && time - last > 600) {
                scene._contactCooldowns.set(key, time);
                pf.takeDamage(this.attackDamage);
            }
        }

        for (let i = 0; i < followers.length; i++) {
            if (this.isDead || this._isDying || !this.active || !this.scene) return;
            const pf = followers[i];
            if (!pf || !pf.active || pf.isDead || pf.scene !== scene) continue;

            const df = Phaser.Math.Distance.Between(this.x, this.y, pf.x, pf.y);
            const key = `pf_boss_${this.twinName}_${i}`;
            const last = scene._contactCooldowns.get(key) || 0;
            if (df < contactR + 10 && time - last > 700) {
                scene._contactCooldowns.set(key, time);
                const str = player.getSTR();
                this.takeDamage(Math.round(14 * (1 + (str - 1) * 0.15)), pf);
            }
        }
    }

    destroy(fromScene) {
        if (this._warningGfx && this._warningGfx.active) {
            this._warningGfx.destroy();
            this._warningGfx = null;
        }

        if (this._lungeReticle && this._lungeReticle.active) {
            this._lungeReticle.destroy();
            this._lungeReticle = null;
        }

        super.destroy(fromScene);
    }
}

export default class TickTwins extends Phaser.GameObjects.Container {
    constructor(scene, x, y, stageIndex = 4) {
        super(scene, 0, 0);

        this.scene = scene;
        this.faction = 'BOSS';
        this.isTwins = true;
        this.stageIndex = stageIndex;
        this.maxHealth = 2200;
        this.health = this.maxHealth;
        this.active = true;
        this.isDead = false;
        this._defeatHandled = false;

        const spacing = 450;
        const margin = spacing + 260;
        const cx = Phaser.Math.Clamp(x, margin, CONFIG.WORLD_SIZE - margin);
        const cy = Phaser.Math.Clamp(y, margin, CONFIG.WORLD_SIZE - margin);

        this.twin1 = new TickTwinEntity(scene, cx - spacing, cy, 'crimson', 0x990011, 0xff0044, 75);
        this.twin2 = new TickTwinEntity(scene, cx + spacing, cy, 'violet', 0x5a1a6a, 0xcc44ff, 75);

        this.twin1.parentManager = this;
        this.twin2.parentManager = this;

        // Twin behavior split:
        // crimson focuses on removing turfs, violet pressures the player directly.
        this.twin1.behaviorMode = 'TURF_TAKER';
        this.twin2.behaviorMode = 'PLAYER_HUNTER';

        // Important: Do NOT add the twins as children of this manager container.
        // They are already scene objects with world positions and physics bodies.
        // Parenting them can offset or trap one twin near the edge of the map.
        scene.add.existing(this);
    }

    update(time, delta) {
        if (!this.active || this.isDead || this._defeatHandled || !this.scene || this.scene.isEnding) return;

        let aliveCount = 0;
        let totalHealth = 0;

        if (this.twin1 && this.twin1.active && !this.twin1.isDead && this.twin1.scene) {
            this.twin1.update(time, delta);
            totalHealth += this.twin1.health;
            aliveCount++;
        }

        if (this.twin2 && this.twin2.active && !this.twin2.isDead && this.twin2.scene) {
            this.twin2.update(time, delta);
            totalHealth += this.twin2.health;
            aliveCount++;
        }

        this.health = totalHealth;
        if (aliveCount === 0) this._completeDefeat();
    }

    checkContactDamage(time) {
        if (!this.active || this.isDead || this._defeatHandled || !this.scene || this.scene.isEnding) return;

        if (this.twin1 && this.twin1.active && !this.twin1.isDead && this.twin1.scene) {
            this.twin1.checkContactDamage(time);
        }

        if (this.twin2 && this.twin2.active && !this.twin2.isDead && this.twin2.scene) {
            this.twin2.checkContactDamage(time);
        }

        const twin1Alive = this.twin1 && this.twin1.active && !this.twin1.isDead && this.twin1.scene;
        const twin2Alive = this.twin2 && this.twin2.active && !this.twin2.isDead && this.twin2.scene;
        if (!twin1Alive && !twin2Alive) this._completeDefeat();
    }

    onTwinDefeated(twin) {
        if (!this.scene || this.scene.isEnding || this._defeatHandled) return;

        this.scene.showFeedback(`☠ TWIN ${twin.twinName.toUpperCase()} SLAIN!`, 0xffffff, twin.x, twin.y - 120);
        const otherTwin = twin === this.twin1 ? this.twin2 : this.twin1;

        if (otherTwin && otherTwin.active && !otherTwin.isDead && otherTwin.scene) {
            if (!otherTwin._rageMode) {
                otherTwin._rageMode = true;
                otherTwin.moveSpeed *= 1.45;
                otherTwin.attackDamage *= 1.3;
                otherTwin.sizeMultiplier = Math.max(otherTwin.sizeMultiplier, 1.35);
                this.scene.showFeedback('⚡ RAGE MODE ACTIVE!', 0xff0000, otherTwin.x, otherTwin.y - 120);
                this.scene.cameras.main.flash(200, 255, 0, 0);
            }
        } else {
            this._completeDefeat();
        }
    }

    _completeDefeat() {
        if (this._defeatHandled || !this.scene) return;

        this._defeatHandled = true;
        this.isDead = true;
        this.active = false;

        const scene = this.scene;
        scene.time.delayedCall(0, () => {
            if (scene && !scene.isEnding && scene.onBossDefeated) {
                scene.onBossDefeated();
            }
            if (this.scene) this.destroy();
        });
    }

    destroy(fromScene) {
        if (this.twin1) {
            this.twin1.parentManager = null;
            if (this.twin1.active || this.twin1.scene) this.twin1.destroy();
            this.twin1 = null;
        }

        if (this.twin2) {
            this.twin2.parentManager = null;
            if (this.twin2.active || this.twin2.scene) this.twin2.destroy();
            this.twin2 = null;
        }

        super.destroy(fromScene);
    }
}

/* CHIGGAS_STEAM_PASS_97A_TICK_TWINS_MANAGER_FIX_BEGIN */
try {
    if (!TickTwins.prototype.__chiggasPass97ATickTwinsManagerFixInstalled) {
        TickTwins.prototype.__chiggasPass97ATickTwinsManagerFixInstalled = true;

        TickTwins.prototype.getActiveTargets = function() {
            const targets = [];
            if (this.twin1 && this.twin1.active && !this.twin1.isDead && !this.twin1._isDying && this.twin1.scene) {
                targets.push(this.twin1);
            }
            if (this.twin2 && this.twin2.active && !this.twin2.isDead && !this.twin2._isDying && this.twin2.scene) {
                targets.push(this.twin2);
            }
            return targets;
        };

        TickTwins.prototype.__pass97AUpdateManagerPosition = function() {
            try {
                const targets = this.getActiveTargets ? this.getActiveTargets() : [];
                if (!targets.length) return;

                const sx = targets.reduce((sum, t) => sum + Number(t.x || 0), 0);
                const sy = targets.reduce((sum, t) => sum + Number(t.y || 0), 0);
                const x = sx / targets.length;
                const y = sy / targets.length;

                if (Number.isFinite(x) && Number.isFinite(y)) {
                    this.x = Phaser.Math.Clamp(x, 0, CONFIG.WORLD_SIZE);
                    this.y = Phaser.Math.Clamp(y, 0, CONFIG.WORLD_SIZE);
                }
            } catch (_) {}
        };

        const __pass97AOrigTickTwinsUpdate = TickTwins.prototype.update;
        if (typeof __pass97AOrigTickTwinsUpdate === 'function') {
            TickTwins.prototype.update = function(...args) {
                this.__pass97AUpdateManagerPosition?.();
                const result = __pass97AOrigTickTwinsUpdate.apply(this, args);
                this.__pass97AUpdateManagerPosition?.();
                return result;
            };
        }

        const __pass97AOrigTickTwinsCheckContact = TickTwins.prototype.checkContactDamage;
        if (typeof __pass97AOrigTickTwinsCheckContact === 'function') {
            TickTwins.prototype.checkContactDamage = function(...args) {
                this.__pass97AUpdateManagerPosition?.();
                return __pass97AOrigTickTwinsCheckContact.apply(this, args);
            };
        }

        TickTwins.prototype.takeDamage = function(amount, attacker) {
            try {
                const targets = this.getActiveTargets ? this.getActiveTargets() : [];
                if (!targets.length) return;

                let chosen = targets[0];

                if (attacker && Number.isFinite(attacker.x) && Number.isFinite(attacker.y)) {
                    let bestDist = Infinity;
                    targets.forEach(target => {
                        const d = Phaser.Math.Distance.Between(attacker.x, attacker.y, target.x, target.y);
                        if (d < bestDist) {
                            bestDist = d;
                            chosen = target;
                        }
                    });
                } else if (this.scene?.player) {
                    let bestDist = Infinity;
                    targets.forEach(target => {
                        const d = Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, target.x, target.y);
                        if (d < bestDist) {
                            bestDist = d;
                            chosen = target;
                        }
                    });
                }

                if (chosen && typeof chosen.takeDamage === 'function') {
                    chosen.takeDamage(amount, attacker);
                }

                this.__pass97AUpdateManagerPosition?.();
            } catch (error) {
                try { console.warn('[Chiggas] Pass 97A TickTwins manager damage forward failed safely:', error); } catch (_) {}
            }
        };
    }
} catch (error) {
    console.warn('[Chiggas] Steam Pass 97A TickTwins manager fix failed safely:', error);
}
/* CHIGGAS_STEAM_PASS_97A_TICK_TWINS_MANAGER_FIX_END */
