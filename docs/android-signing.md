# Android Signing

Android release uploads use an upload keystore. Keep the real keystore and passwords out of Git.

## Current Finding

The file currently at `C:\Chiggas\Android\UploadKey\release\chiggas-upload-key.jks` is a text note, not a real keystore. It records:

- Key alias: `chiggas`
- Key password: same as key store password
- Validity: 25 years
- Owner details for Kevin Phillips / Krysez / Orlando, Florida, US

It does not contain the actual password.

## If You Know The Old Password

Create or locate the real keystore, then use these Android Studio fields:

```text
Key store path: C:\Chiggas\Android\UploadKey\release\chiggas-upload-key.jks
Key store password: your existing upload key password
Key alias: chiggas
Key password: same as the key store password
```

## If The Old Password Is Lost

Do not create a new upload key and expect Google Play to accept it automatically for an existing app. If the app has already been uploaded to Google Play, reset the upload key in Play Console first, then use the new key Google Play expects.

After Play Console is ready for a new upload key:

1. Rename the note file:

```powershell
Rename-Item "C:\Chiggas\Android\UploadKey\release\chiggas-upload-key.jks" "chiggas-upload-key-notes.txt"
```

2. Create a new keystore:

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v `
  -keystore "C:\Chiggas\Android\UploadKey\release\chiggas-upload-key.jks" `
  -alias chiggas `
  -keyalg RSA `
  -keysize 2048 `
  -validity 9125
```

Use a strong password made of letters and numbers if you want to match the old note. Use the same value for the key password when prompted.

3. Verify the keystore:

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -list -v `
  -keystore "C:\Chiggas\Android\UploadKey\release\chiggas-upload-key.jks" `
  -alias chiggas
```

## Optional Local Gradle Properties

Copy `C:\ChiggasUnified\platforms\android-capacitor\android\keystore.properties.example` to `keystore.properties` in the same folder and fill in the real password values. The real `keystore.properties` file is ignored by Git.

When `keystore.properties` exists, the Android release build automatically uses it for the `release` signing config. When it does not exist, Gradle leaves release signing alone so Android Studio's Generate Signed App Bundle wizard can still be used manually.

Expected local file:

```properties
storeFile=C:\\Chiggas\\Android\\UploadKey\\release\\chiggas-upload-key.jks
storePassword=YOUR_REAL_PASSWORD
keyAlias=chiggas
keyPassword=YOUR_REAL_PASSWORD
```
