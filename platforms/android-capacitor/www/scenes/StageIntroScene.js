import Phaser from 'phaser';
import { getSafeBounds } from './ResponsiveLayout.js';

const STAGE_CUTSCENES = {
    0: {
        videoPath: 'assets/forearm-scratch.mp4',
        label: 'Stage 1'
    },
    1: {
        videoPath: 'assets/chigga-leg-climb.mp4',
        label: 'Stage 2'
    },
    2: {
        videoPath: 'assets/chigga-backscratch-scene.mp4',
        label: 'Stage 3'
    },
    3: {
        videoPath: 'assets/chigga-foot-party.mp4',
        label: 'Stage 4'
    },
    4: {
        videoPath: 'assets/pet-dog.mp4',
        label: 'Stage 5'
    }
};

export default class StageIntroScene extends Phaser.Scene {
    constructor() {
        super('StageIntroScene');
    }

    init(data) {
        this.targetGameData = data?.targetGameData ?? {
            stageIndex: 0,
            difficulty: 1,
            controlMode: 'touch'
        };

        this.stageIndex = this.targetGameData.stageIndex ?? 0;
        this.cutscene = STAGE_CUTSCENES[this.stageIndex] ?? null;
    }

    create() {
        const { width, height } = this.scale;
        const safe = getSafeBounds(this, 10);

        this._hasStartedGameTransition = false;
        this._videoStarted = false;
        this._domVideo = null;

        this.cameras.main.setBackgroundColor('#000000');
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 1).setDepth(0);

        if (!this.cutscene || !this.cutscene.videoPath) {
            this._goToGameScene();
            return;
        }

        this.stageLabel = this.add.text(width / 2, 34, this.cutscene.label.toUpperCase(), {
            fontSize: height < 600 ? '22px' : '28px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center'
        }).setOrigin(0.5).setDepth(5).setAlpha(0.95);

        this.promptText = this.add.text(safe.centerX, safe.bottom - 24, 'TAP / CLICK / PRESS ANY KEY TO SKIP', {
            fontSize: height < 600 ? '18px' : '22px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setDepth(5).setAlpha(0.8);

        this.tweens.add({
            targets: this.promptText,
            alpha: 0.25,
            duration: 850,
            yoyo: true,
            repeat: -1
        });

        this.fadeCover = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 1).setDepth(10);
        this.tweens.add({
            targets: this.fadeCover,
            alpha: 0,
            duration: 450,
            ease: 'Sine.easeOut'
        });

        this._createDomVideo(this.cutscene.videoPath);

        const startOrSkip = () => {
            if (!this._videoStarted) {
                this._startCutsceneVideo();
                return;
            }

            this._goToGameScene();
        };

        this.input.once('pointerdown', startOrSkip);
        this.input.keyboard.once('keydown', startOrSkip);

        if (this.input.gamepad) {
            this.input.gamepad.once('down', startOrSkip);
        }

        this.time.delayedCall(250, () => {
            this._startCutsceneVideo();
        });

        this.time.delayedCall(65000, () => {
            this._goToGameScene();
        });

        this.scale.on('resize', this._handleResize, this);
        this.events.once('shutdown', () => this._cleanupScene());
        this.events.once('destroy', () => this._cleanupScene());
    }

    _createDomVideo(videoPath) {
        this._removeDomVideo();

        const gameCanvas = this.game?.canvas;
        const parent = gameCanvas?.parentElement || document.body;

        const video = document.createElement('video');
        video.src = videoPath;
        video.preload = 'auto';
        video.playsInline = true;
        video.muted = false;
        video.autoplay = false;
        video.controls = false;
        video.disablePictureInPicture = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');

        video.style.position = 'absolute';
        video.style.left = '0px';
        video.style.top = '0px';
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.backgroundColor = 'black';
        video.style.zIndex = '20';
        video.style.pointerEvents = 'none';
        video.style.opacity = '1';

        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.position === 'static') {
            parent.style.position = 'relative';
        }

        parent.appendChild(video);
        this._domVideo = video;

        video.addEventListener('ended', () => this._goToGameScene());
        video.addEventListener('error', () => this._goToGameScene());

        this._positionDomVideo();
    }

    _positionDomVideo() {
        const video = this._domVideo;
        const canvas = this.game?.canvas;
        const parent = canvas?.parentElement;
        if (!video || !canvas || !parent) return;

        const canvasRect = canvas.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();

        video.style.left = `${canvasRect.left - parentRect.left}px`;
        video.style.top = `${canvasRect.top - parentRect.top}px`;
        video.style.width = `${canvasRect.width}px`;
        video.style.height = `${canvasRect.height}px`;
    }

    _startCutsceneVideo() {
        if (this._videoStarted || this._hasStartedGameTransition) return;

        this._videoStarted = true;
        this._positionDomVideo();

        const video = this._domVideo;
        if (!video) {
            this._goToGameScene();
            return;
        }

        try {
            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {
                    this._videoStarted = false;
                });
            }
        } catch (e) {
            this._videoStarted = false;
        }
    }

    _handleResize(gameSize) {
        const { width, height } = gameSize;
        const safe = getSafeBounds(this, 10);

        this._positionDomVideo();

        if (this.stageLabel) {
            this.stageLabel.setPosition(safe.centerX, safe.top + 24);
            this.stageLabel.setFontSize(height < 600 ? '22px' : '28px');
        }

        if (this.promptText) {
            this.promptText.setPosition(safe.centerX, safe.bottom - 24);
            this.promptText.setFontSize(height < 600 ? '18px' : '22px');
        }

        if (this.fadeCover) {
            this.fadeCover.setPosition(width / 2, height / 2);
            this.fadeCover.setSize(width, height);
        }
    }

    _removeDomVideo() {
        if (!this._domVideo) return;

        try {
            this._domVideo.pause();
            this._domVideo.removeAttribute('src');
            this._domVideo.load();
        } catch (e) {}

        try {
            if (this._domVideo.parentElement) {
                this._domVideo.parentElement.removeChild(this._domVideo);
            }
        } catch (e) {}

        this._domVideo = null;
    }

    _cleanupScene() {
        this.scale.off('resize', this._handleResize, this);
        this._removeDomVideo();
    }

    _goToGameScene() {
        if (this._hasStartedGameTransition) return;
        this._hasStartedGameTransition = true;

        this._removeDomVideo();

        const { width, height } = this.scale;
        const fade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
            .setDepth(20);

        this.tweens.add({
            targets: fade,
            alpha: 1,
            duration: 350,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.scene.start('GameScene', this.targetGameData);
            }
        });
    }
}

/* CHIGGAS_STEAM_PASS_97A_STAGE6_INTRO_VIDEO_FIX_BEGIN */
try {
    if (typeof STAGE_CUTSCENES !== 'undefined' && !STAGE_CUTSCENES.__chiggasPass97AStage6VideoFixInstalled) {
        STAGE_CUTSCENES.__chiggasPass97AStage6VideoFixInstalled = true;
        STAGE_CUTSCENES[5] = {
            videoPath: 'assets/dog-scratch-to-lawn-2.mp4',
            label: 'Stage 6'
        };
    }
} catch (error) {
    console.warn('[Chiggas] Steam Pass 97A Stage 6 intro video fix failed safely:', error);
}
/* CHIGGAS_STEAM_PASS_97A_STAGE6_INTRO_VIDEO_FIX_END */
