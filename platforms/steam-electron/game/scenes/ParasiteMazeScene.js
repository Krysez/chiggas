// CHIGGAS_CLEANUP_PASS_80A_MAZE_BACK_LABEL_BEGIN
// CHIGGAS_CLEANUP_PASS_80A_MAZE_BACK_LABEL_END
import Phaser from 'phaser';
import { initAudio, startMiniGameMusic, stopAmbientMusic, playMazePellet, playMazePower, playMazeEnemyEat, playMazeDeath, playMiniGameWin } from '../audio/AudioManager.js';
import { getEquippedSoldierSkin, getEquippedPlayerSkin } from './SkinRegistry.js';

const STORAGE_KEY = 'chiggas_parasite_maze_v1';

const MAZE = [
    '#################',
    '#.......#.......#',
    '#.###.#.#.#.###.#',
    '#o#...#...#...#o#',
    '#.#.#.#####.#.#.#',
    '#...#...P...#...#',
    '###.###.#.###.###',
    ' .....E...E..... ',
    '###.###.#.###.###',
    '#...#...E...#...#',
    '#o#.#.#####.#.#o#',
    '#.....E.#.......#',
    '#################'
];

const DIRS = {
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    NONE: { x: 0, y: 0 }
};

function sameDir(a, b) {
    return a && b && a.x === b.x && a.y === b.y;
}

export default class ParasiteMazeScene extends Phaser.Scene {
    constructor() {
        super('ParasiteMazeScene');
    }

    init(data = {}) {
        this.returnScene = data.returnScene || 'MenuScene';
        this.returnData = data.returnData || {};
        this.storyMode = !!data.storyMode;
    }

    create() {
        const { width, height } = this.scale;

        this._startMiniGameAudio('maze');

        this.cameras.main.setBackgroundColor('#050005');
        this.add.rectangle(width / 2, height / 2, width, height, 0x050005, 1);

        this.lives = 3;
        this.score = 0;
        this.pelletsLeft = 0;
        this.gameOver = false;
        this.pausedForHit = false;
        this.startTime = 0;
        this.powerModeUntil = 0;
        this.playerMoving = false;
        this.currentDir = { ...DIRS.NONE };
        this.nextDir = { ...DIRS.NONE };
        this.enemies = [];
        this.pellets = new Map();
        this._mazePalette = this._pickMazePalette();

        this._buildLayout();
        this._createHUD();
        this._createControls();
        this._setupInput();
        this._playOpeningIntro();

        this.events.once('shutdown', () => this._cleanup());
        this.events.once('destroy', () => this._cleanup());
    }

    _startMiniGameAudio(type = 'maze') {
        const start = () => {
            initAudio().then(() => startMiniGameMusic(type)).catch(() => {});
        };

        start();
        this.input.once('pointerdown', start);
        this.input.keyboard?.once('keydown', start);
        if (this.input.gamepad) this.input.gamepad.once('down', start);

        this.events.once('shutdown', () => stopAmbientMusic());
        this.events.once('destroy', () => stopAmbientMusic());
    }

    _pickMazePalette() {
        const palettes = [
            { bg: 0x100010, wall: 0x8a1111, border: 0xffdd00, pelletTint: 0xff7755, powerCore: 0x39ff14 },
            { bg: 0x001018, wall: 0x005caa, border: 0x00c8ff, pelletTint: 0x66ddff, powerCore: 0xffdd00 },
            { bg: 0x101800, wall: 0x227711, border: 0x99ff33, pelletTint: 0xccff66, powerCore: 0xffdd00 },
            { bg: 0x160018, wall: 0x6f22aa, border: 0xff66ff, pelletTint: 0xff99ff, powerCore: 0x39ff14 },
            { bg: 0x181000, wall: 0xaa5500, border: 0xff9900, pelletTint: 0xffcc66, powerCore: 0x39ff14 },
            { bg: 0x001810, wall: 0x008866, border: 0x00ffbb, pelletTint: 0x88ffdd, powerCore: 0xffdd00 }
        ];

        return palettes[Math.floor(Math.random() * palettes.length)];
    }

    _buildLayout() {
        const { width, height } = this.scale;
        this.rows = MAZE.length;
        this.cols = MAZE[0].length;

        const topMargin = height < 560 ? 62 : 78;
        const bottomMargin = height < 560 ? 48 : 60;
        const availableW = width - 22;
        const availableH = height - topMargin - bottomMargin;

        this.tile = Math.floor(Math.min(availableW / this.cols, availableH / this.rows));
        this.tile = Math.max(24, Math.min(this.tile, 48));

        this.boardW = this.cols * this.tile;
        this.boardH = this.rows * this.tile;
        this.offsetX = Math.floor(width / 2 - this.boardW / 2);
        this.offsetY = Math.floor(topMargin + availableH / 2 - this.boardH / 2);

        this.boardBg = this.add.graphics();
        this.boardBg.fillStyle(this._mazePalette.bg, 1);
        this.boardBg.fillRoundedRect(this.offsetX - 8, this.offsetY - 8, this.boardW + 16, this.boardH + 16, 18);
        this.boardBg.lineStyle(5, this._mazePalette.border, 0.86);
        this.boardBg.strokeRoundedRect(this.offsetX - 8, this.offsetY - 8, this.boardW + 16, this.boardH + 16, 18);

        this.walls = this.add.graphics();
        this.walls.fillStyle(this._mazePalette.wall, 0.96);
        this.walls.lineStyle(2, this._mazePalette.border, 0.30);

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cell = MAZE[row][col];
                const x = this._cellCenterX(col);
                const y = this._cellCenterY(row);

                if (cell === '#') {
                    const rx = this.offsetX + col * this.tile;
                    const ry = this.offsetY + row * this.tile;
                    this.walls.fillRoundedRect(rx + 1, ry + 1, this.tile - 2, this.tile - 2, Math.max(4, this.tile * 0.18));
                    this.walls.strokeRoundedRect(rx + 1, ry + 1, this.tile - 2, this.tile - 2, Math.max(4, this.tile * 0.18));
                    continue;
                }

                if (cell === '.' || cell === 'o') {
                    this._createPellet(row, col, cell === 'o');
                    continue;
                }

                if (cell === 'P') {
                    this.spawnCell = { row, col };
                    continue;
                }

                if (cell === 'E') {
                    if (!this.enemyCells) this.enemyCells = [];
                    this.enemyCells.push({ row, col });
                }
            }
        }

        const soldierSkin = getEquippedSoldierSkin();
        this.soldierKey = soldierSkin?.assetKey && this.textures.exists(soldierSkin.assetKey)
            ? soldierSkin.assetKey
            : 'chigga-neutral';

        const playerSkin = getEquippedPlayerSkin();
        this.powerChiggaKey = playerSkin?.assetKey && this.textures.exists(playerSkin.assetKey)
            ? playerSkin.assetKey
            : 'player';

        this.playerCell = { ...this.spawnCell };
        this.player = this.add.sprite(this._cellCenterX(this.playerCell.col), this._cellCenterY(this.playerCell.row), this.soldierKey);
        this.player.setDisplaySize(this.tile * 0.96, this.tile * 0.96);
        this.player.setDepth(50);

        const enemyKeys = ['chigga-blue', 'chigga-green', 'purple-gang-minion', 'orange-gang-minion'];
        (this.enemyCells || []).slice(0, 5).forEach((cell, index) => {
            const key = enemyKeys[index % enemyKeys.length];
            const enemy = this.add.sprite(this._cellCenterX(cell.col), this._cellCenterY(cell.row), this.textures.exists(key) ? key : 'chigga-blue');
            enemy.setDisplaySize(this.tile * 0.92, this.tile * 0.92);
            enemy.setDepth(45);
            enemy._cell = { ...cell };
            enemy._spawn = { ...cell };
            enemy._dir = index % 2 === 0 ? { ...DIRS.LEFT } : { ...DIRS.RIGHT };
            enemy._nextMoveAt = 0;
            enemy._moving = false;
            this.enemies.push(enemy);
        });
    }

    _createPellet(row, col, isPower = false) {
        const x = this._cellCenterX(col);
        const y = this._cellCenterY(row);
        const key = `${row}_${col}`;

        let pellet;
        if (isPower) {
            const c = this.add.container(x, y).setDepth(32);
            const glow = this.add.circle(0, 0, this.tile * 0.34, this._mazePalette.border, 0.28);
            const core = this.add.circle(0, 0, this.tile * 0.22, this._mazePalette.powerCore, 1);
            const ring = this.add.circle(0, 0, this.tile * 0.35).setStrokeStyle(3, this._mazePalette.border, 0.95);
            c.add([glow, core, ring]);
            c._glow = glow;
            c._core = core;
            c._ring = ring;
            pellet = c;
        } else {
            pellet = this.add.image(x, y, 'mite-wild').setDepth(30);
            pellet.setDisplaySize(this.tile * 0.46, this.tile * 0.46);
            pellet.setTint(this._mazePalette.pelletTint);
        }

        pellet._row = row;
        pellet._col = col;
        pellet._isPowerPellet = isPower;
        pellet._baseY = y;
        pellet._phase = Math.random() * Math.PI * 2;

        this.pellets.set(key, pellet);
        this.pelletsLeft += 1;
    }

    _createHUD() {
        const { width, height } = this.scale;

        this.titleText = this.add.text(width / 2, height < 560 ? 24 : 32, 'PARASITE MAZE', {
            fontSize: height < 560 ? '26px' : '38px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);

        this.statusText = this.add.text(16, height < 560 ? 24 : 32, 'Lives: 3  |  Score: 0', {
            fontSize: height < 560 ? '14px' : '18px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#39ff14',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0, 0.5).setDepth(100);

        this.pelletText = this.add.text(width - 16, height < 560 ? 24 : 32, `Parasites: ${this.pelletsLeft}`, {
            fontSize: height < 560 ? '14px' : '18px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(1, 0.5).setDepth(100);

        this.powerText = this.add.text(width / 2, height < 560 ? 52 : 62, '', {
            fontSize: height < 560 ? '15px' : '20px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(100);

        this._createButton(width - 76, height - 28, 'BACK', 0x333333, () => this._returnToMenu(), 118, 38, 15);
    }

    _setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');

        this.input.gamepad?.once('connected', () => {});
    }

    _createControls() {
        const { height } = this.scale;
        const baseX = 72;
        const baseY = height - 58;
        const s = 34;

        this._createDpadButton(baseX, baseY - s, '▲', () => this._setDirection(0, -1));
        this._createDpadButton(baseX, baseY + s, '▼', () => this._setDirection(0, 1));
        this._createDpadButton(baseX - s, baseY, '◀', () => this._setDirection(-1, 0));
        this._createDpadButton(baseX + s, baseY, '▶', () => this._setDirection(1, 0));

        this.input.on('pointerdown', pointer => {
            this._swipeStart = { x: pointer.x, y: pointer.y };
        });

        this.input.on('pointerup', pointer => {
            if (!this._swipeStart) return;
            const dx = pointer.x - this._swipeStart.x;
            const dy = pointer.y - this._swipeStart.y;
            this._swipeStart = null;
            if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;

            if (Math.abs(dx) > Math.abs(dy)) this._setDirection(dx > 0 ? 1 : -1, 0);
            else this._setDirection(0, dy > 0 ? 1 : -1);
        });
    }

    _playOpeningIntro() {
        const { width, height } = this.scale;

        this.pausedForHit = true;
        const overlay = this.add.container(0, 0).setDepth(5000);
        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.9);
        const ring = this.add.graphics();
        ring.lineStyle(10, 0x39ff14, 0.9);
        ring.strokeCircle(width / 2, height / 2, Math.min(width, height) * 0.18);

        const title = this.add.text(width / 2, height / 2 - 58, 'PARASITE MAZE', {
            fontSize: height < 560 ? '40px' : '68px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#39ff14',
            stroke: '#000000',
            strokeThickness: height < 560 ? 9 : 13,
            align: 'center'
        }).setOrigin(0.5).setScale(0.2).setAlpha(0);

        const sub = this.add.text(width / 2, height / 2 + 40, 'Eat every parasite. Power pellets turn you into your Chigga.', {
            fontSize: height < 560 ? '17px' : '25px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center',
            wordWrap: { width: width - 40 }
        }).setOrigin(0.5).setAlpha(0);

        overlay.add([shade, ring, title, sub]);

        this.tweens.add({ targets: title, scaleX: 1, scaleY: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' });
        this.tweens.add({ targets: sub, alpha: 1, y: sub.y + 8, duration: 360, delay: 240 });
        this.tweens.add({ targets: ring, scaleX: 4, scaleY: 4, alpha: 0, duration: 900, ease: 'Cubic.easeOut' });

        this.time.delayedCall(1350, () => {
            this.tweens.add({
                targets: overlay,
                alpha: 0,
                duration: 280,
                onComplete: () => overlay.destroy(true)
            });
            this.pausedForHit = false;
            this.startTime = this.time.now;
            this._setDirection(1, 0);
        });
    }

    update(time, delta) {
        if (this.gameOver || this.pausedForHit) return;

        this._handleInput();
        this._movePlayerStep(time);
        this._moveEnemiesStep(time);
        this._animatePellets(time);
        this._checkEnemyContact();
        this._updatePowerMode(time);
        this._updateHUD();
    }

    _handleInput() {
        if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.wasd.A)) this._setDirection(-1, 0);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.wasd.D)) this._setDirection(1, 0);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.W)) this._setDirection(0, -1);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.S)) this._setDirection(0, 1);

        const pad = this.input.gamepad?.getPad(0);
        if (!pad) return;

        const axisX = pad.axes?.[0]?.getValue?.() ?? 0;
        const axisY = pad.axes?.[1]?.getValue?.() ?? 0;

        if (Math.abs(axisX) > 0.45 || Math.abs(axisY) > 0.45) {
            if (Math.abs(axisX) > Math.abs(axisY)) this._setDirection(axisX > 0 ? 1 : -1, 0);
            else this._setDirection(0, axisY > 0 ? 1 : -1);
        }

        if (pad.left) this._setDirection(-1, 0);
        if (pad.right) this._setDirection(1, 0);
        if (pad.up) this._setDirection(0, -1);
        if (pad.down) this._setDirection(0, 1);
    }

    _setDirection(x, y) {
        this.nextDir = { x, y };
    }

    _movePlayerStep(time) {
        if (this.playerMoving) return;

        if (this._canMoveFromCell(this.playerCell, this.nextDir, true)) {
            this.currentDir = { ...this.nextDir };
        }

        if (!this._canMoveFromCell(this.playerCell, this.currentDir, true)) return;

        const rawNextCell = {
            row: this.playerCell.row + this.currentDir.y,
            col: this.playerCell.col + this.currentDir.x
        };
        const nextCell = this._wrapCell(rawNextCell);
        const usedTunnel = rawNextCell.col !== nextCell.col;

        if (usedTunnel) {
            this.playerMoving = true;
            this.tweens.add({
                targets: this.player,
                alpha: 0,
                scaleX: 0.25,
                scaleY: 0.25,
                duration: 90,
                ease: 'Sine.easeIn',
                onComplete: () => {
                    this.playerCell = nextCell;
                    this.player.setPosition(this._cellCenterX(nextCell.col), this._cellCenterY(nextCell.row));
                    this._eatPelletAtCell(nextCell.row, nextCell.col);

                    this.player.setDisplaySize(
                        this.tile * (this._isPowerMode() ? 1.26 : 0.96),
                        this.tile * (this._isPowerMode() ? 1.26 : 0.96)
                    );

                    this.tweens.add({
                        targets: this.player,
                        alpha: 1,
                        duration: 110,
                        ease: 'Back.easeOut',
                        onComplete: () => {
                            this.playerMoving = false;
                        }
                    });
                }
            });
        } else {
            this._tweenSpriteToCell(this.player, nextCell, this._playerMoveDuration(), () => {
                this.playerCell = nextCell;
                this.playerMoving = false;
                this._eatPelletAtCell(nextCell.row, nextCell.col);
            });

            this.playerMoving = true;
        }

        if (this.currentDir.x !== 0) this.player.setFlipX(this.currentDir.x < 0);
    }

    _playerMoveDuration() {
        return this._isPowerMode() ? 92 : 108;
    }

    _moveEnemiesStep(time) {
        const moveDelay = this._isPowerMode() ? 440 : 330;

        this.enemies.forEach((enemy, index) => {
            if (!enemy || !enemy.active || enemy._moving) return;
            if (time < (enemy._nextMoveAt || 0)) return;

            const dir = this._chooseEnemyDir(enemy, index);
            if (!this._canMoveFromCell(enemy._cell, dir)) {
                enemy._nextMoveAt = time + 120;
                return;
            }

            const nextCell = {
                row: enemy._cell.row + dir.y,
                col: enemy._cell.col + dir.x
            };

            enemy._dir = dir;
            enemy._moving = true;
            enemy._nextMoveAt = time + moveDelay;

            this._tweenSpriteToCell(enemy, nextCell, moveDelay, () => {
                enemy._cell = nextCell;
                enemy._moving = false;
            });

            if (dir.x !== 0) enemy.setFlipX(dir.x < 0);
        });
    }

    _chooseEnemyDir(enemy, index) {
        const dirs = [DIRS.LEFT, DIRS.RIGHT, DIRS.UP, DIRS.DOWN]
            .filter(d => this._canMoveFromCell(enemy._cell, d));

        if (dirs.length === 0) return DIRS.NONE;

        const opposite = { x: -enemy._dir.x, y: -enemy._dir.y };
        const filtered = dirs.length > 1 ? dirs.filter(d => !sameDir(d, opposite)) : dirs;
        const pool = filtered.length > 0 ? filtered : dirs;

        const scared = this._isPowerMode() || enemy._scared;

        pool.sort((a, b) => {
            const ax = enemy._cell.col + a.x;
            const ay = enemy._cell.row + a.y;
            const bx = enemy._cell.col + b.x;
            const by = enemy._cell.row + b.y;

            const da = Phaser.Math.Distance.Between(ax, ay, this.playerCell.col, this.playerCell.row);
            const db = Phaser.Math.Distance.Between(bx, by, this.playerCell.col, this.playerCell.row);

            return scared ? db - da : da - db;
        });

        const chaseChance = scared ? 0.98 : (index < 2 ? 0.62 : 0.42);
        if (Math.random() < chaseChance) return pool[0];

        return pool[Math.floor(Math.random() * pool.length)];
    }

    _tweenSpriteToCell(sprite, cell, duration, onComplete) {
        this.tweens.add({
            targets: sprite,
            x: this._cellCenterX(cell.col),
            y: this._cellCenterY(cell.row),
            duration,
            ease: 'Linear',
            onComplete
        });
    }

    _isTunnelRow(row) {
        if (row < 0 || row >= this.rows) return false;
        const line = MAZE[row] || '';
        return line[0] !== '#' && line[this.cols - 1] !== '#';
    }

    _wrapCell(cell) {
        if (!cell) return cell;

        if (this._isTunnelRow(cell.row) && cell.col < 0) {
            return { row: cell.row, col: this.cols - 1 };
        }

        if (this._isTunnelRow(cell.row) && cell.col >= this.cols) {
            return { row: cell.row, col: 0 };
        }

        return cell;
    }

    _canMoveFromCell(cell, dir, allowTunnel = false) {
        if (!cell || !dir || (dir.x === 0 && dir.y === 0)) return false;

        const row = cell.row + dir.y;
        const col = cell.col + dir.x;

        if (allowTunnel && this._isTunnelRow(row) && (col < 0 || col >= this.cols)) {
            return true;
        }

        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return false;
        return MAZE[row][col] !== '#';
    }

    _eatPelletAtCell(row, col) {
        const key = `${row}_${col}`;
        const pellet = this.pellets.get(key);
        if (!pellet || !pellet.active) return;

        const isPower = !!pellet._isPowerPellet;
        pellet.destroy(true);
        this.pellets.delete(key);
        this.pelletsLeft -= 1;

        if (isPower) playMazePower();
        else playMazePellet();

        this.score += isPower ? 300 : 100;
        this._showFloat(isPower ? 'POWER!' : '+100', this._cellCenterX(col), this._cellCenterY(row), isPower ? 0xffdd00 : 0x39ff14);

        if (isPower) this._activatePowerMode();

        if (this.pelletsLeft <= 0) {
            this._win();
        }
    }

    _activatePowerMode() {
        this.powerModeUntil = this.time.now + 8000;
        this.player.setTexture(this.powerChiggaKey);
        this.player.setDisplaySize(this.tile * 1.26, this.tile * 1.26);
        this.player.setTint(0xffdd00);

        this.enemies.forEach(enemy => {
            if (enemy && enemy.active) enemy.setTint(0x66ccff);
        });

        this.cameras.main.flash(180, 255, 221, 0);
        this.cameras.main.shake(160, 0.008);
    }

    _isPowerMode() {
        return this.time.now < this.powerModeUntil;
    }

    _updatePowerMode(time) {
        if (this._isPowerMode()) {
            const remaining = Math.max(0, Math.ceil((this.powerModeUntil - time) / 1000));
            this.powerText.setText(`POWER CHIGGA: ${remaining}s`);
            this.player.rotation = Math.sin(time * 0.012) * 0.08;

            this.enemies.forEach(enemy => {
                if (!enemy || enemy._eatenPause || !enemy.visible) return;
                enemy.setTint(0x008cff);
                enemy.setAlpha(0.78);
                enemy._scared = true;
            });

            return;
        }

        if (this.powerText?.text) this.powerText.setText('');
        if (this.player.texture?.key !== this.soldierKey) {
            this.player.setTexture(this.soldierKey);
            this.player.setDisplaySize(this.tile * 0.96, this.tile * 0.96);
            this.player.clearTint();
            this.player.rotation = 0;
            this.enemies.forEach(enemy => {
                if (!enemy || enemy._eatenPause) return;
                enemy.clearTint();
                enemy.setAlpha(1);
                enemy._scared = false;
            });
        }
    }

    _checkEnemyContact() {
        if (this.pausedForHit || this.gameOver) return;

        for (const enemy of this.enemies) {
            if (!enemy || !enemy.active || enemy._eatenPause || !enemy.visible) continue;

            const sameCell = enemy._cell.row === this.playerCell.row && enemy._cell.col === this.playerCell.col;
            const adjacentCell = Math.abs(enemy._cell.row - this.playerCell.row) + Math.abs(enemy._cell.col - this.playerCell.col) <= 1;
            const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
            const powerMode = this._isPowerMode();

            const close = distance < (powerMode ? this.tile * 1.75 : this.tile * 0.55);

            if (!sameCell && !(powerMode && adjacentCell) && !close) continue;

            if (powerMode) {
                this._eatEnemy(enemy);
            } else {
                this._hitEnemy();
                return;
            }
        }
    }

    _eatEnemy(enemy) {
        if (!enemy || enemy._eatenPause) return;

        playMazeEnemyEat();
        enemy._eatenPause = true;
        enemy._scared = false;
        this.score += 500;
        this._showFloat('+500', enemy.x, enemy.y, 0xffdd00);

        const startX = enemy.x;
        const startY = enemy.y;
        const homeX = this._cellCenterX(enemy._spawn.col);
        const homeY = this._cellCenterY(enemy._spawn.row);

        this.tweens.killTweensOf(enemy);
        enemy.setVisible(false);
        enemy.setAlpha(0);
        enemy._cell = { row: -99, col: -99 };
        enemy.setPosition(-9999, -9999);

        const eyes = this._createFloatingEyes(startX, startY);

        this.tweens.add({
            targets: eyes,
            x: homeX,
            y: homeY,
            duration: 620,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                enemy._cell = { ...enemy._spawn };
                enemy.setPosition(homeX, homeY);
                enemy._moving = false;
                enemy._nextMoveAt = this.time.now + 7000;

                const waitText = this.add.text(homeX, homeY - this.tile * 0.75, '7', {
                    fontSize: Math.max(16, Math.floor(this.tile * 0.55)) + 'px',
                    fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 4
                }).setOrigin(0.5).setDepth(52);

                let remaining = 7;
                const countdown = this.time.addEvent({
                    delay: 1000,
                    repeat: 6,
                    callback: () => {
                        remaining -= 1;

                        if (remaining > 0) {
                            waitText.setText(String(remaining));
                            return;
                        }

                        countdown.remove(false);
                        waitText.destroy();
                        eyes.destroy(true);

                        enemy.setVisible(true);
                        enemy.setAlpha(this._isPowerMode() ? 0.78 : 1);
                        enemy.setScale(1);
                        enemy.setDisplaySize(this.tile * 0.92, this.tile * 0.92);
                        enemy._eatenPause = false;
                        enemy._moving = false;

                        if (this._isPowerMode()) {
                            enemy.setTint(0x008cff);
                            enemy._scared = true;
                        } else {
                            enemy.clearTint();
                            enemy._scared = false;
                        }
                    }
                });
            }
        });
    }

    _createFloatingEyes(x, y) {
        const eyes = this.add.container(x, y).setDepth(54);
        const eyeW = Math.max(8, this.tile * 0.22);
        const eyeH = Math.max(10, this.tile * 0.28);
        const gap = Math.max(5, this.tile * 0.14);

        const leftEye = this.add.ellipse(-gap, 0, eyeW, eyeH, 0xffffff, 1);
        const rightEye = this.add.ellipse(gap, 0, eyeW, eyeH, 0xffffff, 1);
        const leftPupil = this.add.circle(-gap + eyeW * 0.12, eyeH * 0.08, Math.max(2, eyeW * 0.20), 0x000000, 1);
        const rightPupil = this.add.circle(gap + eyeW * 0.12, eyeH * 0.08, Math.max(2, eyeW * 0.20), 0x000000, 1);

        eyes.add([leftEye, rightEye, leftPupil, rightPupil]);

        this.tweens.add({
            targets: eyes,
            y: y - 5,
            duration: 170,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        return eyes;
    }

    _hitEnemy() {
        if (this.pausedForHit || this.gameOver) return;

        playMazeDeath();
        this.lives -= 1;
        this.cameras.main.shake(240, 0.012);
        this.cameras.main.flash(220, 255, 0, 0);

        if (this.lives <= 0) {
            this.score = 0;
            this._lose();
            return;
        }

        this.pausedForHit = true;
        this._showFloat(`LIFE LOST! ${this.lives} LEFT`, this.player.x, this.player.y - 20, 0xff3333);
        this._resetPositions();

        this.time.delayedCall(900, () => {
            this.pausedForHit = false;
            this._setDirection(1, 0);
        });
    }

    _resetPositions() {
        this.tweens.killTweensOf(this.player);
        this.playerCell = { ...this.spawnCell };
        this.player.setPosition(this._cellCenterX(this.spawnCell.col), this._cellCenterY(this.spawnCell.row));
        this.playerMoving = false;
        this.currentDir = { ...DIRS.NONE };
        this.nextDir = { ...DIRS.NONE };

        this.enemies.forEach(enemy => {
            this.tweens.killTweensOf(enemy);
            enemy._cell = { ...enemy._spawn };
            enemy.setPosition(this._cellCenterX(enemy._spawn.col), this._cellCenterY(enemy._spawn.row));
            enemy._moving = false;
            enemy._nextMoveAt = this.time.now + 500;
        });
    }

    _win() {
        if (this.gameOver) return;
        this.gameOver = true;
        playMiniGameWin();
        const elapsed = this.startTime ? Math.max(1, Math.floor((this.time.now - this.startTime) / 1000)) : 1;
        const timeBonus = Math.max(500, 6000 - elapsed * 80);
        this.score += timeBonus;
        this._saveBest();
        this._showEndPanel(true, elapsed, timeBonus);
    }

    _lose() {
        if (this.gameOver) return;
        this.gameOver = true;
        this.score = 0;
        this._showEndPanel(false, 0, 0);
    }

    _showEndPanel(won, elapsed, bonus) {
        const { width, height } = this.scale;
        const overlay = this.add.container(0, 0).setDepth(6000);
        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.88);
        const panelW = Math.min(560, width - 34);
        const panelH = Math.min(360, height - 42);
        const panelX = width / 2;
        const panelY = height / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x111111, 0.98);
        panel.fillRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 22);
        panel.lineStyle(5, won ? 0x39ff14 : 0xff3333, 0.92);
        panel.strokeRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 22);

        const title = this.add.text(panelX, panelY - panelH / 2 + 62, won ? 'MAZE CLEARED!' : 'INFESTED!', {
            fontSize: height < 560 ? '34px' : '50px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: won ? '#39ff14' : '#ff3333',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        const lines = won
            ? [`Time: ${elapsed}s`, `Time Bonus: +${bonus}`, `Final Score: ${this.score}`, '', 'Reward unlocks in the next pass.']
            : ['Lives Lost: 3/3', 'Final Score: 0', '', 'Clear the maze to score.'];

        const body = this.add.text(panelX, panelY - 4, lines.join('\n'), {
            fontSize: height < 560 ? '16px' : '22px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5);

        overlay.add([shade, panel, title, body]);

        if (this.storyMode) {
            this._createButton(panelX, panelY + panelH / 2 - 58, 'CONTINUE', won ? 0x225522 : 0xaa1111, () => {
                this._returnToMenu();
            }, 220, 48, 20, overlay);
        } else {
            this._createButton(panelX - 120, panelY + panelH / 2 - 58, 'PLAY AGAIN', 0x225522, () => {
                this.scene.restart({ returnScene: this.returnScene, returnData: this.returnData, storyMode: this.storyMode });
            }, 190, 46, 18, overlay);

            this._createButton(panelX + 120, panelY + panelH / 2 - 58, 'BACK', 0xaa1111, () => {
                this._returnToMenu();
            }, 190, 46, 18, overlay);
        }
    }

    _updateHUD() {
        if (this.statusText) this.statusText.setText(`Lives: ${this.lives}  |  Score: ${this.score}`);
        if (this.pelletText) this.pelletText.setText(`Parasites: ${this.pelletsLeft}`);
    }

    _animatePellets(time) {
        this.pellets.forEach(p => {
            if (!p || !p.active) return;
            p.y = p._baseY + Math.sin(time * 0.006 + p._phase) * 2.2;
            p.rotation += p._isPowerPellet ? 0.04 : 0.03;
            if (p._glow) p._glow.setScale(1 + Math.sin(time * 0.009 + p._phase) * 0.12);
        });
    }

    _saveBest() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            const bestScore = Math.max(Number(parsed.bestScore || 0), this.score);
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                ...parsed,
                bestScore,
                completedOnce: true,
                storyUnlocked: !!(parsed.storyUnlocked || this.storyMode),
                lastScore: this.score
            }));
        } catch (e) {}
    }

    _showFloat(text, x, y, color = 0xffffff) {
        const t = this.add.text(x, y, text, {
            fontSize: '20px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: Phaser.Display.Color.IntegerToColor(color).rgba,
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(3000);

        this.tweens.add({
            targets: t,
            y: y - 36,
            alpha: 0,
            duration: 520,
            ease: 'Sine.easeOut',
            onComplete: () => t.destroy()
        });
    }

    _createDpadButton(x, y, label, onClick) {
        return this._createButton(x, y, label, 0x222222, onClick, 42, 38, 18);
    }

    _createButton(x, y, text, color, onClick, w = 180, h = 46, fz = 18, container = null) {
        const btn = this.add.container(x, y).setDepth(1000);
        const bg = this.add.graphics();

        const draw = (fillColor) => {
            bg.clear();
            bg.fillStyle(fillColor, 1);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
            bg.lineStyle(4, 0xffffff, 0.7);
            bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
        };

        draw(color);

        const label = this.add.text(0, 0, text, {
            fontSize: `${fz}px`,
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        btn.add([bg, label]);
        btn.setSize(w, h);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => draw(Phaser.Display.Color.IntegerToColor(color).lighten(18).color));
        btn.on('pointerout', () => draw(color));
        btn.on('pointerdown', () => {
            this.tweens.add({
                targets: btn,
                scaleX: 0.92,
                scaleY: 0.92,
                duration: 80,
                yoyo: true,
                onComplete: onClick
            });
        });

        if (container) container.add(btn);
        return btn;
    }

    _cellCenterX(col) {
        return this.offsetX + col * this.tile + this.tile / 2;
    }

    _cellCenterY(row) {
        return this.offsetY + row * this.tile + this.tile / 2;
    }

    _returnToMenu() {
        this.scene.start(this.returnScene || 'MenuScene', this.returnData || {});
    }

    _cleanup() {}
}

// CHIGGAS_GAMEPLAY_STABILITY_PASS_92A_REPAIR_MAZE_BEGIN
try {
    if (!ParasiteMazeScene.prototype.__chiggasPass92ARepairInstalled) {
        ParasiteMazeScene.prototype.__chiggasPass92ARepairInstalled = true;

        const __pass92AOrigCreate = ParasiteMazeScene.prototype.create;
        ParasiteMazeScene.prototype.create = function(...args) {
            const result = __pass92AOrigCreate.apply(this, args);
            try {
                this.__pass92AButtons = [];
                this.__pass92ASelectedButtonIndex = 0;
                this.__pass92AGamepadCooldownAt = 0;
                this.input?.gamepad?.once?.('connected', () => {});
            } catch (_) {}
            return result;
        };

        const __pass92AOrigShowEnd = ParasiteMazeScene.prototype._showEndPanel;
        if (typeof __pass92AOrigShowEnd === 'function') {
            ParasiteMazeScene.prototype._showEndPanel = function(...args) {
                try {
                    this.__pass92AButtons = [];
                    this.__pass92ASelectedButtonIndex = 0;
                } catch (_) {}
                return __pass92AOrigShowEnd.apply(this, args);
            };
        }

        const __pass92AOrigCreateButton = ParasiteMazeScene.prototype._createButton;
        if (typeof __pass92AOrigCreateButton === 'function') {
            ParasiteMazeScene.prototype._createButton = function(...args) {
                const btn = __pass92AOrigCreateButton.apply(this, args);
                try {
                    const label = String(args[2] || '').toUpperCase();
                    const onClick = args[4];
                    if (btn && typeof onClick === 'function') {
                        btn.__pass92AAction = onClick;
                        btn.__pass92ALabel = label;
                        this.__pass92AButtons = this.__pass92AButtons || [];
                        this.__pass92AButtons.push(btn);
                    }
                } catch (_) {}
                return btn;
            };
        }

        ParasiteMazeScene.prototype.__pass92APad = function() {
            try { return this.input?.gamepad?.getPad?.(0) || null; } catch (_) { return null; }
        };

        ParasiteMazeScene.prototype.__pass92AButtonDown = function(pad, indexes) {
            try { return indexes.some(i => !!pad?.buttons?.[i]?.pressed); } catch (_) { return false; }
        };

        ParasiteMazeScene.prototype.__pass92AActiveButtons = function() {
            try {
                return (this.__pass92AButtons || []).filter(btn => btn && btn.active !== false && btn.visible !== false && typeof btn.__pass92AAction === 'function');
            } catch (_) {
                return [];
            }
        };

        ParasiteMazeScene.prototype.__pass92ADrawButtonHighlight = function(btn) {
            try {
                if (!this.__pass92AButtonRing) this.__pass92AButtonRing = this.add.graphics().setDepth(6200).setScrollFactor(0);
                this.__pass92AButtonRing.clear();
                if (!btn) return;
                const w = btn.input?.hitArea?.width || btn.width || 190;
                const h = btn.input?.hitArea?.height || btn.height || 46;
                this.__pass92AButtonRing.lineStyle(4, 0xffdd00, 1);
                this.__pass92AButtonRing.strokeRoundedRect(btn.x - w / 2 - 6, btn.y - h / 2 - 6, w + 12, h + 12, 16);
            } catch (_) {}
        };

        ParasiteMazeScene.prototype.__pass92APressSelectedButton = function() {
            const buttons = this.__pass92AActiveButtons();
            if (!buttons.length) return false;
            const btn = buttons[Phaser.Math.Clamp(this.__pass92ASelectedButtonIndex || 0, 0, buttons.length - 1)];
            if (!btn || typeof btn.__pass92AAction !== 'function') return false;
            try { btn.__pass92AAction(); } catch (_) {}
            return true;
        };

        ParasiteMazeScene.prototype.__pass92AUpdateGamepadButtons = function(time = 0) {
            const buttons = this.__pass92AActiveButtons();
            if (!buttons.length) return;

            const pad = this.__pass92APad();
            if (!pad) return;
            if (time < (this.__pass92AGamepadCooldownAt || 0)) return;

            const left = this.__pass92AButtonDown(pad, [14]) || (pad.axes?.[0]?.getValue?.() ?? 0) < -0.45;
            const right = this.__pass92AButtonDown(pad, [15]) || (pad.axes?.[0]?.getValue?.() ?? 0) > 0.45;
            const accept = this.__pass92AButtonDown(pad, [0, 9]);
            const cancel = this.__pass92AButtonDown(pad, [1, 8]);

            if (left || right) {
                this.__pass92ASelectedButtonIndex = Phaser.Math.Wrap((this.__pass92ASelectedButtonIndex || 0) + (left ? -1 : 1), 0, buttons.length);
                this.__pass92ADrawButtonHighlight(buttons[this.__pass92ASelectedButtonIndex]);
                this.__pass92AGamepadCooldownAt = time + 180;
                return;
            }

            if (accept) {
                if (this.__pass92APressSelectedButton()) this.__pass92AGamepadCooldownAt = time + 260;
                return;
            }

            if (cancel) {
                this._returnToMenu?.();
                this.__pass92AGamepadCooldownAt = time + 260;
                return;
            }

            this.__pass92ADrawButtonHighlight(buttons[this.__pass92ASelectedButtonIndex || 0]);
        };

        const __pass92AOrigUpdate = ParasiteMazeScene.prototype.update;
        ParasiteMazeScene.prototype.update = function(time, delta) {
            if (typeof __pass92AOrigUpdate === 'function') __pass92AOrigUpdate.call(this, time, delta);
            try { this.__pass92AUpdateGamepadButtons(time); } catch (_) {}
        };
    }
} catch (error) {
    console.warn('[Chiggas] Gameplay Stability Pass 92A Maze repair failed safely:', error);
}
// CHIGGAS_GAMEPLAY_STABILITY_PASS_92A_REPAIR_MAZE_END

