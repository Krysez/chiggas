# Steam Inventory Entitlement Backend Pass 87A
## .env Loader Hotfix

The backend health check returned `envReady:false`, which means the running server does not see `STEAM_PUBLISHER_WEB_API_KEY`.

This patch adds:
- `dotenv` dependency
- `require('dotenv').config();` at the top of `server.js`
- a local check script

## Install

Extract into:

```txt
C:\ChiggaStreamWrapper\steam-entitlement-backend
```

Then run:

```powershell
cd C:\ChiggaStreamWrapper\steam-entitlement-backend

node scripts\apply-backend-pass-87a-dotenv-loader.js
npm install
node scripts\check-backend-pass-87a-env-loader.js
npm start
```

Then in a second PowerShell window:

```powershell
curl http://localhost:8080/health
```

Expected:

```txt
envReady: true
publisherKeyConfigured: true
```

## Important

Your `.env` must contain your real Steamworks Publisher Web API key:

```txt
STEAM_PUBLISHER_WEB_API_KEY=YOUR_REAL_KEY
```