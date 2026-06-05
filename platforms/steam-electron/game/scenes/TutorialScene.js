import Phaser from 'phaser';
import { getSafeBounds } from './ResponsiveLayout.js';

export default class HowToPlayScene extends Phaser.Scene {
    constructor() {
        super('HowToPlayScene');
    }

    preload() {
        if (!this.textures.exists('skin-follicle-base')) {
            this.load.image('skin-follicle-base', 'assets/skin-follicle-base.webp');
        }
        if (!this.textures.exists('cockroach-czar')) {
            this.load.image('cockroach-czar', 'assets/cockroach-czar.png');
        }
    }

    create() {
        const { width, height } = this.scale;
        const safe = getSafeBounds(this, 10);

        this._androidBackHandler = () => this._goBack();
        window.addEventListener('chiggasAndroidBack', this._androidBackHandler);

        this._returning = false;
        this.cameras.main.setBackgroundColor('#050008');

        this.add.rectangle(width / 2, height / 2, width, height, 0x050008, 1);

        const compact = height < 520 || width < 920;

        this.add.text(safe.centerX, safe.top + (compact ? 15 : 26), 'HOW TO PLAY', {
            fontSize: compact ? '34px' : '46px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: compact ? 6 : 8,
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(safe.centerX, safe.top + (compact ? 43 : 66), 'Recruit the swarm. Claim the skin. Survive the boss.', {
            fontSize: compact ? '15px' : '19px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        const cards = [
            {
                title: 'RECRUIT',
                text: 'Find loose Chiggas and build your army.',
                color: 0xff3333,
                icon: this._firstTexture(['chigga-neutral', 'chigga-player', 'player'])
            },
            {
                title: 'CLAIM TURFS',
                text: 'Take over turfs so more recruits spawn.',
                color: 0xffdd00,
                icon: this._firstTexture(['skin-follicle-base', 'follicle-base', 'turf-player', 'territory', 'player'])
            },
            {
                title: 'GET STRONG',
                text: 'Eat enemies and power up before boss fights.',
                color: 0x39ff14,
                icon: this._firstTexture(['powerup-rifle', 'powerup-pistol', 'player'])
            },
            {
                title: 'BEAT BOSSES',
                text: 'Dodge attacks, charge carefully, and finish each stage.',
                color: 0xff66ff,
                icon: this._firstTexture(['cockroach-czar', 'cockroach-boss', 'boss-chigga', 'mite-overlord', 'player'])
            }
        ];

        const top = safe.top + (compact ? 68 : 100);
        const bottom = safe.bottom - (compact ? 32 : 52);
        const gap = compact ? 10 : 18;
        const cardW = (safe.width - (compact ? 18 : 50) - gap * 3) / 4;
        const cardH = Math.max(compact ? 135 : 170, bottom - top);
        const startX = safe.left + (compact ? 9 : 25) + cardW / 2;

        cards.forEach((card, index) => {
            this._drawObjectiveCard({
                x: startX + index * (cardW + gap),
                y: top + cardH / 2,
                w: cardW,
                h: cardH,
                compact,
                ...card
            });
        });

        this._createBackButton(width, height, compact);

        this.input.keyboard.on('keydown-ESC', () => this._goBack());
        this.input.keyboard.on('keydown-ENTER', () => this._goBack());
        if (this.input.gamepad) this.input.gamepad.once('down', () => this._goBack());

        this.scale.on('resize', this._handleResize, this);
        this.events.once('shutdown', () => this.scale.off('resize', this._handleResize, this));
        this.events.once('destroy', () => this.scale.off('resize', this._handleResize, this));

        this.events.once('shutdown', () => {
            this._returning = false;
            if (this._androidBackHandler) {
                window.removeEventListener('chiggasAndroidBack', this._androidBackHandler);
                this._androidBackHandler = null;
            }
        });
    }

    _firstTexture(keys) {
        return keys.find(key => this.textures.exists(key)) || 'player';
    }

    _drawObjectiveCard({ x, y, w, h, title, text, color, icon, compact }) {
        const bg = this.add.graphics();
        bg.fillStyle(0x111111, 0.94);
        bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 18);
        bg.lineStyle(compact ? 3 : 4, color, 0.9);
        bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 18);

        const titleText = this.add.text(x, y - h / 2 + (compact ? 20 : 28), title, {
            fontSize: compact ? '20px' : '26px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#' + color.toString(16).padStart(6, '0'),
            stroke: '#000000',
            strokeThickness: compact ? 4 : 5,
            align: 'center',
            wordWrap: { width: w - 14 }
        }).setOrigin(0.5);

        let image = null;
        if (this.textures.exists(icon)) {
            image = this.add.image(x, y - (compact ? 8 : 12), icon);
            this._fitImage(image, w * 0.52, h * 0.42);
        }

        const body = this.add.text(x, y + h / 2 - (compact ? 34 : 44), text, {
            fontSize: compact ? '14px' : '17px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            wordWrap: { width: w - 18 }
        }).setOrigin(0.5);
    }

    _createBackButton(width, height, compact) {
        const w = compact ? 94 : 130;
        const h = compact ? 30 : 38;
        const safe = getSafeBounds(this, 10);
        const x = safe.right - w / 2 - 4;
        const y = safe.top + h / 2 + 4;

        const btn = this.add.container(x, y).setDepth(20);
        const bg = this.add.graphics();

        const draw = (fill = 0x333333) => {
            bg.clear();
            bg.fillStyle(fill, 0.96);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
            bg.lineStyle(3, 0xffffff, 0.55);
            bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
        };

        draw();

        const label = this.add.text(0, 0, 'BACK', {
            fontSize: compact ? '16px' : '20px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        btn.add([bg, label]);
        btn.setSize(w, h);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => draw(0x555555));
        btn.on('pointerout', () => draw(0x333333));
        btn.on('pointerdown', () => this._goBack());
    }

    _fitImage(image, maxW, maxH) {
        const scale = Math.min(maxW / Math.max(1, image.width), maxH / Math.max(1, image.height));
        image.setScale(scale);
    }

    _handleResize() {
        this.scene.restart();
    }

    _goBack() {
        if (this._returning) return;
        this._returning = true;
        this.scene.start('MenuScene');
    }
}