/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const PASS = 'steam_desktop_wrapper_pass_32';
const DEFAULT_APP_ID = 4788490;
const TRACE_FILE = 'steam-achievement-event-bridge-pass-32.json';
const TRACE_LOG = 'steam-achievement-event-bridge-pass-32.log';

const ACHIEVEMENTS = Object.freeze([
  {
    apiName: 'FIRST_RUN',
    displayName: 'First Run',
    description: 'Launch Chiggas: Survival of the Mitiest for the first time.',
    trigger: 'First successful Steam launch',
    hidden: false,
    managedBy: 'launch_hook'
  },
  {
    apiName: 'FIRST_GAME_STARTED',
    displayName: 'Into the Mities',
    description: 'Start your first run.',
    trigger: 'First gameplay session begins',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'FIRST_CHIGGA_SOLDIER_RECRUITED',
    displayName: 'Who This Chigga?',
    description: 'Recruit Your First Chigga Soldier',
    trigger: 'First Chigga Soldier recruited/unlocked.',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'FIRST_MUNCH',
    displayName: 'Eat That Chigga!',
    description: 'Munch your first soldier to gain STR',
    trigger: 'First munch action',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'FIRST_WEAPON_PICKUP',
    displayName: 'Armed and Mitey',
    description: 'Pick up your first weapon.',
    trigger: 'First weapon pickup',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'FIRST_SHOT_FIRED',
    displayName: 'Say Hello to My Little Chigga',
    description: 'Fire your first shot.',
    trigger: 'First gunshot',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'FIRST_ENEMY_DEFEATED',
    displayName: 'Unalive An Enemy',
    description: 'Defeat your first Foe',
    trigger: 'First enemy kill',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'TEN_ENEMIES_DEFEATED',
    displayName: 'Crew Down',
    description: 'Take Out 10 enemies',
    trigger: 'Lifetime kill stat reaches 10',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'HUNDRED_ENEMIES_DEFEATED',
    displayName: 'Mitey Mayhem',
    description: 'Defeat 100 enemies across all runs.',
    trigger: 'Lifetime kill stat reaches 100',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'FIRST_SURVIVAL_MINUTE',
    displayName: 'Still Standing',
    description: 'Survive for 60 seconds in a single run.',
    trigger: 'Timer reaches 60 seconds',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'FIVE_MINUTE_RUN',
    displayName: 'This Chigga is Built Different',
    description: 'Survive for 5 minutes in a single run.',
    trigger: 'Timer reaches 5 minutes',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'FIRST_SPEED_BOOST',
    displayName: 'Pound the Pavement',
    description: 'Activate your first speed boost.',
    trigger: 'First speed/wind-gush event',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'FIRST_LEGENDARY_TRYON',
    displayName: 'Legendary Look',
    description: 'Equip a Legendary Chigga Wear item for the first time.',
    trigger: 'First Legendary cosmetic equipped',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'FULL_LEGENDARY_FIT',
    displayName: 'Me and My Chigga!',
    description: 'Equip a Legendary Chigga Wear outfit & Legendary Soldier',
    trigger: 'Full Legendary Team set equipped',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'FIRST_STORE_VISIT',
    displayName: 'Window Shopping',
    description: 'Open the Legendary Store for the first time.',
    trigger: 'Store scene opened',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'ALL_BASE_CHIGGAS_UNLOCKED',
    displayName: 'The Whole Crew',
    description: 'Unlock every base Chigga.',
    trigger: 'Base roster complete',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'ALL_LEGENDARY_WEAR_UNLOCKED',
    displayName: 'Gotta Wear Em All!',
    description: 'Unlock every Legendary Chigga Wear item.',
    trigger: 'All Legendary cosmetics owned',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'FIRST_DEATH',
    displayName: 'It Happens',
    description: 'Lose your first run.',
    trigger: 'First death/game over',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'REVENGE_RUN',
    displayName: 'Run It Back',
    description: 'Start another run after being defeated.',
    trigger: 'New run after death',
    hidden: false,
    managedBy: 'game_event_bridge'
  },
  {
    apiName: 'MITIEST_SURVIVOR',
    displayName: 'Survival of the Mitiest',
    description: 'Beat the Game',
    trigger: 'Reach Endgame Once',
    hidden: true,
    managedBy: 'game_event_bridge'
  }
]);

const ACHIEVEMENT_MAP = Object.freeze(
  ACHIEVEMENTS.reduce((acc, achievement) => {
    acc[achievement.apiName] = achievement;
    return acc;
  }, {})
);

function getRootDir() {
  return path.resolve(__dirname, '..');
}

function safeMessage(error) {
  return String(error && error.message ? error.message : error);
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return {};

  const allowed = {};
  for (const key of ['source', 'scene', 'event', 'reason', 'testMode']) {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) {
      allowed[key] = String(metadata[key]).slice(0, 160);
    }
  }
  return allowed;
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
    startedAt: previous.startedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    root,
    achievementCount: ACHIEVEMENTS.length,
    achievementApiNames: ACHIEVEMENTS.map((achievement) => achievement.apiName),
    storeShouldShow: 'TEST BUY',
    ...previous,
    ...update
  };

  try {
    fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
  } catch (error) {
    console.warn('[Chiggas Steam] Failed to write Pass 32 achievement bridge trace JSON:', safeMessage(error));
  }

  try {
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${JSON.stringify(update)}\n`);
  } catch (error) {
    console.warn('[Chiggas Steam] Failed to write Pass 32 achievement bridge trace log:', safeMessage(error));
  }

  return trace;
}

function createChiggasSteamAchievementBridgePass32(options = {}) {
  const appId = Number(options.appId || DEFAULT_APP_ID);
  let steamworks = null;
  let client = null;
  let initAttempted = false;
  let lastInitError = null;

  function initSteamworks() {
    if (client && client.achievement && typeof client.achievement.activate === 'function') {
      return { ok: true, client };
    }

    initAttempted = true;

    try {
      steamworks = steamworks || require('steamworks.js');
    } catch (error) {
      lastInitError = safeMessage(error);
      return { ok: false, status: 'steamworks_js_not_available_for_event_bridge', error: lastInitError };
    }

    try {
      client = steamworks.init(appId);
    } catch (error) {
      lastInitError = safeMessage(error);
      return { ok: false, status: 'steamworks_init_failed_for_event_bridge', error: lastInitError };
    }

    if (!client || !client.achievement || typeof client.achievement.activate !== 'function') {
      lastInitError = 'client.achievement.activate is not available';
      return {
        ok: false,
        status: 'steam_achievement_activate_api_not_available_for_event_bridge',
        clientReady: Boolean(client),
        achievementApiReady: Boolean(client && client.achievement),
        hasActivate: Boolean(client && client.achievement && typeof client.achievement.activate === 'function'),
        error: lastInitError
      };
    }

    lastInitError = null;
    return { ok: true, client };
  }

  function getAchievementList() {
    return ACHIEVEMENTS.map((achievement) => ({ ...achievement }));
  }

  function getStatus() {
    const status = {
      ok: true,
      pass: PASS,
      appId,
      status: 'steam_achievement_event_bridge_available',
      achievementCount: ACHIEVEMENTS.length,
      achievementApiNames: ACHIEVEMENTS.map((achievement) => achievement.apiName),
      firstRunManagedByLaunchHook: true,
      initAttempted,
      clientReady: Boolean(client),
      achievementApiReady: Boolean(client && client.achievement),
      lastInitError,
      storeShouldShow: 'TEST BUY'
    };

    writeTrace({
      ...status,
      attemptedUnlock: false
    });

    return status;
  }

  function unlock(apiName, metadata = {}) {
    const achievementName = String(apiName || '').trim();
    const safeMetadata = sanitizeMetadata(metadata);
    const achievement = ACHIEVEMENT_MAP[achievementName];

    if (!achievement) {
      return writeTrace({
        ok: true,
        status: 'steam_achievement_event_bridge_blocked_unknown_achievement',
        achievement: achievementName,
        attemptedUnlock: false,
        knownAchievement: false,
        metadata: safeMetadata,
        storeShouldShow: 'TEST BUY'
      });
    }

    if (achievement.managedBy === 'launch_hook') {
      return writeTrace({
        ok: true,
        status: 'steam_achievement_event_bridge_blocked_launch_hook_managed_achievement',
        achievement: achievementName,
        displayName: achievement.displayName,
        attemptedUnlock: false,
        knownAchievement: true,
        metadata: safeMetadata,
        meaning: 'FIRST_RUN is intentionally handled by the Electron launch hook, not by renderer gameplay events.',
        storeShouldShow: 'TEST BUY'
      });
    }

    if (process.env.CHIGGAS_STEAM_ACHIEVEMENT_EVENT_BRIDGE_DISABLED === 'true') {
      return writeTrace({
        ok: true,
        status: 'steam_achievement_event_bridge_unlock_blocked_by_disabled_env',
        achievement: achievementName,
        displayName: achievement.displayName,
        attemptedUnlock: false,
        knownAchievement: true,
        metadata: safeMetadata,
        storeShouldShow: 'TEST BUY'
      });
    }

    const init = initSteamworks();
    if (!init.ok) {
      return writeTrace({
        ok: false,
        status: init.status,
        achievement: achievementName,
        displayName: achievement.displayName,
        attemptedUnlock: false,
        knownAchievement: true,
        metadata: safeMetadata,
        error: init.error || null,
        clientReady: Boolean(client),
        achievementApiReady: Boolean(client && client.achievement),
        storeShouldShow: 'TEST BUY'
      });
    }

    try {
      const activationResult = init.client.achievement.activate(achievementName);
      return writeTrace({
        ok: true,
        status: activationResult === false
          ? 'steam_achievement_event_bridge_activate_returned_false_or_noop'
          : 'steam_achievement_event_bridge_activate_succeeded',
        achievement: achievementName,
        displayName: achievement.displayName,
        attemptedUnlock: true,
        knownAchievement: true,
        metadata: safeMetadata,
        activationResult,
        storeMethodAvailable: Boolean(init.client.achievement && typeof init.client.achievement.store === 'function'),
        storeMethodCalled: false,
        storeShouldShow: 'TEST BUY'
      });
    } catch (error) {
      return writeTrace({
        ok: false,
        status: 'steam_achievement_event_bridge_activate_failed',
        achievement: achievementName,
        displayName: achievement.displayName,
        attemptedUnlock: true,
        knownAchievement: true,
        metadata: safeMetadata,
        error: safeMessage(error),
        storeShouldShow: 'TEST BUY'
      });
    }
  }

  return {
    pass: PASS,
    appId,
    unlock,
    getStatus,
    getAchievementList,
    writeTrace
  };
}

module.exports = {
  PASS,
  DEFAULT_APP_ID,
  ACHIEVEMENTS,
  ACHIEVEMENT_MAP,
  createChiggasSteamAchievementBridgePass32
};
