const fs = require('fs');
const path = require('path');
const { STEAM_DIR } = require('../lib/paths');

const RUNTIME_DIR = path.join(STEAM_DIR, 'runtime');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (entry.isFile() && entry.name.endsWith('.js')) return [fullPath];
    return [];
  });
}

function lineCount(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text) return 0;
  return text.split(/\r?\n/).length - (text.endsWith('\n') ? 1 : 0);
}

function relativeRuntimePath(file) {
  return path.relative(STEAM_DIR, file).replace(/\\/g, '/');
}

function groupName(file) {
  const rel = relativeRuntimePath(file);
  const parts = rel.split('/');
  if (parts.length >= 3 && parts[0] === 'runtime') return parts[1];
  return 'runtime';
}

function main() {
  const files = walk(RUNTIME_DIR).map(file => ({
    file: relativeRuntimePath(file),
    group: groupName(file),
    lines: lineCount(file)
  })).sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file));

  const groups = Array.from(files.reduce((map, item) => {
    const current = map.get(item.group) || { group: item.group, files: 0, lines: 0 };
    current.files += 1;
    current.lines += item.lines;
    map.set(item.group, current);
    return map;
  }, new Map()).values()).sort((a, b) => b.lines - a.lines || a.group.localeCompare(b.group));

  const largeFiles = files.filter(file => file.lines >= 250);
  const loaderFiles = files.filter(file => file.lines <= 15 && /(?:main|preload)\.js$/.test(file.file));

  console.log(JSON.stringify({
    ok: true,
    status: 'steam_runtime_module_report',
    runtimeDir: RUNTIME_DIR,
    moduleCount: files.length,
    totalLines: files.reduce((sum, item) => sum + item.lines, 0),
    largest: files.slice(0, 20),
    largeFiles,
    groups,
    loaderFiles
  }, null, 2));
}

main();
