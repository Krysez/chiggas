# Release Upload Checklist

Run commands from `C:\ChiggasUnified`.

## Shared Prep

```powershell
npm run release:prep
```

## SteamPipe

```powershell
npm run steam:pack:win
npm run steam:depot:stage
npm run steam:vdf:write
npm run release:artifacts
```

Upload this generated VDF with SteamPipe:

```text
C:\ChiggasUnified\integrations\steam\steamworks\generated\app_build_4788490.vdf
```

The staged depot content is:

```text
C:\ChiggasUnified\platforms\steam-electron\steam_depot_build\main\windows
```

## Google Play

```powershell
npm run android:cap:copy
npm run android:test
npm run android:bundle:release
npm run release:artifacts
```

The unsigned release bundle is:

```text
C:\ChiggasUnified\platforms\android-capacitor\android\app\build\outputs\bundle\release\app-release.aab
```

Use Android Studio for Play App Signing, keystore management, final signed bundle generation, and upload. Keep keystore files, `keystore.properties`, and `google-services.json` out of Git.

Android signing setup is tracked in `C:\ChiggasUnified\docs\android-signing.md`.
