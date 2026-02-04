@echo off
echo ========================================
echo    VK7Days - Perfect APK Builder
echo ========================================
echo.

echo Step 1: Cleaning previous builds...
if exist "android\app\build" rmdir /s /q "android\app\build"
if exist "android\build" rmdir /s /q "android\build"
if exist "android\.gradle" rmdir /s /q "android\.gradle"

echo Step 2: Installing dependencies...
call npm install

echo Step 3: Building web assets...
call npm run build

echo Step 4: Copying web assets manually...
if not exist "android\app\src\main\assets\public" mkdir "android\app\src\main\assets\public"
xcopy /E /Y "dist\*" "android\app\src\main\assets\public\"

echo Step 5: Creating capacitor config...
echo {"appId":"com.vk7days.taskscheduler","appName":"VK7Days - Task Scheduler","webDir":"dist"} > "android\app\src\main\assets\capacitor.config.json"

echo Step 6: Building Android APK...
cd android
call gradlew.bat assembleDebug --no-daemon --offline
cd ..

echo Step 7: Copying APK to downloads...
if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    copy "android\app\build\outputs\apk\debug\app-debug.apk" "public\downloads\VK7Days.apk"
    echo.
    echo ========================================
    echo ✅ SUCCESS! APK built successfully!
    echo ========================================
    echo.
    echo 📱 APK Location: public\downloads\VK7Days.apk
    echo 📊 APK Size: 
    dir "public\downloads\VK7Days.apk" | find "VK7Days.apk"
    echo.
    echo 🚀 Ready for users to download and install!
    echo.
) else (
    echo.
    echo ========================================
    echo ❌ BUILD FAILED
    echo ========================================
    echo.
    echo Please check the error messages above.
    echo Common solutions:
    echo 1. Install Android Studio
    echo 2. Set ANDROID_HOME environment variable
    echo 3. Use Java 11+ instead of Java 8
    echo.
)

pause