# Source Hygiene

The unified workspace keeps active source, synced payloads, and generated build output separate.

## Allowed Synced Payloads

These folders are intentionally present because the wrappers load from them:

- `platforms\steam-electron\game`
- `platforms\android-capacitor\www`
- `platforms\android-capacitor\android\app\src\main\assets\public`

## Generated Output

Dependencies, Gradle output, Electron build output, local Android SDK paths, logs, and secrets should stay ignored by git.

Android `local.properties` is intentionally excluded because it stores the machine-specific SDK path. Android Studio or Gradle can recreate it when the Android SDK is configured.

Run:

```powershell
cd C:\ChiggasUnified
npm run hygiene:check
```

This validates the root ignore patterns, platform ignore files, and common generated folders.
