const path = require('path');
const {
  ROOT,
  GAME_DIR,
  STEAM_DIR,
  ANDROID_DIR,
  INTEGRATIONS_DIR,
  STEAM_INTEGRATIONS_DIR
} = require('../lib/paths');
const { exists, listFiles } = require('../lib/file-utils');

function countFiles(root, options = {}) {
  return listFiles(root, options).length;
}

function topLevelDirs(root) {
  if (!exists(root)) return [];
  return require('fs')
    .readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

function normalizedRel(rel) {
  return rel.replace(/\\/g, '/');
}

function commonGeneratedExclude(rel) {
  const normalized = normalizedRel(rel);
  return normalized.startsWith('node_modules/')
    || normalized.startsWith('.git/')
    || normalized.startsWith('dist/')
    || normalized.startsWith('build/')
    || normalized.startsWith('out/')
    || normalized.startsWith('coverage/')
    || normalized.endsWith('.log');
}

const integrationsGeneratedExclude = rel => {
  const normalized = normalizedRel(rel);
  return commonGeneratedExclude(rel)
    || normalized.startsWith('steam/entitlement-backend/node_modules/')
    || normalized.startsWith('steam/entitlement-backend/data/')
    || normalized.startsWith('steam/entitlement-backend/backups/')
    || normalized.startsWith('steam/steamworks/generated/');
};

const steamGeneratedExclude = rel => {
  const normalized = normalizedRel(rel);
  return commonGeneratedExclude(rel)
    || normalized.startsWith('steam_depot_build/');
};

const androidGeneratedExclude = rel => {
  const normalized = normalizedRel(rel);
  return commonGeneratedExclude(rel)
    || normalized.includes('/build/')
    || normalized.startsWith('android/.gradle/')
    || normalized.startsWith('android/build/')
    || normalized.startsWith('android/app/build/')
    || normalized.startsWith('android/.kotlin/');
};

const report = {
  ok: true,
  status: 'unified_structure_report',
  root: ROOT,
  sourceOfTruth: {
    game: {
      path: GAME_DIR,
      files: countFiles(GAME_DIR),
      topLevelDirs: topLevelDirs(GAME_DIR)
    },
    integrations: {
      path: INTEGRATIONS_DIR,
      files: countFiles(INTEGRATIONS_DIR, { exclude: integrationsGeneratedExclude }),
      steamFiles: countFiles(STEAM_INTEGRATIONS_DIR, {
        exclude: rel => integrationsGeneratedExclude(path.join('steam', rel))
      }),
      topLevelDirs: topLevelDirs(INTEGRATIONS_DIR)
    }
  },
  platforms: {
    steamElectron: {
      path: STEAM_DIR,
      files: countFiles(STEAM_DIR, { exclude: steamGeneratedExclude }),
      topLevelDirs: topLevelDirs(STEAM_DIR)
    },
    androidCapacitor: {
      path: ANDROID_DIR,
      files: countFiles(ANDROID_DIR, { exclude: androidGeneratedExclude }),
      topLevelDirs: topLevelDirs(ANDROID_DIR)
    }
  },
  support: {
    scripts: {
      path: path.join(ROOT, 'scripts'),
      files: countFiles(path.join(ROOT, 'scripts')),
      topLevelDirs: topLevelDirs(path.join(ROOT, 'scripts'))
    },
    docs: {
      path: path.join(ROOT, 'docs'),
      files: countFiles(path.join(ROOT, 'docs')),
      topLevelDirs: topLevelDirs(path.join(ROOT, 'docs'))
    },
    archive: {
      path: path.join(ROOT, 'archive'),
      files: countFiles(path.join(ROOT, 'archive')),
      topLevelDirs: topLevelDirs(path.join(ROOT, 'archive'))
    }
  }
};

console.log(JSON.stringify(report, null, 2));
