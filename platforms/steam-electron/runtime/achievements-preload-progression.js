function installProgressionAchievementPreloadListeners() {
  require('./achievements/full-legendary-fit-preload').installFullLegendaryFitPreload();
  require('./achievements/all-legendary-wear-preload').installAllLegendaryWearPreload();
  require('./achievements/all-base-chiggas-preload').installAllBaseChiggasPreload();
  require('./achievements/five-minute-run-preload').installFiveMinuteRunPreload();
  require('./achievements/mitiest-survivor-preload').installMitiestSurvivorPreload();
}

module.exports = {
  installProgressionAchievementPreloadListeners
};
