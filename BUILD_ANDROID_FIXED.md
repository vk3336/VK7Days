# VK7Days Android Build Guide - FIXED VERSION

## Issues Fixed:

1. ✅ Capacitor version compatibility (downgraded to stable v6.1.2)
2. ✅ Android SDK target version (changed from 35 to 34)
3. ✅ Gradle version compatibility (downgraded to 8.2.1)
4. ✅ Added proper Android permissions for notifications and alarms
5. ✅ Added signing configuration for release builds
6. ✅ Fixed Java compatibility settings
7. ✅ Enhanced Gradle memory settings
8. ✅ Added proper Android manifest configuration

## Prerequisites:

- Node.js 18+ installed
- Android Studio with SDK 34 installed
- Java 8+ installed

## Build Steps:

### Option 1: Using Build Scripts (Recommended)

```bash
# On Windows:
build-android.bat

# On Mac/Linux:
chmod +x build-android.sh
./build-android.sh
```

### Option 2: Manual Build

```bash
# 1. Install dependencies
npm install

# 2. Build web assets
npm run build

# 3. Sync with Capacitor
npx cap sync android

# 4. Build APK
cd android
./gradlew assembleDebug
cd ..

# 5. Copy APK
cp android/app/build/outputs/apk/debug/app-debug.apk public/downloads/VK7Days.apk
```

## Testing the APK:

1. The APK will be generated at `android/app/build/outputs/apk/debug/app-debug.apk`
2. It will be automatically copied to `public/downloads/VK7Days.apk`
3. Install on Android device: `adb install public/downloads/VK7Days.apk`
4. Or transfer the APK file to your Android device and install manually

## Troubleshooting:

- If build fails, run `npx cap doctor` to check configuration
- Ensure Android SDK 34 is installed in Android Studio
- Make sure ANDROID_HOME environment variable is set
- Clear Gradle cache: `cd android && ./gradlew clean`

## Key Changes Made:

- Downgraded Capacitor from v8/v7 to stable v6.1.2
- Fixed Android target SDK from 35 to 34 (more stable)
- Added proper permissions for notifications and alarms
- Fixed Gradle build configuration
- Added signing configuration for proper APK generation
- Enhanced memory settings for better build performance

The APK should now install and run properly on Android devices without parsing errors.
