# Steam Inventory Backend Pass 88
## Local Ticket + Backend Inventory Smoke Test

This pass does not modify the game. It tests the secure backend chain:

1. Checks backend `/health`.
2. Generates Steam Web API auth ticket with `getAuthTicketForWebApi("chiggas_inventory")`.
3. Sends ticket to `/steam/authenticate`.
4. Sends ticket to `/steam/inventory/owned`.
5. Reports owned itemdef IDs if Steam returns any.

It does not print:
- Steam auth ticket
- Steam Publisher Web API key

## Requirements

Keep backend running in a separate PowerShell window:

```powershell
cd C:\ChiggaStreamWrapper\steam-entitlement-backend
npm start
```

Then install/run this from wrapper root:

```powershell
cd C:\ChiggaStreamWrapper

node scripts\apply-steam-inventory-backend-pass-88-smoke-test.js
npm run steam:backend:inventory-smoke
```

If your backend is not localhost:

```powershell
$env:STEAM_ENTITLEMENT_BACKEND_URL="https://your-render-url.onrender.com"
npm run steam:backend:inventory-smoke
```

## Results

If inventory succeeds but returns no itemdefs, that is still a valid backend test. It just means the Steam account does not currently own any configured itemdefs.