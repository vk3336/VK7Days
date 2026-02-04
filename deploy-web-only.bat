@echo off
echo 🌐 WEB DEPLOYMENT ONLY - VK7Days
echo ================================

echo 📦 Installing dependencies...
call npm install --silent

echo 🔨 Building web app...
call npm run build

if exist "dist\index.html" (
    echo ✅ WEB BUILD COMPLETE!
    echo 📁 Files ready in: dist\
    echo.
    echo Deploy dist\ folder to:
    echo - Vercel: vercel --prod
    echo - Netlify: netlify deploy --prod --dir=dist
    echo - GitHub Pages: Push dist\ to gh-pages branch
    echo.
    dir dist
) else (
    echo ❌ WEB BUILD FAILED!
    echo Check package.json and vite.config.js
)

pause