import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { playHit, playBite, playDeath } from '../audio/AudioManager.js';

export default class CockroachBoss extends Phaser.GameObjects.Container {
    constructor(scene, x, y, stageIndex = 5) {
        super(scene, x, y);

        this.scene = scene;
        this.faction = 'BOSS';
        this.stageIndex = stageIndex;

        const diffMult = scene.difficulty === 0 ? 0.8 : (scene.difficulty === 2 ? 1.3 : 1.0);

        this.maxHealth = Math.round(2800 * diffMult);
        this.health = this.maxHealth;
        this.baseSize = 260;
        this.sizeMultiplier = 1;
        this.moveSpeed = 175 * diffMult;
        this.attackDamage = Math.round(25 * diffMult);
        this.attackCooldown = 750;
        this._lastAttack = 0;
        this._lastHitTime = 0;

        this.state = 'HUNTING';
        this.currentTarget = null;
        this.isDead = false;
        this._hitFlash = 0;

        this._acidCooldown = 4200;
        this._breedCooldown = 6200;
        this._whipCooldown = 8500;
        this._pulsePhase = 0;
        this._walkPhase = 0;
        this._antennaActive = false;
        this._acidPuddles = [];

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.shadow = scene.add.ellipse(0, 92, 250, 58, 0x000000, 0.28);
        this.add(this.shadow);

        const key = this._getBossTextureKey(scene);
        this.sprite = scene.add.image(0, 0, key);
        this.sprite.setDisplaySize(this.baseSize, this.baseSize);
        this.add(this.sprite);

        this.acidGlow = scene.add.graphics();
        this.add(this.acidGlow);

        this.crownText = scene.add.text(0, -168, '👑', {
            fontSize: '52px'
        }).setOrigin(0.5, 1);
        this.add(this.crownText);

        this.nameTag = scene.add.text(0, -196, '☣ ROACH CZAR ☣', {
            fontSize: '22px',
            fontFamily: 'Dhurjati',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5, 1);
        this.add(this.nameTag);

        this.healthGfx = scene.add.graphics();
        this.add(this.healthGfx);

        this.setDepth(900);

        const bodyRadius = 115;
        this.body.setCircle(bodyRadius, -bodyRadius, -bodyRadius);
        this.body.setCollideWorldBounds(true);
        this.body.bounce.set(0.2, 0.2);

        scene.tweens.add({
            targets: this.crownText,
            y: -182,
            duration: 520,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this._drawHud(0);
    }

    _getBossTextureKey(scene) {
        if (scene.textures.exists('cockroach-czar')) {
            return 'cockroach-czar';
        }

        if (!scene.textures.exists('cockroach-czar-fallback')) {
            const g = scene.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0x2d1b10, 1);
            g.fillEllipse(130, 140, 170, 210);
            g.fillStyle(0x5a3d28, 1);
            g.fillEllipse(130, 105, 130, 110);
            g.fillStyle(0x90a4ae, 1);
            g.fillEllipse(130, 155, 170, 150);
            g.fillStyle(0xfbc02d, 1);
            g.fillRect(75, 75, 110, 22);
            g.lineStyle(8, 0xffb300, 1);
            g.strokeCircle(130, 168, 34);
            g.lineStyle(5, 0x27120a, 1);
            g.beginPath();
            g.moveTo(78, 78);
            g.lineTo(22, 20);
            g.moveTo(182, 78);
            g.lineTo(238, 20);
            g.strokePath();
            g.fillStyle(0x111111, 1);
            g.fillEllipse(105, 104, 42, 26);
            g.fillEllipse(155, 104, 42, 26);
            g.fillStyle(0xff1744, 1);
            g.fillCircle(105, 104, 6);
            g.fillCircle(155, 104, 6);
            g.generateTexture('cockroach-czar-fallback', 260, 280);
            g.destroy();
        }

        console.warn('[CockroachBoss] Missing texture key cockroach-czar. Using generated fallback. Check LoadingScene.js loads assets/cockroach-czar.png.');
        return 'cockroach-czar-fallback';
    }

    update(time, delta) {
        if (!this.active || this.isDead || !this.scene) return;

        this._pulsePhase += delta * 0.0035;
        this._walkPhase += delta * 0.012;

        if (this._hitFlash > 0) {
            this._hitFlash -= delta;
            if (this.sprite && this.sprite.active) this.sprite.setTintFill(0xffffff);
        } else if (this.sprite && this.sprite.active) {
            this.sprite.clearTint();
        }

        const moving = this.body && (Math.abs(this.body.velocity.x) > 8 || Math.abs(this.body.velocity.y) > 8);
        const bob = moving ? Math.sin(this._walkPhase) * 8 : Math.sin(this._pulsePhase) * 3;
        const lean = moving ? Math.sin(this._walkPhase * 0.5) * 0.06 : Math.sin(this._pulsePhase * 0.7) * 0.025;

        if (this.sprite && this.sprite.active) {
            this.sprite.y = bob;
            this.sprite.rotation = lean;
            if (this.body && Math.abs(this.body.velocity.x) > 15) {
                this.sprite.setFlipX(this.body.velocity.x < 0);
            }
        }

        if (this.shadow && this.shadow.active) {
            this.shadow.scaleX = 1 + Math.sin(this._pulsePhase) * 0.06;
            this.shadow.scaleY = 1 + Math.cos(this._pulsePhase) * 0.04;
        }

        if (this.state === 'HUNTING' || this.state === 'ATTACKING_TURF') {
            this._acidCooldown -= delta;
            this._breedCooldown -= delta;
            this._whipCooldown -= delta;
        }

        this._drawAcidGlow(time);
        this._drawHud(time);
        this._updatePuddles(time, delta);

        switch (this.state) {
            case 'HUNTING':
                this._stateHunting(time, delta);
                break;
            case 'ATTACKING_TURF':
                this._stateAttackingPlayer(time, delta);
                break;
            case 'DEAD':
                if (this.body) this.body.setVelocity(0, 0);
                break;
        }
    }

    _drawAcidGlow(time) {
        if (!this.acidGlow || !this.acidGlow.active) return;
        this.acidGlow.clear();

        const pulse = 0.45 + 0.25 * Math.sin(time * 0.006);
        this.acidGlow.lineStyle(5, 0x39ff14, pulse);
        this.acidGlow.strokeCircle(0, this.sprite?.y || 0, 136 * this.sizeMultiplier);

        if (this._antennaActive) {
            this.acidGlow.lineStyle(7, 0xff1744, 0.78);
            this.acidGlow.beginPath();
            this.acidGlow.arc(0, -20, 360, Math.PI * 0.75, Math.PI * 2.25, false);
            this.acidGlow.strokePath();
        }
    }

    _drawHud(time) {
        if (!this.healthGfx || !this.healthGfx.active) return;
        this.healthGfx.clear();

        const bw = 180;
        const bh = 14;
        const y = -176;
        const pct = Math.max(0, this.health / this.maxHealth);

        this.healthGfx.fillStyle(0x000000, 0.85);
        this.healthGfx.fillRoundedRect(-bw / 2, y, bw, bh, 5);

        this.healthGfx.fillStyle(0x39ff14, 1);
        this.healthGfx.fillRoundedRect(-bw / 2, y, bw * pct, bh, 5);

        this.healthGfx.lineStyle(2, 0xffffff, 0.45);
        this.healthGfx.strokeRoundedRect(-bw / 2, y, bw, bh, 5);
    }

    _stateHunting(time, delta) {
        const player = this.scene?.player;
        if (!player || !player.active) return;

        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

        if (this._whipCooldown <= 0 && dist < 430) {
            this._doAntennaWhip(player);
            return;
        }

        if (this._acidCooldown <= 0) {
            this._spitAcidMucus(player);
            return;
        }

        if (this._breedCooldown <= 0) {
            this._breedRoachNymphs();
            return;
        }

        if (dist < 165 * this.sizeMultiplier) {
            this.body.setVelocity(0, 0);
            this.state = 'ATTACKING_TURF';
            return;
        }

        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        this.body.setVelocity(
            Math.cos(angle) * this.moveSpeed * this.sizeMultiplier,
            Math.sin(angle) * this.moveSpeed * this.sizeMultiplier
        );
    }

    _stateAttackingPlayer(time, delta) {
        if (this._antennaActive) return;

        const player = this.scene?.player;
        if (!player || !player.active) {
            this.state = 'HUNTING';
            return;
        }

        this.body.setVelocity(0, 0);

        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        const attackRange = 175 * this.sizeMultiplier;

        if (dist > attackRange + 40) {
            this.state = 'HUNTING';
            return;
        }

        if (time - this._lastAttack >= this.attackCooldown) {
            this._lastAttack = time;
            this.scene.cameras.main.shake(120, 0.009);
            playBite(1.2);

            player.takeDamage(this.attackDamage, this);
            this.scene.createImpactEffect(player.x, player.y, 0x5a3d28, 'punch', this.attackDamage, true);
        }
    }

    _spitAcidMucus(player) {
        if (!this.scene || !player || !player.active) return;

        this.body.setVelocity(0, 0);
        this._acidCooldown = 5000 + Math.random() * 2000;

        this.scene.showFeedback('☣ ACID SPIT ☣', 0x39ff14, this.x, this.y - 130);
        playBite(1.4);

        const angleToPlayer = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const offsets = [-0.25, 0, 0.25];

        offsets.forEach(offset => {
            if (!this.scene || this.isDead) return;
            const ang = angleToPlayer + offset;
            const tx = player.x + Math.cos(ang + Math.PI / 2) * (Math.random() - 0.5) * 120;
            const ty = player.y + Math.sin(ang + Math.PI / 2) * (Math.random() - 0.5) * 120;

            const proj = this.scene.add.circle(this.x, this.y, 14, 0x39ff14, 0.9).setDepth(899);
            this.scene.physics.add.existing(proj);

            this.scene.tweens.add({
                targets: proj,
                x: tx,
                y: ty,
                scale: 2.2,
                duration: 620,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    if (proj && proj.active) proj.destroy();
                    if (this.active && !this.isDead && this.scene) this._createAcidPuddle(tx, ty);
                }
            });
        });
    }

    _createAcidPuddle(x, y) {
        if (!this.scene) return;
        const puddle = this.scene.add.graphics().setDepth(100);
        puddle.x = x;
        puddle.y = y;
        puddle._life = 8000;
        puddle._radius = 120;
        puddle._pulse = 0;
        this._acidPuddles.push(puddle);
    }

    _updatePuddles(time, delta) {
        const player = this.scene?.player;

        for (let i = this._acidPuddles.length - 1; i >= 0; i--) {
            const p = this._acidPuddles[i];
            if (!p || !p.active) {
                this._acidPuddles.splice(i, 1);
                continue;
            }

            p._life -= delta;
            if (p._life <= 0) {
                p.destroy();
                this._acidPuddles.splice(i, 1);
                continue;
            }

            p._pulse += delta * 0.005;
            const alpha = Math.min(0.45, p._life / 1000) * (0.8 + 0.2 * Math.sin(p._pulse));

            p.clear();
            p.fillStyle(0x228b22, alpha * 0.4);
            p.fillCircle(0, 0, p._radius);
            p.lineStyle(4, 0x39ff14, alpha * 1.4);
            p.strokeCircle(0, 0, p._radius);

            p.fillStyle(0x39ff14, alpha * 0.7);
            for (let b = 0; b < 3; b++) {
                const bx = Math.sin(p._pulse + b) * 20;
                const by = Math.cos(p._pulse * 0.7 + b) * 20;
                p.fillCircle(bx, by, 10 + 4 * Math.sin(p._pulse * 2 + b));
            }

            if (player && player.active) {
                const dist = Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y);
                if (dist < p._radius) {
                    player._webSlowTimer = 100;
                    if (!player._lastAcidBurn) player._lastAcidBurn = 0;
                    if (time - player._lastAcidBurn >= 500) {
                        player._lastAcidBurn = time;
                        player.takeDamage(5, this);
                        this.scene?.createImpactEffect(player.x, player.y, 0x39ff14, 'punch', 5, true);
                    }
                }

                player.followers.forEach(pf => {
                    if (!pf || !pf.active || !pf.body || pf.isDead) return;
                    const df = Phaser.Math.Distance.Between(pf.x, pf.y, p.x, p.y);
                    if (df < p._radius) {
                        pf.body.velocity.x *= 0.65;
                        pf.body.velocity.y *= 0.65;
                        if (!pf._lastAcidBurn) pf._lastAcidBurn = 0;
                        if (time - pf._lastAcidBurn >= 500) {
                            pf._lastAcidBurn = time;
                            pf.takeDamage(4, this);
                        }
                    }
                });
            }
        }
    }

    _breedRoachNymphs() {
        if (!this.scene || this.isDead) return;
        this.body.setVelocity(0, 0);
        this._breedCooldown = 5500 + Math.random() * 2000;

        this.scene.showFeedback('🥚 BREED BROOD 🥚', 0xffcc00, this.x, this.y - 120);
        playBite(0.85);

        for (let i = 0; i < 3; i++) {
            const angle = Math.PI * 0.5 + (i - 1) * 0.45;
            const dist = 120;
            const rx = this.x - Math.cos(angle) * dist;
            const ry = this.y + Math.sin(angle) * dist;

            const nymph = this.scene.spawnChigga(rx, ry, CONFIG.FACTIONS.WILD);
            if (nymph) {
                nymph.target = this.scene.player;
                nymph.health = 190;
                nymph.maxHealth = 190;
                nymph.baseDamage = Math.max(nymph.baseDamage || 10, 16);
                nymph.setScale(0.8);
                if (nymph.setTint) nymph.setTint(0x733d1a);
            }
        }

        for (let i = 0; i < 8; i++) {
            const a = Math.PI * 0.5 + (Math.random() - 0.5);
            const d = this.scene.add.circle(this.x, this.y + 40, 5, 0x5a3d28, 0.8).setDepth(890);
            this.scene.tweens.add({
                targets: d,
                x: this.x + Math.cos(a) * 80,
                y: this.y + 50 + Math.sin(a) * 80,
                scale: 0.1,
                alpha: 0,
                duration: 400,
                onComplete: () => { if (d && d.active) d.destroy(); }
            });
        }
    }

    _doAntennaWhip(player) {
        if (!this.scene || !player || !player.active || this.isDead) return;

        this.state = 'ATTACKING_TURF';
        this._antennaActive = true;
        this._whipCooldown = 8500 + Math.random() * 3000;
        this.body.setVelocity(0, 0);

        this.scene.showFeedback('⚡ ANTENNA WHIP! ⚡', 0xff3300, this.x, this.y - 120);
        this.scene.cameras.main.shake(300, 0.012);
        playHit(1.2);

        this.scene.tweens.add({
            targets: this.sprite,
            scaleX: this.sprite.scaleX * 1.15,
            scaleY: this.sprite.scaleY * 0.86,
            duration: 240,
            yoyo: true,
            onComplete: () => {
                if (!this.active || this.isDead || !this.scene || !player || !player.active) return;

                this._antennaActive = false;
                this.state = 'HUNTING';

                this.scene.cameras.main.shake(400, 0.022);
                playHit(1.85);

                const whipRange = 430;
                const dp = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                if (dp < whipRange) {
                    player.takeDamage(this.attackDamage * 1.5, this);
                    const ang = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
                    player.body.setVelocity(Math.cos(ang) * 900, Math.sin(ang) * 900);
                    this.scene.createImpactEffect(player.x, player.y, 0xffcc00, 'punch', this.attackDamage * 1.5, true);
                }

                player.followers.forEach(pf => {
                    if (!pf || !pf.active || !pf.body) return;
                    const df = Phaser.Math.Distance.Between(this.x, this.y, pf.x, pf.y);
                    if (df < whipRange) {
                        pf.takeDamage(this.attackDamage * 1.3, this);
                        if (pf && pf.active && pf.body && !pf.isDead) {
                            const ang = Phaser.Math.Angle.Between(this.x, this.y, pf.x, pf.y);
                            pf.body.setVelocity(Math.cos(ang) * 800, Math.sin(ang) * 800);
                        }
                    }
                });
            }
        });
    }

    takeDamage(amount, attacker) {
        if (this.isDead || !this.active || !this.scene) return;

        this._hitFlash = 120;
        this.health = Math.max(0, this.health - amount);
        const pct = this.health / this.maxHealth;
        this.sizeMultiplier = Math.max(0.45, pct);

        const display = this.baseSize * this.sizeMultiplier;
        if (this.sprite && this.sprite.active) this.sprite.setDisplaySize(display, display);

        playHit(0.65);

        const bodyRadius = Math.max(55, 115 * this.sizeMultiplier);
        if (this.body) this.body.setCircle(bodyRadius, -bodyRadius, -bodyRadius);

        this.scene.createImpactEffect(this.x, this.y, 0x5a3d28, 'punch', amount, false);

        if (this.health <= 0) this._die(attacker);
    }

    _die(attacker) {
        if (this.isDead || !this.scene) return;

        const scene = this.scene;
        const deathX = this.x;
        const deathY = this.y;

        this.isDead = true;
        this.state = 'DEAD';
        this._antennaActive = false;
        if (this.body) this.body.setVelocity(0, 0);

        playDeath();

        if (attacker && attacker.faction === CONFIG.FACTIONS.PLAYER && scene.player) {
            scene.player.gainStr(40);
            scene.addScore(10000, deathX, deathY);
        }

        this._acidPuddles.forEach(p => { if (p && p.active) p.destroy(); });
        this._acidPuddles = [];

        for (let i = 0; i < 45; i++) {
            const angle = (i / 45) * Math.PI * 2;
            const dist = 80 + Math.random() * 220;
            const blob = scene.add.circle(
                deathX,
                deathY,
                12 + Math.random() * 22,
                [0x5a3d28, 0x2d1b10, 0x39ff14, 0x110011][Math.floor(Math.random() * 4)],
                0.85
            ).setDepth(1100);
            scene.tweens.add({
                targets: blob,
                x: deathX + Math.cos(angle) * dist,
                y: deathY + Math.sin(angle) * dist,
                scaleX: 0,
                scaleY: 0,
                alpha: 0,
                duration: 600 + Math.random() * 800,
                ease: 'Quad.easeOut',
                onComplete: () => { if (blob && blob.active) blob.destroy(); }
            });
        }

        scene.cameras.main.shake(800, 0.035);
        scene.cameras.main.flash(400, 57, 255, 20);

        scene.time.delayedCall(120, () => {
            if (scene && scene.scene && scene.scene.isActive()) {
                scene.onBossDefeated();
            }
            if (this.active) this.destroy();
        });
    }

    checkContactDamage(time) {
        if (this.isDead || !this.active || !this.scene || !this.scene.player || !this.scene._contactCooldowns) return;
        if (this.state === 'DEAD') return;

        const player = this.scene.player;
        const contactR = 155 * this.sizeMultiplier;

        const dp = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (dp < contactR && time - this._lastHitTime > 600) {
            this._lastHitTime = time;
            player.takeDamage(this.attackDamage, this);
            this.scene.createImpactEffect(player.x, player.y, 0x5a3d28, 'punch', this.attackDamage, true);
        }

        player.followers.forEach((pf, i) => {
            if (!pf || !pf.active) return;
            const df = Phaser.Math.Distance.Between(this.x, this.y, pf.x, pf.y);
            const key = `boss_pf_${i}`;
            const last = this.scene._contactCooldowns.get(key) || 0;
            if (df < contactR && time - last > 600) {
                this.scene._contactCooldowns.set(key, time);
                pf.takeDamage(this.attackDamage, this);
            }
        });

        player.followers.forEach((pf, i) => {
            if (!pf || !pf.active) return;
            const df = Phaser.Math.Distance.Between(this.x, this.y, pf.x, pf.y);
            const key = `pf_boss_${i}`;
            const last = this.scene._contactCooldowns.get(key) || 0;
            if (df < contactR + 18 && time - last > 700) {
                this.scene._contactCooldowns.set(key, time);
                const str = player.getSTR ? player.getSTR() : 1;
                this.takeDamage(Math.round(15 * (1 + (str - 1) * 0.15)), pf);
            }
        });
    }

    destroy(fromScene) {
        this._acidPuddles.forEach(p => { if (p && p.active) p.destroy(); });
        this._acidPuddles = [];
        super.destroy(fromScene);
    }
}