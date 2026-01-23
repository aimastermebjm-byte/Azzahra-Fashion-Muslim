const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const publicDir = path.join(__dirname, '..', 'public');
const sourceImage = path.join(publicDir, 'azzahra-logo.jpg');

async function generateSplashScreens() {
    console.log('🔄 Generating PWA Splash Screens...');

    // Common mobile splash screen sizes
    const sizes = [
        { width: 640, height: 1136, name: 'splash-640x1136.png' },   // iPhone 5
        { width: 750, height: 1334, name: 'splash-750x1334.png' },   // iPhone 6/7/8
        { width: 1242, height: 2208, name: 'splash-1242x2208.png' }, // iPhone 6+/7+/8+
        { width: 1125, height: 2436, name: 'splash-1125x2436.png' }, // iPhone X/XS
        { width: 1536, height: 2048, name: 'splash-1536x2048.png' }, // iPad
        { width: 1080, height: 1920, name: 'splash-1080x1920.png' }, // Android HD
        { width: 1440, height: 2560, name: 'splash-1440x2560.png' }, // Android QHD
    ];

    // Background color
    const bgColor = { r: 13, g: 13, b: 13, alpha: 1 }; // #0d0d0d

    for (const { width, height, name } of sizes) {
        const outputPath = path.join(publicDir, name);

        // Calculate logo size (40% of screen width)
        const logoSize = Math.round(width * 0.4);

        // Resize logo
        const resizedLogo = await sharp(sourceImage)
            .resize(logoSize, logoSize, { fit: 'contain', background: bgColor })
            .png()
            .toBuffer();

        // Create splash screen with centered logo
        await sharp({
            create: {
                width,
                height,
                channels: 4,
                background: bgColor
            }
        })
            .composite([{
                input: resizedLogo,
                gravity: 'center'
            }])
            .png()
            .toFile(outputPath);

        console.log(`✅ Created ${name} (${width}x${height})`);
    }

    console.log('✨ All splash screens generated!');
}

generateSplashScreens().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
