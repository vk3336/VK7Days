@echo off
echo Building VK7Days Android App (Fixed Version)...

echo Step 1: Cleaning previous builds...
if exist "android\app\build" rmdir /s /q "android\app\build"
if exist "dist" rmdir /s /q "dist"

echo Step 2: Installing/updating dependencies...
call npm install

echo Step 3: Building web assets...
call npm run build

echo Step 4: Syncing with Capacitor...
call npx cap sync android

echo Step 5: Cleaning Android build cache...
cd android
call gradlew clean
cd ..

echo Step 6: Building Android APK (Release)...
cd android
call gradlew assembleRelease
if %ERRORLEVEL% NEQ 0 (
    echo Release build failed, trying debug build...
    call gradlew assembleDebug
)
cd ..

echo Step 7: Copying APK to public folder...
if exist "android\app\build\outputs\apk\release\app-release.apk" (
    copy "android\app\build\outputs\apk\release\app-release.apk" "public\downloads\VK7Days.apk"
    echo ✅ Release APK built successfully and copied to public/downloads/VK7Days.apk
) else if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    copy "android\app\build\outputs\apk\debug\app-debug.apk" "public\downloads\VK7Days.apk"
    echo ✅ Debug APK built successfully and copied to public/downloads/VK7Days.apk
) else (
    echo ❌ APK build failed - check the logs above
    echo Common fixes:
    echo 1. Run: npm install
    echo 2. Run: npx cap sync android
    echo 3. Check Android SDK is properly installed
    echo 4. Ensure Java 11 or higher is installed
)

pause