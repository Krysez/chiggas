function installLeaderboardMainRuntime() {
  require('./leaderboards/api-capture-main').installLeaderboardApiAndCaptureMain();
  require('./leaderboards/probe-main').installLeaderboardProbeMain();
  require('./leaderboards/auto-submit-main').installLeaderboardAutoSubmitMain();
  require('./leaderboards/watchdog-main').installLeaderboardWatchdogMain();
}

module.exports = {
  installLeaderboardMainRuntime
};
