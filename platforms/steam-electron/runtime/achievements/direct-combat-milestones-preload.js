function installCombatMilestoneAchievementListeners() {
  require('./first-soldier-recruited-preload').installFirstSoldierRecruitedPreload();
  require('./first-enemy-defeated-preload').installFirstEnemyDefeatedPreload();
  require('./ten-enemies-defeated-preload').installTenEnemiesDefeatedPreload();
}

module.exports = {
  installCombatMilestoneAchievementListeners
};
