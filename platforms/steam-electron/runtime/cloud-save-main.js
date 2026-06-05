const cloudSave = require('../steam-cloud-save-export-pass-98a');

function exportCloudSave(reason, app, options = {}) {
  try {
    const result = cloudSave.exportCloudSave(reason, app, options);
    console.log('[Chiggas Steam Cloud] save export:', JSON.stringify(result));
    return result;
  } catch (error) {
    console.warn('[Chiggas Steam Cloud] save export failed:', error);
    return null;
  }
}

function installRobustCloudSaveHooks(app) {
  const writeCloud = (reason) => exportCloudSave(reason, app, {
    source: 'pass_98b_robust_main_process_hook',
    pid: process.pid,
    cwd: process.cwd(),
    execPath: process.execPath,
    argv: process.argv
  });

  writeCloud('main_process_load');

  try {
    if (app && typeof app.whenReady === 'function') {
      app.whenReady().then(() => {
        writeCloud('app_when_ready');
        setTimeout(() => writeCloud('app_ready_delayed_2s'), 2000);
      });
    }
  } catch (error) {
    console.warn('[Chiggas Steam Cloud] app.whenReady export failed:', error);
  }

  try { app.on('before-quit', () => writeCloud('before_quit_98b')); } catch (_) {}
  try { app.on('will-quit', () => writeCloud('will_quit_98b')); } catch (_) {}
  try { process.on('beforeExit', () => writeCloud('process_before_exit_98b')); } catch (_) {}
  try { process.on('exit', () => writeCloud('process_exit_98b')); } catch (_) {}
}

module.exports = {
  exportCloudSave,
  installRobustCloudSaveHooks
};
