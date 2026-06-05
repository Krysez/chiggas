function installAchievementObserverPreloadListeners() {
  require('./achievements/runtime-scene-observer-preload').installRuntimeSceneObserverPreload();
  require('./achievements/first-game-started-interaction-preload').installFirstGameStartedInteractionPreload();
  require('./achievements/first-store-visit-click-map-preload').installFirstStoreVisitClickMapPreload();
  require('./achievements/first-store-visit-coordinate-preload').installFirstStoreVisitCoordinatePreload();
  require('./achievements/first-weapon-pickup-map-preload').installFirstWeaponPickupMapPreload();
}

module.exports = {
  installAchievementObserverPreloadListeners
};
