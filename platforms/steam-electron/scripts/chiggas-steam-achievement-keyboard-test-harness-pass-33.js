/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const PASS = 'steam_desktop_wrapper_pass_33';
const APP_ID = 4788490;
const TEST_ACHIEVEMENT = 'FIRST_GAME_STARTED';
const ACCELERATOR = 'CommandOrControl+Alt+G';
const TRACE_FILE = 'steam-achievement-keyboard-test-trace-pass-33.json';
const LOG_FILE = 'steam-achievement-keyboard-test-trace-pass-33.log';

let installed = false;

function nowIso() {
  return new Date().toISOString();
}

function getRoot(rootOverride) {
  return rootOverride || path.resolve(__dirname, '..');
}

function writeTrace(root, data) {
  const tracePath = path.join(root, TRACE_FILE);
  const logPath = path.join(root, LOG_FILE);
  const payload = {
    pass: PASS,
    appId: APP_ID,
    achievement: TEST_ACHIEVEMENT,
    accelerator: ACCELERATOR,
    updatedAt: nowIso(),
    ...data,
  };

  try {
    fs.writeFileSync(tracePath, JSON.stringify(payload, null, 2), 'utf8');
  } catch (error) {
    // Last resort: console only. Do not crash the game because tracing failed.
    console.warn(`[${PASS}] Failed to write trace:`, error && error.message ? error.message : error);
  }

  try {
    fs.appendFileSync(logPath, `${nowIso()} ${JSON.stringify(payload)}\n`, 'utf8');
  } catch (error) {
    console.warn(`[${PASS}] Failed to append trace log:`, error && error.message ? error.message : error);
  }

  return payload;
}

function activateAchievement(root) {
  let steamworks;
  try {
    steamworks = require('steamworks.js');
  } catch (error) {
    return writeTrace(root, {
      ok: false,
      traceStatus: 'steam_achievement_keyboard_test_steamworks_js_not_available',
      attemptedUnlock: false,
      activationResult: null,
      storeMethodAvailable: false,
      storeMethodCalled: false,
      error: String(error && error.message ? error.message : error),
    });
  }

  let client;
  try {
    client = steamworks.init(APP_ID);
  } catch (error) {
    return writeTrace(root, {
      ok: false,
      traceStatus: 'steam_achievement_keyboard_test_steamworks_init_failed',
      attemptedUnlock: false,
      activationResult: null,
      storeMethodAvailable: false,
      storeMethodCalled: false,
      error: String(error && error.message ? error.message : error),
    });
  }

  const achievementApiReady = Boolean(client && client.achievement && typeof client.achievement.activate === 'function');
  if (!achievementApiReady) {
    return writeTrace(root, {
      ok: false,
      traceStatus: 'steam_achievement_keyboard_test_achievement_api_not_available',
      attemptedUnlock: false,
      activationResult: null,
      storeMethodAvailable: Boolean(client && client.achievement && typeof client.achievement.store === 'function'),
      storeMethodCalled: false,
      error: null,
    });
  }

  try {
    const activationResult = client.achievement.activate(TEST_ACHIEVEMENT);
    return writeTrace(root, {
      ok: true,
      traceStatus: 'steam_achievement_keyboard_test_activate_succeeded',
      attemptedUnlock: true,
      activationResult,
      storeMethodAvailable: Boolean(client && client.achievement && typeof client.achievement.store === 'function'),
      storeMethodCalled: false,
      error: null,
      meaning: 'The Pass 33 keyboard harness called steamworks.js achievement.activate for FIRST_GAME_STARTED.',
    });
  } catch (error) {
    return writeTrace(root, {
      ok: false,
      traceStatus: 'steam_achievement_keyboard_test_activate_failed',
      attemptedUnlock: true,
      activationResult: null,
      storeMethodAvailable: Boolean(client && client.achievement && typeof client.achievement.store === 'function'),
      storeMethodCalled: false,
      error: String(error && error.message ? error.message : error),
    });
  }
}

function install(options = {}) {
  if (installed) {
    return { ok: true, pass: PASS, status: 'steam_achievement_keyboard_test_harness_already_installed' };
  }

  const root = getRoot(options.root);
  let electron;
  try {
    electron = require('electron');
  } catch (error) {
    return writeTrace(root, {
      ok: false,
      traceStatus: 'steam_achievement_keyboard_test_electron_not_available',
      attemptedUnlock: false,
      error: String(error && error.message ? error.message : error),
    });
  }

  const globalShortcut = electron.globalShortcut;
  if (!globalShortcut || typeof globalShortcut.register !== 'function') {
    return writeTrace(root, {
      ok: false,
      traceStatus: 'steam_achievement_keyboard_test_global_shortcut_not_available',
      attemptedUnlock: false,
      error: null,
    });
  }

  let registered = false;
  try {
    registered = globalShortcut.register(ACCELERATOR, () => {
      activateAchievement(root);
    });
  } catch (error) {
    return writeTrace(root, {
      ok: false,
      traceStatus: 'steam_achievement_keyboard_test_shortcut_register_failed',
      attemptedUnlock: false,
      registered: false,
      error: String(error && error.message ? error.message : error),
    });
  }

  installed = true;

  return writeTrace(root, {
    ok: Boolean(registered),
    traceStatus: registered
      ? 'steam_achievement_keyboard_test_harness_registered'
      : 'steam_achievement_keyboard_test_harness_register_returned_false',
    attemptedUnlock: false,
    registered: Boolean(registered),
    error: registered ? null : 'globalShortcut.register returned false. The accelerator may be unavailable.',
    nextAction: registered
      ? 'With the Steam-launched game focused, press Ctrl+Alt+G once to unlock FIRST_GAME_STARTED.'
      : 'Use the traceStatus/error to diagnose shortcut registration.',
  });
}

module.exports = {
  PASS,
  APP_ID,
  TEST_ACHIEVEMENT,
  ACCELERATOR,
  TRACE_FILE,
  LOG_FILE,
  install,
  activateAchievement,
};
