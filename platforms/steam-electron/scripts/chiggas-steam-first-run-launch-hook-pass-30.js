/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const PASS = 'steam_desktop_wrapper_pass_30';
const DEFAULT_APP_ID = 4788490;
const DEFAULT_ACHIEVEMENT = 'FIRST_RUN';
const TRACE_FILE = 'steam-achievement-launch-trace-pass-30.json';
const TRACE_LOG = 'steam-achievement-launch-trace-pass-30.log';

let installed = false;
let attempted = false;

function getRootDir() {
  return path.resolve(__dirname, '..');
}

function safeMessage(error) {
  return String(error && error.message ? error.message : error);
}

function writeTrace(update) {
  const root = getRootDir();
  const tracePath = path.join(root, TRACE_FILE);
  const logPath = path.join(root, TRACE_LOG);
  let previous = {};

  try {
    if (fs.existsSync(tracePath)) {
      previous = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
    }
  } catch (_) {
    previous = {};
  }

  const trace = {
    pass: PASS,
    appId: DEFAULT_APP_ID,
    achievement: DEFAULT_ACHIEVEMENT,
    startedAt: previous.startedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    root,
    process: {
      platform: process.platform,
      versions: process.versions,
      argv: process.argv
    },
    storeShouldShow: 'TEST BUY',
    ...previous,
    ...update
  };

  try {
    fs.writeFileSync(tracePath, JSON.stringify(trace, null, 2));
  } catch (error) {
    console.warn('[Chiggas Steam] Failed to write Pass 30 achievement trace JSON:', safeMessage(error));
  }

  try {
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${JSON.stringify(update)}\n`);
  } catch (error) {
    console.warn('[Chiggas Steam] Failed to write Pass 30 achievement trace log:', safeMessage(error));
  }

  return trace;
}

function attemptFirstRunUnlock(options = {}) {
  if (attempted) {
    return writeTrace({
      ok: true,
      status: 'steam_first_run_launch_hook_already_attempted',
      attemptedUnlock: false,
      duplicateAttemptBlocked: true,
      hookInstalled: installed
    });
  }

  attempted = true;

  const appId = Number(options.appId || DEFAULT_APP_ID);
  const achievement = String(options.achievement || DEFAULT_ACHIEVEMENT);

  writeTrace({
    ok: true,
    status: 'steam_first_run_launch_hook_attempt_started',
    attemptedUnlock: false,
    hookInstalled: installed,
    appId,
    achievement
  });

  let steamworks;
  try {
    steamworks = require('steamworks.js');
  } catch (error) {
    return writeTrace({
      ok: false,
      status: 'steamworks_js_not_available_on_launch',
      attemptedUnlock: false,
      error: safeMessage(error),
      hookInstalled: installed
    });
  }

  let client;
  try {
    client = steamworks.init(appId);
  } catch (error) {
    return writeTrace({
      ok: false,
      status: 'steamworks_init_failed_on_launch',
      attemptedUnlock: false,
      error: safeMessage(error),
      hookInstalled: installed
    });
  }

  if (!client || !client.achievement || typeof client.achievement.activate !== 'function') {
    return writeTrace({
      ok: false,
      status: 'steam_achievement_activate_api_not_available_on_launch',
      attemptedUnlock: false,
      clientReady: Boolean(client),
      achievementApiReady: Boolean(client && client.achievement),
      hasActivate: Boolean(client && client.achievement && typeof client.achievement.activate === 'function'),
      hookInstalled: installed
    });
  }

  try {
    const activationResult = client.achievement.activate(achievement);

    return writeTrace({
      ok: true,
      status: activationResult === false
        ? 'steam_first_run_launch_achievement_activate_returned_false_or_noop'
        : 'steam_first_run_launch_achievement_activate_succeeded',
      attemptedUnlock: true,
      unlockedAchievement: achievement,
      appId,
      achievement,
      activationResult,
      storeMethodAvailable: Boolean(client.achievement && typeof client.achievement.store === 'function'),
      storeMethodCalled: false,
      note: 'Pass 30 uses steamworks.js achievement.activate only. This wrapper does not require client.achievement.store for FIRST_RUN to unlock.'
    });
  } catch (error) {
    return writeTrace({
      ok: false,
      status: 'steam_first_run_launch_achievement_activate_failed',
      attemptedUnlock: true,
      error: safeMessage(error),
      appId,
      achievement,
      hookInstalled: installed
    });
  }
}

function installChiggasFirstRunLaunchHookPass30(options = {}) {
  if (installed) {
    return writeTrace({
      ok: true,
      status: 'steam_first_run_launch_hook_install_skipped_already_installed',
      attemptedUnlock: false,
      hookInstalled: true
    });
  }

  installed = true;

  writeTrace({
    ok: true,
    status: 'steam_first_run_launch_hook_installed_waiting_for_electron_ready',
    attemptedUnlock: false,
    hookInstalled: true,
    storeShouldShow: 'TEST BUY'
  });

  let electronApp;
  try {
    electronApp = require('electron').app;
  } catch (error) {
    return writeTrace({
      ok: false,
      status: 'electron_app_not_available_for_launch_hook',
      attemptedUnlock: false,
      hookInstalled: true,
      error: safeMessage(error)
    });
  }

  try {
    if (electronApp && typeof electronApp.isReady === 'function' && electronApp.isReady()) {
      return attemptFirstRunUnlock(options);
    }

    if (electronApp && typeof electronApp.whenReady === 'function') {
      electronApp.whenReady()
        .then(() => attemptFirstRunUnlock(options))
        .catch((error) => writeTrace({
          ok: false,
          status: 'electron_when_ready_failed_for_launch_hook',
          attemptedUnlock: false,
          error: safeMessage(error),
          hookInstalled: true
        }));

      return writeTrace({
        ok: true,
        status: 'steam_first_run_launch_hook_scheduled_for_electron_ready',
        attemptedUnlock: false,
        hookInstalled: true
      });
    }

    return writeTrace({
      ok: false,
      status: 'electron_ready_api_not_available_for_launch_hook',
      attemptedUnlock: false,
      hookInstalled: true
    });
  } catch (error) {
    return writeTrace({
      ok: false,
      status: 'steam_first_run_launch_hook_install_failed',
      attemptedUnlock: false,
      hookInstalled: true,
      error: safeMessage(error)
    });
  }
}

module.exports = {
  installChiggasFirstRunLaunchHookPass30,
  attemptFirstRunUnlock
};

if (require.main === module) {
  const result = attemptFirstRunUnlock({ appId: DEFAULT_APP_ID, achievement: DEFAULT_ACHIEVEMENT });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
