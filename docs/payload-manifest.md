# Payload Manifest

The payload manifest records deterministic hashes for the shared game payload and each synced platform payload.

Run:

```powershell
cd C:\ChiggasUnified
npm run manifest:write
```

This writes:

```text
C:\ChiggasUnified\docs\payload-manifest.json
```

The manifest uses the same practical exclusions as `npm run diff:platforms`:

- `vendor/phaser/phaser.esm.js`
- `cordova.js`
- `cordova_plugins.js`
- `node_modules`

Use it when you want an audit snapshot after a major cleanup, sync, or platform update.
