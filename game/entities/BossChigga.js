import Phaser from 'phaser';
import { CONFIG } from '../config.js';

/**
 * BossChigga — Giant procedurally-drawn animated parasite boss.
 *
 * Drawn entirely with Phaser Graphics — no external sprite.
 * Body, legs, eyes, mouth, accessories all animate via tweens + per-frame drawing.
 *
 * Behaviour:
 *  HUNTING       → charge nearest player turf
 *  ATTACKING_TURF → stomp chiggas inside turf until empty → revert to NEUTRAL
 *  FLEEING       → sprint to far corner when all player turfs gone
 *  DEAD          → big splat explosion
 */
export default class BossChigga extends Phaser.GameObjects.Container {
    constructor(scene, x, y, stageIndex = 0) {
        super(scene, x, y);

        this.scene = scene;
        this.faction = 'BOSS';
        this.stageIndex = stageIndex;

        // Add difficulty scaling multiplier
        const diffMult = scene.difficulty === 0 ? 0.8 : (scene.difficulty === 2 ? 1.3 : 1.0);

        // ── Stats ─────────────────────────────────────────────────────────
        const stageScale = 1 + stageIndex * 0.6;
        this.maxHealth    = Math.round(800 * stageScale * diffMult);
        this.health       = this.maxHealth;
        this.baseSize     = 80 + stageIndex * 20;   // radius of body circle
        this.sizeMultiplier = 1;
        this.moveSpeed    = (170 + stageIndex * 25) * diffMult;
        this.attackDamage = Math.round((14 + stageIndex * 5) * diffMult);
        this.attackCooldown = 800;
        this._lastAttack  = 0;
        this._lastHitTime = 0;

        this.state        = 'HUNTING';
        this.currentTarget = null;
        this.isDead       = false;
        this._hitFlash    = 0;
        this._jumpCooldown = 6000;
        this._jumpTimer   = 0;

        // ── Animation state ───────────────────────────────────────────────
        this._legPhase     = 0;       // 0‥2π, drives leg swing
        this._bodyBob      = 0;       // vertical offset for walk bob
        this._bobDir       = 1;
        this._eyeBlink     = false;
        this._blinkTimer   = 0;
        this._stompScale   = 1;       // brief stomp squash
        this._facingLeft   = false;
        this._moveTime     = 0;
        this._summonedMites = [];
        this._isDying       = false;

        // ── Drawing layers ────────────────────────────────────────────────
        this.gfxShadow = scene.add.graphics();   // drop shadow
        this.gfxLegs   = scene.add.graphics();   // legs (behind body)
        this.gfxBody   = scene.add.graphics();   // main body
        this.gfxFace   = scene.add.graphics();   // eyes/mouth
        this.gfxHud    = scene.add.graphics();   // hp bar
        this.add([this.gfxShadow, this.gfxLegs, this.gfxBody, this.gfxFace, this.gfxHud]);

        // Crown text object parented to container
        this.crownText = scene.add.text(0, -(this.baseSize + 34), '👑', {
            fontSize: `${Math.round(this.baseSize * 0.55)}px`
        }).setOrigin(0.5, 1);
        this.add(this.crownText);

        // Boss name tag
        let bName = '⚠ FLEA KING ⚠';

        this.nameTag = scene.add.text(0, -(this.baseSize + 56), bName, {
            fontSize: '20px', fontFamily: 'Dhurjati',
            color: '#ff2200', stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5, 1);
        this.add(this.nameTag);

        // Crown bob tween
        scene.tweens.add({
            targets: this.crownText,
            y: -(this.baseSize + 42),
            duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });

        // ── Physics ───────────────────────────────────────────────────────
        scene.physics.add.existing(this);
        const r = this.baseSize;
        this.body.setCircle(r, -r, -r);
        this.body.setCollideWorldBounds(true);

        scene.add.existing(this);
        this.setDepth(900);

        this._drawAll(0);
    }

    // ── Colour palette based on stage ─────────────────────────────────────
    get _bodyColor()   { return [0xcc2200, 0x7700cc, 0x004499, 0x6b5f4a, 0x3b2a1f][this.stageIndex] ?? 0xcc2200; }
    get _legColor()    { return [0x991100, 0x550099, 0x003377, 0x3d3427, 0x1b120c][this.stageIndex] ?? 0x991100; }
    get _accentColor() { return [0xff6600, 0xff00ff, 0x00aaff, 0xd6c28e, 0xffcc33][this.stageIndex] ?? 0xff6600; }

    // ── Per-frame draw ─────────────────────────────────────────────────────
    _drawAll(time) {
        const s  = this.sizeMultiplier;
        const r  = this.baseSize * s;
        const bob = this._bodyBob * s;
        const stomp = this._stompScale;
        const flash = this._hitFlash > 0;

        const bodyColor = flash ? 0xffffff : this._bodyColor;
        const legColor  = flash ? 0xffffff : this._legColor;
        const accent    = flash ? 0xffaaaa : this._accentColor;

        // ── Shadow ────────────────────────────────────────────────────────
        this.gfxShadow.clear();
        this.gfxShadow.fillStyle(0x000000, 0.25);
        this.gfxShadow.fillEllipse(0, r * 0.7, r * 2.2, r * 0.55);

        // ── Legs (6 legs, 3 each side) ───────────────────────────────────
        this.gfxLegs.clear();
        this.gfxLegs.lineStyle(Math.max(3, r * 0.12), legColor, 1);
        const legCount = 3;
        const legSpread = r * 1.6;
        for (let i = 0; i < legCount; i++) {
            const frac = (i / (legCount - 1)) - 0.5; // -0.5 .. 0.5
            const swing = Math.sin(this._legPhase + i * 1.2) * 18 * s;
            const attachY = bob - r * 0.15 + frac * r * 0.9;
            // Left leg
            this.gfxLegs.beginPath();
            this.gfxLegs.moveTo(-r * 0.7, attachY);
            this.gfxLegs.lineTo(-legSpread, attachY + swing + r * 0.5);
            this.gfxLegs.strokePath();
            // Right leg
            this.gfxLegs.beginPath();
            this.gfxLegs.moveTo(r * 0.7, attachY);
            this.gfxLegs.lineTo(legSpread, attachY - swing + r * 0.5);
            this.gfxLegs.strokePath();
        }

        // ── Body ──────────────────────────────────────────────────────────
        this.gfxBody.clear();
        // Main blob (squash/stretch during stomp)
        const bw = r * stomp;
        const bh = r * (2 - stomp + 0.1);
        this.gfxBody.fillStyle(bodyColor, 1);
        this.gfxBody.fillEllipse(0, bob, bw * 2, bh * 2);

        // Belly sheen
        this.gfxBody.fillStyle(0xffffff, 0.13);
        this.gfxBody.fillEllipse(-r * 0.2, bob - r * 0.2, r * 0.9, r * 0.7);

        // Spiky back bumps
        this.gfxBody.fillStyle(accent, 0.85);
        for (let i = 0; i < 5; i++) {
            const bumpAngle = (i / 4) * Math.PI - Math.PI * 0.85;
            const bumpX = Math.cos(bumpAngle) * r * 0.88;
            const bumpY = bob + Math.sin(bumpAngle) * r * 0.88;
            this.gfxBody.fillCircle(bumpX, bumpY, r * 0.14);
        }

        // Gold chain
        const chainY = bob + r * 0.35;
        this.gfxBody.lineStyle(Math.max(2, r * 0.08), 0xffcc00, 1);
        this.gfxBody.beginPath();
        this.gfxBody.arc(0, chainY, r * 0.55, Math.PI * 0.1, Math.PI * 0.9, false);
        this.gfxBody.strokePath();
        // chain links
        for (let i = 0; i <= 5; i++) {
            const ca = Math.PI * 0.1 + (i / 5) * Math.PI * 0.8;
            this.gfxBody.fillStyle(0xffcc00, 1);
            this.gfxBody.fillCircle(Math.cos(ca) * r * 0.55, chainY + Math.sin(ca) * r * 0.04, r * 0.07);
        }

        // ── Face ──────────────────────────────────────────────────────────
        this.gfxFace.clear();
        const eyeOff = this._facingLeft ? -1 : 1;
        const eyeY   = bob - r * 0.18;
        const eyeR   = r * 0.22;

        // Eyes
        for (let side = -1; side <= 1; side += 2) {
            const ex = side * r * 0.38 * eyeOff;
            // white sclera
            this.gfxFace.fillStyle(0xffffff, 1);
            this.gfxFace.fillCircle(ex, eyeY, eyeR);
            // iris (yellow)
            this.gfxFace.fillStyle(0xffee00, 1);
            this.gfxFace.fillCircle(ex + side * eyeR * 0.18, eyeY, eyeR * 0.62);
            // pupil
            this.gfxFace.fillStyle(0x000000, 1);
            if (this._eyeBlink) {
                this.gfxFace.fillRect(ex - eyeR * 0.45, eyeY - eyeR * 0.08, eyeR * 0.9, eyeR * 0.16);
            } else {
                this.gfxFace.fillCircle(ex + side * eyeR * 0.22, eyeY, eyeR * 0.3);
            }
            // angry eyebrow
            this.gfxFace.lineStyle(Math.max(2, r * 0.07), 0x220000, 1);
            this.gfxFace.beginPath();
            this.gfxFace.moveTo(ex - eyeR * 0.6, eyeY - eyeR * 0.85);
            this.gfxFace.lineTo(ex + eyeR * 0.6, eyeY - eyeR * 1.1);
            this.gfxFace.strokePath();
        }

        // Mouth — grin or snarl
        const mouthY = bob + r * 0.35;
        this.gfxFace.lineStyle(Math.max(2, r * 0.1), 0x220000, 1);
        this.gfxFace.beginPath();
        if (this.state === 'ATTACKING_TURF') {
            // open angry maw
            this.gfxFace.arc(0, mouthY, r * 0.3, 0, Math.PI, false);
            this.gfxFace.strokePath();
            // teeth
            this.gfxFace.fillStyle(0xffffff, 1);
            for (let t = 0; t < 4; t++) {
                const ta = (t / 3) * Math.PI;
                this.gfxFace.fillRect(
                    Math.cos(ta) * r * 0.28 - r * 0.06,
                    mouthY + Math.sin(ta) * r * 0.08,
                    r * 0.1, r * 0.22
                );
            }
        } else {
            this.gfxFace.arc(0, mouthY, r * 0.35, 0.1 * Math.PI, 0.9 * Math.PI, false);
            this.gfxFace.strokePath();
        }

        // Stage-specific visual decorations
        if (this.stageIndex === 3) {
            // Callous Crusher: armor plates and grime crust
            this.gfxBody.lineStyle(Math.max(3, r * 0.08), 0x2c241c, 0.95);
            for (let i = 0; i < 4; i++) {
                const py = bob - r * 0.65 + i * r * 0.35;
                this.gfxBody.strokeEllipse(0, py, r * 1.35, r * 0.28);
            }
            this.gfxBody.fillStyle(0x8a7f72, 0.8);
            for (let i = 0; i < 10; i++) {
                const a = i * 0.9;
                this.gfxBody.fillCircle(Math.cos(a) * r * 0.55, bob + Math.sin(a) * r * 0.72, r * 0.055);
            }
        } else if (this.stageIndex === 4) {
            // Beastmaster: fur clumps and golden feral markings
            this.gfxBody.lineStyle(Math.max(2, r * 0.06), 0x0f0905, 1);
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2;
                const x1 = Math.cos(a) * r * 0.82;
                const y1 = bob + Math.sin(a) * r * 0.82;
                const x2 = Math.cos(a) * r * 1.12;
                const y2 = bob + Math.sin(a) * r * 1.12;
                this.gfxBody.beginPath();
                this.gfxBody.moveTo(x1, y1);
                this.gfxBody.lineTo(x2, y2);
                this.gfxBody.strokePath();
            }
            this.gfxBody.fillStyle(0xffcc33, 0.9);
            this.gfxBody.fillCircle(-r * 0.38, bob - r * 0.48, r * 0.08);
            this.gfxBody.fillCircle(r * 0.38, bob - r * 0.48, r * 0.08);
        }

        // ── HUD HP bar above boss ─────────────────────────────────────────
        this.gfxHud.clear();
        const hpW = r * 2;
        const hpY = -(this.baseSize + 20);
        this.gfxHud.fillStyle(0x000000, 0.65);
        this.gfxHud.fillRect(-hpW / 2, hpY, hpW, 10);
        const hpPct = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
        this.gfxHud.fillStyle(0xff0000, 1);
        this.gfxHud.fillRect(-hpW / 2, hpY, hpW * hpPct, 10);
    }

    update(time, delta) {
        if (!this.active || this.isDead || this._isDying || !this.scene || this.scene.isEnding) return;
        this._moveTime = time;

        // Leg animation
        const vel = this.body ? Math.sqrt(this.body.velocity.x ** 2 + this.body.velocity.y ** 2) : 0;
        const moving = vel > 20;
        if (moving) {
            this._legPhase += delta * 0.009;
            this._bodyBob   = Math.sin(this._legPhase * 2) * 5;
            this._facingLeft = this.body.velocity.x < 0;
        } else {
            this._legPhase += delta * 0.003;
            this._bodyBob   = Math.sin(this._legPhase) * 2;
        }

        // Blink
        this._blinkTimer += delta;
        if (this._blinkTimer > 2800 + Math.random() * 1500) {
            this._eyeBlink   = true;
            this._blinkTimer = 0;
            this.scene.time.delayedCall(100, () => { if (this.active) this._eyeBlink = false; });
        }

        // Hit flash decay
        if (this._hitFlash > 0) this._hitFlash -= delta;

        // Stomp recovery
        if (this._stompScale < 1) {
            this._stompScale = Math.min(1, this._stompScale + delta * 0.006);
        }

        // Update nameTag Y relative to current size
        if (this.crownText) this.crownText.y = -(this.baseSize * this.sizeMultiplier + 34);
        if (this.nameTag) this.nameTag.y = -(this.baseSize * this.sizeMultiplier + 56);

        // Redraw every frame
        this._drawAll(time);

        if (this.state === 'HUNTING' || this.state === 'ATTACKING_TURF') {
            this._jumpCooldown -= delta;
        }

        // State machine
        switch (this.state) {
            case 'HUNTING':        this._stateHunting(time);      break;
            case 'ATTACKING_TURF': this._stateAttackingTurf(time); break;
            case 'LEAP_WINDUP':    this._stateLeapWindup(time, delta); break;
            case 'LEAP_FLIGHT':    this._stateLeapFlight(time, delta); break;
            case 'FLEEING':        this._stateFleeing();            break;
        }
    }

    _stateLeapWindup(time, delta) {
        this._jumpTimer -= delta;
        this.body.setVelocity(0, 0);

        if (this._jumpTimer <= 0) {
            this.state = 'LEAP_FLIGHT';
            this._jumpTimer = 850; // Flight lasts 0.85s

            // Target player position
            const player = this.scene.player;
            if (player && player.active) {
                // Leap in direction of player with high speed
                const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
                const jumpDist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                const speed = jumpDist / 0.85; // land exactly on target time!
                this.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            }
        }
    }

    _stateLeapFlight(time, delta) {
        this._jumpTimer -= delta;

        // Animate altitude (rise up then down via sizeMultiplier and shadow alpha)
        const total = 850;
        const progress = Math.max(0, this._jumpTimer) / total; // 1 to 0
        const arc = Math.sin(progress * Math.PI); // 0 -> 1 -> 0
        
        // Scale body up while in mid-air
        this.sizeMultiplier = 1 + arc * 0.7;

        // Shadow shrinks and fades out as we get higher
        this.gfxShadow.setAlpha(1 - arc * 0.8);

        if (this._jumpTimer <= 0) {
            this._performLeapCrash();
        }
    }

    _performLeapCrash() {
        this.state = 'HUNTING';
        this._jumpCooldown = 8000 + Math.random() * 4000;
        this.sizeMultiplier = 1;
        this._stompScale = 1.35; // splat stretch
        this.body.setVelocity(0, 0);

        const scene = this.scene;
        if (!scene) return;

        scene.cameras.main.shake(350, 0.02);

        // Crash landing dust rings
        const color = this._accentColor;
        const blastRadius = this.baseSize * 2.3;
        
        const ring = scene.add.circle(this.x, this.y, 20, color, 0.65).setDepth(200);
        scene.tweens.add({
            targets: ring,
            scale: blastRadius / 20,
            alpha: 0,
            duration: 500,
            onComplete: () => ring.destroy()
        });

        // AOE impact damage on player and nearby army units
        const dmg = this.attackDamage * 1.4;
        const player = scene.player;

        if (player && player.active) {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
            if (dist < blastRadius) {
                player.takeDamage(dmg, this);
                scene.createImpactEffect(player.x, player.y, color, 'punch', dmg, true);
            }

            player.followers.forEach(pf => {
                if (pf && pf.active && !pf.isDead) {
                    const df = Phaser.Math.Distance.Between(this.x, this.y, pf.x, pf.y);
                    if (df < blastRadius) {
                        pf.takeDamage(dmg * 0.7);
                    }
                }
            });
        }
    }

    // ── State: HUNTING ─────────────────────────────────────────────────────
    _stateHunting(time) {
        // Trigger Flea Leap if ready and player is within range
        const player = this.scene.player;
        if (this._jumpCooldown <= 0 && player && player.active) {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
            if (dist > 150 && dist < 900) {
                this.state = 'LEAP_WINDUP';
                this._jumpTimer = 800; // 0.8s squash
                this.body.setVelocity(0, 0);
                this._stompScale = 0.55;
                this.scene.showFeedback('FLEA LEAP!', 0xff2200, this.x, this.y - 100);
                return;
            }
        }

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

    // ── State: ATTACKING_TURF ──────────────────────────────────────────────
    _stateAttackingTurf(time) {
        const t = this.currentTarget;
        if (!t || t.faction !== CONFIG.FACTIONS.PLAYER) {
            this.currentTarget = null;
            this.state = 'HUNTING';
            return;
        }

        this.body.setVelocity(0, 0);

        if (time - this._lastAttack >= this.attackCooldown) {
            this._lastAttack = time;
            this._stompScale = 0.68;   // visual stomp squash

            // Camera shake for impact
            this.scene.cameras.main.shake(80, 0.007);

            this.scene.units.children.iterate(unit => {
                if (!unit || !unit.active || unit.faction !== CONFIG.FACTIONS.PLAYER) return;
                if (Phaser.Math.Distance.Between(t.x, t.y, unit.x, unit.y) < t.radius * 1.2) {
                    unit.takeDamage(this.attackDamage * 3);
                    this.scene.createImpactEffect(unit.x, unit.y, 0xff0000);
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
                this.scene.showFeedback('TURF LOST!', 0xff0000, t.x, t.y - 80);
                this.currentTarget = null;
                this.state = 'HUNTING';
                const playerTurfs = this.scene.territories.filter(tr => tr.faction === CONFIG.FACTIONS.PLAYER);
                if (playerTurfs.length === 0) this.state = 'FLEEING';
            }
        }
    }

    // ── State: FLEEING ─────────────────────────────────────────────────────
    _stateFleeing() {
        const targetX = CONFIG.WORLD_SIZE + 500;
        const targetY = CONFIG.WORLD_SIZE + 500;
        const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
        this.body.setVelocity(Math.cos(angle) * this.moveSpeed * 1.6, Math.sin(angle) * this.moveSpeed * 1.6);
        if (this.x > CONFIG.WORLD_SIZE + 200 || this.y > CONFIG.WORLD_SIZE + 200) {
            this.scene.onBossFled();
            this.destroy();
        }
    }

    takeDamage(amount, attacker) {
        if (this.isDead || this._isDying || !this.active || !this.scene) return;
        if (this.state === 'LEAP_FLIGHT') return; // Immune while flying high!

        this._hitFlash = 120;
        this.health = Math.max(0, this.health - amount);
        const pct = this.maxHealth > 0 ? this.health / this.maxHealth : 0;
        this.sizeMultiplier = Math.max(0.35, pct);

        if (this.body && this.body.setCircle) {
            const r = this.baseSize * this.sizeMultiplier * 0.85;
            this.body.setCircle(r, -r, -r);
        }

        if (this.scene.createImpactEffect) {
            this.scene.createImpactEffect(this.x, this.y, 0xff2200);
        }

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
            scene.player.gainStr(10);
            scene.addScore(2000, deathX, deathY);
        }

        for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * Math.PI * 2;
            const dist = 50 + Math.random() * 150;
            const blob = scene.add.circle(
                deathX, deathY,
                10 + Math.random() * 18,
                [0xff4400, 0xff8800, 0xffee00][Math.floor(Math.random() * 3)],
                1
            ).setDepth(1100);

            scene.tweens.add({
                targets: blob,
                x: deathX + Math.cos(angle) * dist,
                y: deathY + Math.sin(angle) * dist,
                scaleX: 0,
                scaleY: 0,
                alpha: 0,
                duration: 500 + Math.random() * 500,
                ease: 'Quad.easeOut',
                onComplete: () => { if (blob && blob.active) blob.destroy(); }
            });
        }

        if (scene.cameras && scene.cameras.main) {
            scene.cameras.main.shake(350, 0.022);
        }

        // Let the current collision/update frame finish before GameScene clears enemies and advances stage.
        scene.time.delayedCall(0, () => {
            if (scene && !scene.isEnding && scene.onBossDefeated) {
                scene.onBossDefeated();
            }
            if (this.active) this.destroy();
        });
    }

    // ── Contact damage check (called by GameScene) ─────────────────────────
    checkContactDamage(time) {
        if (
            this.isDead || this._isDying || !this.active || !this.scene ||
            this.scene.isEnding || !this.scene.player || !this.scene._contactCooldowns ||
            (this.scene._isSpawnProtected && this.scene._isSpawnProtected())
        ) return;

        if (this.state === 'FLEEING' || this.state === 'LEAP_FLIGHT') return;

        const player = this.scene.player;
        const contactR = this.baseSize * this.sizeMultiplier + 20;

        const dp = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (dp < contactR && time - this._lastHitTime > 600) {
            this._lastHitTime = time;
            player.takeDamage(this.attackDamage, this);
            if (this.scene.createImpactEffect) {
                this.scene.createImpactEffect(player.x, player.y, 0xff0000);
            }
        }

        if (player.followers) {
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

            player.followers.forEach((pf, i) => {
                if (!pf || !pf.active) return;
                const df = Phaser.Math.Distance.Between(this.x, this.y, pf.x, pf.y);
                const key = `pf_boss_${i}`;
                const last = this.scene._contactCooldowns.get(key) || 0;
                if (df < contactR + 12 && time - last > 700) {
                    this.scene._contactCooldowns.set(key, time);
                    const str = player.getSTR();
                    this.takeDamage(Math.round(14 * (1 + (str - 1) * 0.15)), pf);
                }
            });
        }
    }
}