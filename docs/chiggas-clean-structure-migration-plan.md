# Chiggas Clean Structure Migration Plan

Generated: 2026-06-05

## Goal

Create a cleaner, stable, easier-to-update structure from:

- `C:\ChiggaStreamWrapper`
- `C:\Chiggas\Android\ChiggasAndroid`

The originals should remain untouched until the clean structure is created, checked, and explicitly accepted.

## Recommended New Root

Use one unified project root:

```text
C:\ChiggasUnified
  game\
  platforms\
    steam-electron\
    android-capacitor\
  integrations\
    steam\
    google-play\
  scripts\
    sync\
    checks\
    build\
    steam\
    android\
  archive\
    steam-passes\
    traces\
    backups\
    old-builds\
  docs\
```

This is better than two independent clean folders because the Steam and Android projects are already mostly the same Phaser game. A unified root prevents the game payloads from drifting.

## Current Read

### Shared Game

The live game payload exists in both:

- `C:\ChiggaStreamWrapper\game`
- `C:\Chiggas\Android\ChiggasAndroid\www`

Both identify as:

- Name: `Chiggas - Survival of the Mitiest`
- Export date: `2026-05-27T19:17:55.050Z`
- Asset count: `114`
- Asset types: `video`, `image`, `audio`, `text`, `file`

Hash comparison, excluding giant Phaser vendor JS and obvious backup files:

- Same common game files: `153`
- Different common files: `4`
- Different files:
  - `index.html`
  - `entities\TickTwins.js`
  - `scenes\GameScene.js`
  - `scenes\StageIntroScene.js`
- Missing in Android compared to Steam game: mostly Steam helper scripts and historical backup files
- Extra in Android compared to Steam game: mostly duplicated/alternate asset PNG names and Android sync scripts

Recommended source of truth: start from `C:\ChiggaStreamWrapper\game`, then review the four differing files and the Android-only assets before finalizing `C:\ChiggasUnified\game`.

### Steam Wrapper

`C:\ChiggaStreamWrapper` is an Electron/Steam wrapper.

Important live platform files:

- `main.js`
- `preload.js`
- `package.json`
- `package-lock.json`
- `steamworksBridgeCore.js`
- `steamworksBridgeSkeleton.js`
- `steam-cloud-save-export-pass-98a.js`
- `steam-leaderboards-pass-96a.js`
- `steam-leaderboards-backend-pass-96b.js`
- `steam-leaderboard-capture-pass-96c.js`
- `steam_input\`
- `steam_achievements\`
- `steamworks\`
- `steam-entitlement-backend\`
- live Steam helper payloads loaded by `game\index.html`

High-noise groups:

- `node_modules\`
- `steam_depot_build\`
- `backups\`
- `chiggas_steam_pass_*`
- root `pass*-trace.json`
- root `steam-achievement-*.log`
- root `steam-achievement-*.json`
- `game.zip`
- `final-release-cleanup-reports\`

Recommendation: active platform files move to `platforms\steam-electron`; pass folders, traces, logs, and old build artifacts move to `archive`.

### Android Wrapper

`C:\Chiggas\Android\ChiggasAndroid` is a Capacitor Android app.

Important live platform files:

- `package.json`
- `package-lock.json`
- `capacitor.config.json`
- `android\build.gradle`
- `android\settings.gradle`
- `android\variables.gradle`
- `android\gradle.properties`
- `android\gradlew`
- `android\gradlew.bat`
- `android\gradle\wrapper\`
- `android\app\build.gradle`
- `android\app\capacitor.build.gradle`
- `android\app\proguard-rules.pro`
- `android\app\src\main\`
- `android\capacitor-cordova-android-plugins\src\main\`
- `www\` as the current web payload

Important native code:

- `android\app\src\main\java\com\krysez\chiggas\MainActivity.java`
- `android\app\src\main\java\com\krysez\chiggas\GooglePlayBillingBridge.java`

High-noise groups:

- `node_modules\`
- `android\.gradle\`
- `android\.idea\`
- `android\build\`
- `android\app\build\`
- `android\capacitor-cordova-android-plugins\build\`
- `android\app\release\app-release.aab`
- `Chiggas - www - Backup.rar`

Recommendation: keep live Android project files in `platforms\android-capacitor`; regenerate build output later.

## Proposed Destination Mapping

```text
C:\ChiggaStreamWrapper\game
  -> C:\ChiggasUnified\game

C:\ChiggaStreamWrapper\main.js
C:\ChiggaStreamWrapper\preload.js
C:\ChiggaStreamWrapper\package.json
C:\ChiggaStreamWrapper\package-lock.json
  -> C:\ChiggasUnified\platforms\steam-electron

C:\ChiggaStreamWrapper\steam_input
  -> C:\ChiggasUnified\integrations\steam\input

C:\ChiggaStreamWrapper\steam_achievements
  -> C:\ChiggasUnified\integrations\steam\achievements

C:\ChiggaStreamWrapper\steamworks
C:\ChiggaStreamWrapper\steamworksBridgeCore.js
C:\ChiggaStreamWrapper\steamworksBridgeSkeleton.js
  -> C:\ChiggasUnified\integrations\steam\steamworks

C:\ChiggaStreamWrapper\steam-entitlement-backend
  -> C:\ChiggasUnified\integrations\steam\entitlement-backend

C:\Chiggas\Android\ChiggasAndroid\android
C:\Chiggas\Android\ChiggasAndroid\capacitor.config.json
C:\Chiggas\Android\ChiggasAndroid\package.json
C:\Chiggas\Android\ChiggasAndroid\package-lock.json
  -> C:\ChiggasUnified\platforms\android-capacitor

C:\ChiggaStreamWrapper\chiggas_steam_pass_*
  -> C:\ChiggasUnified\archive\steam-passes

trace/log files
  -> C:\ChiggasUnified\archive\traces

backup zips/rars/build outputs
  -> C:\ChiggasUnified\archive\backups or excluded
```

## Script Reference Cleanup

The scan found many path references that will become stale after migration:

- Steam wrapper path references: about `1496` matches outside excluded generated folders
- Android path references: about `174` matches outside excluded generated folders

Most Steam references are inside pass scripts, README files, generated checks, and historical apply scripts. These should not remain active in the clean project.

Active scripts should stop relying on hard-coded paths like:

- `C:\ChiggaStreamWrapper`
- `C:\Chiggas\Android\ChiggasAndroid`
- `C:\Program Files (x86)\Steam\steamapps\common\Chiggas\resources\app`
- `steam_depot_build\windows\resources\app`
- `src\main\assets\public`

Instead, use stable path helpers:

```js
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME_DIR = path.join(ROOT, 'game');
const STEAM_DIR = path.join(ROOT, 'platforms', 'steam-electron');
const ANDROID_DIR = path.join(ROOT, 'platforms', 'android-capacitor');
const STEAM_INTEGRATIONS_DIR = path.join(ROOT, 'integrations', 'steam');
```

For installed Steam app discovery, keep a dedicated helper:

```js
scripts\steam\find-installed-steam-app.js
```

For Android web sync, use one dedicated helper:

```js
scripts\sync\sync-game-to-android.js
```

For Steam web sync, use one dedicated helper:

```js
scripts\sync\sync-game-to-steam.js
```

## New Stable Commands

The current Steam `package.json` contains many pass-specific scripts. The clean version should expose fewer stable commands:

```json
{
  "scripts": {
    "steam:start": "node ../../scripts/checks/check-steam-runtime.js && electron .",
    "steam:build": "node ../../scripts/build/prepare-steam-build.js && electron-builder --win portable",
    "steam:check": "node ../../scripts/checks/check-steam-platform.js",
    "steam:wallet:check": "node ../../scripts/steam/check-wallet.js",
    "steam:leaderboards:check": "node ../../scripts/steam/check-leaderboards.js",
    "steam:achievements:check": "node ../../scripts/steam/check-achievements.js",
    "steam:input:check": "node ../../scripts/steam/check-input.js"
  }
}
```

Android stable commands:

```json
{
  "scripts": {
    "android:sync": "node ../../scripts/sync/sync-game-to-android.js",
    "android:check": "node ../../scripts/checks/check-android-platform.js",
    "android:billing:check": "node ../../scripts/android/check-billing-bridge.js"
  }
}
```

Unified root commands:

```json
{
  "scripts": {
    "check": "node scripts/checks/check-unified-project.js",
    "sync:steam": "node scripts/sync/sync-game-to-steam.js",
    "sync:android": "node scripts/sync/sync-game-to-android.js",
    "diff:platforms": "node scripts/checks/diff-platform-game-payloads.js"
  }
}
```

## Migration Phases

### Phase 1: Create Clean Structure

Create `C:\ChiggasUnified` and copy live source only.

Do not copy:

- `node_modules`
- build outputs
- `.gradle`
- `.idea`
- logs
- traces
- old generated depot app copies
- old compressed backups

Archive instead:

- pass folders
- pass traces
- old README/checklist pass docs
- manual backups

### Phase 2: Decide Canonical Game Files

Resolve the four game differences:

- `index.html`
- `entities\TickTwins.js`
- `scenes\GameScene.js`
- `scenes\StageIntroScene.js`

Recommended default: Steam game copy is canonical because it contains the newest pass 97/101/102-era fixes, but Android-only behavior must be checked before overwriting Android differences.

### Phase 3: Rewrite Active Script Paths

Create a small shared path helper module and update only active scripts.

Do not rewrite archived pass scripts unless they are reactivated later.

### Phase 4: Add Checks

Add checks that answer:

- Does unified `game\` exist and contain required entry files?
- Does Steam platform point to `..\..\game` or a synced game copy?
- Does Android `www\` match unified `game\`?
- Is real billing still locked unless explicitly armed?
- Are generated folders absent from the clean project?
- Are no active scripts pointing back at old absolute roots?

### Phase 5: Build/Run Validation

Steam:

- install dependencies
- run runtime checks
- start Electron
- verify game loads
- verify Steam bridges exist or safely report unavailable

Android:

- install dependencies
- sync web payload
- run Gradle sync/build
- verify fullscreen landscape
- verify Android back event
- verify billing bridge capability report
- keep real billing locked until product details and restore tests pass

## Risks

- `main.js` and `preload.js` are large and contain many appended pass blocks. Cleaning structure alone will not make those files architecturally clean.
- Some pass scripts patch multiple app roots, including installed Steam directories. Archived scripts should not be active by default.
- Android and Steam game payloads are close but not identical. The four differing files need review before a canonical game copy is declared.
- `.env` exists in the Steam wrapper. It should not be copied blindly into a shared archive or committed.
- Android build output includes an existing `.aab`; treat it as artifact/archive, not source.

## Recommended Next Step

Create `C:\ChiggasUnified` with live source only and add the first-generation sync/check scripts. Leave the original folders untouched.

After that, run:

```text
scripts\checks\diff-platform-game-payloads.js
scripts\checks\check-active-path-references.js
```

Then resolve the four canonical game-file differences before treating the unified game folder as final.
