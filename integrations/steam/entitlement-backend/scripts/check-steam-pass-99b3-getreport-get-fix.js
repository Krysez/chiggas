const fs = require("fs");
const path = require("path");

const root = process.cwd();
const serverPath = path.join(root, "steam-microtxn-pass-99a-server.js");

function exists(p) { return fs.existsSync(p); }
function read(p) { return exists(p) ? fs.readFileSync(p, "utf8") : ""; }

const s = read(serverPath);

const checks = {
  serverPresent: exists(serverPath),
  getReportFixMarkerPresent: s.includes("CHIGGAS_STEAM_PASS_99B3_GETREPORT_GET_FIX"),
  getReportUsesGet: s.includes("GetReport/v5/', params, 'GET'") || s.includes('GetReport/v5/", params, "GET"'),
  steamApiSupportsGetQueryString: s.includes("requestPath = method === 'GET'") || s.includes('requestPath = method === "GET"')
};

const ok = checks.serverPresent && checks.getReportFixMarkerPresent && checks.getReportUsesGet && checks.steamApiSupportsGetQueryString;

console.log(JSON.stringify({
  ok,
  pass: "steam_desktop_wrapper_pass_99b3",
  status: ok ? "getreport_get_fix_ready" : "getreport_get_fix_check_failed",
  root,
  serverPath,
  checks,
  guidance: ok ? [
    "Stop the MicroTxn backend with Ctrl+C.",
    "Restart it: npm run steam:mtx:server",
    "Then rerun GetReport from C:\\ChiggaStreamWrapper.",
    "Command: npm run steam:wallet:smoke:report -- --hours=24"
  ] : [
    "Review false checks above.",
    "Run this from C:\\ChiggaStreamWrapper\\steam-entitlement-backend."
  ]
}, null, 2));

process.exit(ok ? 0 : 1);
