const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const publicDir = path.join(__dirname, '..', 'public');
const sourceImage = path.join(publicDir, 'azzahra-logo.jpg');

async function generateIcons() {
    console.log('🔄 Generating app icons from azzahra-logo.jpg...');

    // Check if source image exists
    if (!fs.existsSync(sourceImage)) {
        console.error('❌ Source image not found:', sourceImage);
        process.exit(1);
    }

    const sizes = [
        { name: 'pwa-192x192.png', size: 192 },
        { name: 'pwa-512x512.png', size: 512 },
        { name: 'apple-touch-icon.png', size: 180 },
    ];

    for (const { name, size } of sizes) {
        const outputPath = path.join(publicDir, name);
        await sharp(sourceImage)
            .resize(size, size, {
                fit: 'cover',
                position: 'center'
            })
            .png()
            .toFile(outputPath);
        console.log(`✅ Created ${name} (${size}x${size})`);
    }

    // Generate favicon.ico (32x32)
    const faviconPath = path.join(publicDir, 'favicon.ico');
    await sharp(sourceImage)
        .resize(32, 32, {
            fit: 'cover',
            position: 'center'
        })
        .png()
        .toFile(faviconPath.replace('.ico', '.png'));

    // Rename to .ico (browsers accept PNG as ico)
    if (fs.existsSync(faviconPath)) {
        fs.unlinkSync(faviconPath);
    }
    fs.renameSync(faviconPath.replace('.ico', '.png'), faviconPath);
    console.log('✅ Created favicon.ico (32x32)');

    console.log('✨ All icons generated successfully!');
}

generateIcons().catch(err => {
    console.error('❌ Error generating icons:', err);
    process.exit(1);
});
