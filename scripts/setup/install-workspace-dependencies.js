const childProcess = require('child_process');
const path = require('path');
const { ROOT } = require('../lib/paths');

const projects = [
  {
    label: 'Steam Electron',
    dir: path.join(ROOT, 'platforms', 'steam-electron')
  },
  {
    label: 'Android Capacitor',
    dir: path.join(ROOT, 'platforms', 'android-capacitor')
  },
  {
    label: 'Steam entitlement backend',
    dir: path.join(ROOT, 'integrations', 'steam', 'entitlement-backend')
  }
];

function run(label, command, args, cwd) {
  console.log(`\n== ${label} ==`);
  const result = childProcess.spawnSync(command, args, {
    cwd,
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

function npmArgs(args) {
  return process.platform === 'win32'
    ? ['cmd.exe', ['/d', '/s', '/c', 'npm', ...args]]
    : ['npm', args];
}

for (const project of projects) {
  const [command, args] = npmArgs(['install', '--ignore-scripts']);
  run(`npm install: ${project.label}`, command, args, project.dir);
}

{
  const [command, args] = npmArgs(['run', 'release:versions']);
  run('release versions', command, args, ROOT);
}
{
  const [command, args] = npmArgs(['run', 'release:check']);
  run('release check', command, args, ROOT);
}
{
  const [command, args] = npmArgs(['run', 'verify']);
  run('verify', command, args, ROOT);
}

console.log('\n' + JSON.stringify({
  ok: true,
  status: 'workspace_dependencies_installed',
  projects: projects.map((project) => ({
    label: project.label,
    dir: project.dir
  }))
}, null, 2));
