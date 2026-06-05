const fs = require('fs');
const path = require('path');
const { ROOT, STEAM_DIR, ANDROID_DIR, STEAM_INTEGRATIONS_DIR } = require('../lib/paths');
const { exists } = require('../lib/file-utils');

const packages = [
  path.join(ROOT, 'package.json'),
  path.join(STEAM_DIR, 'package.json'),
  path.join(ANDROID_DIR, 'package.json'),
  path.join(STEAM_INTEGRATIONS_DIR, 'entitlement-backend', 'package.json')
];

const dependencySections = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies'
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isPinned(version) {
  return typeof version === 'string'
    && /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(version);
}

function lockPathFor(packagePath) {
  return path.join(path.dirname(packagePath), 'package-lock.json');
}

const packageChecks = packages.map(packagePath => {
  const packageJson = readJson(packagePath);
  const rel = path.relative(ROOT, packagePath).replace(/\\/g, '/');
  const unpinned = [];

  for (const section of dependencySections) {
    const deps = packageJson[section] || {};
    for (const [name, version] of Object.entries(deps)) {
      if (!isPinned(version)) {
        unpinned.push({ section, name, version });
      }
    }
  }

  const lockPath = lockPathFor(packagePath);
  const hasDependencies = dependencySections.some(section => packageJson[section] && Object.keys(packageJson[section]).length);
  const lockExists = !hasDependencies || exists(lockPath);
  let lockMatches = true;
  let lockRoot = null;

  if (hasDependencies && lockExists) {
    const lockJson = readJson(lockPath);
    lockRoot = lockJson.packages && lockJson.packages[''] ? lockJson.packages[''] : null;
    lockMatches = Boolean(lockRoot)
      && lockJson.name === packageJson.name
      && lockJson.version === packageJson.version;

    for (const section of dependencySections) {
      const packageDeps = packageJson[section] || {};
      const lockDeps = lockRoot && lockRoot[section] ? lockRoot[section] : {};
      for (const [name, version] of Object.entries(packageDeps)) {
        if (lockDeps[name] !== version) lockMatches = false;
      }
    }
  }

  return {
    package: rel,
    ok: unpinned.length === 0 && lockExists && lockMatches,
    hasDependencies,
    lock: path.relative(ROOT, lockPath).replace(/\\/g, '/'),
    lockExists,
    lockMatches,
    unpinned
  };
});

const ok = packageChecks.every(check => check.ok);

console.log(JSON.stringify({
  ok,
  status: ok ? 'dependency_policy_ready' : 'dependency_policy_failed',
  packageChecks,
  failed: packageChecks.filter(check => !check.ok)
}, null, 2));

process.exit(ok ? 0 : 1);
