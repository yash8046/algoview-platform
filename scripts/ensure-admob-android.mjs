import fs from 'node:fs';
import path from 'node:path';

const TEST_ADMOB_APP_ID = 'ca-app-pub-3940256099942544~3347511713';

const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');
const stringsPath = path.resolve('android/app/src/main/res/values/strings.xml');

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function ensureAndroidManifest() {
  if (!fileExists(manifestPath)) {
    console.warn('[AdMob Android Patch] AndroidManifest.xml not found, skipping.');
    return false;
  }

  let manifest = fs.readFileSync(manifestPath, 'utf8');

  if (!manifest.includes('com.google.android.gms.ads.APPLICATION_ID')) {
    manifest = manifest.replace(
      /<application([^>]*)>/,
      `<application$1>\n        <meta-data\n            android:name="com.google.android.gms.ads.APPLICATION_ID"\n            android:value="@string/admob_app_id" />`
    );
  }

  fs.writeFileSync(manifestPath, manifest);
  return true;
}

function ensureStringsXml() {
  if (!fileExists(stringsPath)) {
    console.warn('[AdMob Android Patch] strings.xml not found, skipping.');
    return false;
  }

  let stringsXml = fs.readFileSync(stringsPath, 'utf8');

  if (stringsXml.includes('name="admob_app_id"')) {
    stringsXml = stringsXml.replace(
      /<string name="admob_app_id">[\s\S]*?<\/string>/,
      `<string name="admob_app_id">${TEST_ADMOB_APP_ID}</string>`
    );
  } else {
    stringsXml = stringsXml.replace(
      /<resources>/,
      `<resources>\n    <string name="admob_app_id">${TEST_ADMOB_APP_ID}</string>`
    );
  }

  fs.writeFileSync(stringsPath, stringsXml);
  return true;
}

const manifestUpdated = ensureAndroidManifest();
const stringsUpdated = ensureStringsXml();

if (manifestUpdated && stringsUpdated) {
  console.log('[AdMob Android Patch] Added required AdMob test app ID for Android startup.');
  console.log('[AdMob Android Patch] Replace admob_app_id with your real AdMob app ID before Play Store release.');
}