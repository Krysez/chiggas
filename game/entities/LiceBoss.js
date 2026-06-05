import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import Chigga from './Chigga.js';

/**
 * LiceBoss — The LICE LORD for Stage 4 ("The Foot" or "LICE LORD").
 *
 * A translucent, segmented parasitic monarch designed with specialized grasping claws.
 * Lives in hair, lays nit eggs, and drags enemies in with sweeping claw pulls.
 *
 * Mechanics:
 *  - NIT LAYING: Spawns stationary white "Nit" eggs on the ground. If not destroyed in 4s,
 *                they hatch into fast-biting Nymph lice.
 *  - HAIR CLING: Clings to the nearest follicle, gaining a 60% damage-reduction shield and
 *                firing scales/itch particles in all directions.
 *  - ITCH CLAW: Sweeps its huge grasping legs in a wide circle, pulling the player and
 *               army in close while dealing heavy damage.
 */
export default class LiceBoss extends Phaser.GameObjects.Container {
    constructor(scene, x, y, stageIndex = 3) {
        super(scene, x, y);

        this.scene = scene;
        this.faction = 'BOSS';
        this.stageIndex = stageIndex;

        // Difficulty multiplier
        const diffMult = scene.difficulty === 0 ? 0.8 : (scene.difficulty === 2 ? 1.3 : 1.0);

        // Stats
        this.maxHealth = Math.round(1800 * diffMult);
        this.health = this.maxHealth;
        this.baseSize = 110;
        this.sizeMultiplier = 1;
        this.moveSpeed = 160 * diffMult;
        this.attackDamage = Math.round(22 * diffMult);
        this.attackCooldown = 800;
        this._lastAttack = 0;
        this._lastHitTime = 0;

        this.state = 'HUNTING';
        this.currentTarget = null;
        this.isDead = false;
        this._hitFlash = 0;

        // Abilities Cooldowns
        this._nitCooldown = 7000;
        this._clingCooldown = 12000;
        this._clawCooldown = 10000;

        // Hair Cling state
        this._clingingFollicle = null;
        this._clingTimer = 0;

        // Claw Pull state
        this._clawPhase = 0;
        this._clawActive = false;

        // Animation counters
        this._legPhase = 0;
        this._pulsePhase = 0;
        this._stompScale = 1;
        this._gutPulsate = 0;

        // Graphics Layers
        this.gfxShadow = scene.add.graphics();
        this.gfxLegs = scene.add.graphics();
        this.gfxBody = scene.add.graphics();
        this.gfxFace = scene.add.graphics();
        this.gfxHud = scene.add.graphics();
        this.add([this.gfxShadow, this.gfxLegs, this.gfxBody, this.gfxFace, this.gfxHud]);

        // Text title
        this.crownText = scene.add.text(0, -(this.baseSize + 36), '👑', {
            fontSize: '48px'
        }).setOrigin(0.5, 1);
        this.add(this.crownText);

        this.nameTag = scene.add.text(0, -(this.baseSize + 60), '☠ LICE LORD ☠', {
            fontSize: '20px', fontFamily: 'Dhurjati',
            color: '#cceeff', stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5, 1);
        this.add(this.nameTag);

        scene.tweens.add({
            targets: this.crownText,
            y: -(this.baseSize + 46),
            duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });

        // Physics
        scene.physics.add.existing(this);
        const r = this.baseSize * 0.85;
        this.body.setCircle(r, -r, -r);
        this.body.setCollideWorldBounds(true);
        this.body.bounce.set(0.3, 0.3);

        scene.add.existing(this);
        this.setDepth(900);

        this._nits = [];
        this._nymphs = [];

        this._drawAll(0);
    }

    // Translucent grey-white coloration typical of lice
    get _shellColor() { return 0xccddee; }
    get _gutColor() { return 0x554444; } // dark internal organs
    get _legColor() { return 0xaabbcc; }

    _drawAll(time) {
        const s = this.sizeMultiplier;
        const r = this.baseSize * s;
        const flash = this._hitFlash > 0;
        const stomp = this._stompScale;
        const clinging = this.state === 'CLINGING';

        const shellCol = flash ? 0xffffff : this._shellColor;
        const gutCol = flash ? 0xffffff : this._gutColor;
        const legCol = flash ? 0xffffff : this._legColor;
        const eyeColor = flash ? 0xffffff : (clinging ? 0xff0000 : 0x221111);

        // 1. Shadow
        this.gfxShadow.clear();
        if (!clinging) {
            this.gfxShadow.fillStyle(0x000000, 0.25);
            this.gfxShadow.fillEllipse(0, r * 0.6, r * 2.3, r * 0.6);
        }

        // 2. Grasping Legs (6 legs total with giant circular curved pincers)
        this.gfxLegs.clear();
        this.gfxLegs.lineStyle(Math.max(3, r * 0.1), legCol, 1);
        const legSpread = r * 1.5;
        const numLegs = 3; // per side

        for (let i = 0; i < numLegs; i++) {
            const frac = (i / (numLegs - 1)) - 0.5; // -0.5 to 0.5
            const attachY = frac * r * 0.5;
            const swing = clinging ? 0 : Math.sin(this._legPhase + i * 1.3) * 15 * s;

            // Left leg
            this.gfxLegs.beginPath();
            this.gfxLegs.moveTo(-r * 0.5, attachY);
            this.gfxLegs.lineTo(-legSpread * 0.95, attachY + swing - r * 0.1);
            // Curved pincer clamp
            this.gfxLegs.arc(-legSpread, attachY + swing + r * 0.1, r * 0.2, Math.PI * 1.5, Math.PI * 0.5, true);
            this.gfxLegs.strokePath();

            // Right leg
            this.gfxLegs.beginPath();
            this.gfxLegs.moveTo(r * 0.5, attachY);
            this.gfxLegs.lineTo(legSpread * 0.95, attachY - swing - r * 0.1);
            // Curved pincer clamp
            this.gfxLegs.arc(legSpread, attachY - swing + r * 0.1, r * 0.2, Math.PI * 1.5, Math.PI * 0.5, false);
            this.gfxLegs.strokePath();
        }

        // Claw attack pull visual swipe
        if (this._clawActive) {
            const pullRadius = r * 2.8;
            this.gfxLegs.lineStyle(5, 0xff5500, 0.4 + 0.3 * Math.sin(this._clawPhase));
            this.gfxLegs.strokeCircle(0, 0, pullRadius);
            
            // Sweep lines
            this.gfxLegs.fillStyle(0xffaa00, 0.15);
            this.gfxLegs.fillCircle(0, 0, pullRadius * stomp);
        }

        // 3. Segmented Body
        this.gfxBody.clear();
        const bw = r * stomp * 0.9;
        const bh = r * (2 - stomp) * 1.3; // Elongated flat abdomen

        // Draw glowing internal gut first (translucent lice effect)
        const gutW = bw * 0.6;
        const gutH = bh * 0.7;
        const gutOffset = Math.sin(this._gutPulsate) * 3;
        this.gfxBody.fillStyle(gutCol, 0.7);
        this.gfxBody.fillEllipse(0, gutOffset + r * 0.2, gutW, gutH);

        // Outer semi-translucent shell
        this.gfxBody.fillStyle(shellCol, 0.55);
        this.gfxBody.fillEllipse(0, 0, bw, bh);

        // Segment lines across the abdomen
        this.gfxBody.lineStyle(3, 0x99aabb, 0.5);
        for (let i = 1; i < 6; i++) {
            const segmentY = -bh * 0.5 + (i / 6) * bh;
            this.gfxBody.beginPath();
            this.gfxBody.moveTo(-bw * 0.78, segmentY);
            this.gfxBody.lineTo(bw * 0.78, segmentY);
            this.gfxBody.strokePath();
        }

        // Thorax plates (rigid head joint)
        this.gfxBody.fillStyle(shellCol, 0.8);
        this.gfxBody.fillCircle(0, -bh * 0.45, bw * 0.85);

        // 4. Face & Antennae
        this.gfxFace.clear();
        const headY = -bh * 0.65;

        // Two antennae
        this.gfxFace.lineStyle(4, legCol, 1);
        this.gfxFace.beginPath();
        this.gfxFace.moveTo(-r * 0.2, headY);
        this.gfxFace.lineTo(-r * 0.4, headY - r * 0.45);
        this.gfxFace.lineTo(-r * 0.5, headY - r * 0.55);
        this.gfxFace.strokePath();

        this.gfxFace.beginPath();
        this.gfxFace.moveTo(r * 0.2, headY);
        this.gfxFace.lineTo(r * 0.4, headY - r * 0.45);
        this.gfxFace.lineTo(r * 0.5, headY - r * 0.55);
        this.gfxFace.strokePath();

        // 2 Dark Beady Eyes (glow red during cling)
        this.gfxFace.fillStyle(eyeColor, 1);
        this.gfxFace.fillCircle(-r * 0.18, headY + r * 0.1, r * 0.08);
        this.gfxFace.fillCircle(r * 0.18, headY + r * 0.1, r * 0.08);

        // Mouth (stylet piercing parts)
        this.gfxFace.fillStyle(0x331111, 1);
        this.gfxFace.fillTriangle(
            -r * 0.06, headY + r * 0.22,
            r * 0.06, headY + r * 0.22,
            0, headY + r * 0.44
        );

        // Grasping shield ring during Hair Cling
        if (clinging) {
            this.gfxFace.lineStyle(6, 0x00ffff, 0.7);
            this.gfxFace.strokeCircle(0, 0, r + 20);
        }

        // 5. HUD
        this.gfxHud.clear();
        const bw2 = Math.min(150, r * 1.85);
        const bh2 = 11;
        const by2 = -r * 1.5 - 20;

        this.gfxHud.fillStyle(0x000000, 0.75);
        this.gfxHud.fillRect(-bw2 / 2, by2, bw2, bh2);

        const pct = Math.max(0, this.health / this.maxHealth);
        const barColor = pct > 0.5 ? 0x33ccff : pct > 0.25 ? 0xffff33 : 0xff3333;
        this.gfxHud.fillStyle(barColor, 1);
        this.gfxHud.fillRect(-bw2 / 2, by2, bw2 * pct, bh2);
        this.gfxHud.lineStyle(1, 0xffffff, 0.3);
        this.gfxHud.strokeRect(-bw2 / 2, by2, bw2, bh2);
    }

    update(time, delta) {
        if (!this.active || this.isDead) return;

        this._gutPulsate += delta * 0.003;
        this._pulsePhase += delta * 0.005;

        // Leg movement
        const vel = this.body ? Math.sqrt(this.body.velocity.x ** 2 + this.body.velocity.y ** 2) : 0;
        if (this.state !== 'CLINGING') {
            if (vel > 20) {
                this._legPhase += delta * 0.012;
            } else {
                this._legPhase += delta * 0.003;
            }
        }

        if (this._hitFlash > 0) this._hitFlash -= delta;
        if (this._stompScale < 1) this._stompScale = Math.min(1, this._stompScale + delta * 0.005);

        // Cooldowns
        if (this.state === 'HUNTING' || this.state === 'ATTACKING_TURF') {
            this._nitCooldown -= delta;
            this._clingCooldown -= delta;
            this._clawCooldown -= delta;
        }

        this.crownText.y = -(this.baseSize * this.sizeMultiplier + 36);
        this.nameTag.y = -(this.baseSize * this.sizeMultiplier + 60);

        this._drawAll(time);

        // State Machine
        switch (this.state) {
            case 'HUNTING': this._stateHunting(time, delta); break;
            case 'ATTACKING_TURF': this._stateAttackingTurf(time, delta); break;
            case 'CLINGING': this._stateClinging(time, delta); break;
            case 'DEAD': if (this.body) this.body.setVelocity(0, 0); break;
        }

        // Maintain nymphs and nits
        this._updateNits(time, delta);
    }

    _stateHunting(time, delta) {
        const player = this.scene.player;

        // Claw Sweep Pull
        if (this._clawCooldown <= 0 && player && player.active) {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
            if (dist < 400) {
                this._doClawPull(player);
                return;
            }
        }

        // Hair Cling (Flee to hair follicle to shield and spray)
        if (this._clingCooldown <= 0) {
            const nearestHair = this.scene.follicles.getChildren().find(f => f.active);
            if (nearestHair) {
                const dist = Phaser.Math.Distance.Between(this.x, this.y, nearestHair.x, nearestHair.y);
                if (dist < 800) {
                    this._startCling(nearestHair);
                    return;
                }
            }
        }

        // Lay Nit Eggs
        if (this._nitCooldown <= 0) {
            this._layNitEgg();
            return;
        }

        // Special Stage 4 behavior: Lice Lord hunts idle/player soldiers first.
        // This makes relying on turf-spawned armies riskier during the boss fight.
        if (this._tryHuntPlayerSoldiers(time, delta)) {
            return;
        }

        // Default: march to closest player turf
        let nearest = null;
        let minDist = Infinity;
        this.scene.territories.forEach(t => {
            if (t.faction === CONFIG.FACTIONS.PLAYER) {
                const d = Phaser.Math.Distance.Between(this.x, this.y, t.x, t.y);
                if (d < minDist) { minDist = d; nearest = t; }
            }
        });

        if (!nearest) {
            // Chase player directly if no turfs left
            if (player && player.active) {
                nearest = player;
                minDist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
            } else {
                return;
            }
        }

        this.currentTarget = nearest;
        const targetRadius = nearest.radius ?? 40;
        if (minDist < this.baseSize * this.sizeMultiplier + targetRadius * 0.5) {
            this.body.setVelocity(0, 0);
            this._stompScale = 0.7;
            this.state = 'ATTACKING_TURF';
        } else {
            const angle = Phaser.Math.Angle.Between(this.x, this.y, nearest.x, nearest.y);
            this.body.setVelocity(
                Math.cos(angle) * this.moveSpeed * this.sizeMultiplier,
                Math.sin(angle) * this.moveSpeed * this.sizeMultiplier
            );
        }
    }

    // ─── Ability 1: Lay Nit Eggs ─────────────────────────────────────────────
    _layNitEgg() {
        this._stompScale = 1.35; // squash up
        this.body.setVelocity(0, 0);
        this._nitCooldown = 7500 + Math.random() * 3000;

        this.scene.showFeedback('🥚 NIT LAID 🥚', 0xffffff, this.x, this.y - 90);

        // Create nit capsule (visual + physics)
        const scene = this.scene;
        const nit = scene.add.container(this.x, this.y);
        const gfx = scene.add.graphics();
        nit.add(gfx);
        nit.setDepth(450);

        scene.physics.add.existing(nit);
        nit.body.setCircle(18, -18, -18);
        nit.body.setImmovable(true);

        nit._health = 160;
        nit._maxHealth = 160;
        nit._hatchTimer = 4000; // hatches in 4s
        nit.isDead = false;

        // Draw egg capsule
        const drawNit = () => {
            gfx.clear();
            const alpha = 0.5 + 0.5 * Math.sin(scene.time.now * 0.01);
            gfx.fillStyle(0x000000, 0.2);
            gfx.fillCircle(0, 10, 22);

            // Translucent glowing egg shell
            gfx.fillStyle(0xeefffc, 0.85);
            gfx.fillEllipse(0, 0, 36, 44);
            // Pulsing center (growing embryo)
            gfx.fillStyle(0xff3333, alpha * 0.45);
            gfx.fillCircle(0, 2, 14);

            // Ring
            gfx.lineStyle(2, 0xffffff, 0.7);
            gfx.strokeEllipse(0, 0, 36, 44);
        };

        nit._tick = (delta) => {
            if (nit.isDead || !nit.active) return;
            nit._hatchTimer -= delta;

            if (nit._hatchTimer <= 0) {
                nit._hatch();
                return;
            }
            drawNit();
        };

        nit.takeDamage = (amount) => {
            if (nit.isDead) return;
            nit._health = Math.max(0, nit._health - amount);
            scene.createImpactEffect(nit.x, nit.y, 0xffffff, 'punch', amount, false);

            if (nit._health <= 0) {
                nit.isDead = true;
                // Pop FX
                scene.showFeedback('NIT CRUSHED!', 0x00ff00, nit.x, nit.y - 40);
                scene.addScore(100, nit.x, nit.y);
                scene.cameras.main.shake(100, 0.005);
                this._spawnBurrowFX(nit.x, nit.y, 0xeefffc);
                scene.time.delayedCall(0, () => { if (nit.active) nit.destroy(); });
            }
        };

        nit._hatch = () => {
            if (nit.isDead) return;
            nit.isDead = true;

            // Hatch FX
            this._spawnBurrowFX(nit.x, nit.y, 0xff3333);
            scene.showFeedback('🦟 NYMPH HATCHED! 🦟', 0xff3333, nit.x, nit.y - 50);

            // Spawn 2 aggressive baby nymphs!
            for (let i = 0; i < 2; i++) {
                const angle = Math.random() * Math.PI * 2;
                const offset = 30;
                const nx = nit.x + Math.cos(angle) * offset;
                const ny = nit.y + Math.sin(angle) * offset;

                const nymph = new Chigga(scene, nx, ny, CONFIG.FACTIONS.WILD);
                nymph.target = scene.player; // aggro directly
                nymph.health = 180;
                nymph.maxHealth = 180;
                nymph.moveSpeed = 330;
                nymph.setScale(0.85); // smaller scale
                scene.units.add(nymph);
            }

            scene.time.delayedCall(0, () => { if (nit.active) nit.destroy(); });
        };

        this._nits.push(nit);
        drawNit();
    }

    _updateNits(time, delta) {
        this._nits = this._nits.filter(n => n && n.active && !n.isDead);
        this._nits.forEach(n => { if (n._tick) n._tick(delta); });
    }

    // ─── Ability 2: Hair Cling ───────────────────────────────────────────────
    _startCling(follicle) {
        this.state = 'CLINGING';
        this._clingingFollicle = follicle;
        this._clingTimer = 3500; // stay on hair for 3.5s
        this._stompScale = 0.85;

        // Teleport-dash to the follicle's base
        this.scene.showFeedback('💈 HAIR LATCH 💈', 0x00ffff, this.x, this.y - 90);
        this.scene.cameras.main.shake(200, 0.01);
        this._spawnBurrowFX(this.x, this.y, 0xaabbcc);

        this.x = follicle.x;
        this.y = follicle.y + 40; // Cling just below the base of the follicle hair
        if (this.body) {
            this.body.x = this.x - this.body.halfWidth;
            this.body.y = this.y - this.body.halfHeight;
            this.body.setVelocity(0, 0);
        }

        this._spawnBurrowFX(this.x, this.y, 0x00ffff);
    }

    _stateClinging(time, delta) {
        this._clingTimer -= delta;
        this.body.setVelocity(0, 0);

        // Shoot scale spray projectiles periodically while clinging
        if (!this._lastSpray) this._lastSpray = 0;
        if (time - this._lastSpray >= 450) {
            this._lastSpray = time;
            this._stompScale = 1.2;
            this._sprayScales();
        }

        if (this._clingTimer <= 0) {
            // Jump off follicle back to hunting
            this.state = 'HUNTING';
            this._clingCooldown = 13000 + Math.random() * 4000;
            this._clingingFollicle = null;
            this.scene.showFeedback('LEAP OFF HAIR!', 0x00ffff, this.x, this.y - 90);
            
            const angle = Math.random() * Math.PI * 2;
            this.body.setVelocity(Math.cos(angle) * 350, Math.sin(angle) * 350);
            this._stompScale = 0.75;
            this._spawnBurrowFX(this.x, this.y, 0xaabbcc);
        }
    }

    _sprayScales() {
        if (!this.scene || !this.scene.player) return;
        const count = 8;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
            const px = this.x + Math.cos(angle) * this.baseSize * 0.8;
            const py = this.y + Math.sin(angle) * this.baseSize * 0.8;

            const scaleProj = this.scene.add.circle(px, py, 9, 0xcceeff, 0.95).setDepth(899);
            this.scene.physics.add.existing(scaleProj);
            scaleProj.body.setVelocity(Math.cos(angle) * 380, Math.sin(angle) * 380);

            // Destroy timer
            this.scene.time.delayedCall(1600, () => {
                if (scaleProj && scaleProj.active) scaleProj.destroy();
            });

            // Overlap check with player & followers
            this.scene.physics.add.overlap(scaleProj, this.scene.player, () => {
                this.scene.player.takeDamage(this.attackDamage * 0.5, this);
                this.scene.createImpactEffect(this.scene.player.x, this.scene.player.y, 0xccddee, 'punch', this.attackDamage * 0.5, true);
                scaleProj.destroy();
            });

            this.scene.player.followers.forEach(pf => {
                if (!pf || !pf.active) return;
                this.scene.physics.add.overlap(scaleProj, pf, () => {
                    pf.takeDamage(this.attackDamage * 0.5);
                    scaleProj.destroy();
                });
            });
        }
    }

    // ─── Ability 3: Itch Claw Sweeping Pull ──────────────────────────────────
    _doClawPull(player) {
        this.state = 'ATTACKING_TURF'; // block movement
        this._clawActive = true;
        this._clawCooldown = 11000 + Math.random() * 3000;
        this.body.setVelocity(0, 0);
        this._stompScale = 0.5; // squash down for suction pull

        this.scene.showFeedback('🧲 CLAW VACUUM! 🧲', 0xff5500, this.x, this.y - 100);
        this.scene.cameras.main.shake(800, 0.015);

        // Apply magnetic drag pull on all players and followers in wide radius over 1 second
        this.scene.tweens.add({
            targets: this,
            _clawPhase: Math.PI * 6,
            duration: 1000,
            onUpdate: () => {
                const pullRadius = this.baseSize * this.sizeMultiplier * 2.8;

                // Pull player
                const dp = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                if (dp < pullRadius) {
                    const angle = Phaser.Math.Angle.Between(player.x, player.y, this.x, this.y);
                    player.x += Math.cos(angle) * 12;
                    player.y += Math.sin(angle) * 12;
                    if (player.body) {
                        player.body.x = player.x - player.body.halfWidth;
                        player.body.y = player.y - player.body.halfHeight;
                    }
                }

                // Pull followers
                player.followers.forEach(pf => {
                    if (!pf || !pf.active) return;
                    const df = Phaser.Math.Distance.Between(this.x, this.y, pf.x, pf.y);
                    if (df < pullRadius) {
                        const angle = Phaser.Math.Angle.Between(pf.x, pf.y, this.x, this.y);
                        pf.x += Math.cos(angle) * 15;
                        pf.y += Math.sin(angle) * 15;
                        if (pf.body) {
                            pf.body.x = pf.x - pf.body.halfWidth;
                            pf.body.y = pf.y - pf.body.halfHeight;
                        }
                    }
                });
            },
            onComplete: () => {
                this._clawActive = false;
                this._clawPhase = 0;
                this.state = 'HUNTING';
                this._stompScale = 1.4; // slam back up
                this.scene.cameras.main.shake(300, 0.025);

                // Strike blast damage to everyone very close (slashed by claws)
                const slashR = this.baseSize * this.sizeMultiplier + 50;
                const dp = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                if (dp < slashR) {
                    player.takeDamage(this.attackDamage * 1.5, this);
                    this.scene.createImpactEffect(player.x, player.y, 0xff5500, 'punch', this.attackDamage * 1.5, true);
                }

                player.followers.forEach(pf => {
                    if (!pf || !pf.active) return;
                    const df = Phaser.Math.Distance.Between(this.x, this.y, pf.x, pf.y);
                    if (df < slashR) {
                        pf.takeDamage(this.attackDamage * 1.5);
                    }
                });
            }
        });
    }

    // ─── Turf Attacking ───────────────────────────────────────────────────────
    _tryHuntPlayerSoldiers(time, delta) {
        if (!this.scene || !this.scene.units || this.isDead || !this.active) return false;

        let target = null;
        let minDist = Infinity;
        const seen = new Set();

        const consider = (unit) => {
            if (!unit || !unit.active || unit.isDead || unit.faction !== CONFIG.FACTIONS.PLAYER) return;
            if (seen.has(unit)) return;
            seen.add(unit);

            const d = Phaser.Math.Distance.Between(this.x, this.y, unit.x, unit.y);
            if (d < minDist) {
                minDist = d;
                target = unit;
            }
        };

        this.scene.units.children.entries.forEach(consider);
        this.scene.player?.followers?.forEach(consider);

        if (!target) return false;

        const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
        const attackRange = this.baseSize * this.sizeMultiplier * 0.65 + 42;

        if (minDist > attackRange) {
            this.body.setVelocity(
                Math.cos(angle) * this.moveSpeed * this.sizeMultiplier * 1.08,
                Math.sin(angle) * this.moveSpeed * this.sizeMultiplier * 1.08
            );

            if (!this._lastSoldierHuntNotice || time - this._lastSoldierHuntNotice > 3600) {
                this._lastSoldierHuntNotice = time;
                this.scene.showFeedback('LICE LORD HUNTS SOLDIERS!', 0xccddee, this.x, this.y - 110);
            }

            return true;
        }

        this.body.setVelocity(0, 0);

        if (time - this._lastAttack >= this.attackCooldown) {
            this._lastAttack = time;
            this._stompScale = 0.62;
            const dmg = this.attackDamage * 3.25;
            target.takeDamage(dmg, this);
            this.scene.createImpactEffect(target.x, target.y, 0xccddee, 'bite', dmg, true);
            this.scene.cameras.main.shake(90, 0.007);
        }

        return true;
    }

    _stateAttackingTurf(time, delta) {
        if (this._clawActive) return; // let claws sweep finish
        const t = this.currentTarget;
        if (!t || t.faction !== CONFIG.FACTIONS.PLAYER) {
            this.currentTarget = null;
            this.state = 'HUNTING';
            return;
        }

        this.body.setVelocity(0, 0);

        if (time - this._lastAttack >= this.attackCooldown) {
            this._lastAttack = time;
            this._stompScale = 0.65;
            this.scene.cameras.main.shake(120, 0.008);

            this.scene.units.children.iterate(unit => {
                if (!unit || !unit.active || unit.faction !== CONFIG.FACTIONS.PLAYER) return;
                if (Phaser.Math.Distance.Between(t.x, t.y, unit.x, unit.y) < t.radius * 1.2) {
                    unit.takeDamage(this.attackDamage * 2.5);
                    this.scene.createImpactEffect(unit.x, unit.y, 0xccddee);
                }
            });
            this.scene.player.followers.forEach(pf => {
                if (!pf || !pf.active) return;
                if (Phaser.Math.Distance.Between(t.x, t.y, pf.x, pf.y) < t.radius * 1.2) {
                    pf.takeDamage(this.attackDamage * 2);
                }
            });

            const remaining = this.scene.units.children.entries.filter(u =>
                u && u.active && u.faction === CONFIG.FACTIONS.PLAYER &&
                Phaser.Math.Distance.Between(t.x, t.y, u.x, u.y) < t.radius
            );

            if (remaining.length === 0) {
                t.setFaction(CONFIG.FACTIONS.NEUTRAL);
                this.scene.showFeedback('TURF DUSTED!', 0xccddee, t.x, t.y - 80);
                this.currentTarget = null;
                this.state = 'HUNTING';
            }
        }
    }

    // ─── Take Damage ─────────────────────────────────────────────────────────
    takeDamage(amount, attacker) {
        if (this.isDead || !this.active || !this.scene) return;

        // Translucent shield during hair cling
        if (this.state === 'CLINGING') {
            amount *= 0.4;
        }

        this._hitFlash = 120;
        this.health = Math.max(0, this.health - amount);
        const pct = this.health / this.maxHealth;
        this.sizeMultiplier = Math.max(0.4, pct);

        const r = this.baseSize * this.sizeMultiplier * 0.85;
        this.body.setCircle(r, -r, -r);
        this.scene.createImpactEffect(this.x, this.y, 0xaabbcc, 'punch', amount, false);

        if (this.health <= 0) this._die(attacker);
    }

    _die(attacker) {
        if (this.isDead || !this.scene) return;
        this.isDead = true;
        this.state = 'DEAD';
        if (this.body) this.body.setVelocity(0, 0);

        const scene = this.scene;
        const deathX = this.x;
        const deathY = this.y;

        if (attacker && attacker.faction === CONFIG.FACTIONS.PLAYER) {
            scene.player.gainStr(25);
            scene.addScore(4000, this.x, this.y);
        }

        // Clean up eggs/nits
        this._nits.forEach(n => { if (n && n.active) n.destroy(); });
        this._nits = [];

        // Huge white-grey translucent shell explosion
        for (let i = 0; i < 35; i++) {
            const angle = (i / 35) * Math.PI * 2;
            const dist = 70 + Math.random() * 180;
            const blob = scene.add.circle(
                deathX, deathY,
                10 + Math.random() * 20,
                [0xeefffc, 0xccddee, 0x8899aa, 0x221111][Math.floor(Math.random() * 4)], 0.8
            ).setDepth(1100);
            scene.tweens.add({
                targets: blob,
                x: deathX + Math.cos(angle) * dist,
                y: deathY + Math.sin(angle) * dist,
                scaleX: 0, scaleY: 0, alpha: 0,
                duration: 500 + Math.random() * 700,
                ease: 'Quad.easeOut',
                onComplete: () => blob.destroy()
            });
        }
        scene.cameras.main.shake(600, 0.03);
        scene.onBossDefeated();
        scene.time.delayedCall(0, () => { if (this.active) this.destroy(); });
    }

    _spawnBurrowFX(x, y, color) {
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const speed = 70 + Math.random() * 100;
            const blob = this.scene.add.circle(x, y, 4 + Math.random() * 7, color, 0.8).setDepth(1100);
            this.scene.tweens.add({
                targets: blob,
                x: x + Math.cos(angle) * speed,
                y: y + Math.sin(angle) * speed,
                scaleX: 0, scaleY: 0, alpha: 0,
                duration: 400 + Math.random() * 200,
                ease: 'Quad.easeOut',
                onComplete: () => blob.destroy()
            });
        }
    }

    checkContactDamage(time) {
        if (this.isDead || !this.active || !this.scene || !this.scene.player || !this.scene._contactCooldowns) return;
        if (this.state === 'CLINGING') return; // immune while on hair

        const player = this.scene.player;
        const contactR = this.baseSize * this.sizeMultiplier + 22;

        const dp = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (dp < contactR && time - this._lastHitTime > 600) {
            this._lastHitTime = time;
            player.takeDamage(this.attackDamage, this);
            this.scene.createImpactEffect(player.x, player.y, 0xaabbcc, 'punch', this.attackDamage, true);
        }

        player.followers.forEach((pf, i) => {
            if (!pf || !pf.active) return;
            const df = Phaser.Math.Distance.Between(this.x, this.y, pf.x, pf.y);
            const key = `boss_pf_${i}`;
            const last = this.scene._contactCooldowns.get(key) || 0;
            if (df < contactR && time - last > 600) {
                this.scene._contactCooldowns.set(key, time);
                pf.takeDamage(this.attackDamage);
            }
        });

        // Contact feedback to damage boss
        player.followers.forEach((pf, i) => {
            if (!pf || !pf.active) return;
            const df = Phaser.Math.Distance.Between(this.x, this.y, pf.x, pf.y);
            const key = `pf_boss_${i}`;
            const last = this.scene._contactCooldowns.get(key) || 0;
            if (df < contactR + 12 && time - last > 700) {
                this.scene._contactCooldowns.set(key, time);
                const str = player.getSTR();
                this.takeDamage(Math.round(14 * (1 + (str - 1) * 0.15)));
            }
        });
    }

    destroy(fromScene) {
        this._nits.forEach(n => { if (n && n.active) n.destroy(); });
        this._nits = [];
        super.destroy(fromScene);
    }
}