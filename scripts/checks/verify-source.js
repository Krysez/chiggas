const childProcess = require('child_process');
const { ROOT } = require('../lib/paths');

const checks = [
  'check',
  'steam:check',
  'android:check',
  'deps:check',
  'hygiene:check',
  'paths:check',
  'diff:platforms',
  'runtime:report'
];

function runScript(script) {
  console.log(`\n== npm run ${script} ==`);
  const result = childProcess.spawnSync('npm', ['run', script], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: 'inherit'
  });

  return result.status === 0;
}

const failed = [];

for (const check of checks) {
  if (!runScript(check)) failed.push(check);
}

const ok = failed.length === 0;

console.log('\n' + JSON.stringify({
  ok,
  status: ok ? 'source_verification_passed' : 'source_verification_failed',
  checks,
  failed
}, null, 2));

process.exit(ok ? 0 : 1);
