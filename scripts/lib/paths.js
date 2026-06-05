const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME_DIR = path.join(ROOT, 'game');
const PLATFORMS_DIR = path.join(ROOT, 'platforms');
const STEAM_DIR = path.join(PLATFORMS_DIR, 'steam-electron');
const ANDROID_DIR = path.join(PLATFORMS_DIR, 'android-capacitor');
const INTEGRATIONS_DIR = path.join(ROOT, 'integrations');
const STEAM_INTEGRATIONS_DIR = path.join(INTEGRATIONS_DIR, 'steam');
const ANDROID_WWW_DIR = path.join(ANDROID_DIR, 'www');
const ANDROID_PUBLIC_DIR = path.join(ANDROID_DIR, 'android', 'app', 'src', 'main', 'assets', 'public');
const STEAM_GAME_DIR = path.join(STEAM_DIR, 'game');

module.exports = {
  ROOT,
  GAME_DIR,
  PLATFORMS_DIR,
  STEAM_DIR,
  ANDROID_DIR,
  INTEGRATIONS_DIR,
  STEAM_INTEGRATIONS_DIR,
  ANDROID_WWW_DIR,
  ANDROID_PUBLIC_DIR,
  STEAM_GAME_DIR
};
