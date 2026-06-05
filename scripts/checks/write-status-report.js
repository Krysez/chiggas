const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../lib/paths');
const { ensureDir } = require('../lib/file-utils');

const commands = [
  ['verify', ['npm', ['run', 'verify']]],
  ['manifest', ['npm', ['run', 'manifest:write']]],
  ['audit', ['npm', ['run', 'audit:write']]],
  ['structure', ['npm', ['run', 'structure:report']]],
  ['androidToolchain', ['npm', ['run', 'android:toolchain']]]
];

function run(command, args) {
  const result = childProcess.spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function lastJsonObject(text) {
  const source = String(text || '');
  for (let index = source.lastIndexOf('{'); index >= 0; index = source.lastIndexOf('{', index - 1)) {
    const candidate = source.slice(index).trim();
    try {
      return JSON.parse(candidate);
    } catch (_) {
      // Keep walking backward; command output can contain several JSON objects.
    }
  }
  return null;
}

function extractJson(commandResult) {
  return lastJsonObject(commandResult.stdout) || lastJsonObject(commandResult.stderr) || {
    ok: commandResult.ok,
    status: commandResult.ok ? 'command_passed' : 'command_failed'
  };
}

const results = {};
for (const [name, [command, args]] of commands) {
  results[name] = run(command, args);
}

const verify = extractJson(results.verify);
const manifest = extractJson(results.manifest);
const audit = extractJson(results.audit);
const structure = extractJson(results.structure);
const toolchain = extractJson(results.androidToolchain);
const generatedAt = new Date().toISOString();

const lines = [
  '# Chiggas Unified Status',
  '',
  `Generated: ${generatedAt}`,
  '',
  '## Summary',
  '',
  `- Source verification: ${verify.ok ? 'pass' : 'fail'} (${verify.status || 'unknown'})`,
  `- Payload manifest: ${manifest.ok ? 'pass' : 'fail'} (${manifest.status || 'unknown'})`,
  `- NPM audit: ${audit.ok ? 'clean' : 'findings'} (${audit.status || 'unknown'})`,
  `- Structure report: ${structure.ok ? 'pass' : 'fail'} (${structure.status || 'unknown'})`,
  `- Android native toolchain: ${toolchain.ok ? 'ready' : 'incomplete'} (${toolchain.status || 'unknown'})`,
  '',
  '## Commands',
  '',
  '```powershell',
  'cd C:\\ChiggasUnified',
  'npm run sync:all',
  'npm run verify',
  'npm run manifest:write',
  'npm run audit:write',
  'npm run structure:report',
  'npm run android:toolchain',
  '```',
  '',
  '## Verification',
  '',
  `Checks: ${(verify.checks || []).join(', ') || 'not reported'}`,
  `Failed: ${(verify.failed || []).join(', ') || 'none'}`,
  '',
  '## Payload Manifest',
  '',
  `Output: C:\\ChiggasUnified\\docs\\payload-manifest.json`,
  ...(manifest.payloads || []).map(payload => `- ${payload.label}: ${payload.fileCount} files (${payload.combinedHash})`),
  '',
  'Comparisons:',
  ...(manifest.comparisons || []).map(item => `- ${item.label}: ${item.matchesGame ? 'matches game' : 'differs from game'}`),
  '',
  '## Audit',
  '',
  `Output: C:\\ChiggasUnified\\docs\\audit-report.md`,
  ...(audit.projects || []).map(project => {
    const vulnerabilities = project.vulnerabilities || {};
    return `- ${project.name}: ${project.status || 'unknown'}, total vulnerabilities ${vulnerabilities.total || 0}`;
  }),
  '',
  '## Structure',
  '',
  `- Shared game files: ${structure.sourceOfTruth && structure.sourceOfTruth.game ? structure.sourceOfTruth.game.files : 'unknown'}`,
  `- Integration files: ${structure.sourceOfTruth && structure.sourceOfTruth.integrations ? structure.sourceOfTruth.integrations.files : 'unknown'}`,
  `- Steam wrapper files: ${structure.platforms && structure.platforms.steamElectron ? structure.platforms.steamElectron.files : 'unknown'}`,
  `- Android wrapper files: ${structure.platforms && structure.platforms.androidCapacitor ? structure.platforms.androidCapacitor.files : 'unknown'}`,
  `- Script files: ${structure.support && structure.support.scripts ? structure.support.scripts.files : 'unknown'}`,
  `- Docs files: ${structure.support && structure.support.docs ? structure.support.docs.files : 'unknown'}`,
  '',
  '## Android Toolchain',
  '',
  toolchain.note || 'No Android toolchain note reported.',
  '',
  ...(toolchain.checks || []).map(check => `- ${check.label}: ${check.ok ? 'ok' : 'missing'}${check.actual ? ` (${check.actual})` : ''}`),
  '',
  '## Notes',
  '',
  '- Original source folders remain untouched.',
  '- `C:\\ChiggasUnified\\game` is the shared game source of truth.',
  '- Steam and Android payloads should be refreshed with `npm run sync:all` after shared game changes.',
  '- Gradle build and Android tests require Java plus Android SDK environment setup.'
];

const outputPath = path.join(ROOT, 'docs', 'status.md');
ensureDir(path.dirname(outputPath));
fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf8');

const ok = results.verify.ok && results.manifest.ok && results.audit.ok && results.structure.ok;
console.log(JSON.stringify({
  ok,
  status: ok ? 'status_report_written' : 'status_report_written_with_failures',
  outputPath,
  generatedAt,
  verify: {
    ok: verify.ok,
    status: verify.status,
    failed: verify.failed || []
  },
  manifest: {
    ok: manifest.ok,
    status: manifest.status,
    comparisons: manifest.comparisons || []
  },
  audit: {
    ok: audit.ok,
    status: audit.status,
    projects: audit.projects || []
  },
  androidToolchain: {
    ok: toolchain.ok,
    status: toolchain.status
  }
}, null, 2));

process.exit(ok ? 0 : 1);
