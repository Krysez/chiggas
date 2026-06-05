# Structure Map

`C:\ChiggasUnified` is organized around one shared game source and two platform wrappers.

## Source Of Truth

- `game` contains the shared Phaser game payload.
- `integrations\steam` contains Steam-specific integration assets such as Steam Input, achievements, and Steamworks files.

## Platform Wrappers

- `platforms\steam-electron` contains the Steam/Electron shell and runtime bridge modules.
- `platforms\android-capacitor` contains the Android/Capacitor shell, native Android project, billing bridge, and synced web payloads.

## Support Folders

- `scripts\sync` moves shared game files into each platform wrapper.
- `scripts\checks` validates structure, path references, platform payloads, and runtime wiring.
- `scripts\lib` keeps shared script helpers.
- `docs` records cleanup decisions and future workflows.
- `archive` keeps historical pass metadata outside the active code path.

Run the live structure report with:

```powershell
cd C:\ChiggasUnified
npm run structure:report
```
