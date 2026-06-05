# Android Capacitor Cleanup Notes

## 2026-06-05 Platform Script Cleanup

Replaced the default placeholder `test` script in `platforms/android-capacitor/package.json` with stable platform commands:

- `cap:sync`
- `cap:copy`
- `android:assemble:debug`
- `android:test`
- `check`

The root workspace now exposes `npm run android:check` for Android-specific structure checks.

The root workspace also exposes `npm run android:toolchain` to report whether Java, Android Studio's bundled JDK, the Android SDK, and the Gradle wrapper are available before attempting native Gradle builds.

Native Gradle commands run through `C:\ChiggasUnified\scripts\android\run-gradle.js`, which detects Android Studio's bundled JDK and the local Android SDK path.

## 2026-06-05 Package And Test Namespace Cleanup

Renamed the Android package metadata from `chiggasandroid` to `chiggas-android-capacitor`.

Moved generated placeholder tests from `com.getcapacitor.myapp` to the real app namespace:

- `com.krysez.chiggas`

The instrumented test now asserts the real package id:

- `com.krysez.chiggas`

## 2026-06-05 Payload Reference Cleanup

Normalized `vendor/phaser/VERSION.txt` at the shared game source so Android sync no longer copies stale original-folder references.

`npm run diff:platforms` now verifies:

- Steam game payload
- Android `www`
- Android native `android/app/src/main/assets/public`

## 2026-06-05 Verification Notes

`npm run cap:copy` succeeds with the pinned Capacitor CLI command:

- `npx --package @capacitor/cli@8.3.4 cap copy android`

Gradle unit test verification now succeeds through the detected Android Studio JDK and local Android SDK path.
