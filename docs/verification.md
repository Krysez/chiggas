# Verification

Run source-level verification from the unified workspace root:

```powershell
cd C:\ChiggasUnified
npm run verify
```

This checks the unified layout, Steam/Electron runtime wiring, Android/Capacitor source wiring, active path references, platform payload diffs, and Steam runtime module sizes.

## Individual Checks

```powershell
npm run check
npm run steam:check
npm run android:check
npm run paths:check
npm run diff:platforms
npm run runtime:report
npm run release:artifacts
npm run release:prep
```

## Android Native Toolchain

Android native build commands depend on the local machine having Java and Android SDK environment variables configured. Check that separately:

```powershell
npm run android:toolchain
```

When the toolchain report is ready, Gradle commands can be run from the Android platform folder:

```powershell
cd C:\ChiggasUnified\platforms\android-capacitor
npm run android:test
npm run android:assemble:debug
```
