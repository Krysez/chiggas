import Phaser from 'phaser';
import LoadingScene from './scenes/LoadingScene.js';
import IntroScene from './scenes/IntroScene.js';
import StageIntroScene from './scenes/StageIntroScene.js';
import MenuScene from './scenes/MenuScene.js';
import WardrobeScene from './scenes/WardrobeScene.js';
import LegendaryStoreScene from './scenes/LegendaryStoreScene.js';
import HowToPlayScene from './scenes/TutorialScene.js';
import GameScene from './scenes/GameScene.js';
import LeaderboardScene from './scenes/LeaderboardScene.js';
import MemoryMatchScene from './scenes/MemoryMatchScene.js';
import ParasiteMazeScene from './scenes/ParasiteMazeScene.js';
import MiniGamesScene from './scenes/MiniGamesScene.js';
import MiniGamePromptScene from './scenes/MiniGamePromptScene.js';
import { exposeGamepadRuntimeDebug } from './scenes/GamepadRuntimeBridge.js';
import { installDemoAchievementSuppression } from './scenes/DemoMode.js';

exposeGamepadRuntimeDebug();
installDemoAchievementSuppression();

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: '100%',
        height: '100%'
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    input: {
        gamepad: true,
        activePointers: 4
    },
    scene: [
        LoadingScene,
        IntroScene,
        StageIntroScene,
        MenuScene,
        WardrobeScene,
        LegendaryStoreScene,
        HowToPlayScene,
        GameScene,
        LeaderboardScene,
        MemoryMatchScene,
        ParasiteMazeScene,
        MiniGamesScene,
        MiniGamePromptScene
    ]
};

new Phaser.Game(config);
