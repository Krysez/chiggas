import Phaser from 'phaser';
import { CONFIG } from '../config.js';

const WORLD = CONFIG.WORLD_SIZE;
function rand(min, max) { return min + Math.random() * (max - min); }

export default class TerrainDecorator {
    constructor(scene, density = 'low', stage = null) {
        this.scene = scene;
        this.density = density;
        this.stage = stage;
    }

    decorate() {
        if (this.scene.stageIndex === 5) {
            this._drawLawnDecorations();

            if (this.stage?.ambientOverlay) {
                this.scene.add.rectangle(
                    WORLD / 2, WORLD / 2, WORLD, WORLD,
                    this.stage.ambientOverlay, 0.12
                ).setDepth(5);
            }
            return;
        }

        const skinTint = this.stage?.skinTint ?? 0xd4956a;
        this.scene.add.rectangle(
            WORLD / 2, WORLD / 2, WORLD, WORLD,
            skinTint, 0.28
        ).setDepth(0);

        this._drawBasePores();
        this._drawHairFollicles();

        if (this.density === 'medium' || this.density === 'high' || this.density === 'extreme') {
            this._drawPimples();
            this._drawBruises();
        }
        if (this.density === 'high' || this.density === 'extreme') {
            this._drawTattoos();
            this._drawScars();
            this._drawExtraPores();
        }

        if (this.stage?.ambientOverlay) {
            this.scene.add.rectangle(
                WORLD / 2, WORLD / 2, WORLD, WORLD,
                this.stage.ambientOverlay, 0.18
            ).setDepth(5);
        }
    }

    _drawLawnDecorations() {
        const count = 45;
        for (let i = 0; i < count; i++) {
            const x = Math.random() * WORLD;
            const y = Math.random() * WORLD;
            const isPebble = Math.random() > 0.5;
            const size = rand(50, 100);

            const g = this.scene.add.graphics().setDepth(2);

            if (isPebble) {
                const baseColor = [0x777777, 0x888888, 0x555555][Math.floor(Math.random() * 3)];

                g.fillStyle(0x000000, 0.25);
                g.fillEllipse(x + 5, y + 8, size * 0.45, size * 0.35);

                g.fillStyle(baseColor, 1);
                g.fillEllipse(x, y, size * 0.45, size * 0.35);

                g.fillStyle(0xffffff, 0.15);
                g.fillEllipse(x - size * 0.1, y - size * 0.08, size * 0.2, size * 0.1);
            } else {
                const leafColor = 0x22aa33;
                const shadowColor = 0x001100;
                const scale = size / 70;

                g.fillStyle(shadowColor, 0.2);
                g.fillCircle(x - 5, y + 10, size * 0.18);
                g.fillCircle(x + 10, y + 10, size * 0.18);
                g.fillCircle(x + 2, y + 5, size * 0.18);

                g.fillStyle(leafColor, 1);
                g.fillCircle(x - 10 * scale, y, size * 0.18);
                g.fillCircle(x + 10 * scale, y, size * 0.18);
                g.fillCircle(x, y - 12 * scale, size * 0.18);

                // Phaser Graphics does not support Canvas-style quadraticCurveTo().
                // Use short line segments instead so Stage 5 lawn decorations never crash.
                g.lineStyle(4, 0x116611, 1);
                g.beginPath();
                g.moveTo(x, y + 4 * scale);
                g.lineTo(x + 3 * scale, y + 10 * scale);
                g.lineTo(x + 5 * scale, y + 17 * scale);
                g.lineTo(x + 4 * scale, y + 22 * scale);
                g.strokePath();

                g.fillStyle(0x55ff66, 0.4);
                g.fillCircle(x - 10 * scale, y - 2, size * 0.08);
                g.fillCircle(x + 10 * scale, y - 2, size * 0.08);
                g.fillCircle(x, y - 12 * scale - 2, size * 0.08);
            }

            if (this.scene.follicles) {
                const f = this.scene.add.zone(x, y, size, size);
                this.scene.physics.add.existing(f, true);
                f.body.setCircle(size * 0.33);
                this.scene.follicles.add(f);
            }
        }

        for (let i = 0; i < 70; i++) {
            const x = Math.random() * WORLD;
            const y = Math.random() * WORLD;
            const g = this.scene.add.graphics().setDepth(1);
            g.lineStyle(rand(2, 4), 0x33aa44, rand(0.5, 0.8));

            const bladeCount = 3 + Math.floor(Math.random() * 3);
            for (let b = 0; b < bladeCount; b++) {
                const angle = rand(-0.3, 0.3);
                const len = rand(15, 30);
                g.beginPath();
                g.moveTo(x, y);
                g.lineTo(x + Math.sin(angle) * len * 0.4, y - Math.cos(angle) * len);
                g.strokePath();
            }
        }
    }

    _drawBasePores() {
        const count = this.density === 'low' ? 30 : this.density === 'medium' ? 55 : 80;
        const poreColor = this.stage?.skinTint
            ? Phaser.Display.Color.IntegerToColor(this.stage.skinTint).darken(25).color
            : 0xb5735a;

        for (let i = 0; i < count; i++) {
            const x = Math.random() * WORLD;
            const y = Math.random() * WORLD;
            const r = rand(20, 60);
            const alpha = rand(0.08, 0.24);
            const g = this.scene.add.graphics().setDepth(1);
            g.fillStyle(poreColor, alpha);
            g.fillCircle(x, y, r);
            g.fillStyle(0x000000, alpha * 0.6);
            g.fillCircle(x, y, r * 0.28);
        }
    }

    _drawHairFollicles() {
        const hairMap = { sparse: 10, medium: 28, dense: 55, extreme: 200 };
        const count = hairMap[this.stage?.hairDensity] ?? (
            this.density === 'low' ? 15 : this.density === 'medium' ? 25 : 40
        );

        for (let i = 0; i < count; i++) {
            const x = Math.random() * WORLD;
            const y = Math.random() * WORLD;
            const size = rand(60, 130);
            const angle = rand(0, Math.PI * 2);

            this.scene.add.image(x, y, 'deco-hair')
                .setDisplaySize(size, size)
                .setAngle(Phaser.Math.RadToDeg(angle))
                .setAlpha(rand(0.45, 0.9))
                .setDepth(2);

            if (this.scene.follicles) {
                const f = this.scene.add.zone(x, y, size, size);
                this.scene.physics.add.existing(f, true);
                f.body.setCircle(size * 0.3);
                this.scene.follicles.add(f);
            }
        }
    }

    _drawPimples() {
        if (this.scene.stageIndex < 2) return;

        if (!this.scene.pimples) this.scene.pimples = [];
        const count = this.density === 'medium' ? 8 : (this.density === 'extreme' ? 28 : 20);

        for (let i = 0; i < count; i++) {
            const x = Math.random() * WORLD;
            const y = Math.random() * WORLD;
            const size = rand(50, 120);

            const pimple = this.scene.add.sprite(x, y, 'deco-pimple')
                .setDisplaySize(size, size)
                .setAlpha(rand(0.65, 0.95))
                .setDepth(3);

            pimple.radius = size / 2;
            pimple.triggerRadius = size * 0.58;
            pimple.active = true;
            this.scene.pimples.push(pimple);

            const g = this.scene.add.graphics().setDepth(2);
            g.fillStyle(0xffdd99, 0.12);
            g.fillCircle(x, y, size * 0.9);
            pimple.glow = g;
        }
    }

    _drawBruises() {
        const count = this.density === 'medium' ? 6 : 14;
        for (let i = 0; i < count; i++) {
            const x = Math.random() * WORLD;
            const y = Math.random() * WORLD;
            const w = rand(100, 240);
            const h = rand(80, 170);

            this.scene.add.image(x, y, 'deco-bruise')
                .setDisplaySize(w, h)
                .setAngle(rand(0, 360))
                .setAlpha(rand(0.4, 0.72))
                .setDepth(2);
        }
    }

    _drawTattoos() {
        const positions = [
            { x: WORLD * 0.2,  y: WORLD * 0.3,  size: rand(1200, 2000) },
            { x: WORLD * 0.75, y: WORLD * 0.2,  size: rand(1000, 1600) },
            { x: WORLD * 0.5,  y: WORLD * 0.7,  size: rand(1500, 2500) },
            { x: WORLD * 0.85, y: WORLD * 0.65, size: rand(900, 1500) },
        ];

        positions.forEach(p => {
            this.scene.add.image(p.x, p.y, 'deco-tattoo')
                .setDisplaySize(p.size, p.size)
                .setAlpha(rand(0.28, 0.52))
                .setDepth(2);
        });
    }

    _drawScars() {
        const count = this.density === 'high' || this.density === 'extreme' ? 8 : 4;
        for (let i = 0; i < count; i++) {
            const x = Math.random() * WORLD;
            const y = Math.random() * WORLD;
            const len = rand(120, 400);
            const angle = rand(0, Math.PI);
            const g = this.scene.add.graphics().setDepth(3);

            g.lineStyle(rand(5, 13), 0xe07070, rand(0.3, 0.55));
            g.beginPath();
            g.moveTo(x - Math.cos(angle) * len * 0.5, y - Math.sin(angle) * len * 0.5);
            g.lineTo(x + Math.cos(angle) * len * 0.5, y + Math.sin(angle) * len * 0.5);
            g.strokePath();

            g.lineStyle(rand(1, 3), 0xffdada, rand(0.2, 0.4));
            g.beginPath();
            g.moveTo(x - Math.cos(angle) * len * 0.5, y - Math.sin(angle) * len * 0.5 + 2);
            g.lineTo(x + Math.cos(angle) * len * 0.5, y + Math.sin(angle) * len * 0.5 + 2);
            g.strokePath();
        }
    }

    _drawExtraPores() {
        for (let i = 0; i < 90; i++) {
            const x = Math.random() * WORLD;
            const y = Math.random() * WORLD;
            const r = rand(4, 15);
            const g = this.scene.add.graphics().setDepth(1);
            g.fillStyle(0x8a4030, rand(0.1, 0.28));
            g.fillCircle(x, y, r);
        }
    }
}