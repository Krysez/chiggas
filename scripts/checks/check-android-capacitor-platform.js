const fs = require('fs');
const path = require('path');
const {
  ANDROID_DIR,
  ANDROID_PUBLIC_DIR,
  ANDROID_WWW_DIR
} = require('../lib/paths');
const { exists } = require('../lib/file-utils');

const expectedPackage = 'com.krysez.chiggas';

const requiredFiles = [
  'package.json',
  'package-lock.json',
  'capacitor.config.json',
  'android/app/build.gradle',
  'android/app/src/main/AndroidManifest.xml',
  'android/app/src/main/java/com/krysez/chiggas/MainActivity.java',
  'android/app/src/main/java/com/krysez/chiggas/GooglePlayBillingBridge.java',
  'android/app/src/test/java/com/krysez/chiggas/ExampleUnitTest.java',
  'android/app/src/androidTest/java/com/krysez/chiggas/ExampleInstrumentedTest.java',
  'www/index.html',
  'www/vendor/phaser/VERSION.txt',
  'android/app/src/main/assets/public/index.html',
  'android/app/src/main/assets/public/vendor/phaser/VERSION.txt'
];

function read(rel) {
  return fs.readFileSync(path.join(ANDROID_DIR, rel), 'utf8');
}

function main() {
  const fileChecks = requiredFiles.map(file => ({
    file,
    exists: exists(path.join(ANDROID_DIR, file))
  }));
  const missingRequiredFiles = fileChecks.filter(check => !check.exists);

  const pkg = JSON.parse(read('package.json'));
  const capConfig = JSON.parse(read('capacitor.config.json'));
  const assetCapConfig = JSON.parse(read('android/app/src/main/assets/capacitor.config.json'));
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const unitTest = read('android/app/src/test/java/com/krysez/chiggas/ExampleUnitTest.java');
  const instrumentedTest = read('android/app/src/androidTest/java/com/krysez/chiggas/ExampleInstrumentedTest.java');
  const wwwPhaserVersion = read('www/vendor/phaser/VERSION.txt');
  const publicPhaserVersion = read('android/app/src/main/assets/public/vendor/phaser/VERSION.txt');

  const scriptNames = Object.keys(pkg.scripts || {}).sort();
  const checks = [
    {
      label: 'package name',
      ok: pkg.name === 'chiggas-android-capacitor',
      actual: pkg.name
    },
    {
      label: 'package scripts',
      ok: ['android:assemble:debug', 'android:test', 'cap:copy', 'cap:sync', 'check'].every(name => scriptNames.includes(name)),
      actual: scriptNames
    },
    {
      label: 'capacitor app id',
      ok: capConfig.appId === expectedPackage && assetCapConfig.appId === expectedPackage,
      actual: { root: capConfig.appId, asset: assetCapConfig.appId }
    },
    {
      label: 'capacitor webDir',
      ok: capConfig.webDir === 'www' && assetCapConfig.webDir === 'www',
      actual: { root: capConfig.webDir, asset: assetCapConfig.webDir }
    },
    {
      label: 'manifest main activity package',
      ok: manifest.includes('android:name=".MainActivity"'),
      actual: 'MainActivity'
    },
    {
      label: 'unit test package',
      ok: unitTest.includes(`package ${expectedPackage};`),
      actual: unitTest.split(/\r?\n/)[0]
    },
    {
      label: 'instrumented test package',
      ok: instrumentedTest.includes(`package ${expectedPackage};`) && instrumentedTest.includes(`assertEquals("${expectedPackage}"`),
      actual: instrumentedTest.split(/\r?\n/)[0]
    },
    {
      label: 'android payload roots exist',
      ok: exists(ANDROID_WWW_DIR) && exists(ANDROID_PUBLIC_DIR),
      actual: { www: ANDROID_WWW_DIR, public: ANDROID_PUBLIC_DIR }
    },
    {
      label: 'phaser version source normalized',
      ok: !/ChiggaStreamWrapper|ChiggasAndroid/.test(wwwPhaserVersion + publicPhaserVersion),
      actual: { www: wwwPhaserVersion.trim(), public: publicPhaserVersion.trim() }
    }
  ];

  const failedChecks = checks.filter(check => !check.ok);
  const ok = missingRequiredFiles.length === 0 && failedChecks.length === 0;

  console.log(JSON.stringify({
    ok,
    status: ok ? 'android_capacitor_platform_ready' : 'android_capacitor_platform_incomplete',
    fileChecks,
    missingRequiredFiles,
    checks,
    failedChecks
  }, null, 2));

  process.exit(ok ? 0 : 1);
}

main();
