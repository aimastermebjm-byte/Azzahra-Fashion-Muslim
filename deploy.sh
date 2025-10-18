#!/bin/bash

# Auto-deploy script untuk Vercel
echo "🚀 Starting deployment to Vercel..."

# Build project
echo "📦 Building project..."
npm run build

# Deploy to Vercel
echo "🌐 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment completed!"
echo "🔗 Your app is now live on Vercel!"