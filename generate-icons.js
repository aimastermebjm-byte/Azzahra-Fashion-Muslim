const sharp = require('sharp');
const path = require('path');

const inputPath = path.join(__dirname, 'public', 'azzahra-logo.jpg');

// Generate 192x192
sharp(inputPath)
  .resize(192, 192)
  .toFile(path.join(__dirname, 'public', 'pwa-192x192.png'))
  .then(() => console.log('✅ Created pwa-192x192.png'))
  .catch(err => console.error('Error:', err));

// Generate 512x512
sharp(inputPath)
  .resize(512, 512)
  .toFile(path.join(__dirname, 'public', 'pwa-512x512.png'))
  .then(() => console.log('✅ Created pwa-512x512.png'))
  .catch(err => console.error('Error:', err));
