# Dependency Policy

The unified workspace uses exact dependency versions for platform wrappers and backend services.

This keeps cleanup and release work reproducible. Dependency updates should be deliberate:

```powershell
cd C:\ChiggasUnified\platforms\steam-electron
npm install --package-lock-only --ignore-scripts

cd C:\ChiggasUnified\platforms\android-capacitor
npm install --package-lock-only --ignore-scripts

cd C:\ChiggasUnified\integrations\steam\entitlement-backend
npm install --package-lock-only --ignore-scripts
```

After dependency changes, return to the root and run:

```powershell
cd C:\ChiggasUnified
npm run verify
npm run status:write
```

Avoid `latest`, broad ranges, and local machine-specific dependency edits in active project files.

Steam/Electron should stay on an Electron version that clears `npm audit` advisories whenever practical.
