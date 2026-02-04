@echo off
echo 🚀 QUICK APK BUILD
echo ==================

echo 📦 Building web...
call npm run build

echo 🧹 Force cleaning Android...
rmdir /s /q android\app\build 2>nul
rmdir /s /q android\app\src\main\assets\public 2>nul
rmdir /s /q android\capacitor-cordova-android-plugins\src\main 2>nul

echo 📱 Manual sync...
xcopy /E /I /Y dist android\app\src\main\assets\public

echo 🔨 Building APK...
cd android
gradlew.bat assembleDebug --no-daemon --offline
if %ERRORLEVEL% NEQ 0 (
    echo Trying online build...
    gradlew.bat assembleDebug --no-daemon
)
cd ..

echo 📋 Copying APK...
if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    copy "android\app\build\outputs\apk\debug\app-debug.apk" "public\downloads\VK7Days.apk"
    echo ✅ APK READY: public\downloads\VK7Days.apk
) else (
    echo ❌ BUILD FAILED
)

pause