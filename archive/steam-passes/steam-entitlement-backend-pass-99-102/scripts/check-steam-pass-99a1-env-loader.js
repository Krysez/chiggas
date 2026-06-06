const fs = require("fs");
const path = require("path");

const root = process.cwd();
const serverPath = path.join(root, "steam-microtxn-pass-99a-server.js");
const envPath = path.join(root, ".env");

function exists(p) { return fs.existsSync(p); }
function read(p) { return exists(p) ? fs.readFileSync(p, "utf8") : ""; }

const server = read(serverPath);
const env = read(envPath);

const checks = {
  cwdLooksLikeBackend: root.toLowerCase().includes("steam-entitlement-backend"),
  serverPresent: exists(serverPath),
  envFilePresent: exists(envPath),
  envFileHasPublisherKey: /STEAM_PUBLISHER_WEB_API_KEY\s*=\s*.+/.test(env) || /STEAM_WEB_API_KEY\s*=\s*.+/.test(env),
  envLoaderPatchPresent: server.includes("CHIGGAS_STEAM_PASS_99A1_ENV_FILE_LOADER_BEGIN"),
  envLoaderRunsBeforePublisherKey: server.indexOf("CHIGGAS_STEAM_PASS_99A1_ENV_FILE_LOADER_BEGIN") >= 0 && server.indexOf("CHIGGAS_STEAM_PASS_99A1_ENV_FILE_LOADER_BEGIN") < server.indexOf("const PUBLISHER_KEY"),
  healthReportsEnvFiles: server.includes("envFilesLoaded")
};

const ok = checks.cwdLooksLikeBackend &&
  checks.serverPresent &&
  checks.envFilePresent &&
  checks.envFileHasPublisherKey &&
  checks.envLoaderPatchPresent &&
  checks.envLoaderRunsBeforePublisherKey;

console.log(JSON.stringify({
  ok,
  pass: "steam_desktop_wrapper_pass_99a1",
  status: ok ? "steam_microtxn_env_loader_ready" : "steam_microtxn_env_loader_check_failed",
  root,
  files: {
    serverPath,
    envPath
  },
  checks,
  guidance: ok ? [
    "Stop the currently running MicroTxn backend with Ctrl+C.",
    "Restart it: npm run steam:mtx:server",
    "In another PowerShell window, run: curl -UseBasicParsing http://localhost:8791/steam/mtx/health",
    "Confirm publisherKeyConfigured is true."
  ] : [
    "Review false checks above.",
    "Most likely fix: add STEAM_PUBLISHER_WEB_API_KEY=your_key_here to C:\\ChiggaStreamWrapper\\steam-entitlement-backend\\.env"
  ]
}, null, 2));

process.exit(ok ? 0 : 1);
