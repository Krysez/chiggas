# Steam Inventory Entitlement Backend Pass 87B
## Publisher Key Trim + Safe Health Diagnostics

If `/health` shows:

```txt
publisherKeyConfigured: true
envReady: false
```

then the backend sees a key value, but it is failing the readiness check. This hotfix:

- trims `STEAM_PUBLISHER_WEB_API_KEY`
- keeps dotenv loading
- adds safe health diagnostics:
  - key length
  - first 4 chars
  - last 4 chars
  - whether it looks like hex
  - whether it passes length check

It never prints the full key.

## Install

Extract into:

```txt
C:\ChiggaStreamWrapper\steam-entitlement-backend
```

Then run:

```powershell
cd C:\ChiggaStreamWrapper\steam-entitlement-backend

node scripts\apply-backend-pass-87b-key-diagnostics.js
node scripts\check-backend-pass-87b-key-diagnostics.js
npm start
```

In a second PowerShell window:

```powershell
curl http://localhost:8080/health
```

Expected:

```txt
envReady: true
publisherKeyConfigured: true
publisherKeyDiagnostics.length: 32 or more
publisherKeyDiagnostics.readyByLength: true
```

## If you still get envReady false

Send only the safe diagnostics block from `/health`, not the full key.