const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function exists(target) {
  try {
    return fs.existsSync(target);
  } catch (_) {
    return false;
  }
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function removeDir(target) {
  if (exists(target)) fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(source, destination, options = {}) {
  const exclude = options.exclude || (() => false);
  removeDir(destination);
  ensureDir(destination);

  function walk(src, dest, rel = '') {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const entryRel = rel ? path.join(rel, entry.name) : entry.name;
      if (exclude(entryRel, entry)) continue;
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        ensureDir(destPath);
        walk(srcPath, destPath, entryRel);
      } else if (entry.isFile()) {
        ensureDir(path.dirname(destPath));
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  walk(source, destination);
}

function copyMissingFiles(source, destination) {
  if (!exists(source)) return 0;
  let copied = 0;

  function walk(src, rel = '') {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const entryRel = rel ? path.join(rel, entry.name) : entry.name;
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(destination, entryRel);
      if (entry.isDirectory()) {
        walk(srcPath, entryRel);
      } else if (entry.isFile() && !exists(destPath)) {
        ensureDir(path.dirname(destPath));
        fs.copyFileSync(srcPath, destPath);
        copied += 1;
      }
    }
  }

  walk(source);
  return copied;
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function listFiles(root, options = {}) {
  const exclude = options.exclude || (() => false);
  const out = [];
  if (!exists(root)) return out;

  function walk(dir, rel = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryRel = rel ? path.join(rel, entry.name) : entry.name;
      if (exclude(entryRel, entry)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, entryRel);
      else if (entry.isFile()) out.push({ rel: entryRel, full });
    }
  }

  walk(root);
  return out;
}

module.exports = {
  exists,
  ensureDir,
  removeDir,
  copyDir,
  copyMissingFiles,
  hashFile,
  listFiles
};
