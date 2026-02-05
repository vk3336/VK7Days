@echo off
echo ========================================
echo Building Enhanced VK7Days APK
echo ========================================
echo.

echo [1/6] Cleaning previous builds...
if exist "android\app\build" rmdir /s /q "android\app\build"
if exist "dist" rmdir /s /q "dist"

echo [2/6] Building web assets...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Web build failed!
    pause
    exit /b 1
)

echo [3/6] Syncing to Capacitor...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ERROR: Capacitor sync failed!
    pause
    exit /b 1
)

echo [4/6] Building Android project...
cd android
call gradlew clean assembleRelease
if %errorlevel% neq 0 (
    echo ERROR: Android build failed!
    cd ..
    pause
    exit /b 1
)
cd ..

echo [5/6] Copying APK to public folder...
if not exist "public\downloads" mkdir "public\downloads"
copy "android\app\build\outputs\apk\release\app-release.apk" "public\downloads\VK7Days-Enhanced.apk"

echo [6/6] Build completed successfully!
echo.
echo ========================================
echo Enhanced APK Features:
echo ✅ Continuous ringtone until dismissed
echo ✅ One-click permission requesting
echo ✅ Works when app is closed
echo ✅ Proper background execution
echo ========================================
echo.
echo APK Location: public\downloads\VK7Days-Enhanced.apk
echo.
pause