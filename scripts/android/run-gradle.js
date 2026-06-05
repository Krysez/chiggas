const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { ANDROID_DIR } = require('../lib/paths');
const { exists } = require('../lib/file-utils');

const androidProjectDir = path.join(ANDROID_DIR, 'android');
const gradlew = path.join(androidProjectDir, 'gradlew.bat');
const androidStudioJbr = path.join('C:', 'Program Files', 'Android', 'Android Studio', 'jbr');
const defaultSdk = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
  : '';

function readLocalSdkDir() {
  const localProperties = path.join(androidProjectDir, 'local.properties');
  if (!exists(localProperties)) return '';
  const text = fs.readFileSync(localProperties, 'utf8');
  const match = text.match(/^sdk\.dir=(.+)$/m);
  if (!match) return '';
  return match[1].replace(/\\:/g, ':').replace(/\\\\/g, '\\');
}

function ensureLocalProperties(sdkDir) {
  if (!sdkDir || exists(path.join(androidProjectDir, 'local.properties'))) return;
  const escaped = sdkDir.replace(/\\/g, '\\\\').replace(/^([A-Z]):/i, '$1\\:');
  fs.writeFileSync(path.join(androidProjectDir, 'local.properties'), `sdk.dir=${escaped}\n`, 'utf8');
}

const javaHome = process.env.JAVA_HOME
  || (exists(path.join(androidStudioJbr, 'bin', 'java.exe')) ? androidStudioJbr : '');
const sdkDir = process.env.ANDROID_HOME
  || process.env.ANDROID_SDK_ROOT
  || readLocalSdkDir()
  || (defaultSdk && exists(defaultSdk) ? defaultSdk : '');

if (!exists(gradlew)) {
  console.error(`Missing Gradle wrapper: ${gradlew}`);
  process.exit(1);
}

if (!javaHome) {
  console.error('Unable to detect Java. Set JAVA_HOME or install Android Studio with bundled JBR.');
  process.exit(1);
}

if (!sdkDir) {
  console.error('Unable to detect Android SDK. Set ANDROID_HOME/ANDROID_SDK_ROOT or install SDKs with Android Studio.');
  process.exit(1);
}

ensureLocalProperties(sdkDir);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('No Gradle task supplied.');
  process.exit(1);
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: sdkDir,
  ANDROID_SDK_ROOT: sdkDir,
  Path: `${path.join(javaHome, 'bin')};${process.env.Path || process.env.PATH || ''}`
};

const result = childProcess.spawnSync(gradlew, args, {
  cwd: androidProjectDir,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
