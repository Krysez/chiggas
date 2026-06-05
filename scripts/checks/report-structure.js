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

const androidGeneratedExclude = rel => {
  const normalized = rel.replace(/\\/g, '/');
  return normalized.startsWith('android/.gradle/')
    || normalized.startsWith('android/app/build/')
    || normalized.startsWith('node_modules/');
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
      files: countFiles(INTEGRATIONS_DIR),
      steamFiles: countFiles(STEAM_INTEGRATIONS_DIR),
      topLevelDirs: topLevelDirs(INTEGRATIONS_DIR)
    }
  },
  platforms: {
    steamElectron: {
      path: STEAM_DIR,
      files: countFiles(STEAM_DIR, {
        exclude: rel => rel.replace(/\\/g, '/').startsWith('node_modules/')
      }),
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
