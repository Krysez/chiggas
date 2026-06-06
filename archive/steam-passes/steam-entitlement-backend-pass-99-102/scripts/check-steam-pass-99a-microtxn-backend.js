const fs = require("fs");
const path = require("path");

const PASS = "steam_desktop_wrapper_pass_99a";
const root = process.cwd();

function exists(p) { return fs.existsSync(p); }
function read(p) { return exists(p) ? fs.readFileSync(p, "utf8") : ""; }

const serverPath = path.join(root, "steam-microtxn-pass-99a-server.js");
const packagePath = path.join(root, "package.json");
const ordersFile = path.join(root, "data", "steam-microtxn-orders-pass-99a.json");
const server = read(serverPath);
const pkg = exists(packagePath) ? JSON.parse(read(packagePath)) : {};

const checks = {
  cwdLooksLikeBackend: root.toLowerCase().includes("steam-entitlement-backend"),
  serverPresent: exists(serverPath),
  noSandboxApiUsed: !server.includes("ISteamMicroTxnSandbox"),
  initTxnEndpointPresent: server.includes("/steam/mtx/init") && server.includes("InitTxn/v3"),
  finalizeEndpointPresent: server.includes("/steam/mtx/finalize") && server.includes("FinalizeTxn/v2"),
  queryEndpointPresent: server.includes("/steam/mtx/query") && server.includes("QueryTxn/v2"),
  getReportEndpointPresent: server.includes("/steam/mtx/report") && server.includes("GetReport/v5"),
  publisherKeyEnvReferenced: server.includes("STEAM_PUBLISHER_WEB_API_KEY"),
  appId4788490Referenced: server.includes("4788490"),
  usersessionClientPresent: server.includes("usersession") && server.includes("client"),
  packageJsonPresent: exists(packagePath),
  packageScriptServerPresent: !!(pkg.scripts && pkg.scripts["steam:mtx:server"]),
  packageScriptCheckPresent: !!(pkg.scripts && pkg.scripts["steam:pass99a:check"])
};

const ok = Object.values(checks).every(Boolean);

console.log(JSON.stringify({
  ok,
  pass: PASS,
  status: ok ? "steam_microtxn_backend_foundation_ready" : "steam_microtxn_backend_foundation_check_failed",
  root,
  files: {
    serverPath,
    packagePath,
    ordersFile
  },
  env: {
    appId: process.env.STEAM_APP_ID || "4788490",
    publisherKeyConfigured: !!(process.env.STEAM_PUBLISHER_WEB_API_KEY || process.env.STEAM_WEB_API_KEY)
  },
  checks,
  guidance: ok ? [
    "Start the backend: npm run steam:mtx:server",
    "In another PowerShell window, test health: curl http://localhost:8791/steam/mtx/health",
    "Do not run InitTxn yet until the game bridge pass is ready, unless you are intentionally testing a live transaction.",
    "This pass uses the real ISteamMicroTxn endpoints, not sandbox."
  ] : [
    "Review false checks above.",
    "Run this from C:\\ChiggaStreamWrapper\\steam-entitlement-backend.",
    "If package.json was missing, create one or paste this output."
  ]
}, null, 2));

process.exit(ok ? 0 : 1);
