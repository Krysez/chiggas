function installSurvivalLegendaryAchievementListeners() {
  require('./first-survival-minute-preload').installFirstSurvivalMinutePreload();
  require('./first-death-preload').installFirstDeathPreload();
  require('./revenge-run-preload').installRevengeRunPreload();
  require('./first-legendary-tryon-preload').installFirstLegendaryTryonPreload();
}

module.exports = {
  installSurvivalLegendaryAchievementListeners
};
