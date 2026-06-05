function installSteamItemStoreHandlers() {
  require('./item-store/hardwire-handler-main').installItemStoreHardwireHandlerMain();
  require('./item-store/windows-open-chain-main').installItemStoreWindowsOpenChainMain();
  require('./item-store/dynamic-url-handler-main').installItemStoreDynamicUrlHandlerMain();
}

module.exports = {
  installSteamItemStoreHandlers
};
