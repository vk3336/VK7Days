@echo off
echo Building VK7Days Android App...

echo Step 1: Installing dependencies...
call npm install

echo Step 2: Building web assets...
call npm run build

echo Step 3: Syncing with Capacitor...
call npx cap sync android

echo Step 4: Building Android APK...
cd android
call gradlew assembleDebug
cd ..

echo Step 5: Copying APK to public folder...
if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    copy "android\app\build\outputs\apk\debug\app-debug.apk" "public\downloads\VK7Days.apk"
    echo ✅ APK built successfully and copied to public/downloads/VK7Days.apk
) else (
    echo ❌ APK build failed - check the logs above
)

pause