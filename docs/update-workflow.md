# Update Workflow

Use `C:\ChiggasUnified\game` as the shared game source of truth.

## After Editing Game Source

```powershell
cd C:\ChiggasUnified
npm run sync:all
npm run verify
```

`sync:all` updates both platform payloads:

- `platforms\steam-electron\game`
- `platforms\android-capacitor\www`
- `platforms\android-capacitor\android\app\src\main\assets\public`

The Android native public payload may contain Capacitor-generated helpers such as `cordova.js` and `cordova_plugins.js`; the sync script preserves those helpers when they already exist.

## Steam Runtime Changes

Edit Steam-specific code in `C:\ChiggasUnified\platforms\steam-electron`.

```powershell
cd C:\ChiggasUnified
npm run steam:check
npm run runtime:report
```

Keep `main.js` and `preload.js` as loaders. Add focused runtime modules under `platforms\steam-electron\runtime` when new Steam behavior is needed.

## Android Wrapper Changes

Edit Android wrapper code in `C:\ChiggasUnified\platforms\android-capacitor`.

```powershell
cd C:\ChiggasUnified
npm run android:check
npm run android:toolchain
```

Run Gradle only after the Android toolchain report is ready:

```powershell
cd C:\ChiggasUnified\platforms\android-capacitor
npm run android:test
npm run android:assemble:debug
```
