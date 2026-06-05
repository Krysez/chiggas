import Phaser from 'phaser';
import { CONFIG } from '../config.js';

/**
 * TickBoss — The TICK TYRANT for Stage 2.
 *
 * A bloated blood-gorged tick with the ability to BURROW under skin and
 * re-emerge anywhere on the map. Drawn entirely with Phaser Graphics.
 *
 * States:
 *  HUNTING        → charge nearest player turf
 *  ATTACKING_TURF → stomp defenders out of turf, revert to NEUTRAL
 *  BURROWING      → sink into ground, disappear, reappear elsewhere
 *  SURFACING      → dramatic emergence shake/FX
 *  FLEEING        → sprint to corner when all player turfs gone
 *  DEAD           → splat explosion
 *
 * Burrow triggers every 12–18s OR when taking significant damage.
 */
export default class TickBoss extends Phaser.GameObjects.Container {
    constructor(scene, x, y, stageIndex = 1) {
        super(scene, x, y);

        this.scene = scene;
        this.faction = 'BOSS';
        this.stageIndex = stageIndex;

        // ── Stats ─────────────────────────────────────────────────────────
        const stageScale = Math.pow(1.8, stageIndex);
        this.maxHealth    = Math.round(900 * stageScale);
        this.health       = this.maxHealth;
        this.baseSize     = 85 + stageIndex * 15;
        this.sizeMultiplier = 1;
        this.moveSpeed    = 155 + stageIndex * 20;
        this.attackDamage = 16 + stageIndex * 5;
        this.attackCooldown = 850;
        this._lastAttack  = 0;
        this._lastHitTime = 0;

        this.state         = 'HUNTING';
        this.currentTarget = null;
        this.isDead        = false;
        this._hitFlash     = 0;

        // ── Burrow state ──────────────────────────────────────────────────
        this._burrowCooldown  = 0;           // counts UP; burrow when >= _burrowInterval
        this._burrowInterval  = 9000 + Math.random() * 5000; // 9-14s — more frequent
        this._burrowDepth     = 0;           // 0=surface, 1=fully underground
        this._surfaceShake    = 0;
        this._burrowHitCount  = 0;           // damage-triggered burrow
        this._burrowChain     = 0;           // remaining chained burrow-hops (0 = normal)
        this._burrowMode      = 'normal';    // 'normal' | 'ambush' | 'chain'

        // ── Attack pattern timers ─────────────────────────────────────────
        this._lungeCooldown    = 6000;          // first lunge after 6s
        this._lungeChargeTimer = 0;             // counts up during charge windup
        this._lungeTarget      = null;
        this._lungeLatchTime   = 0;
        this._larvaeCooldown   = 8000;          // first spawn after 8s
        this._patternRoll      = 0;             // random selector for "after-burrow" pattern

        // ── Animation state ───────────────────────────────────────────────
        this._legPhase    = 0;
        this._bodyBob     = 0;
        this._eyeBlink    = false;
        this._blinkTimer  = 0;
        this._stompScale  = 1;
        this._facingLeft  = false;
        this._moveTime    = 0;
        this._bloodSwell  = 0;   // pulsing blood-belly

        // ── Graphics layers ───────────────────────────────────────────────
        this.gfxShadow = scene.add.graphics();
        this.gfxLegs   = scene.add.graphics();
        this.gfxBody   = scene.add.graphics();
        this.gfxFace   = scene.add.graphics();
        this.gfxHud    = scene.add.graphics();
        this.add([this.gfxShadow, this.gfxLegs, this.gfxBody, this.gfxFace, this.gfxHud]);

        // Skull emoji (tick has skull instead of crown)
        this.crownText = scene.add.text(0, -(this.baseSize + 34), '💀', {
            fontSize: `${Math.round(this.baseSize * 0.52)}px`
        }).setOrigin(0.5, 1);
        this.add(this.crownText);

        // Name tag
        this.nameTag = scene.add.text(0, -(this.baseSize + 58), '☠ TICK TYRANT ☠', {
            fontSize: '18px', fontFamily: 'Dhurjati',
            color: '#aa00ff', stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5, 1);
        this.add(this.nameTag);

        // Skull float tween
        scene.tweens.add({
            targets: this.crownText,
            y: -(this.baseSize + 44),
            duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });

        // ── Burrow warning ring (separate graphics, not in container) ─────
        this._warningGfx = scene.add.graphics().setDepth(895);

        // ── Physics ───────────────────────────────────────────────────────
        scene.physics.add.existing(this);
        const r = this.baseSize * 0.85;
        this.body.setCircle(r, -r, -r);
        this.body.setCollideWorldBounds(true);

        scene.add.existing(this);
        this.setDepth(900);

        this._drawAll(0);
    }

    // ── Colours ────────────────────────────────────────────────────────────
    get _bodyColor()   { return 0x5a1a6a; }   // deep purple-brown tick
    get _legColor()    { return 0x3a0a4a; }
    get _accentColor() { return 0xcc44ff; }   // blood-purple accent
    get _bellyColor()  {
        // belly swells red/pink with blood
        const t = 0.5 + 0.5 * Math.sin(this._bloodSwell);
        const r = Math.round(180 + t * 75);
        const g = Math.round(20 + t * 10);
        const b = Math.round(30 + t * 20);
        return (r << 16) | (g << 8) | b;
    }

    // ── Per-frame draw ─────────────────────────────────────────────────────
    _drawAll(time) {
        const bd  = this._burrowDepth;   // 0=visible 1=underground
        const vis = 1 - bd;              // overall visibility scale
        if (vis <= 0) return;            // fully underground, skip draw

        const s     = this.sizeMultiplier * vis;
        const r     = this.baseSize * s;
        const bob   = this._bodyBob * s;
        const stomp = this._stompScale;
        const flash = this._hitFlash > 0;

        const bodyColor = flash ? 0xffffff : this._bodyColor;
        const legColor  = flash ? 0xffffff : this._legColor;
        const accent    = flash ? 0xff88ff : this._accentColor;

        // Scale entire container so it sinks into ground while burrowing
        this.setScale(1, vis);
        this.setAlpha(Math.max(0.05, vis));

        // ── Shadow ────────────────────────────────────────────────────────
        this.gfxShadow.clear();
        this.gfxShadow.fillStyle(0x000000, 0.3 * vis);
        this.gfxShadow.fillEllipse(0, r * 0.7, r * 2.4, r * 0.6 * vis);

        // ── 8 legs (tick has 8) ───────────────────────────────────────────
        this.gfxLegs.clear();
        this.gfxLegs.lineStyle(Math.max(3, r * 0.11), legColor, 1);
        const legCount = 4; // 4 per side = 8 total
        const legSpread = r * 1.55;
        for (let i = 0; i < legCount; i++) {
            const frac = (i / (legCount - 1)) - 0.5;
            const swing = Math.sin(this._legPhase + i * 0.9) * 16 * s;
            const attachY = bob + frac * r * 0.95;
            // Left leg
            this.gfxLegs.beginPath();
            this.gfxLegs.moveTo(-r * 0.65, attachY);
            this.gfxLegs.lineTo(-legSpread, attachY + swing + r * 0.55);
            this.gfxLegs.strokePath();
            // Right leg
            this.gfxLegs.beginPath();
            this.gfxLegs.moveTo(r * 0.65, attachY);
            this.gfxLegs.lineTo(legSpread, attachY - swing + r * 0.55);
            this.gfxLegs.strokePath();
        }

        // ── Body — fat engorged oval ──────────────────────────────────────
        this.gfxBody.clear();
        const bw = r * stomp * 1.15;   // ticks are wider
        const bh = r * (2 - stomp + 0.1);
        this.gfxBody.fillStyle(bodyColor, 1);
        this.gfxBody.fillEllipse(0, bob, bw * 2, bh * 2);

        // Blood belly (engorged lower half)
        this.gfxBody.fillStyle(this._bellyColor, 0.85);
        this.gfxBody.fillEllipse(0, bob + r * 0.38, r * 1.55, r * 1.1);

        // Dorsal scute plates (tick armor segments)
        this.gfxBody.fillStyle(0x380a45, 0.9);
        for (let i = 0; i < 3; i++) {
            const sx = (i - 1) * r * 0.42;
            const sy = bob - r * 0.22;
            this.gfxBody.fillEllipse(sx, sy, r * 0.38, r * 0.28);
        }

        // Sheen
        this.gfxBody.fillStyle(0xffffff, 0.08);
        this.gfxBody.fillEllipse(-r * 0.25, bob - r * 0.28, r * 0.8, r * 0.55);

        // ── Face ──────────────────────────────────────────────────────────
        this.gfxFace.clear();
        const eyeY  = bob - r * 0.22;
        const eyeR  = r * 0.19;

        // 4 beady eyes (pair × 2)
        const eyePositions = [
            { x: -r * 0.42, y: eyeY - eyeR * 0.2 },
            { x: r * 0.42,  y: eyeY - eyeR * 0.2 },
            { x: -r * 0.18, y: eyeY + eyeR * 0.5 },
            { x: r * 0.18,  y: eyeY + eyeR * 0.5 },
        ];
        eyePositions.forEach(ep => {
            this.gfxFace.fillStyle(0xdd0022, 1);
            this.gfxFace.fillCircle(ep.x, ep.y, eyeR);
            this.gfxFace.fillStyle(0x000000, 1);
            if (this._eyeBlink) {
                this.gfxFace.fillRect(ep.x - eyeR * 0.6, ep.y - eyeR * 0.1, eyeR * 1.2, eyeR * 0.2);
            } else {
                this.gfxFace.fillCircle(ep.x + eyeR * 0.15, ep.y, eyeR * 0.45);
            }
            // Glint
            this.gfxFace.fillStyle(0xffffff, 0.7);
            this.gfxFace.fillCircle(ep.x - eyeR * 0.25, ep.y - eyeR * 0.3, eyeR * 0.2);
        });

        // Hypostome (feeding mouthpart — like a nasty hook beak)
        const mouthY = bob + r * 0.05;
        this.gfxFace.fillStyle(0x1a0a10, 1);
        this.gfxFace.fillTriangle(
            -r * 0.1, mouthY,
            r * 0.1, mouthY,
            0, mouthY + r * 0.38
        );
        this.gfxFace.lineStyle(Math.max(2, r * 0.06), 0x440022, 1);
        this.gfxFace.beginPath();
        this.gfxFace.moveTo(0, mouthY);
        this.gfxFace.lineTo(0, mouthY + r * 0.35);
        this.gfxFace.strokePath();
        // Barbs on the hypostome
        for (let i = 1; i <= 3; i++) {
            const by2 = mouthY + (i / 4) * r * 0.3;
            const bx  = r * 0.07;
            this.gfxFace.lineStyle(Math.max(1, r * 0.04), 0x880033, 1);
            this.gfxFace.beginPath();
            this.gfxFace.moveTo(-bx, by2);
            this.gfxFace.lineTo(-bx * 2.2, by2 + r * 0.06);
            this.gfxFace.strokePath();
            this.gfxFace.beginPath();
            this.gfxFace.moveTo(bx, by2);
            this.gfxFace.lineTo(bx * 2.2, by2 + r * 0.06);
            this.gfxFace.strokePath();
        }

        // ── HUD: health bar + glow ring ───────────────────────────────────
        this.gfxHud.clear();
        const glowR = r + 12;
        const glowAlpha = (0.4 + 0.4 * Math.sin(this._moveTime * 0.005)) * vis;
        this.gfxHud.lineStyle(5, 0xaa00ff, glowAlpha);
        this.gfxHud.strokeCircle(0, bob, glowR);
        this.gfxHud.lineStyle(2, 0xff44ff, glowAlpha * 0.55);
        this.gfxHud.strokeCircle(0, bob, glowR + 7);

        const bw2 = Math.min(150, r * 1.85);
        const bh2 = 11;
        const by2 = bob - r - 26;
        this.gfxHud.fillStyle(0x000000, 0.75);
        this.gfxHud.fillRect(-bw2 / 2, by2, bw2, bh2);
        const pct = Math.max(0, this.health / this.maxHealth);
        const barColor = pct > 0.5 ? 0xaa00ff : pct > 0.25 ? 0xff44ff : 0xff0066;
        this.gfxHud.fillStyle(barColor, 1);
        this.gfxHud.fillRect(-bw2 / 2, by2, bw2 * pct, bh2);
        this.gfxHud.lineStyle(1, 0xffffff, 0.3);
        this.gfxHud.strokeRect(-bw2 / 2, by2, bw2, bh2);
    }

    // ── Per-frame warning ring (drawn in world, not on container) ─────────────
    _drawWarningRing(time) {
        this._warningGfx.clear();
        if (this.state !== 'BURROWING' && this.state !== 'SURFACING') return;

        const target = this._burrowTarget;
        if (!target) return;

        const alpha = 0.3 + 0.3 * Math.sin(time * 0.01);
        const radius = 80 + 20 * Math.sin(time * 0.008);

        this._warningGfx.lineStyle(4, 0xff00ff, alpha);
        this._warningGfx.strokeCircle(target.x, target.y, radius);
        this._warningGfx.fillStyle(0xff00ff, alpha * 0.15);
        this._warningGfx.fillCircle(target.x, target.y, radius);

        // Cracks radiating from center
        this._warningGfx.lineStyle(2, 0xffffff, alpha * 0.5);
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + time * 0.002;
            const len = radius * 0.6;
            this._warningGfx.beginPath();
            this._warningGfx.moveTo(target.x, target.y);
            this._warningGfx.lineTo(target.x + Math.cos(a) * len, target.y + Math.sin(a) * len);
            this._warningGfx.strokePath();
        }
    }

    // ── Update loop ────────────────────────────────────────────────────────
    update(time, delta) {
        if (!this.active || this.isDead) return;
        this._moveTime = time;

        // Animate blood swell
        this._bloodSwell += delta * 0.002;

        // Leg animation
        const vel = this.body ? Math.sqrt(this.body.velocity.x ** 2 + this.body.velocity.y ** 2) : 0;
        const moving = vel > 20;
        if (moving) {
            this._legPhase  += delta * 0.01;
            this._bodyBob    = Math.sin(this._legPhase * 2) * 5;
            this._facingLeft = this.body.velocity.x < 0;
        } else {
            this._legPhase  += delta * 0.003;
            this._bodyBob    = Math.sin(this._legPhase) * 2;
        }

        // Blink
        this._blinkTimer += delta;
        if (this._blinkTimer > 2200 + Math.random() * 1800) {
            this._eyeBlink   = true;
            this._blinkTimer = 0;
            this.scene.time.delayedCall(90, () => { if (this.active) this._eyeBlink = false; });
        }

        // Hit flash decay
        if (this._hitFlash > 0) this._hitFlash -= delta;

        // Stomp recovery
        if (this._stompScale < 1) {
            this._stompScale = Math.min(1, this._stompScale + delta * 0.006);
        }

        // Update timers (only when above ground)
        if (this.state === 'HUNTING' || this.state === 'ATTACKING_TURF') {
            this._burrowCooldown += delta;
            this._lungeCooldown  -= delta;
            this._larvaeCooldown -= delta;
        }

        // Update crown/nametag Y
        this.crownText.y  = -(this.baseSize * this.sizeMultiplier + 34);
        this.nameTag.y    = -(this.baseSize * this.sizeMultiplier + 58);

        // Draw
        this._drawAll(time);
        this._drawWarningRing(time);

        // State machine
        switch (this.state) {
            case 'HUNTING':        this._stateHunting(time, delta);       break;
            case 'ATTACKING_TURF': this._stateAttackingTurf(time, delta);  break;
            case 'LUNGE_WINDUP':   this._stateLungeWindup(time, delta);    break;
            case 'LUNGE_CHARGE':   this._stateLungeCharge(time, delta);    break;
            case 'LUNGE_LATCH':   this._stateLungeLatch(time, delta);     break;
            case 'BURROWING':      this._stateBurrowing(time, delta);      break;
            case 'SURFACING':      this._stateSurfacing(time, delta);      break;
            case 'FLEEING':        this._stateFleeing();                   break;
        }
    }

    // ── State: HUNTING ─────────────────────────────────────────────────────
    _stateHunting(time, delta) {
        // Priority 1: chained burrow hops (set after damage-triggered burrow)
        if (this._burrowChain > 0) {
            this._burrowChain--;
            this._startBurrow('chain');
            return;
        }

        // Priority 2: lunge attack — when player is at mid-range
        if (this._lungeCooldown <= 0) {
            const player = this.scene.player;
            if (player && player.active) {
                const dp = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                if (dp > 280 && dp < 1100) {
                    this._startLunge(player);
                    return;
                }
            }
        }

        // Priority 3: spawn tick larvae — periodic ranged attack
        if (this._larvaeCooldown <= 0) {
            this._spawnLarvae();
            this._larvaeCooldown = 11000 + Math.random() * 5000;
        }

        // Priority 4: scheduled burrow
        if (this._burrowCooldown >= this._burrowInterval) {
            // Randomly pick ambush vs normal burrow
            const ambushChance = 0.5;
            this._startBurrow(Math.random() < ambushChance ? 'ambush' : 'normal');
            return;
        }

        // Default: march to nearest player turf
        let nearest = null;
        let minDist  = Infinity;
        this.scene.territories.forEach(t => {
            if (t.faction === CONFIG.FACTIONS.PLAYER) {
                const d = Phaser.Math.Distance.Between(this.x, this.y, t.x, t.y);
                if (d < minDist) { minDist = d; nearest = t; }
            }
        });

        if (!nearest) { this.state = 'FLEEING'; return; }

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

    // ── Attack 1: Blood Drain Lunge ───────────────────────────────────────
    // Telegraphs for 0.6s with a red crosshair on the player, then launches
    // at 2.4× speed. On contact, latches for 1.5s draining health.
    _startLunge(player) {
        this.state = 'LUNGE_WINDUP';
        this._lungeTarget = player;
        this._lungeChargeTimer = 0;
        this.body.setVelocity(0, 0);
        this._stompScale = 1.15; // puff up before the charge

        // Telegraph reticle on the player
        const reticle = this.scene.add.graphics().setDepth(901);
        this._lungeReticle = reticle;
        this._lungeReticleTime = 0;
        this.scene.showFeedback('⚠ LUNGE!', 0xff00ff, this.x, this.y - 80);
    }

    _stateLungeWindup(time, delta) {
        this._lungeChargeTimer += delta;
        const player = this._lungeTarget;

        // Draw expanding crosshair on player
        if (this._lungeReticle && player && player.active) {
            const r = 60 - (this._lungeChargeTimer / 600) * 40;
            const alpha = 0.4 + 0.5 * Math.sin(time * 0.025);
            this._lungeReticle.clear();
            this._lungeReticle.lineStyle(4, 0xff00ff, alpha);
            this._lungeReticle.strokeCircle(player.x, player.y, Math.max(20, r));
            this._lungeReticle.lineStyle(2, 0xffffff, alpha * 0.7);
            this._lungeReticle.strokeCircle(player.x, player.y, Math.max(20, r) + 6);
            // Cross-hair lines
            const r2 = Math.max(20, r) + 6;
            this._lungeReticle.beginPath();
            this._lungeReticle.moveTo(player.x - r2 - 10, player.y);
            this._lungeReticle.lineTo(player.x - r2 + 4, player.y);
            this._lungeReticle.moveTo(player.x + r2 + 10, player.y);
            this._lungeReticle.lineTo(player.x + r2 - 4, player.y);
            this._lungeReticle.moveTo(player.x, player.y - r2 - 10);
            this._lungeReticle.lineTo(player.x, player.y - r2 + 4);
            this._lungeReticle.moveTo(player.x, player.y + r2 + 10);
            this._lungeReticle.lineTo(player.x, player.y + r2 - 4);
            this._lungeReticle.strokePath();
        }

        if (this._lungeChargeTimer >= 600) {
            // FIRE
            if (this._lungeReticle) { this._lungeReticle.destroy(); this._lungeReticle = null; }
            if (!player || !player.active) {
                this.state = 'HUNTING';
                this._lungeCooldown = 7000 + Math.random() * 3000;
                return;
            }
            const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            const chargeSpeed = this.moveSpeed * 2.6;
            this.body.setVelocity(Math.cos(angle) * chargeSpeed, Math.sin(angle) * chargeSpeed);
            this.state = 'LUNGE_CHARGE';
            this._lungeChargeTimer = 0;
            this._stompScale = 0.9;
        }
    }

    _stateLungeCharge(time, delta) {
        this._lungeChargeTimer += delta;
        const player = this._lungeTarget;

        // Lunge max duration ~1.2s
        if (this._lungeChargeTimer > 1200 || !player || !player.active) {
            this.body.setVelocity(0, 0);
            this.state = 'HUNTING';
            this._lungeCooldown = 7000 + Math.random() * 3000;
            return;
        }

        // Check contact with player
        const dp = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        const contactR = this.baseSize * this.sizeMultiplier + 40;
        if (dp < contactR) {
            // LATCH
            this.body.setVelocity(0, 0);
            this.state = 'LUNGE_LATCH';
            this._lungeLatchTime = 0;
            this._stompScale = 1.25; // bloated latch posture
            this.scene.cameras.main.shake(220, 0.018);
            this.scene.showFeedback('LATCHED!', 0xff0066, player.x, player.y - 70);
        }
    }

    _stateLungeLatch(time, delta) {
        this._lungeLatchTime += delta;
        const player = this._lungeTarget;

        // Stay glued to the player while draining
        if (player && player.active) {
            // Lock position to just behind the player
            const offset = this.baseSize * this.sizeMultiplier * 0.6;
            this.x = player.x;
            this.y = player.y + offset * 0.3;
            if (this.body) {
                this.body.x = this.x - this.body.halfWidth;
                this.body.y = this.y - this.body.halfHeight;
                this.body.setVelocity(0, 0);
            }

            // Drain damage every 250ms (~6 ticks over 1500ms)
            if (!this._lastDrainTick) this._lastDrainTick = 0;
            if (this._lungeLatchTime - this._lastDrainTick >= 250) {
                this._lastDrainTick = this._lungeLatchTime;
                player.takeDamage(this.attackDamage * 0.6, this);
                // Steal a little health for the tick
                this.health = Math.min(this.maxHealth, this.health + this.attackDamage * 0.4);
                // Visual: red drain particles flowing from player into tick
                const blob = this.scene.add.circle(player.x, player.y, 6, 0xff0044, 1).setDepth(1100);
                this.scene.tweens.add({
                    targets: blob,
                    x: this.x, y: this.y - 20,
                    scale: 0.3, alpha: 0,
                    duration: 220, ease: 'Quad.easeIn',
                    onComplete: () => blob.destroy()
                });
            }
        }

        // End latch after 1.5s
        if (this._lungeLatchTime >= 1500 || !player || !player.active) {
            this._lastDrainTick = 0;
            this._lungeTarget = null;
            this.state = 'HUNTING';
            this._lungeCooldown = 8000 + Math.random() * 4000;
            this._stompScale = 0.9;
        }
    }

    // ── Attack 2: Spawn Tick Larvae ───────────────────────────────────────
    // Emits 4-6 small fast-moving baby ticks (graphics circles) that home in
    // on the player and explode on contact dealing splash damage.
    _spawnLarvae() {
        const player = this.scene.player;
        if (!player || !player.active || !this.scene) return;

        const count = 4 + Math.floor(Math.random() * 3); // 4-6 larvae
        this.scene.showFeedback('SPAWNING LARVAE!', 0xff00ff, this.x, this.y - 100);
        this._stompScale = 1.2;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
            const speed = 160 + Math.random() * 80;
            const startX = this.x + Math.cos(angle) * this.baseSize * 0.8;
            const startY = this.y + Math.sin(angle) * this.baseSize * 0.8;

            this._createLarva(startX, startY, angle, speed);
        }
    }

    _createLarva(x, y, initialAngle, speed) {
        // Larva is a Phaser Arcade physics sprite (using a graphics→texture would be heavy)
        // Instead we use a Container with graphics drawn each frame in a scene update hook
        const scene = this.scene;
        const larva = scene.add.container(x, y);
        const gfx   = scene.add.graphics();
        larva.add(gfx);
        larva.setDepth(850);
        scene.physics.add.existing(larva);
        larva.body.setCircle(10, -10, -10);
        larva.body.setCollideWorldBounds(true);
        larva.body.bounce.set(0.6, 0.6);

        // Initial outward burst, then home in on player
        larva.body.setVelocity(Math.cos(initialAngle) * speed, Math.sin(initialAngle) * speed);

        larva._life   = 0;
        larva._maxLife = 5000;   // 5 seconds before fizzling
        larva._wiggle = Math.random() * Math.PI * 2;
        larva._dead   = false;

        // Register larva with scene-level update so it homes/explodes
        if (!scene._larvae) scene._larvae = [];
        scene._larvae.push(larva);

        // Draw initial appearance
        const drawLarva = () => {
            if (!larva.active) return;
            gfx.clear();
            // Shadow
            gfx.fillStyle(0x000000, 0.3);
            gfx.fillEllipse(0, 6, 18, 6);
            // Body
            gfx.fillStyle(0x880033, 1);
            gfx.fillCircle(0, 0, 10);
            gfx.fillStyle(0xcc0066, 0.7);
            gfx.fillCircle(-2, -2, 6);
            // Tiny eyes
            gfx.fillStyle(0xffff00, 1);
            gfx.fillCircle(-3, -1, 1.5);
            gfx.fillCircle(3, -1, 1.5);
            // Legs (wiggling)
            gfx.lineStyle(1.5, 0x550022, 1);
            for (let i = -1; i <= 1; i++) {
                const w = Math.sin(larva._wiggle + i) * 2;
                gfx.beginPath();
                gfx.moveTo(-7, i * 4);
                gfx.lineTo(-14, i * 4 + w);
                gfx.moveTo(7, i * 4);
                gfx.lineTo(14, i * 4 - w);
                gfx.strokePath();
            }
        };

        // Per-frame logic — homing, lifetime, contact detection
        larva._tick = (time, delta) => {
            if (larva._dead || !larva.active) return;
            larva._life   += delta;
            larva._wiggle += delta * 0.015;

            const player = scene.player;
            if (!player || !player.active) {
                drawLarva();
                return;
            }

            // Homing
            const dx = player.x - larva.x;
            const dy = player.y - larva.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                const homeSpeed = 220;
                const wob = Math.sin(larva._wiggle) * 50;
                const ang = Math.atan2(dy, dx);
                larva.body.setVelocity(
                    Math.cos(ang) * homeSpeed + Math.cos(ang + Math.PI / 2) * wob * 0.3,
                    Math.sin(ang) * homeSpeed + Math.sin(ang + Math.PI / 2) * wob * 0.3
                );
            }

            // Contact: explode on player or follower
            const explodeR = 22;
            if (dist < explodeR) {
                larva._explode(player);
                return;
            }
            for (const pf of player.followers) {
                if (!pf || !pf.active) continue;
                const df = Phaser.Math.Distance.Between(larva.x, larva.y, pf.x, pf.y);
                if (df < explodeR) { larva._explode(pf); return; }
            }

            // Lifetime expiry — fizzle
            if (larva._life >= larva._maxLife) {
                larva._fizzle();
                return;
            }

            drawLarva();
        };

        larva._explode = (target) => {
            if (larva._dead) return;
            larva._dead = true;
            // Splash damage
            if (target && target.takeDamage) {
                const dmg = Math.round(this.attackDamage * 0.55);
                if (target === scene.player) {
                    target.takeDamage(dmg, this);
                } else {
                    target.takeDamage(dmg);
                }
            }
            // Burst FX
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                const blob = scene.add.circle(larva.x, larva.y, 4, 0xff0044, 1).setDepth(1100);
                scene.tweens.add({
                    targets: blob,
                    x: larva.x + Math.cos(a) * 30,
                    y: larva.y + Math.sin(a) * 30,
                    scaleX: 0, scaleY: 0, alpha: 0,
                    duration: 300, ease: 'Quad.easeOut',
                    onComplete: () => blob.destroy()
                });
            }
            scene._larvae = scene._larvae.filter(l => l !== larva);
            larva.destroy();
        };

        larva._fizzle = () => {
            if (larva._dead) return;
            larva._dead = true;
            scene.tweens.add({
                targets: larva,
                alpha: 0, scale: 0.5,
                duration: 300,
                onComplete: () => {
                    scene._larvae = scene._larvae?.filter(l => l !== larva);
                    larva.destroy();
                }
            });
        };

        drawLarva();
    }

    // ── State: ATTACKING_TURF ──────────────────────────────────────────────
    _stateAttackingTurf(time, delta) {
        const t = this.currentTarget;
        if (!t || t.faction !== CONFIG.FACTIONS.PLAYER) {
            this.currentTarget = null;
            this.state = 'HUNTING';
            return;
        }

        this.body.setVelocity(0, 0);

        // Check auto-burrow timer even while attacking
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
                    this.scene.createImpactEffect(unit.x, unit.y, 0xaa00ff, 'bite', this.attackDamage * 3, true);
                }
            });
            this.scene.player.followers.forEach(pf => {
                if (!pf || !pf.active) return;
                if (Phaser.Math.Distance.Between(t.x, t.y, pf.x, pf.y) < t.radius * 1.2) {
                    pf.takeDamage(this.attackDamage * 2);
                    this.scene.createImpactEffect(pf.x, pf.y, 0xaa00ff, 'bite', this.attackDamage * 2, true);
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

    // ── Burrow ────────────────────────────────────────────────────────────
    // mode:
    //   'normal' → emerge ~250px away from farthest player turf
    //   'ambush' → emerge directly under the player for a surprise stomp
    //   'chain'  → quick short hop, slightly forward, with reduced cooldown
    _startBurrow(mode = 'normal') {
        this.state = 'BURROWING';
        this._burrowMode = mode;
        this._burrowCooldown = 0;
        this._burrowDepth    = 0;
        // After a chain set, normal interval is shorter
        this._burrowInterval = (mode === 'chain' ? 6000 : 10000) + Math.random() * 5000;

        const player = this.scene.player;
        const playerTurfs = this.scene.territories.filter(t => t.faction === CONFIG.FACTIONS.PLAYER);

        if (mode === 'ambush' && player && player.active) {
            // Emerge directly under the player
            this._burrowTarget = {
                x: Phaser.Math.Clamp(player.x, 200, CONFIG.WORLD_SIZE - 200),
                y: Phaser.Math.Clamp(player.y, 200, CONFIG.WORLD_SIZE - 200)
            };
            this.scene.showFeedback('⚠ AMBUSH!', 0xff0066, this.x, this.y - 80);
        } else if (mode === 'chain' && player && player.active) {
            // Short hop in the player's direction (250-400px)
            const ang  = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            const dist = 250 + Math.random() * 150;
            this._burrowTarget = {
                x: Phaser.Math.Clamp(this.x + Math.cos(ang) * dist, 200, CONFIG.WORLD_SIZE - 200),
                y: Phaser.Math.Clamp(this.y + Math.sin(ang) * dist, 200, CONFIG.WORLD_SIZE - 200)
            };
        } else if (playerTurfs.length > 0) {
            // Normal: emerge near the farthest player turf (unexpected angle)
            let farthest = playerTurfs[0];
            let maxDist  = 0;
            playerTurfs.forEach(t => {
                const d = Phaser.Math.Distance.Between(this.x, this.y, t.x, t.y);
                if (d > maxDist) { maxDist = d; farthest = t; }
            });
            const angle = Math.random() * Math.PI * 2;
            const dist  = 220 + Math.random() * 180;
            this._burrowTarget = {
                x: Phaser.Math.Clamp(farthest.x + Math.cos(angle) * dist, 200, CONFIG.WORLD_SIZE - 200),
                y: Phaser.Math.Clamp(farthest.y + Math.sin(angle) * dist, 200, CONFIG.WORLD_SIZE - 200)
            };
            this._burrowTurfTarget = farthest;
        } else {
            this._burrowTarget = {
                x: 400 + Math.random() * (CONFIG.WORLD_SIZE - 800),
                y: 400 + Math.random() * (CONFIG.WORLD_SIZE - 800)
            };
        }

        this.body.setVelocity(0, 0);
        if (mode === 'normal') {
            this.scene.showFeedback('IT BURROWS!', 0xaa00ff, this.x, this.y - 80);
        }
        this.scene.cameras.main.shake(mode === 'chain' ? 120 : 200, 0.01);

        // Burrow particle: dirt clods shooting outward
        this._spawnBurrowFX(this.x, this.y, 0x8b5a2b);
    }

    _spawnBurrowFX(x, y, color) {
        for (let i = 0; i < 14; i++) {
            const angle = (i / 14) * Math.PI * 2;
            const speed = 80 + Math.random() * 120;
            const blob  = this.scene.add.circle(x, y, 5 + Math.random() * 9, color, 0.9).setDepth(1100);
            this.scene.tweens.add({
                targets: blob,
                x: x + Math.cos(angle) * speed,
                y: y + Math.sin(angle) * speed,
                scaleX: 0, scaleY: 0, alpha: 0,
                duration: 400 + Math.random() * 300,
                ease: 'Quad.easeOut',
                onComplete: () => blob.destroy()
            });
        }
        // Purple mist ring
        const ring = this.scene.add.circle(x, y, 20, 0xaa00ff, 0.4).setDepth(1099);
        this.scene.tweens.add({
            targets: ring, scale: 5, alpha: 0, duration: 500,
            onComplete: () => ring.destroy()
        });
    }

    _stateBurrowing(time, delta) {
        // Sink into ground over 0.8s
        this._burrowDepth += delta / 800;
        if (this._burrowDepth >= 1) {
            this._burrowDepth = 1;
            this.setAlpha(0);
            this.setScale(1, 0);
            // Teleport to destination and start surfacing
            this.x = this._burrowTarget.x;
            this.y = this._burrowTarget.y;
            this.body.x = this.x - this.body.halfWidth;
            this.body.y = this.y - this.body.halfHeight;
            this.state = 'SURFACING';
            this._surfaceTimer = 0;

            // Pre-surface warning
            this.scene.showFeedback('⚠ TICK INCOMING ⚠', 0xff00ff,
                this._burrowTarget.x, this._burrowTarget.y - 100);
            this._spawnBurrowFX(this._burrowTarget.x, this._burrowTarget.y, 0xaa00ff);
        }
    }

    _stateSurfacing(time, delta) {
        this._surfaceTimer = (this._surfaceTimer ?? 0) + delta;
        // Rise faster on chain (0.5s) than normal (0.9s)
        const riseTime = this._burrowMode === 'chain' ? 500 : 900;
        this._burrowDepth -= delta / riseTime;
        if (this._burrowDepth <= 0) {
            this._burrowDepth = 0;
            this.setAlpha(1);
            this.setScale(1, 1);
            this.state = 'HUNTING';
            this.scene.cameras.main.shake(this._burrowMode === 'chain' ? 150 : 250, 0.013);
            this._spawnBurrowFX(this.x, this.y, 0x5a1a6a);

            // Ambush mode: huge AOE damage stomp on emergence
            if (this._burrowMode === 'ambush') {
                this._performAmbushStomp();
            } else if (this._burrowMode !== 'chain') {
                this.scene.showFeedback('IT SURFACES!', 0xaa00ff, this.x, this.y - 90);
            }
            this._burrowMode = 'normal';
        }
    }

    /** Ambush surfacing: deal heavy AOE around emergence point */
    _performAmbushStomp() {
        const scene = this.scene;
        const aoeR = this.baseSize * this.sizeMultiplier + 90;
        scene.cameras.main.shake(380, 0.022);
        scene.showFeedback('💥 STOMP! 💥', 0xff00ff, this.x, this.y - 100);

        // Damage shockwave ring (visual)
        const ring = scene.add.circle(this.x, this.y, 20, 0xff00ff, 0.6).setDepth(1099);
        scene.tweens.add({
            targets: ring, scale: aoeR / 20, alpha: 0,
            duration: 500, ease: 'Quad.easeOut',
            onComplete: () => ring.destroy()
        });
        const ring2 = scene.add.circle(this.x, this.y, 20, 0xffffff, 0.4).setDepth(1098);
        scene.tweens.add({
            targets: ring2, scale: aoeR / 20 * 1.2, alpha: 0,
            duration: 600, ease: 'Quad.easeOut',
            onComplete: () => ring2.destroy()
        });

        // Damage everyone in AOE
        const dmg = Math.round(this.attackDamage * 1.8);
        const player = scene.player;
        if (player && player.active) {
            const dp = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
            if (dp < aoeR) {
                player.takeDamage(dmg, this);
                // Knockback
                const ang = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
                player.body.setVelocity(Math.cos(ang) * 600, Math.sin(ang) * 600);
            }
            player.followers.forEach(pf => {
                if (!pf || !pf.active) return;
                const df = Phaser.Math.Distance.Between(this.x, this.y, pf.x, pf.y);
                if (df < aoeR) {
                    pf.takeDamage(Math.round(dmg * 0.7));
                    const ang = Phaser.Math.Angle.Between(this.x, this.y, pf.x, pf.y);
                    pf.body.setVelocity(Math.cos(ang) * 500, Math.sin(ang) * 500);
                }
            });
        }
    }

    // ── State: FLEEING ─────────────────────────────────────────────────────
    _stateFleeing() {
        const player  = this.scene.player;
        const corners = [
            { x: 200, y: 200 },
            { x: CONFIG.WORLD_SIZE - 200, y: 200 },
            { x: 200, y: CONFIG.WORLD_SIZE - 200 },
            { x: CONFIG.WORLD_SIZE - 200, y: CONFIG.WORLD_SIZE - 200 }
        ];
        let farthest = corners[0], maxDist = 0;
        corners.forEach(c => {
            const d = Phaser.Math.Distance.Between(player.x, player.y, c.x, c.y);
            if (d > maxDist) { maxDist = d; farthest = c; }
        });
        const angle = Phaser.Math.Angle.Between(this.x, this.y, farthest.x, farthest.y);
        this.body.setVelocity(
            Math.cos(angle) * this.moveSpeed * 1.7,
            Math.sin(angle) * this.moveSpeed * 1.7
        );
        if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) > 4000) {
            this.scene.onBossFled();
            this.setVisible(false);
            this.body.setVelocity(0, 0);
        }
    }

    // ── Take Damage ────────────────────────────────────────────────────────
    takeDamage(amount, attacker) {
        if (this.isDead || !this.active || !this.scene) return;
        if (this.state === 'BURROWING' || this.state === 'SURFACING') return; // immune while tunneling

        this._hitFlash   = 120;
        this.health      = Math.max(0, this.health - amount);
        const pct        = this.health / this.maxHealth;
        this.sizeMultiplier = Math.max(0.35, pct);

        // Damage-triggered burrow: if hit hard/repeatedly in quick succession,
        // start an evasive chain (1-2 short hops away from the player)
        this._burrowHitCount++;
        if (this._burrowHitCount >= 6 && this._burrowCooldown > 3000) {
            this._burrowHitCount = 0;
            this._burrowChain = 1 + Math.floor(Math.random() * 2); // 1 or 2 extra hops
            this._startBurrow('chain');
        }

        // Low-health desperation: more aggressive larvae & lunge
        if (this.health / this.maxHealth < 0.4) {
            this._lungeCooldown = Math.min(this._lungeCooldown, 4000);
            this._larvaeCooldown = Math.min(this._larvaeCooldown, 6000);
        }

        const r = this.baseSize * this.sizeMultiplier * 0.85;
        this.body.setCircle(r, -r, -r);
        this.scene.createImpactEffect(this.x, this.y, 0xaa00ff, 'punch', amount, false);

        if (this.health <= 0) this._die(attacker);
    }

    // ── Death ──────────────────────────────────────────────────────────────
    _die(attacker) {
        if (this.isDead || !this.scene) return;
        this.isDead = true;
        this.state  = 'DEAD';
        if (this.body) this.body.setVelocity(0, 0);

        const scene = this.scene; // cache before destroy nulls it
        const deathX = this.x;
        const deathY = this.y;

        if (attacker && attacker.faction === CONFIG.FACTIONS.PLAYER) {
            scene.player.gainStr(15);
            scene.addScore(2000, this.x, this.y);
        }

        for (let i = 0; i < 28; i++) {
            const angle = (i / 28) * Math.PI * 2;
            const dist  = 60 + Math.random() * 160;
            const blob  = scene.add.circle(
                deathX, deathY,
                8 + Math.random() * 20,
                [0xaa00ff, 0xff44ff, 0xdd0044, 0x8b5a2b][Math.floor(Math.random() * 4)], 1
            ).setDepth(1100);
            scene.tweens.add({
                targets: blob,
                x: deathX + Math.cos(angle) * dist,
                y: deathY + Math.sin(angle) * dist,
                scaleX: 0, scaleY: 0, alpha: 0,
                duration: 500 + Math.random() * 600,
                ease: 'Quad.easeOut',
                onComplete: () => blob.destroy()
            });
        }
        if (this._warningGfx && this._warningGfx.active) this._warningGfx.destroy();
        if (this._lungeReticle && this._lungeReticle.active) this._lungeReticle.destroy();
        scene.cameras.main.shake(400, 0.025);
        scene.onBossDefeated();
        // Defer destroy so any in-flight update/contact code completes first
        scene.time.delayedCall(0, () => { if (this.active) this.destroy(); });
    }

    // ── Contact damage (called by GameScene) ───────────────────────────────
    checkContactDamage(time) {
        if (this.isDead || !this.active || !this.scene || !this.scene.player || !this.scene._contactCooldowns) return;
        // Skip during burrowing (immune), surfacing, lunge windup (telegraph), and latch (own damage tick)
        if (this.state === 'FLEEING' || this.state === 'BURROWING' ||
            this.state === 'SURFACING' || this.state === 'LUNGE_WINDUP' ||
            this.state === 'LUNGE_LATCH') return;
        const player   = this.scene.player;
        const contactR = this.baseSize * this.sizeMultiplier + 20;

        const dp = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (dp < contactR && time - this._lastHitTime > 600) {
            this._lastHitTime = time;
            player.takeDamage(this.attackDamage, this);
            this.scene.createImpactEffect(player.x, player.y, 0xaa00ff, 'bite', this.attackDamage, true);
        }

        player.followers.forEach((pf, i) => {
            if (!pf || !pf.active) return;
            const df  = Phaser.Math.Distance.Between(this.x, this.y, pf.x, pf.y);
            const key = `boss_pf_${i}`;
            const last = this.scene._contactCooldowns.get(key) || 0;
            if (df < contactR && time - last > 600) {
                this.scene._contactCooldowns.set(key, time);
                pf.takeDamage(this.attackDamage);
            }
        });

        // Followers counter-damage the boss
        player.followers.forEach((pf, i) => {
            if (!pf || !pf.active) return;
            const df  = Phaser.Math.Distance.Between(this.x, this.y, pf.x, pf.y);
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
        if (this._warningGfx && this._warningGfx.active) {
            this._warningGfx.destroy();
        }
        super.destroy(fromScene);
    }
}
