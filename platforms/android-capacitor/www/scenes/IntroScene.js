import Phaser from 'phaser';
import { getSafeBounds } from './ResponsiveLayout.js';

export default class IntroScene extends Phaser.Scene {
    constructor() {
        super('IntroScene');
    }

    create() {
        const { width, height } = this.scale;
        const safe = getSafeBounds(this, 10);

        this._hasStartedMenuTransition = false;
        this._videoStarted = false;
        this._domVideo = null;

        this.cameras.main.setBackgroundColor('#000000');
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 1).setDepth(0);

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
            duration: 550,
            ease: 'Sine.easeOut'
        });

        this._createDomVideo();

        const startOrSkip = () => {
            if (!this._videoStarted) {
                this._startIntroVideo();
                return;
            }

            this._goToTitleScreen();
        };

        this.input.once('pointerdown', startOrSkip);
        this.input.keyboard.once('keydown', startOrSkip);

        if (this.input.gamepad) {
            this.input.gamepad.once('down', startOrSkip);
        }

        // Try to autoplay. If the browser blocks autoplay, the first tap/key will start it.
        this.time.delayedCall(250, () => {
            this._startIntroVideo();
        });

        // Safety fallback so the game never gets stuck on a broken video.
        this.time.delayedCall(65000, () => {
            this._goToTitleScreen();
        });

        this.scale.on('resize', this._handleResize, this);
        this.events.once('shutdown', () => this._cleanupIntroScene());
        this.events.once('destroy', () => this._cleanupIntroScene());
    }

    _createDomVideo() {
        this._removeDomVideo();

        const gameCanvas = this.game?.canvas;
        const parent = gameCanvas?.parentElement || document.body;

        const video = document.createElement('video');
        video.src = 'assets/chiggas-intro.mp4';
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

        // Ensure the parent can position the overlay correctly.
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.position === 'static') {
            parent.style.position = 'relative';
        }

        parent.appendChild(video);
        this._domVideo = video;

        video.addEventListener('ended', () => this._goToTitleScreen());
        video.addEventListener('error', () => this._goToTitleScreen());

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

    _startIntroVideo() {
        if (this._videoStarted || this._hasStartedMenuTransition) return;

        this._videoStarted = true;
        this._positionDomVideo();

        const video = this._domVideo;
        if (!video) {
            this._goToTitleScreen();
            return;
        }

        try {
            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {
                    // Autoplay may be blocked. The first user input will call this again or skip.
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

    _cleanupIntroScene() {
        this.scale.off('resize', this._handleResize, this);
        this._removeDomVideo();
    }

    _goToTitleScreen() {
        if (this._hasStartedMenuTransition) return;
        this._hasStartedMenuTransition = true;

        this._removeDomVideo();

        const { width, height } = this.scale;
        const fade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
            .setDepth(20);

        this.tweens.add({
            targets: fade,
            alpha: 1,
            duration: 450,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.scene.start('MenuScene');
            }
        });
    }
}