const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { ROOT, STEAM_DIR, ANDROID_DIR, STEAM_INTEGRATIONS_DIR } = require('../lib/paths');
const { ensureDir } = require('../lib/file-utils');

const projects = [
  ['steam-electron', STEAM_DIR],
  ['android-capacitor', ANDROID_DIR],
  ['steam-entitlement-backend', path.join(STEAM_INTEGRATIONS_DIR, 'entitlement-backend')]
];

function runAudit(cwd) {
  const result = childProcess.spawnSync('npm', ['audit', '--json'], {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });

  let report = null;
  try {
    report = JSON.parse(result.stdout || '{}');
  } catch (_) {
    report = {
      auditReportVersion: null,
      error: {
        message: 'Unable to parse npm audit output.',
        stdout: result.stdout || '',
        stderr: result.stderr || ''
      }
    };
  }

  return {
    ok: result.status === 0,
    status: result.status,
    report
  };
}

function summarize(name, cwd, audit) {
  const metadata = audit.report.metadata || {};
  const vulnerabilities = metadata.vulnerabilities || {};
  const advisories = Object.values(audit.report.vulnerabilities || {}).map(item => ({
    name: item.name,
    severity: item.severity,
    isDirect: item.isDirect,
    range: item.range,
    fixAvailable: item.fixAvailable
  }));

  return {
    name,
    cwd,
    ok: audit.ok,
    status: audit.ok ? 'audit_clean' : 'audit_has_findings',
    exitStatus: audit.status,
    vulnerabilities,
    advisories
  };
}

const audits = projects.map(([name, cwd]) => summarize(name, cwd, runAudit(cwd)));
const total = audits.reduce((sum, item) => sum + (item.vulnerabilities.total || 0), 0);

const report = {
  ok: total === 0,
  status: total === 0 ? 'audit_report_clean' : 'audit_report_has_findings',
  generatedAt: new Date().toISOString(),
  projects: audits
};

const outputPath = path.join(ROOT, 'docs', 'audit-report.json');
ensureDir(path.dirname(outputPath));
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

const summaryPath = path.join(ROOT, 'docs', 'audit-report.md');
const lines = [
  '# Audit Report',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  `Status: ${report.status}`,
  '',
  '## Projects',
  '',
  ...audits.flatMap(project => [
    `### ${project.name}`,
    '',
    `- Status: ${project.status}`,
    `- Total vulnerabilities: ${project.vulnerabilities.total || 0}`,
    `- Critical: ${project.vulnerabilities.critical || 0}`,
    `- High: ${project.vulnerabilities.high || 0}`,
    `- Moderate: ${project.vulnerabilities.moderate || 0}`,
    `- Low: ${project.vulnerabilities.low || 0}`,
    '',
    ...(project.advisories.length
      ? project.advisories.map(item => `- ${item.name}: ${item.severity}, range ${item.range}`)
      : ['- No advisories reported.']),
    ''
  ]),
  'Detailed JSON is available at `C:\\ChiggasUnified\\docs\\audit-report.json`.'
];
fs.writeFileSync(summaryPath, lines.join('\n') + '\n', 'utf8');

console.log(JSON.stringify({
  ok: report.ok,
  status: report.status,
  outputPath,
  summaryPath,
  generatedAt: report.generatedAt,
  projects: audits.map(project => ({
    name: project.name,
    status: project.status,
    vulnerabilities: project.vulnerabilities
  }))
}, null, 2));

process.exit(0);
