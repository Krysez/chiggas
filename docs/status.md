# Chiggas Unified Status

Generated: 2026-06-06T14:25:11.643Z

## Summary

- Source verification: pass (source_verification_passed)
- Payload manifest: pass (payload_manifest_written)
- NPM audit: clean (audit_report_clean)
- Structure report: pass (unified_structure_report)
- Android native toolchain: ready (android_toolchain_ready)

## Commands

```powershell
cd C:\ChiggasUnified
npm run sync:all
npm run verify
npm run manifest:write
npm run audit:write
npm run structure:report
npm run android:toolchain
```

## Verification

Checks: check, steam:check, android:check, deps:check, hygiene:check, paths:check, diff:platforms, runtime:report
Failed: none

## Payload Manifest

Output: C:\ChiggasUnified\docs\payload-manifest.json
- game: 203 files (5e0d7c1c0365dadee8d1f27b5071db7447435dba58fc170c70fa6717823731bc)
- steam: 203 files (5e0d7c1c0365dadee8d1f27b5071db7447435dba58fc170c70fa6717823731bc)
- android-game-projection: 191 files (5d0762e1048b242a36a511123dc473d6b85afceb5f09bbb591b60041c5e60022)
- android-www: 191 files (5d0762e1048b242a36a511123dc473d6b85afceb5f09bbb591b60041c5e60022)
- android-public: 191 files (5d0762e1048b242a36a511123dc473d6b85afceb5f09bbb591b60041c5e60022)

Comparisons:
- steam: matches game
- android-www: matches game
- android-public: matches game

## Audit

Output: C:\ChiggasUnified\docs\audit-report.md
- steam-electron: audit_clean, total vulnerabilities 0
- android-capacitor: audit_clean, total vulnerabilities 0
- steam-entitlement-backend: audit_clean, total vulnerabilities 0

## Structure

- Shared game files: 204
- Integration files: 17
- Steam wrapper files: 296
- Android wrapper files: 466
- Script files: 29
- Docs files: 19

## Android Toolchain

Gradle build commands can be attempted.

- Java home detected: ok (C:\Program Files\Android\Android Studio\jbr)
- java executable: ok (openjdk version "21.0.10" 2026-01-20)
- Android SDK detected: ok (C:\Users\kevin\AppData\Local\Android\Sdk)
- Gradle wrapper: ok (C:\ChiggasUnified\platforms\android-capacitor\android\gradlew.bat)

## Notes

- Original source folders remain untouched.
- `C:\ChiggasUnified\game` is the shared game source of truth.
- Steam and Android payloads should be refreshed with `npm run sync:all` after shared game changes.
- Gradle build and Android tests require Java plus Android SDK environment setup.
