# Backend Pass 87C
## Flat Publisher Key Diagnostics Hotfix

This ZIP is flat. Extract it directly into:

```txt
C:\ChiggaStreamWrapper\steam-entitlement-backend
```

It adds:

```txt
scripts\apply-backend-pass-87c-key-diagnostics.js
scripts\check-backend-pass-87c-key-diagnostics.js
```

Run:

```powershell
cd C:\ChiggaStreamWrapper\steam-entitlement-backend

node scripts\apply-backend-pass-87c-key-diagnostics.js
npm install
node scripts\check-backend-pass-87c-key-diagnostics.js
npm start
```

Then in a second PowerShell:

```powershell
curl http://localhost:8080/health
```