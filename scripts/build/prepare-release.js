const childProcess = require('child_process');
const { ROOT } = require('../lib/paths');

const steps = [
  ['sync all platform payloads', ['run', 'sync:all']],
  ['verify source', ['run', 'verify']],
  ['release readiness', ['run', 'release:check']],
  ['release versions', ['run', 'release:versions']],
  ['Steam backend readiness', ['run', 'steam:backend:check']],
  ['release artifacts', ['run', 'release:artifacts']]
];

function npmArgs(args) {
  return process.platform === 'win32'
    ? ['cmd.exe', ['/d', '/s', '/c', 'npm', ...args]]
    : ['npm', args];
}

function run(label, npmCommandArgs) {
  console.log(`\n== ${label} ==`);
  const [command, args] = npmArgs(npmCommandArgs);
  const result = childProcess.spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit'
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(typeof result.status === 'number' ? result.status : 1);
  }
}

for (const [label, npmCommandArgs] of steps) {
  run(label, npmCommandArgs);
}

console.log('\n' + JSON.stringify({
  ok: true,
  status: 'release_prep_ready',
  steps: steps.map(([label]) => label)
}, null, 2));
