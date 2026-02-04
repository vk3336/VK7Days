#!/bin/bash
echo "Building VK7Days Android App..."

echo "Step 1: Installing dependencies..."
npm install

echo "Step 2: Building web assets..."
npm run build

echo "Step 3: Syncing with Capacitor..."
npx cap sync android

echo "Step 4: Building Android APK..."
cd android
./gradlew assembleDebug
cd ..

echo "Step 5: Copying APK to public folder..."
if [ -f "android/app/build/outputs/apk/debug/app-debug.apk" ]; then
    cp "android/app/build/outputs/apk/debug/app-debug.apk" "public/downloads/VK7Days.apk"
    echo "✅ APK built successfully and copied to public/downloads/VK7Days.apk"
else
    echo "❌ APK build failed - check the logs above"
fi