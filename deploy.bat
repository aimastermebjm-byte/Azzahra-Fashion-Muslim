@echo off
echo 🚀 Starting deployment to Vercel...

:: Build project
echo 📦 Building project...
call npm run build

:: Deploy to Vercel
echo 🌐 Deploying to Vercel...
call vercel --prod

echo ✅ Deployment completed!
echo 🔗 Your app is now live on Vercel!
pause