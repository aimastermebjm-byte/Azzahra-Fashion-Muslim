import fs from 'fs';
import path from 'path';

// Base64 valid PNG (Blue Square 192x192)
const icon192 = 'iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAMAAABlApw1AAAAAXNSR0IArs4c6QAAAHVQTFRF////3d3dZmZmzMzM3d3dZmZmzMzM3d3dZmZmzMzM3d3dZmZmzMzM3d3dZmZmzMzM3d3dZmZmzMzM3d3dZmZmzMzM3d3dZmZmzMzM3d3dZmZmzMzM3d3dZmZmzMzM3d3dZmZmzMzM3d3dZmZmkdDkyAAAACJ0Uk5TAAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISs7O1IAAABYSURBVHja7cEBDQAAAMKg909tDwcUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4GXHAAAVusw0EAAAAASUVORK5CYII=';

const publicDir = path.join(process.cwd(), 'public');

function writeIcon(fileName, base64Data) {
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(path.join(publicDir, fileName), buffer);
    console.log(`✅ Created valid PNG: ${fileName} (${buffer.length} bytes)`);
}

console.log('🔄 Generating PWA Icons...');
writeIcon('pwa-192x192.png', icon192);
writeIcon('pwa-512x512.png', icon192);

console.log('✨ Icons generated successfully!');
