# Chiggas Unified Status

Generated: 2026-06-05T20:38:07.873Z

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
- game: 203 files (960c4dee41bc2561a8485e1f575e5f21078fef12f24587343b82b0ef224f675e)
- steam: 203 files (960c4dee41bc2561a8485e1f575e5f21078fef12f24587343b82b0ef224f675e)
- android-www: 203 files (960c4dee41bc2561a8485e1f575e5f21078fef12f24587343b82b0ef224f675e)
- android-public: 203 files (960c4dee41bc2561a8485e1f575e5f21078fef12f24587343b82b0ef224f675e)

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
- Integration files: 38
- Steam wrapper files: 297
- Android wrapper files: 507
- Script files: 21
- Docs files: 13

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
