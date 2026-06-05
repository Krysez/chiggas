function installLeaderboardPreloadRuntime() {
  require('./leaderboards/api-capture-preload').installLeaderboardApiAndCapturePreload();
  require('./leaderboards/probe-preload').installLeaderboardProbePreload();
  require('./leaderboards/auto-submit-preload').installLeaderboardAutoSubmitPreload();
  require('./leaderboards/watchdog-preload').installLeaderboardWatchdogPreload();
}

module.exports = {
  installLeaderboardPreloadRuntime
};
