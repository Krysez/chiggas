# Steam Electron Runtime Modules

This folder holds the Steam wrapper runtime that is loaded from `main.js` and `preload.js`.

## Top-Level Loaders

- `steam-bridge-main.js`: creates the Steamworks bridge and registers core Steam/Input/Inventory/Purchase IPC.
- `steam-bridge-preload.js`: exposes the public renderer globals for Steam, Steam Input, inventory, purchases, runtime status, and controller debug.
- `steam-input-preload.js`: builds the renderer Steam Input bridge and native action polling runtime.
- `achievements-main.js`: installs the main-process achievement bridge, first-run hook, and achievement trace handlers.
- `achievements-preload.js`: exposes the public achievement APIs in the renderer.
- `achievements-preload-direct.js`: loads direct achievement event listeners.
- `achievements-preload-observers.js`: loads observer/map achievement helpers.
- `achievements-preload-progression.js`: loads progression achievement listeners.
- `leaderboards-main.js`: loads main-process leaderboard modules.
- `leaderboards-preload.js`: loads renderer leaderboard modules.
- `item-store-main.js`: loads live item-store main-process handlers.
- `item-store-preload.js`: exposes renderer item-store APIs.
- `item-store-legacy-blockers.js`: installs legacy item-store blockers/interceptors.
- `cloud-save-main.js`: exports Steam Cloud save snapshots.
- `fullscreen-main.js`: installs fullscreen and depot launch guards.

## Subfolders

- `achievements/`: renderer achievement listeners, split by achievement or small achievement group.
- `achievements-main/`: main-process achievement trace and harness handlers.
- `leaderboards/`: leaderboard capture, probe, auto-submit, and watchdog runtime modules.
- `item-store/`: main-process item-store URL/open handlers.

## Conventions

- Keep `main.js` and `preload.js` as orchestration files.
- Prefer adding a new feature under the closest runtime subfolder, then load it from the relevant top-level loader.
- Add any new required runtime file to `C:\ChiggasUnified\scripts\checks\check-steam-electron-runtime.js`.
- Preserve trace/log roots under the clean Steam wrapper root, not the original source folder.
- Run `npm run steam:check` from `C:\ChiggasUnified` after adding or moving runtime modules.
- Run `npm run runtime:report` from `C:\ChiggasUnified` to list large modules, loader files, and runtime groups.
