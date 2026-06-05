const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { ANDROID_DIR } = require('../lib/paths');
const { exists } = require('../lib/file-utils');

function run(command, args, options = {}) {
  try {
    const result = childProcess.spawnSync(command, args, {
      cwd: options.cwd || ANDROID_DIR,
      encoding: 'utf8',
      shell: false
    });
    return {
      ok: result.status === 0,
      status: result.status,
      stdout: (result.stdout || '').trim(),
      stderr: (result.stderr || '').trim()
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      stdout: '',
      stderr: String(error && error.message ? error.message : error)
    };
  }
}

function firstLine(text) {
  return String(text || '').split(/\r?\n/).find(Boolean) || '';
}

function localAppDataPath(...parts) {
  return process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, ...parts) : '';
}

function readLocalSdkDir() {
  const localProperties = path.join(ANDROID_DIR, 'android', 'local.properties');
  if (!exists(localProperties)) return '';
  const text = fs.readFileSync(localProperties, 'utf8');
  const match = text.match(/^sdk\.dir=(.+)$/m);
  if (!match) return '';
  return match[1].replace(/\\:/g, ':').replace(/\\\\/g, '\\');
}

function main() {
  const javaHome = process.env.JAVA_HOME || '';
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
  const androidStudioJbr = path.join('C:', 'Program Files', 'Android', 'Android Studio', 'jbr');
  const localSdk = readLocalSdkDir();
  const defaultSdk = localAppDataPath('Android', 'Sdk');
  const detectedJavaHome = javaHome || (exists(path.join(androidStudioJbr, 'bin', 'java.exe')) ? androidStudioJbr : '');
  const detectedAndroidHome = androidHome || localSdk || (exists(defaultSdk) ? defaultSdk : '');
  const gradlew = path.join(ANDROID_DIR, 'android', 'gradlew.bat');
  const javaCommand = detectedJavaHome ? path.join(detectedJavaHome, 'bin', 'java.exe') : 'java';
  const javaVersion = run(javaCommand, ['-version']);

  const checks = [
    {
      label: 'Java home detected',
      ok: Boolean(detectedJavaHome),
      actual: detectedJavaHome || null
    },
    {
      label: 'java executable',
      ok: javaVersion.ok,
      actual: firstLine(javaVersion.stderr || javaVersion.stdout) || javaVersion.stderr || null
    },
    {
      label: 'Android SDK detected',
      ok: Boolean(detectedAndroidHome),
      actual: detectedAndroidHome || null
    },
    {
      label: 'Gradle wrapper',
      ok: exists(gradlew),
      actual: gradlew
    }
  ];

  const ok = checks.every(check => check.ok);
  console.log(JSON.stringify({
    ok,
    status: ok ? 'android_toolchain_ready' : 'android_toolchain_incomplete',
    note: ok ? 'Gradle build commands can be attempted.' : 'Install/configure Java JDK and Android SDK before Gradle build commands.',
    checks
  }, null, 2));
}

main();
