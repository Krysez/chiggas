# Fresh Checkout

After cloning `Krysez/chiggas`, run:

```powershell
cd C:\ChiggasUnified
npm run setup:install
```

This installs dependencies for:

- Steam Electron
- Android Capacitor
- Steam entitlement backend

It then runs:

```powershell
npm run release:versions
npm run release:check
npm run verify
```

## Local Machine Files

The following are intentionally ignored and may need to be recreated on each machine:

- `platforms\android-capacitor\android\local.properties`
- Android keystore files
- `platforms\android-capacitor\android\keystore.properties`
- `platforms\android-capacitor\android\app\google-services.json`
- `.env` files

Android Studio can recreate `local.properties` when the project is opened. The Gradle wrapper helper can also recreate it if the Android SDK is in the default Windows location.
