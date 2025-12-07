const sharp = require('sharp');
const path = require('path');

const projectDir = path.join(__dirname, '..');
const publicDir = path.join(projectDir, 'public');

// Source logo - change this to your logo file
const sourceLogo = path.join(projectDir, 'IMG-20240914-WA0001.jpg');

async function generateIcons() {
  console.log('Generating PWA icons from:', sourceLogo);

  // 192x192 icon
  await sharp(sourceLogo)
    .resize(192, 192, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Created pwa-192x192.png');

  // 512x512 icon
  await sharp(sourceLogo)
    .resize(512, 512, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Created pwa-512x512.png');

  console.log('Done! Icons generated successfully.');
}

generateIcons().catch(console.error);
