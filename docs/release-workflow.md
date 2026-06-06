# Release Workflow

Run release commands from `C:\ChiggasUnified`.

## Before Any Release

```powershell
npm run sync:all
npm run verify
npm run release:check
npm run release:versions
```

## Steam Build For SteamPipe

```powershell
npm run steam:pack:win
npm run steam:depot:stage
$env:CHIGGAS_STEAM_WINDOWS_DEPOT_ID="YOUR_WINDOWS_DEPOT_ID"
npm run steam:vdf:write
```

The staged SteamPipe content lands at:

```text
C:\ChiggasUnified\platforms\steam-electron\steam_depot_build\windows
```

The generated SteamPipe VDF is:

```text
C:\ChiggasUnified\integrations\steam\steamworks\generated\app_build_4788490.vdf
```

The source template is:

```text
C:\ChiggasUnified\integrations\steam\steamworks\templates\app_build_4788490_template.vdf
```

`steam:vdf:write` replaces the depot placeholder in a generated ignored file. Do not commit generated SteamPipe upload files.

## Android Build

```powershell
npm run android:cap:copy
npm run android:test
npm run android:assemble:debug
```

For release packaging:

```powershell
npm run android:assemble:release
npm run android:bundle:release
```

Use Android Studio for Play signing, bundle generation, SDK management, and upload when that is more convenient.

Detailed upload steps are tracked in `C:\ChiggasUnified\docs\release-upload-checklist.md`.

Versioning rules are tracked in `C:\ChiggasUnified\docs\versioning.md`.
