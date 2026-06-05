# Release Workflow

Run release commands from `C:\ChiggasUnified`.

## Before Any Release

```powershell
npm run sync:all
npm run verify
npm run release:check
```

## Steam Build For SteamPipe

```powershell
npm run steam:pack:win
npm run steam:depot:stage
```

The staged SteamPipe content lands at:

```text
C:\ChiggasUnified\platforms\steam-electron\steam_depot_build\windows
```

The SteamPipe template is:

```text
C:\ChiggasUnified\integrations\steam\steamworks\templates\app_build_4788490_template.vdf
```

Before uploading, replace `REPLACE_WITH_WINDOWS_DEPOT_ID` in a working copy of the template with the real Windows depot ID from Steamworks.

## Android Build

```powershell
npm run android:cap:copy
npm run android:test
npm run android:assemble:debug
```

For release packaging:

```powershell
npm run android:assemble:release
```

Use Android Studio for Play signing, bundle generation, SDK management, and upload when that is more convenient.
