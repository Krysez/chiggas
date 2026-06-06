# Steam Inventory Entitlement Backend Pass 87

This backend verifies Steam ownership without putting your Steam Publisher Web API key in the game client.

## Why this is needed

Your current Electron `steamworks.js` binding can generate a Web API auth ticket, but it does not expose Steam Inventory directly. This backend uses the secure Steam Web API path:

1. Game generates `getAuthTicketForWebApi("chiggas_inventory")`.
2. Game sends the ticket hex to this backend.
3. Backend calls `ISteamUserAuth/AuthenticateUserTicket`.
4. Backend calls `IInventoryService/GetInventory`.
5. Backend returns owned `itemdefid` values to the game.
6. Game maps `itemdefid` to `skinId` locally.

## Setup

```powershell
cd C:\ChiggasUnified\integrations\steam\entitlement-backend
npm install
copy .env.example .env
```

Edit `.env` and add:

```txt
STEAM_PUBLISHER_WEB_API_KEY=your_real_key_here
```

## Run locally

```powershell
npm start
```

Health check:

```powershell
curl http://localhost:8080/health
```

## Deploy to Render

1. Create a new Web Service.
2. Use this backend folder as the service root.
3. Build command:

```txt
npm install
```

4. Start command:

```txt
npm start
```

5. Add environment variables:

```txt
STEAM_PUBLISHER_WEB_API_KEY
STEAM_APP_ID=4788490
STEAM_AUTH_IDENTITY=chiggas_inventory
ALLOWED_ORIGIN=*
```

## Important security rule

Never place `STEAM_PUBLISHER_WEB_API_KEY` in the Electron/game client.
It belongs only on the backend server.

## Unified Workspace Check

From the repo root:

```powershell
cd C:\ChiggasUnified
npm run steam:backend:check
```

This runs static backend checks without requiring a real publisher key.
