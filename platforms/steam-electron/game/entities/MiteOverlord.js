import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import Chigga from './Chigga.js';

/**
 * MiteOverlord — The Stage 3 Boss ("The Back")
 *
 * A massive, ancient parasite god. Focuses on area denial and swarming.
 *
 * Mechanics:
 *  - WEB_SPIT: Shoots sticky/acidic web puddles that slow the player.
 *  - SPIN_ATTACK: Retracts legs, then extends them like a buzzsaw and charges.
 *  - SUMMONING: Shakes and spawns a swarm of WILD mites.
 */
export default class MiteOverlord extends Phaser.GameObjects.Container {
    constructor(scene, x, y, stageIndex = 2) {
        super(scene, x, y);

        this.scene = scene;
        this.faction = 'BOSS';
        this.stageIndex = stageIndex;

        // ── Stats ─────────────────────────────────────────────────────────
        const stageScale = 1 + (stageIndex - 1) * 0.6;
        this.maxHealth    = Math.round(1500 * stageScale);
        this.health       = this.maxHealth;
        this.baseSize     = 100 + stageIndex * 15;
        this.sizeMultiplier = 1;
        this.moveSpeed    = 165 + stageIndex * 15;
        this.attackDamage = 20 + stageIndex * 5;
        this.attackCooldown = 800;
        this._lastAttack  = 0;
        this._lastHitTime = 0;

        this.state         = 'HUNTING';
        this.currentTarget = null;
        this.isDead        = false;
        this._hitFlash     = 0;

        // ── Timers ─────────────────────────────────────────────────────────
        this._webCooldown    = 4000;
        this._spinCooldown   = 10000;
        this._summonCooldown = 15000;
        
        // ── State specifics ────────────────────────────────────────────────
        this._spinChargeTimer = 0;
        this._spinDuration    = 0;
        this._spinAngle       = 0;
        
        // ── Animation state ───────────────────────────────────────────────
        this._legPhase    = 0;
        this._bodyBob     = 0;
        this._stompScale  = 1;
        this._moveTime    = 0;
        this._pulsePhase  = 0;

        // ── Graphics layers ───────────────────────────────────────────────
        this.gfxShadow = scene.add.graphics();
        this.gfxLegs   = scene.add.graphics();
        this.gfxBody   = scene.add.graphics();
        this.gfxPustules = scene.add.graphics();
        this.gfxHud    = scene.add.graphics();
        this.add([this.gfxShadow, this.gfxLegs, this.gfxBody, this.gfxPustules, this.gfxHud]);

        this.crownText = scene.add.text(0, -(this.baseSize + 34), '🕷', {
            fontSize: `${Math.round(this.baseSize * 0.52)}px`
        }).setOrigin(0.5, 1);
        this.add(this.crownText);

        this.nameTag = scene.add.text(0, -(this.baseSize + 58), '☣ MITE OVERLORD ☣', {
            fontSize: '18px', fontFamily: 'Dhurjati',
            color: '#33ff33', stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5, 1);
        this.add(this.nameTag);

        scene.tweens.add({
            targets: this.crownText,
            y: -(this.baseSize + 44),
            duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });

        // ── Physics ───────────────────────────────────────────────────────
        scene.physics.add.existing(this);
        const r = this.baseSize * 0.85;
        this.body.setCircle(r, -r, -r);
        this.body.setCollideWorldBounds(true);
        this.body.bounce.set(1, 1);

        scene.add.existing(this);
        this.setDepth(900);

        // Track active webs
        this._webPuddles = [];

        this._drawAll(0);
    }

    get _bodyColor() { return 0x1a261a; } // Dark muddy green/black
    get _legColor()  { return 0x0a110a; }

    _drawAll(time) {
        const s     = this.sizeMultiplier;
        const r     = this.baseSize * s;
        const bob   = this._bodyBob * s;
        const stomp = this._stompScale;
        const flash = this._hitFlash > 0;

        const bodyColor = flash ? 0xffffff : this._bodyColor;
        const legColor  = flash ? 0xffffff : this._legColor;
        const pulseAmt  = 0.5 + 0.5 * Math.sin(this._pulsePhase);
        const pustuleColor = flash ? 0xffffff : (pulseAmt > 0.5 ? 0x66ff66 : 0x22cc22);

        // ── Shadow ────────────────────────────────────────────────────────
        this.gfxShadow.clear();
        this.gfxShadow.fillStyle(0x000000, 0.3);
        this.gfxShadow.fillEllipse(0, r * 0.5, r * 2.2, r * 1.8);

        // ── 12 Legs ───────────────────────────────────────────────────────
        this.gfxLegs.clear();
        const legCount = 6; // 6 per side
        
        let legSpread = r * 1.8;
        let isSpinning = this.state === 'SPIN_ATTACK';
        let isChargingSpin = this.state === 'SPIN_WINDUP';
        
        this.gfxLegs.lineStyle(Math.max(3, r * 0.08), legColor, 1);

        for (let i = 0; i < legCount; i++) {
            const frac = (i / (legCount - 1)) - 0.5;
            let attachY = bob + frac * r * 1.2;
            let attachX = r * 0.7;

            // In spin attack, legs extend perfectly straight out to create a buzzsaw
            if (isSpinning) {
                // Spin around central axis
                const angleOffset = (i / legCount) * Math.PI + this._spinAngle;
                
                // Right side leg
                this.gfxLegs.beginPath();
                this.gfxLegs.moveTo(Math.cos(angleOffset) * r*0.5, Math.sin(angleOffset) * r*0.5);
                this.gfxLegs.lineTo(Math.cos(angleOffset) * r*2.2, Math.sin(angleOffset) * r*2.2);
                this.gfxLegs.strokePath();

                // Left side leg (opposite)
                const oppAngle = angleOffset + Math.PI;
                this.gfxLegs.beginPath();
                this.gfxLegs.moveTo(Math.cos(oppAngle) * r*0.5, Math.sin(oppAngle) * r*0.5);
                this.gfxLegs.lineTo(Math.cos(oppAngle) * r*2.2, Math.sin(oppAngle) * r*2.2);
                this.gfxLegs.strokePath();
                
            } else if (isChargingSpin) {
                // Legs curl inward closely
                const curlX = r * 0.8;
                const curlY = attachY;
                this.gfxLegs.beginPath();
                this.gfxLegs.moveTo(attachX, attachY);
                this.gfxLegs.lineTo(curlX, curlY + r*0.3);
                this.gfxLegs.strokePath();
                
                this.gfxLegs.beginPath();
                this.gfxLegs.moveTo(-attachX, attachY);
                this.gfxLegs.lineTo(-curlX, curlY + r*0.3);
                this.gfxLegs.strokePath();
            } else {
                // Normal walking
                const swing = Math.sin(this._legPhase + i * 1.1) * 20 * s;
                
                // Right leg (jointed)
                this.gfxLegs.beginPath();
                this.gfxLegs.moveTo(attachX, attachY);
                this.gfxLegs.lineTo(attachX + legSpread*0.4, attachY - swing - r*0.2);
                this.gfxLegs.lineTo(attachX + legSpread, attachY - swing*1.5 + r*0.3);
                this.gfxLegs.strokePath();

                // Left leg (jointed)
                this.gfxLegs.beginPath();
                this.gfxLegs.moveTo(-attachX, attachY);
                this.gfxLegs.lineTo(-attachX - legSpread*0.4, attachY + swing - r*0.2);
                this.gfxLegs.lineTo(-attachX - legSpread, attachY + swing*1.5 + r*0.3);
                this.gfxLegs.strokePath();
            }
        }

        // ── Body ──────────────────────────────────────────────────────────
        this.gfxBody.clear();
        const bw = r * stomp * 1.05;
        const bh = r * (2 - stomp) * 0.85; // slightly elongated
        
        this.gfxBody.fillStyle(bodyColor, 1);
        this.gfxBody.fillEllipse(0, bob, bw * 2, bh * 2);

        // Carapace plates
        this.gfxBody.lineStyle(4, 0x000000, 0.4);
        for(let i=0; i<4; i++) {
            const py = bob - bh*0.6 + i*(bh*0.4);
            this.gfxBody.beginPath();
            this.gfxBody.moveTo(-bw*0.8, py - 10);
            this.gfxBody.lineTo(0, py + 15);
            this.gfxBody.lineTo(bw*0.8, py - 10);
            this.gfxBody.strokePath();
        }

        // ── Glowing Pustules & Eyes ───────────────────────────────────────
        this.gfxPustules.clear();
        
        // Pustules on back
        const pustulePositions = [
            {x: 0, y: -bh*0.4, rad: r*0.18},
            {x: -bw*0.4, y: -bh*0.1, rad: r*0.14},
            {x: bw*0.4, y: -bh*0.1, rad: r*0.14},
            {x: -bw*0.2, y: bh*0.3, rad: r*0.12},
            {x: bw*0.2, y: bh*0.3, rad: r*0.12},
            {x: 0, y: bh*0.6, rad: r*0.15}
        ];

        pustulePositions.forEach(p => {
            this.gfxPustules.fillStyle(0x114411, 1);
            this.gfxPustules.fillCircle(p.x, bob + p.y, p.rad * 1.2);
            this.gfxPustules.fillStyle(pustuleColor, 0.9);
            this.gfxPustules.fillCircle(p.x, bob + p.y, p.rad);
            // Glint
            this.gfxPustules.fillStyle(0xffffff, 0.6);
            this.gfxPustules.fillCircle(p.x - p.rad*0.3, bob + p.y - p.rad*0.3, p.rad*0.3);
        });

        // 8 glowing green eyes clumped at the front
        const eyeY = bob - bh*0.8;
        const eyes = [
            {x: -r*0.2, y: eyeY, r: r*0.1},
            {x: r*0.2, y: eyeY, r: r*0.1},
            {x: -r*0.4, y: eyeY+r*0.1, r: r*0.07},
            {x: r*0.4, y: eyeY+r*0.1, r: r*0.07},
            {x: -r*0.1, y: eyeY+r*0.15, r: r*0.05},
            {x: r*0.1, y: eyeY+r*0.15, r: r*0.05},
            {x: -r*0.3, y: eyeY+r*0.25, r: r*0.04},
            {x: r*0.3, y: eyeY+r*0.25, r: r*0.04}
        ];

        eyes.forEach(e => {
            this.gfxPustules.fillStyle(pustuleColor, 1);
            this.gfxPustules.fillCircle(e.x, e.y, e.r);
            this.gfxPustules.fillStyle(0xffffff, 0.8);
            this.gfxPustules.fillCircle(e.x, e.y, e.r*0.4);
        });

        // ── HUD ───────────────────────────────────────────────────────────
        this.gfxHud.clear();
        const glowR = r + 16;
        const glowAlpha = (0.3 + 0.3 * Math.sin(this._moveTime * 0.005));
        this.gfxHud.lineStyle(4, 0x33ff33, glowAlpha);
        this.gfxHud.strokeCircle(0, bob, glowR);
        this.gfxHud.lineStyle(2, 0x99ff99, glowAlpha * 0.5);
        this.gfxHud.strokeCircle(0, bob, glowR + 6);

        const bw2 = Math.min(160, r * 2);
        const bh2 = 12;
        const by2 = bob - r * 1.5 - 20;
        this.gfxHud.fillStyle(0x000000, 0.8);
        this.gfxHud.fillRect(-bw2 / 2, by2, bw2, bh2);
        const pct = Math.max(0, this.health / this.maxHealth);
        const barColor = pct > 0.5 ? 0x33ff33 : pct > 0.25 ? 0xffff33 : 0xff3333;
        this.gfxHud.fillStyle(barColor, 1);
        this.gfxHud.fillRect(-bw2 / 2, by2, bw2 * pct, bh2);
        this.gfxHud.lineStyle(1, 0xffffff, 0.3);
        this.gfxHud.strokeRect(-bw2 / 2, by2, bw2, bh2);
    }

    update(time, delta) {
        if (!this.active || this.isDead) return;
        this._moveTime = time;

        this._pulsePhase += delta * 0.005;

        // Animation updates
        const vel = this.body ? Math.sqrt(this.body.velocity.x ** 2 + this.body.velocity.y ** 2) : 0;
        if (this.state !== 'SPIN_ATTACK' && this.state !== 'SPIN_WINDUP') {
            if (vel > 20) {
                this._legPhase  += delta * 0.015;
                this._bodyBob    = Math.sin(this._legPhase * 2) * 6;
            } else {
                this._legPhase  += delta * 0.004;
                this._bodyBob    = Math.sin(this._legPhase) * 3;
            }
        }

        if (this._hitFlash > 0) this._hitFlash -= delta;
        if (this._stompScale < 1) this._stompScale = Math.min(1, this._stompScale + delta * 0.005);

        // Cooldowns
        if (this.state === 'HUNTING' || this.state === 'ATTACKING_TURF') {
            this._webCooldown    -= delta;
            this._spinCooldown   -= delta;
            this._summonCooldown -= delta;
        }

        this.crownText.y  = -(this.baseSize * this.sizeMultiplier + 34);
        this.nameTag.y    = -(this.baseSize * this.sizeMultiplier + 58);

        this._drawAll(time);
        this._updateWebs(time, delta);

        switch (this.state) {
            case 'HUNTING':        this._stateHunting(time, delta);       break;
            case 'ATTACKING_TURF': this._stateAttackingTurf(time, delta);  break;
            case 'WEB_SPIT':       this._stateWebSpit(time, delta);        break;
            case 'SPIN_WINDUP':    this._stateSpinWindup(time, delta);     break;
            case 'SPIN_ATTACK':    this._stateSpinAttack(time, delta);     break;
            case 'SUMMONING':      this._stateSummoning(time, delta);      break;
            case 'FLEEING':        this._stateFleeing();                   break;
        }
    }

    // ── State: HUNTING ─────────────────────────────────────────────────────
    _stateHunting(time, delta) {
        const player = this.scene.player;

        // 1. Summon Swarm
        if (this._summonCooldown <= 0) {
            this._startSummoning();
            return;
        }

        // 2. Spin Attack
        if (this._spinCooldown <= 0 && player && player.active) {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
            if (dist > 300 && dist < 1500) {
                this._startSpinAttack(player);
                return;
            }
        }

        // 3. Web Spit
        if (this._webCooldown <= 0 && player && player.active) {
            this._startWebSpit(player);
            return;
        }

        // 4. March to nearest turf
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

    // ── Ability 1: Web Spit ────────────────────────────────────────────────
    _startWebSpit(player) {
        this.state = 'WEB_SPIT';
        this.body.setVelocity(0, 0);
        this._stompScale = 1.3; // puff up to spit
        this._webSpitTimer = 0;
        
        // Predict player position
        const pVelX = player.body ? player.body.velocity.x : 0;
        const pVelY = player.body ? player.body.velocity.y : 0;
        this._webTarget = {
            x: player.x + pVelX * 0.5,
            y: player.y + pVelY * 0.5
        };

        this.scene.showFeedback('☣ TOXIC WEB ☣', 0x33ff33, this.x, this.y - 100);
    }

    _stateWebSpit(time, delta) {
        this._webSpitTimer += delta;
        if (this._webSpitTimer >= 600) {
            // Fire the web projectile
            this._fireWebProjectile(this._webTarget.x, this._webTarget.y);
            this.state = 'HUNTING';
            this._webCooldown = 7000 + Math.random() * 3000;
            this._stompScale = 0.8;
        }
    }

    _fireWebProjectile(tx, ty) {
        if (!this.scene) return;
        const proj = this.scene.add.circle(this.x, this.y, 15, 0x33ff33, 1).setDepth(899);
        this.scene.tweens.add({
            targets: proj,
            x: tx, y: ty,
            scale: 2.5,
            duration: 500,
            ease: 'Quad.easeIn',
            onComplete: () => {
                proj.destroy();
                if (this.active && !this.isDead) {
                    this._createWebPuddle(tx, ty);
                }
            }
        });
    }

    _createWebPuddle(x, y) {
        if (!this.scene) return;
        const puddle = this.scene.add.graphics().setDepth(100); // ground layer
        puddle.x = x;
        puddle.y = y;
        puddle._life = 12000; // lasts 12 seconds
        puddle._radius = 180;
        puddle._pulse = 0;

        this._webPuddles.push(puddle);
        this.scene.cameras.main.shake(100, 0.005);
    }

    _updateWebs(time, delta) {
        const player = this.scene.player;
        
        for (let i = this._webPuddles.length - 1; i >= 0; i--) {
            const p = this._webPuddles[i];
            p._life -= delta;
            if (p._life <= 0) {
                p.destroy();
                this._webPuddles.splice(i, 1);
                continue;
            }

            p._pulse += delta * 0.005;
            const alpha = Math.min(0.5, p._life / 1000) * (0.8 + 0.2*Math.sin(p._pulse));
            
            p.clear();
            p.fillStyle(0x113311, alpha);
            p.fillCircle(0, 0, p._radius);
            p.lineStyle(3, 0x33ff33, alpha * 1.5);
            p.strokeCircle(0, 0, p._radius);
            
            // Web strands inside
            p.lineStyle(1, 0x66ff66, alpha);
            for(let j=0; j<5; j++) {
                const a1 = Math.random() * Math.PI * 2;
                const a2 = a1 + Math.PI * (0.8 + Math.random()*0.4);
                p.beginPath();
                p.moveTo(Math.cos(a1) * p._radius, Math.sin(a1) * p._radius);
                p.lineTo(Math.cos(a2) * p._radius, Math.sin(a2) * p._radius);
                p.strokePath();
            }

            // Apply slow to player if inside
            if (player && player.active) {
                const dist = Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y);
                if (dist < p._radius) {
                    player._webSlowTimer = 100; // applies a slow modifier in player class, or we manually slow them here
                    // If Player class doesn't support _webSlowTimer out of the box, we directly apply a massive drag
                    if (player.body) {
                        player.body.velocity.x *= 0.85;
                        player.body.velocity.y *= 0.85;
                    }
                    if (Math.random() < 0.1) {
                        const blob = this.scene.add.circle(player.x, player.y, 4, 0x33ff33, 0.8).setDepth(1100);
                        this.scene.tweens.add({targets: blob, y: player.y+20, alpha: 0, duration: 400, onComplete: ()=>blob.destroy()});
                    }
                }
            }
        }
    }

    // ── Ability 2: Spin Attack ──────────────────────────────────────────────
    _startSpinAttack(player) {
        this.state = 'SPIN_WINDUP';
        this.body.setVelocity(0, 0);
        this._spinChargeTimer = 0;
        this._spinTarget = player;
        this.scene.showFeedback('⚠ BUZZSAW ⚠', 0xff0000, this.x, this.y - 100);
        this.scene.cameras.main.shake(800, 0.005);
    }

    _stateSpinWindup(time, delta) {
        this._spinChargeTimer += delta;
        this._pulsePhase += delta * 0.02; // flash fast
        
        if (this._spinChargeTimer >= 1000) {
            this.state = 'SPIN_ATTACK';
            this._spinDuration = 0;
            const player = this._spinTarget;
            
            if (player && player.active) {
                const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
                const chargeSpeed = this.moveSpeed * 3.2; // very fast
                this.body.setVelocity(Math.cos(angle) * chargeSpeed, Math.sin(angle) * chargeSpeed);
            }
        }
    }

    _stateSpinAttack(time, delta) {
        this._spinDuration += delta;
        this._spinAngle += delta * 0.015; // rotate legs rapidly
        
        // Huge contact area during spin
        const r = this.baseSize * this.sizeMultiplier * 2.2; 
        
        // Bounce off world bounds manually to keep momentum
        if (this.body.x <= 0 || this.body.right >= CONFIG.WORLD_SIZE) this.body.velocity.x *= -1;
        if (this.body.y <= 0 || this.body.bottom >= CONFIG.WORLD_SIZE) this.body.velocity.y *= -1;

        if (this._spinDuration > 3000) {
            this.state = 'HUNTING';
            this.body.setVelocity(0, 0);
            this._spinCooldown = 12000 + Math.random() * 4000;
        }
    }

    // ── Ability 3: Summoning ────────────────────────────────────────────────
    _startSummoning() {
        this.state = 'SUMMONING';
        this.body.setVelocity(0, 0);
        this._summonTimer = 0;
        this._stompScale = 1.4;
        this.scene.showFeedback('AWAKEN MINIONS!', 0x33ff33, this.x, this.y - 100);
    }

    _stateSummoning(time, delta) {
        this._summonTimer += delta;
        
        // Shake violently
        this.x += (Math.random() - 0.5) * 8;
        this.y += (Math.random() - 0.5) * 8;
        
        if (this._summonTimer >= 1200) {
            // Spawn 6-10 WILD mites
            const count = 6 + Math.floor(Math.random() * 5);
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const dist = this.baseSize * 1.5;
                const sx = this.x + Math.cos(angle) * dist;
                const sy = this.y + Math.sin(angle) * dist;
                
                const mite = new Chigga(this.scene, sx, sy, CONFIG.FACTIONS.WILD);
                mite.target = this.scene.player; // instantly aggro player
                this.scene.units.add(mite); // Ensure they get added to the active units list!
            }
            
            // Blast effect
            const ring = this.scene.add.circle(this.x, this.y, this.baseSize, 0x33ff33, 0.6).setDepth(899);
            this.scene.tweens.add({
                targets: ring, scale: 4, alpha: 0, duration: 600, onComplete: ()=>ring.destroy()
            });

            this.state = 'HUNTING';
            this._summonCooldown = 16000 + Math.random() * 5000;
            this._stompScale = 0.8;
        }
    }

    // ── Turf Attack ────────────────────────────────────────────────────────
    _stateAttackingTurf(time, delta) {
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
                    this.scene.createImpactEffect(unit.x, unit.y, 0x33ff33);
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
                this.scene.showFeedback('TURF DEVOURED!', 0xff0000, t.x, t.y - 80);
                this.currentTarget = null;
                this.state = 'HUNTING';
                const playerTurfs = this.scene.territories.filter(tr => tr.faction === CONFIG.FACTIONS.PLAYER);
                if (playerTurfs.length === 0) this.state = 'FLEEING';
            }
        }
    }

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

    takeDamage(amount, attacker) {
        if (this.isDead || !this.active || !this.scene) return;
        
        // Take less damage during spin windup/attack
        if (this.state === 'SPIN_ATTACK' || this.state === 'SPIN_WINDUP') {
            amount *= 0.5;
        }

        this._hitFlash   = 120;
        this.health      = Math.max(0, this.health - amount);
        const pct        = this.health / this.maxHealth;
        this.sizeMultiplier = Math.max(0.4, pct);

        // Desperation mode: spam web and spin
        if (pct < 0.35) {
            this._webCooldown = Math.min(this._webCooldown, 3000);
            this._spinCooldown = Math.min(this._spinCooldown, 5000);
            this._summonCooldown = Math.min(this._summonCooldown, 8000);
        }

        const r = this.baseSize * this.sizeMultiplier * 0.85;
        this.body.setCircle(r, -r, -r);
        this.scene.createImpactEffect(this.x, this.y, 0x33ff33);

        if (this.health <= 0) this._die(attacker);
    }

    _die(attacker) {
        if (this.isDead || !this.scene) return;
        this.isDead = true;
        this.state  = 'DEAD';
        if (this.body) this.body.setVelocity(0, 0);

        const scene = this.scene;
        const deathX = this.x;
        const deathY = this.y;

        if (attacker && attacker.faction === CONFIG.FACTIONS.PLAYER) {
            scene.player.gainStr(25);
            scene.addScore(3000, this.x, this.y);
        }

        // Clean up web puddles
        this._webPuddles.forEach(p => p.destroy());
        this._webPuddles = [];

        for (let i = 0; i < 40; i++) {
            const angle = (i / 40) * Math.PI * 2;
            const dist  = 80 + Math.random() * 200;
            const blob  = scene.add.circle(
                deathX, deathY,
                10 + Math.random() * 25,
                [0x33ff33, 0x114411, 0x66ff66, 0x000000][Math.floor(Math.random() * 4)], 1
            ).setDepth(1100);
            scene.tweens.add({
                targets: blob,
                x: deathX + Math.cos(angle) * dist,
                y: deathY + Math.sin(angle) * dist,
                scaleX: 0, scaleY: 0, alpha: 0,
                duration: 600 + Math.random() * 800,
                ease: 'Quad.easeOut',
                onComplete: () => blob.destroy()
            });
        }
        scene.cameras.main.shake(600, 0.03);
        scene.onBossDefeated();
        scene.time.delayedCall(0, () => { if (this.active) this.destroy(); });
    }

    checkContactDamage(time) {
        if (this.isDead || !this.active || !this.scene || !this.scene.player || !this.scene._contactCooldowns) return;
        if (this.state === 'FLEEING') return;
        
        const player   = this.scene.player;
        
        // Spin attack increases contact radius massively
        const baseR = this.baseSize * this.sizeMultiplier;
        const contactR = this.state === 'SPIN_ATTACK' ? baseR * 2.2 : baseR + 25;
        const dmgMult  = this.state === 'SPIN_ATTACK' ? 1.8 : 1.0;

        const dp = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (dp < contactR && time - this._lastHitTime > (this.state === 'SPIN_ATTACK' ? 300 : 600)) {
            this._lastHitTime = time;
            player.takeDamage(this.attackDamage * dmgMult, this);
            this.scene.createImpactEffect(player.x, player.y, 0x33ff33);
            
            // Knockback on spin
            if (this.state === 'SPIN_ATTACK') {
                const ang = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
                if (player.body && typeof player.body.setVelocity === 'function') {
                    player.body.setVelocity(Math.cos(ang) * 800, Math.sin(ang) * 800);
                }
            }
        }

        player.followers.forEach((pf, i) => {
            if (!pf || !pf.active || pf.isDead) return;
            const df  = Phaser.Math.Distance.Between(this.x, this.y, pf.x, pf.y);
            const key = `boss_pf_${i}`;
            const last = this.scene._contactCooldowns.get(key) || 0;
            const cdReq = this.state === 'SPIN_ATTACK' ? 300 : 600;
            
            if (df < contactR && time - last > cdReq) {
                this.scene._contactCooldowns.set(key, time);
                pf.takeDamage(this.attackDamage * dmgMult);
                if (this.state === 'SPIN_ATTACK') {
                    const ang = Phaser.Math.Angle.Between(this.x, this.y, pf.x, pf.y);
                    if (pf.body && typeof pf.body.setVelocity === 'function') {
                        pf.body.setVelocity(Math.cos(ang) * 800, Math.sin(ang) * 800);
                    }
                }
            }
        });

        // Counter damage from followers (disabled during spin attack)
        if (this.state !== 'SPIN_ATTACK') {
            player.followers.forEach((pf, i) => {
                if (!pf || !pf.active || pf.isDead) return;
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
    }
}