const fs = require('fs');
const { ROOT } = require('../lib/paths');
const { listFiles } = require('../lib/file-utils');

const stalePatterns = [
  /C:\\ChiggaStreamWrapper/i,
  /C:\/ChiggaStreamWrapper/i,
  /C:\\Chiggas\\Android\\ChiggasAndroid/i,
  /C:\/Chiggas\/Android\/ChiggasAndroid/i
];

const files = listFiles(ROOT, {
  exclude: (rel, entry) => {
    const normalized = rel.replace(/\\/g, '/');
    if (entry.isDirectory()) {
      return normalized.startsWith('archive/') ||
        normalized.includes('/vendor/') ||
        normalized.includes('/node_modules') ||
        normalized.includes('/build') ||
        normalized.includes('/.gradle') ||
        normalized.includes('/.idea');
    }
    return false;
  }
}).filter(file => /\.(js|json|gradle|xml|properties|vdf|yaml|yml)$/i.test(file.rel));

const matches = [];
for (const file of files) {
  let text = '';
  try {
    text = fs.readFileSync(file.full, 'utf8');
  } catch (_) {
    continue;
  }
  stalePatterns.forEach(pattern => {
    if (pattern.test(text)) matches.push({ file: file.rel, pattern: String(pattern) });
  });
}

console.log(JSON.stringify({
  ok: matches.length === 0,
  status: matches.length === 0 ? 'no_stale_active_absolute_paths' : 'stale_active_absolute_paths_found',
  matchCount: matches.length,
  matches
}, null, 2));

process.exit(matches.length === 0 ? 0 : 1);
