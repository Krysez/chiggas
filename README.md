# Chiggas Unified

Unified workspace for the shared Phaser game, Steam Electron wrapper, and Android Capacitor wrapper.

The original folders are intentionally left untouched:

- `C:\ChiggaStreamWrapper`
- `C:\Chiggas\Android\ChiggasAndroid`

## Layout

```text
game\                         Shared game source of truth
platforms\steam-electron\     Steam/Electron wrapper
platforms\android-capacitor\  Android/Capacitor wrapper
integrations\steam\           Steam Input, achievements, Steamworks, entitlement backend
scripts\sync\                 Platform sync scripts
scripts\checks\               Project sanity checks
archive\                      Indexes for historical pass folders and traces
```

The Steam/Electron wrapper now keeps a small active script surface. Its historical package scripts were archived at `C:\ChiggasUnified\archive\steam-passes\steam-electron-legacy-package-scripts.json`.

Steam runtime cleanup decisions are tracked in `C:\ChiggasUnified\docs\steam-electron-cleanup-notes.md`.

Android cleanup decisions are tracked in `C:\ChiggasUnified\docs\android-capacitor-cleanup-notes.md`.

## First Commands

```powershell
cd C:\ChiggasUnified
npm run sync:all
npm run verify
npm run android:toolchain
```

`npm run paths:check` only scans active source/config files, so archived pass notes and vendor text do not block normal validation.

`npm run runtime:report` lists Steam runtime module sizes, groups, and loader files so future cleanup can stay targeted.

`npm run structure:report` summarizes the active unified folder layout.

`npm run hygiene:check` validates ignore rules and common generated-output locations.

`npm run manifest:write` writes deterministic payload hashes to `C:\ChiggasUnified\docs\payload-manifest.json`.

`npm run deps:check` validates exact dependency versions and package-lock alignment.

`npm run audit:write` writes npm audit summaries to `C:\ChiggasUnified\docs\audit-report.md` and `.json`.

`npm run status:write` writes the current source, structure, and Android toolchain snapshot to `C:\ChiggasUnified\docs\status.md`.

Verification details are tracked in `C:\ChiggasUnified\docs\verification.md`.

Routine update steps are tracked in `C:\ChiggasUnified\docs\update-workflow.md`.

Release build steps are tracked in `C:\ChiggasUnified\docs\release-workflow.md`.

Upload checklist steps are tracked in `C:\ChiggasUnified\docs\release-upload-checklist.md`.

Folder roles are tracked in `C:\ChiggasUnified\docs\structure-map.md`.

Source hygiene rules are tracked in `C:\ChiggasUnified\docs\source-hygiene.md`.

Payload manifest rules are tracked in `C:\ChiggasUnified\docs\payload-manifest.md`.

Dependency update rules are tracked in `C:\ChiggasUnified\docs\dependency-policy.md`.
