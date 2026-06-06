# Versioning

Run this before release packaging:

```powershell
cd C:\ChiggasUnified
npm run release:versions
```

## Current Version Sources

Steam:

```text
C:\ChiggasUnified\platforms\steam-electron\package.json
```

Android:

```text
C:\ChiggasUnified\platforms\android-capacitor\android\app\build.gradle
```

## Android Rule

Every Google Play upload must use a `versionCode` higher than the previous uploaded artifact. `versionName` is the visible user-facing version.

Example:

```gradle
versionCode 4
versionName "1.0.1"
```

## Steam Rule

SteamPipe does not require the same style of numeric versioning, but the Steam package version controls generated artifact names. Keep it aligned with the release you intend to upload.
