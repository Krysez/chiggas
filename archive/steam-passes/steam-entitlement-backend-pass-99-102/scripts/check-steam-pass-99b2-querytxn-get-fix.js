const fs = require("fs");
const path = require("path");

const root = process.cwd();
const serverPath = path.join(root, "steam-microtxn-pass-99a-server.js");

function exists(p) { return fs.existsSync(p); }
function read(p) { return exists(p) ? fs.readFileSync(p, "utf8") : ""; }

const s = read(serverPath);

const checks = {
  serverPresent: exists(serverPath),
  getFixMarkerPresent: s.includes("CHIGGAS_STEAM_PASS_99B2_QUERYTXN_GET_FIX"),
  queryTxnUsesGet: s.includes("QueryTxn/v2/', params, 'GET'") || s.includes('QueryTxn/v2/", params, "GET"'),
  steamApiSupportsGetQueryString: s.includes("requestPath = method === 'GET'") || s.includes('requestPath = method === "GET"')
};

const ok = checks.serverPresent && checks.getFixMarkerPresent && checks.queryTxnUsesGet;

console.log(JSON.stringify({
  ok,
  pass: "steam_desktop_wrapper_pass_99b2",
  status: ok ? "querytxn_get_fix_ready" : "querytxn_get_fix_check_failed",
  root,
  serverPath,
  checks,
  guidance: ok ? [
    "Stop the MicroTxn backend with Ctrl+C.",
    "Restart it: npm run steam:mtx:server",
    "Then rerun query for the approved order.",
    "Command: npm run steam:wallet:smoke:query -- --orderid=1780516545347438639"
  ] : [
    "Review false checks above.",
    "Run this from C:\\ChiggaStreamWrapper\\steam-entitlement-backend."
  ]
}, null, 2));

process.exit(ok ? 0 : 1);
