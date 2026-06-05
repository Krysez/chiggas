const { GAME_DIR, STEAM_GAME_DIR, ANDROID_WWW_DIR, ANDROID_PUBLIC_DIR } = require('../lib/paths');
const { exists, hashFile, listFiles } = require('../lib/file-utils');

function comparableFiles(root) {
  return listFiles(root, {
    exclude: (rel, entry) => {
      const normalized = rel.replace(/\\/g, '/');
      return entry.isDirectory() && ['node_modules'].includes(entry.name) ||
        normalized === 'vendor/phaser/phaser.esm.js' ||
        normalized === 'cordova.js' ||
        normalized === 'cordova_plugins.js';
    }
  });
}

function diffAgainst(label, root) {
  if (!exists(root)) {
    return { label, root, ok: false, status: 'missing_payload', same: 0, different: [], missing: [], extra: [] };
  }

  const sourceFiles = comparableFiles(GAME_DIR);
  const targetFiles = comparableFiles(root);
  const targetByRel = new Map(targetFiles.map(file => [file.rel, file.full]));
  const sourceByRel = new Map(sourceFiles.map(file => [file.rel, file.full]));
  const different = [];
  const missing = [];
  let same = 0;

  for (const file of sourceFiles) {
    const target = targetByRel.get(file.rel);
    if (!target) missing.push(file.rel);
    else if (hashFile(file.full) === hashFile(target)) same += 1;
    else different.push(file.rel);
  }

  const extra = targetFiles.filter(file => !sourceByRel.has(file.rel)).map(file => file.rel);
  const ok = different.length === 0 && missing.length === 0 && extra.length === 0;
  return { label, root, ok, status: ok ? 'payload_matches_game' : 'payload_differs', same, different, missing, extra };
}

function main() {
  const results = [
    diffAgainst('steam', STEAM_GAME_DIR),
    diffAgainst('android-www', ANDROID_WWW_DIR),
    diffAgainst('android-public', ANDROID_PUBLIC_DIR)
  ];
  const ok = results.every(result => result.ok);
  console.log(JSON.stringify({ ok, status: ok ? 'platform_payloads_match' : 'platform_payloads_differ', results }, null, 2));
  process.exit(ok ? 0 : 1);
}

main();
