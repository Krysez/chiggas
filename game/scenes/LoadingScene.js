import Phaser from 'phaser';
import { getAllSkins } from './SkinRegistry.js';

export default class LoadingScene extends Phaser.Scene {
    constructor() {
        super('LoadingScene');
    }

    preload() {
        this.load.image('tutorial-page', 'assets/chiggas-tutorial.png');
        const { width, height } = this.scale;
        
        // Progress bar
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
        
        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });
        
        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            this.scene.start('IntroScene');
        });

        // Load game assets
        this.load.image('skin-texture', 'assets/skin-texture.webp');
        this.load.image('skin-brown', 'assets/brown-skin.png');
        this.load.image('skin-pale', 'assets/pale-skin.png');
        this.load.image('skin-dog', 'assets/dog-fur.png');
        this.load.image('player', 'assets/my-chigga.png');
        this.load.image('game-title', 'assets/chiggas-title.png');
        this.load.image('game-featured', 'assets/chiggas-featured-image.webp');
        this.load.image('game-title-new', 'assets/chiggas-title-image.png');
        this.load.image('chigga-neutral', 'assets/soldier-denim-red.png');
        this.load.image('chigga-blue', 'assets/chigga-blue-swag-new.webp');
        this.load.image('chigga-green', 'assets/chigga-green-swag.webp');
        this.load.image('purple-gang-commander', 'assets/purple-gang-commander.png');
        this.load.image('purple-gang-minion', 'assets/purple-gang-minion.png');
        this.load.image('orange-gang-commander', 'assets/orange-gang-commander.png');
        this.load.image('orange-gang-minion', 'assets/orange-gang-minion.png');
        this.load.image('mite-wild', 'assets/mite-wild-new.webp');
        this.load.image('powerup-speed', 'assets/powerup-speed.webp');
        this.load.image('powerup-pistol', 'assets/powerup-pistol.webp');
        this.load.image('powerup-rifle', 'assets/chigga-rifle.png');
        this.load.image('bullet', 'assets/bullet.webp');
        this.load.image('follicle', 'assets/skin-follicle-base.webp');
        this.load.image('grass-lawn', 'assets/grass-lawn.webp');
        this.load.image('cockroach-czar', 'assets/cockroach-czar.png');
        this.load.image('hud-avatar-panel', 'assets/hud-avatar-panel.png');
        this.load.image('hud-soldier-circle', 'assets/hud-soldier-circle.png');
        this.load.image('mobile-btn-recruit', 'assets/mobile-btn-recruit.png');
        this.load.image('mobile-btn-eat', 'assets/mobile-btn-eat.png');
        this.load.image('mobile-btn-charge', 'assets/mobile-btn-charge.png');

        // Wardrobe cosmetic assets.
        // These must be loaded during LoadingScene, not only inside WardrobeScene,
        // so selected Soldier cosmetics are available when GameScene spawns/recruits army units.
        getAllSkins().forEach(skin => {
            if (!skin || !skin.assetKey || !skin.imagePath) return;
            if (skin.assetKey === 'player') return;
            if (this.textures.exists(skin.assetKey)) return;
            this.load.image(skin.assetKey, skin.imagePath);
        });

        // Audio assets
        this.load.audio('charge_cry', 'assets/audio/charge_cry.mp3');
        this.load.audio('gunshot', 'assets/audio/gunshot.mp3');
        this.load.audio('cartoon_munch', 'assets/audio/cartoon-munch.mp3');

        // Video assets
        this.load.video('leg-climb', 'assets/chigga-leg-climb.mp4', 'loadeddata', false, false);
        this.load.video('intro-video', 'assets/chiggas-intro.mp4', 'loadeddata', false, false);

        // Terrain decoration assets
        this.load.image('deco-hair',   'assets/skin-hair-follicle.webp');
        this.load.image('deco-pimple', 'assets/skin-pimple.webp');
        this.load.image('deco-bruise', 'assets/skin-bruise.webp');
        this.load.image('deco-tattoo', 'assets/skin-tattoo-tribal.webp');
    }
}