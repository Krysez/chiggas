import Phaser from 'phaser';
import { getSafeBounds } from './ResponsiveLayout.js';

export default class LeaderboardScene extends Phaser.Scene {
    constructor() {
        super('LeaderboardScene');
    }

    create() {
        const { width, height } = this.scale;
        const safe = getSafeBounds(this, 10);

        this._androidBackHandler = () => this._goBack();
        window.addEventListener('chiggasAndroidBack', this._androidBackHandler);

        this._returning = false;

        this.add.rectangle(width / 2, height / 2, width, height, 0x090909);

        const bg = this.add.graphics();
        bg.fillGradientStyle(0x240024, 0x240024, 0x000000, 0x000000, 0.95, 0.95, 1, 1);
        bg.fillRect(0, 0, width, height);

        const compact = height < 520 || width < 920;

        this.add.text(safe.centerX, safe.top + (compact ? 20 : 32), 'LEADERBOARDS', {
            fontSize: compact ? '32px' : '44px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: compact ? 6 : 8
        }).setOrigin(0.5);

        const records = this._loadAllRecords();
        const difficulties = [
            { key: 'difficulty_0', label: 'TOO EASY', shortLabel: 'EASY', color: 0x33aa33 },
            { key: 'difficulty_1', label: 'STRAIGHT UP BASIC', shortLabel: 'BASIC', color: 0xffdd00 },
            { key: 'difficulty_2', label: "YOU GOTTA BE KIDDIN' ME", shortLabel: 'HARD', color: 0xff3333 }
        ];

        this._drawLandscapeCards(width, height, records, difficulties, compact);

        this._createBackButton(width, height, compact);

        const hint = this.add.text(safe.centerX, safe.bottom - (compact ? 2 : 6), 'TAP BACK OR PRESS ANY KEY TO RETURN', {
            fontSize: compact ? '13px' : '15px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#aaaaaa',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        const back = () => this._goBack();
        this.input.keyboard.once('keydown', back);
        if (this.input.gamepad) this.input.gamepad.once('down', back);

        this.scale.on('resize', this._handleResize, this);

        this.events.once('shutdown', () => {
            this.scale.off('resize', this._handleResize, this);
            this._returning = false;
            if (this._androidBackHandler) {
                window.removeEventListener('chiggasAndroidBack', this._androidBackHandler);
                this._androidBackHandler = null;
            }
        });
    }

    _drawLandscapeCards(width, height, records, difficulties, compact) {
        const safe = getSafeBounds(this, 10);
        const marginX = compact ? 8 : 22;
        const gap = compact ? 12 : 22;
        const top = safe.top + (compact ? 52 : 76);
        const bottom = safe.bottom - (compact ? 32 : 48);

        const cardW = (safe.width - marginX * 2 - gap * 2) / 3;
        const cardH = Math.max(188, bottom - top);
        const y = top + cardH / 2;
        const startX = safe.left + marginX + cardW / 2;

        difficulties.forEach((diff, index) => {
            this._drawReadableCard(
                startX + index * (cardW + gap),
                y,
                cardW,
                cardH,
                diff,
                records[diff.key] || this._defaultRecord(),
                compact
            );
        });
    }

    _drawReadableCard(x, y, w, h, diff, record, compact) {
        const card = this.add.container(x, y);
        const bg = this.add.graphics();
        const borderColor = diff.color;

        bg.fillStyle(0x111111, 0.94);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
        bg.lineStyle(compact ? 3 : 4, borderColor, 0.92);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);

        const title = this.add.text(0, -h / 2 + (compact ? 24 : 31), compact ? diff.shortLabel : diff.label, {
            fontSize: compact ? '23px' : '28px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#' + borderColor.toString(16).padStart(6, '0'),
            stroke: '#000000',
            strokeThickness: compact ? 4 : 5,
            align: 'center',
            wordWrap: { width: w - 20 }
        }).setOrigin(0.5);

        const hasRecord = (record.totalRuns || 0) > 0 || (record.bestScore || 0) > 0;

        if (!hasRecord) {
            const noRecord = this.add.text(0, 8, 'NO RUNS\nRECORDED', {
                fontSize: compact ? '21px' : '26px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center',
                lineSpacing: 4
            }).setOrigin(0.5);
            card.add([bg, title, noRecord]);
            return;
        }

        const statRows = [
            ['SCORE', record.bestScore || 0],
            ['STAGE', record.bestStage || 0],
            ['KILLS', record.totalKills || 0],
            ['RUNS', record.totalRuns || 0]
        ];

        const rowStartY = -h / 2 + (compact ? 58 : 76);
        const rowH = compact ? 31 : 39;

        const rowObjects = [];
        statRows.forEach((row, i) => {
            const ry = rowStartY + i * rowH;

            const label = this.add.text(-w * 0.30, ry, row[0], {
                fontSize: compact ? '16px' : '18px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#bbbbbb',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'left'
            }).setOrigin(0, 0.5);

            const value = this.add.text(w * 0.30, ry, String(row[1]), {
                fontSize: compact ? '21px' : '26px',
                fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'right'
            }).setOrigin(1, 0.5);

            rowObjects.push(label, value);
        });

        const extra = this.add.text(0, h / 2 - (compact ? 26 : 34), `RECRUITS ${record.totalRecruits || 0}  •  TURFS ${record.totalTurfsClaimed || 0}`, {
            fontSize: compact ? '14px' : '16px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffddaa',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            wordWrap: { width: w - 24 }
        }).setOrigin(0.5);

        card.add([bg, title, ...rowObjects, extra]);
    }

    _createBackButton(width, height, compact) {
        const w = compact ? 96 : 130;
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

    _handleResize() {
        this.scene.restart();
    }

    _goBack() {
        if (this._returning) return;
        this._returning = true;
        this.scene.start('MenuScene');
    }

    _defaultRecord() {
        return {
            bestScore: 0,
            bestStage: 0,
            bestKills: 0,
            bestRecruits: 0,
            bestTurfsClaimed: 0,
            totalRuns: 0,
            totalKills: 0,
            totalRecruits: 0,
            totalEaten: 0,
            totalTurfsClaimed: 0,
            totalBossesDefeated: 0
        };
    }

    _loadAllRecords() {
        try {
            const raw = window.localStorage.getItem('chiggas_records_v1');
            if (!raw) return {};
            return JSON.parse(raw) || {};
        } catch (err) {
            console.warn('[Leaderboard] Could not load records:', err);
            return {};
        }
    }
}