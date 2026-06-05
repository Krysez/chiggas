const childProcess = require('child_process');
const { ROOT } = require('../lib/paths');

const scripts = ['sync:steam', 'sync:android'];
const failed = [];

for (const script of scripts) {
  console.log(`\n== npm run ${script} ==`);
  const result = childProcess.spawnSync('npm', ['run', script], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: 'inherit'
  });

  if (result.status !== 0) failed.push(script);
}

const ok = failed.length === 0;

console.log('\n' + JSON.stringify({
  ok,
  status: ok ? 'all_platforms_synced' : 'platform_sync_failed',
  scripts,
  failed
}, null, 2));

process.exit(ok ? 0 : 1);
