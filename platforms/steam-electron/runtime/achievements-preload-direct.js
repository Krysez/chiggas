function installDirectAchievementPreloadListeners() {
  require('./achievements/direct-weapon-actions-preload').installWeaponActionAchievementListeners();
  require('./achievements/direct-combat-milestones-preload').installCombatMilestoneAchievementListeners();
  require('./achievements/direct-survival-legendary-preload').installSurvivalLegendaryAchievementListeners();
}

module.exports = {
  installDirectAchievementPreloadListeners
};
