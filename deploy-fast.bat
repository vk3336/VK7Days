@echo off
echo 🚀 FAST DEPLOYMENT - VK7Days Task Scheduler
echo ============================================

echo 📦 Step 1: Installing dependencies...
call npm install --silent

echo 🔨 Step 2: Building web app...
call npm run build

echo 📱 Step 3: Syncing with Android...
call npx cap sync android

echo 🧹 Step 4: Cleaning Android build...
cd android
call gradlew clean --quiet
echo ✅ Android cleaned

echo 📦 Step 5: Building APK (Release)...
call gradlew assembleRelease --quiet
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️ Release failed, building debug...
    call gradlew assembleDebug --quiet
)
cd ..

echo 📋 Step 6: Copying APK...
if exist "android\app\build\outputs\apk\release\app-release.apk" (
    copy "android\app\build\outputs\apk\release\app-release.apk" "public\downloads\VK7Days.apk" >nul
    echo ✅ RELEASE APK ready at: public\downloads\VK7Days.apk
    echo 📊 APK Size:
    dir "public\downloads\VK7Days.apk" | findstr VK7Days.apk
) else if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    copy "android\app\build\outputs\apk\debug\app-debug.apk" "public\downloads\VK7Days.apk" >nul
    echo ✅ DEBUG APK ready at: public\downloads\VK7Days.apk
    echo 📊 APK Size:
    dir "public\downloads\VK7Days.apk" | findstr VK7Days.apk
) else (
    echo ❌ BUILD FAILED!
    echo Check these:
    echo - Android SDK installed?
    echo - Java 11+ installed?
    echo - Run: java -version
    exit /b 1
)

echo.
echo 🎉 DEPLOYMENT COMPLETE!
echo 📱 APK: public\downloads\VK7Days.apk
echo 🌐 Web: dist\ folder ready
echo.
echo Next steps:
echo 1. Test APK on Android device
echo 2. Deploy web version to hosting
echo 3. Share APK download link
echo.
pause