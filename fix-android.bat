@echo off
echo Fixing Android build...

echo Step 1: Installing latest Capacitor...
npm install @capacitor/core@latest @capacitor/cli@latest @capacitor/android@latest

echo Step 2: Building web app...
npm run build

echo Step 3: Syncing Capacitor...
npx cap sync android

echo Step 4: Building APK...
cd android
gradlew assembleDebug
cd ..

echo Step 5: Copying APK...
copy "android\app\build\outputs\apk\debug\app-debug.apk" "public\downloads\VK7Days.apk"

echo Android build complete! APK is ready in public/downloads/
pause