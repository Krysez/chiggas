function installWeaponActionAchievementListeners() {
  require('./first-weapon-pickup-event-preload').installFirstWeaponPickupEventPreload();
  require('./first-speed-boost-preload').installFirstSpeedBoostPreload();
  require('./first-shot-fired-preload').installFirstShotFiredPreload();
  require('./first-munch-preload').installFirstMunchPreload();
  require('./first-munch-counter-preload').installFirstMunchCounterPreload();
}

module.exports = {
  installWeaponActionAchievementListeners
};
