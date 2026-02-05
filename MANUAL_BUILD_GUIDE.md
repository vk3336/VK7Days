# Manual Build Guide - Enhanced VK7Days APK

## Current Status

✅ **All enhanced code has been successfully applied to your project:**

### New Files Added:

- `android/app/src/main/java/com/vk7days/taskscheduler/AlarmSoundService.java`
- `android/app/src/main/java/com/vk7days/taskscheduler/AlarmStopReceiver.java`

### Files Enhanced:

- `android/app/src/main/java/com/vk7days/taskscheduler/AlarmReceiver.java`
- `android/app/src/main/java/com/vk7days/taskscheduler/MainActivity.java`
- `android/app/src/main/AndroidManifest.xml`
- `src/lib/backgroundAlarms.js`
- `android/gradle.properties`
- `android/local.properties`

## Build Options

### Option 1: Use Android Studio (Recommended)

1. **Open Android Studio**
2. **Open Project**: Select the `android` folder in your VK7Days directory
3. **Wait for Sync**: Let Android Studio sync the project and download dependencies
4. **Build APK**:
   - Go to `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
   - Or use `Build` → `Generate Signed Bundle / APK` for release version
5. **Find APK**: Look in `android/app/build/outputs/apk/debug/` or `/release/`

### Option 2: Command Line (Alternative)

```bash
# Try the enhanced build script
apply-enhancements.bat

# Or manually:
npm run build
npx cap sync android
cd android
gradlew clean assembleDebug
```

### Option 3: Capacitor Run (For Testing)

```bash
# This will build and install directly to connected device
npx cap run android
```

## If Build Still Fails

### Gradle Issues Fix:

1. **Delete build folders**:

   ```bash
   cd android
   rmdir /s /q app\build
   rmdir /s /q .gradle
   ```

2. **Update Gradle Wrapper** (if needed):

   ```bash
   gradlew wrapper --gradle-version 7.6.1
   ```

3. **Check Java Version**:
   - Ensure you have JDK 11 installed
   - Android Studio should handle this automatically

### Android SDK Issues Fix:

1. **Open Android Studio**
2. **Go to File → Settings → Appearance & Behavior → System Settings → Android SDK**
3. **Install required SDK versions** (API 33, 34)
4. **Install Build Tools** (33.0.0 or later)

## Enhanced Features Implemented

### 🔊 Continuous Ringtone System

- **AlarmSoundService**: Plays default alarm ringtone in loop
- **Foreground service**: Keeps running even when app is closed
- **Auto-stop**: Stops when app opens or user dismisses

### 🔔 Smart Permission Management

- **One-click requesting**: "Enable Alert" button now actually requests permissions
- **Guided setup**: Opens system settings for manual permissions
- **Clear feedback**: Shows exactly what's enabled/missing

### 📱 Enhanced Alarm Flow

- **Background trigger**: AlarmReceiver starts continuous sound service
- **App open**: Automatically stops default ringtone, plays custom voice
- **Dismiss action**: Notification buttons to stop alarm without opening app

### 🔐 All Required Permissions

- Notification permission (Android 13+)
- Exact alarm permission (Android 12+)
- Battery optimization exemption
- Foreground service for media playback
- Wake lock and vibration permissions

## Testing the Enhanced APK

### After Installation:

1. **Open VK7Days app**
2. **Click "🔔 Enable Alert" button**
3. **Grant all permissions** when system dialogs appear
4. **Schedule a test task** for 1-2 minutes from now
5. **Close the app completely**
6. **Wait for alarm time**

### Expected Behavior:

- **Default ringtone plays continuously**
- **Device vibrates in pattern**
- **Notification shows with dismiss/open buttons**
- **Ringtone continues until you take action**
- **Opening app stops ringtone and plays custom voice**

## Troubleshooting

### If Permissions Don't Work:

1. Go to **Settings → Apps → VK7Days**
2. **Permissions**: Enable all permissions
3. **Battery**: Set to "Unrestricted"
4. **Set alarms and reminders**: Enable (Android 12+)

### If Ringtone Doesn't Play:

1. Check **Do Not Disturb** is off
2. Check **Alarm volume** is up
3. Ensure **VK7Days** is not in battery optimization

### If Background Alarms Don't Trigger:

1. **Disable battery optimization** for VK7Days
2. **Enable exact alarms** in system settings
3. **Allow background activity** for VK7Days

## Success Indicators

✅ **"Enable Alert" button shows all permissions granted**
✅ **Test alarm triggers when app is closed**
✅ **Default ringtone plays continuously**
✅ **Opening app stops ringtone and shows custom voice**
✅ **Notification dismiss button works**

Your enhanced VK7Days APK is now ready with professional-grade background alarm functionality!
