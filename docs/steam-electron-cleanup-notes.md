# Steam Electron Cleanup Notes

Runtime module map: `platforms/steam-electron/runtime/README.md`

## 2026-06-05 Runtime Reference Cleanup

Removed stale main-process bridge blocks that required helper modules not present in either the original active Steam wrapper root or the clean unified workspace:

- `steamInventoryBackendBridgePass89`
- `steamStorePurchaseLinkPass91`
- `steamStoreItemStoreExternalPass91B`

The renderer-facing `ChiggasSteamBackend` name is still exposed for game compatibility, but it now aliases the current `ChiggasSteamInventory` IPC path instead of invoking the missing Pass 89 channel.

The renderer-facing `ChiggasSteamItemStoreExternal` name remains because `LegendaryStoreScene` uses it, and the live main-process item store handler is now supplied by the later dynamic URL handler blocks already present in `main.js`.

Validation after cleanup:

```powershell
cd C:\ChiggasUnified
npm run steam:check
npm run check
npm run paths:check
npm run diff:platforms

cd C:\ChiggasUnified\platforms\steam-electron
npm run steam:leaderboards:check
npm run steam:cloud:check
```

Expected result: all commands pass, and `npm run steam:check` reports an empty `optionalMissing` list.

## 2026-06-05 Item Store Runtime Extraction

Moved the live item-store main-process handlers out of `main.js` and into `runtime/item-store-main.js`.

Moved the legacy item-store blocker/interceptor blocks out of `main.js` and into `runtime/item-store-legacy-blockers.js`.

Moved the renderer-facing `ChiggasSteamItemStoreExternal` exposure out of `preload.js` and into `runtime/item-store-preload.js`.

`main.js` now installs item-store behavior through two named runtime calls: one for legacy blocking and one for the live item-store IPC handlers. The Steam package build list and runtime checker include `runtime/**/*.js`.

Split `runtime/item-store-main.js` into focused item-store handler modules:

- `item-store/hardwire-handler-main.js`
- `item-store/windows-open-chain-main.js`
- `item-store/dynamic-url-handler-main.js`

## 2026-06-05 Cloud Save Runtime Extraction

Moved Steam Cloud save exports into `runtime/cloud-save-main.js`.

`main.js` now calls `installRobustCloudSaveHooks(app)` at startup and `exportCloudSave(...)` for launch/before-quit events instead of carrying inline Pass 98A/98B cloud blocks.

## 2026-06-05 Achievement Main Runtime Extraction

Moved the main-process Steam achievement bridge, first-run hook, keyboard harness bootstrap, and Pass 38/42/44 achievement trace handlers into `runtime/achievements-main.js`.

`main.js` now installs achievement main-process behavior through `installAchievementBridgeAndLaunchHook()` and `installAchievementTraceHandlers()`.

Split `runtime/achievements-main.js` trace handlers into focused main-process modules:

- `achievements-main/keyboard-test-main.js`
- `achievements-main/runtime-scene-observer-main.js`
- `achievements-main/first-game-started-interaction-main.js`
- `achievements-main/first-store-visit-click-map-main.js`

## 2026-06-05 Achievement Preload API Extraction

Moved the renderer-facing Pass 32 achievement API and Pass 36 helper aliases into `runtime/achievements-preload.js`.

`preload.js` now exposes the public achievement APIs with `require('./runtime/achievements-preload').exposeAchievementApis()`.

## 2026-06-05 Achievement Preload Observer Extraction

Moved the Pass 38/42/44/46/48 preload observer and mapper cluster into `runtime/achievements-preload-observers.js`.

This keeps scene observation, first-game-started tracing, first-store-visit click mapping, and first-weapon-pickup input mapping out of the top-level preload file while preserving the original trace output location.

## 2026-06-05 Direct Achievement Preload Listener Extraction

Moved the Pass 52C/53/54/56/57/58A/60/63A/65/66C/68 direct achievement listener cluster into `runtime/achievements-preload-direct.js`.

This module covers direct custom-event achievement unlock routing for weapon pickup, speed boost, first shot, munch, recruited soldier, enemy defeated, survival minute, death, revenge run, and first legendary try-on.

## 2026-06-05 Progression Achievement Preload Listener Extraction

Moved the Pass 70/72/74/75/77 progression achievement listener cluster into `runtime/achievements-preload-progression.js`.

This module covers full legendary fit, all legendary wear, all base Chiggas, five-minute run, and Mitiest Survivor event routing.

Split `runtime/achievements-preload-progression.js` into focused progression achievement modules:

- `achievements/full-legendary-fit-preload.js`
- `achievements/all-legendary-wear-preload.js`
- `achievements/all-base-chiggas-preload.js`
- `achievements/five-minute-run-preload.js`
- `achievements/mitiest-survivor-preload.js`

## 2026-06-05 Leaderboard Main Runtime Extraction

Moved the main-process Pass 96A/96C/96C2A/96E/96F leaderboard runtime into `runtime/leaderboards-main.js`.

`main.js` now installs leaderboard main-process behavior with `require('./runtime/leaderboards-main').installLeaderboardMainRuntime()`.

## 2026-06-05 Leaderboard Preload Runtime Extraction

Moved the preload Pass 96A/96C/96C2A/96E/96F leaderboard runtime into `runtime/leaderboards-preload.js`.

`preload.js` now installs leaderboard renderer behavior with `require('./runtime/leaderboards-preload').installLeaderboardPreloadRuntime()`.

## 2026-06-05 Core Steam Bridge Preload Extraction

Moved the core preload Steam/Input bridge into `runtime/steam-bridge-preload.js`.

`preload.js` now loads the Steam/Input globals with `require('./runtime/steam-bridge-preload').exposeSteamBridgePreload(contextBridge, ipcRenderer)`.

Split Steam Input fallback prompts, native action polling, and controller diagnostics out of `runtime/steam-bridge-preload.js`:

- `steam-input-preload.js`

Split Steam Input fallback prompt helpers and controller diagnostics out of `runtime/steam-input-preload.js`:

- `steam-input-prompts-preload.js`
- `controller-diagnostics-preload.js`

## 2026-06-05 Fullscreen Main Runtime Extraction

Moved the Pass 96H and Pass 96G fullscreen/depot launch guards into `runtime/fullscreen-main.js`.

The fullscreen trace paths are now anchored to the clean Steam wrapper root instead of the original source folder.

## 2026-06-05 Core Steam Bridge Main Extraction

Moved Steamworks bridge creation and the desktop/Steam/Input/Inventory/Purchase IPC handlers into `runtime/steam-bridge-main.js`.

`main.js` now creates the bridge with `createSteamBridgeRuntime()` and registers IPC with `registerSteamBridgeIpc(...)`.

## 2026-06-05 Large Runtime Module Split

Split `runtime/leaderboards-preload.js` into focused submodules under `runtime/leaderboards/`:

- `api-capture-preload.js`
- `probe-preload.js`
- `auto-submit-preload.js`
- `watchdog-preload.js`

Split `runtime/leaderboards-main.js` into focused submodules under `runtime/leaderboards/`:

- `api-capture-main.js`
- `probe-main.js`
- `auto-submit-main.js`
- `watchdog-main.js`

Split the page-side Pass 96F leaderboard watchdog installer out of `runtime/leaderboards/watchdog-preload.js`:

- `watchdog-page-installer-preload.js`

Split the page-side Pass 96E leaderboard auto-submit installer out of `runtime/leaderboards/auto-submit-preload.js`:

- `auto-submit-page-installer-preload.js`

Split the page-side Pass 96C2A leaderboard probe installer out of `runtime/leaderboards/probe-preload.js`:

- `probe-page-installer-preload.js`

Split `runtime/achievements-preload-direct.js` into focused submodules under `runtime/achievements/`:

- `direct-weapon-actions-preload.js`
- `direct-combat-milestones-preload.js`
- `direct-survival-legendary-preload.js`

Split `runtime/achievements/direct-weapon-actions-preload.js` into focused weapon/action achievement modules:

- `first-weapon-pickup-event-preload.js`
- `first-speed-boost-preload.js`
- `first-shot-fired-preload.js`
- `first-munch-preload.js`
- `first-munch-counter-preload.js`

Split `runtime/achievements/direct-combat-milestones-preload.js` into focused combat achievement modules:

- `first-soldier-recruited-preload.js`
- `first-enemy-defeated-preload.js`
- `ten-enemies-defeated-preload.js`

Split `runtime/achievements/direct-survival-legendary-preload.js` into focused survival and legendary achievement modules:

- `first-survival-minute-preload.js`
- `first-death-preload.js`
- `revenge-run-preload.js`
- `first-legendary-tryon-preload.js`

Split `runtime/achievements-preload-observers.js` into focused submodules under `runtime/achievements/`:

- `runtime-scene-observer-preload.js`
- `first-game-started-interaction-preload.js`
- `first-store-visit-click-map-preload.js`
- `first-store-visit-coordinate-preload.js`
- `first-weapon-pickup-map-preload.js`
