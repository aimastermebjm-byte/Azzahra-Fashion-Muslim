const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

// ============================================================
// 1. FIREBASE INITIALIZATION
// ============================================================
const serviceAccountPath = path.join(__dirname, '../service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Service account key tidak ditemukan di:', serviceAccountPath);
  console.error('Harap download dari Firebase Console -> Project Settings -> Service Accounts');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'azzahra-fashion-muslim-ab416.firebasestorage.app'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

console.log('✅ Firebase initialized');
console.log('⏳ Starting WhatsApp client (this may take 30-60 seconds)...');
console.log('   Puppeteer is loading headless Chrome...');

// ============================================================
// 2. SMART BUNDLER (15-second window)
// ============================================================
const PAIRING_WINDOW = 15000; // 15 seconds
let messageBuffer = [];
let processingTimeout = null;

function addToBuffer(item) {
  messageBuffer.push(item);
  console.log(`📥 Buffer: ${messageBuffer.length} items (${item.type})`);

  // Reset timer setiap ada pesan baru
  clearTimeout(processingTimeout);

  // Set timer: proses setelah 15 detik tidak ada pesan baru
  processingTimeout = setTimeout(() => {
    processBundle();
  }, PAIRING_WINDOW);
}

async function processBundle() {
  if (messageBuffer.length === 0) return;

  console.log('⚙️ ===== PROCESSING BUNDLE =====');
  console.log(`📦 Total items: ${messageBuffer.length}`);

  const images = messageBuffer.filter(m => m.type === 'image');
  const texts = messageBuffer.filter(m => m.type === 'text');

  // Clear buffer immediately
  const currentBuffer = [...messageBuffer];
  messageBuffer = [];

  // Combine captions
  const combinedCaption = texts.map(t => t.content).join('\n');
  const imageCaption = images.find(i => i.caption)?.caption || '';
  const finalCaption = combinedCaption || imageCaption;

  console.log(`🖼️ Images: ${images.length}`);
  console.log(`📝 Caption: ${finalCaption.substring(0, 50)}...`);

  if (images.length === 0) {
    console.log('⚠️ No images in bundle, skipping...');
    return;
  }

  try {
    // 1. Parse Caption
    const parsed = parseCaption(finalCaption);
    console.log('📋 Parsed:', parsed);

    // 2. Generate Collage
    console.log('🎨 Generating collage...');
    const collageBuffer = await generateCollage(images.map(i => i.imageBuffer));

    // 3. Upload Collage to Storage
    const filename = `collages/draft_${Date.now()}.jpg`;
    const file = bucket.file(filename);
    await file.save(collageBuffer, {
      metadata: { contentType: 'image/jpeg' }
    });
    const [collageUrl] = await file.getSignedUrl({
      action: 'read',
      expires: '03-09-2491'
    });
    console.log('☁️ Collage uploaded:', filename);

    // 4. Save to product_drafts
    const draftData = {
      name: parsed.name,
      description: parsed.description,
      category: parsed.category,
      retailPrice: parsed.retailPrice,
      resellerPrice: parsed.resellerPrice,
      costPrice: parsed.costPrice,
      collageUrl: collageUrl,
      variantCount: images.length,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      rawImages: images.map(i => i.storageUrl).filter(Boolean)
    };

    const docRef = await db.collection('product_drafts').add(draftData);
    console.log('✅ Draft SAVED! ID:', docRef.id);
    console.log('📊 Draft:', JSON.stringify(draftData, null, 2));

  } catch (error) {
    console.error('❌ Bundle processing failed:', error);
  }
}

// ============================================================
// 3. CAPTION PARSER (No AI, Regex Only)
// ============================================================
function parseCaption(caption) {
  if (!caption) {
    return {
      name: 'Produk Baru',
      description: '',
      category: 'Gamis',
      retailPrice: 0,
      resellerPrice: 0,
      costPrice: 0
    };
  }

  const lines = caption.split('\n').map(l => l.trim()).filter(Boolean);
  const name = lines[0] || 'Produk Baru';
  const description = lines.slice(1).join('\n');

  // Extract price
  let retailPrice = 0;
  const cleanText = caption.toLowerCase();

  // Pattern 1: "450k", "150rb", "1.5jt"
  const suffixMatch = cleanText.match(/(\d+(?:[.,]\d+)?)\s*(rb|k|ribu|jt)/);
  if (suffixMatch) {
    const val = parseFloat(suffixMatch[1].replace(',', '.'));
    retailPrice = suffixMatch[2] === 'jt' ? val * 1000000 : val * 1000;
  }

  // Pattern 2: "Rp 450.000" or "IDR 150,000"
  if (retailPrice === 0) {
    const currencyMatch = cleanText.match(/(?:rp|idr)\s*\.?\s*([\d,.]+)/);
    if (currencyMatch) {
      retailPrice = parseInt(currencyMatch[1].replace(/[^0-9]/g, ''), 10);
    }
  }

  // Pattern 3: Fallback - numbers in price range
  if (retailPrice === 0) {
    const numberMatches = cleanText.match(/[\d,.]+/g);
    if (numberMatches) {
      const potentialPrices = numberMatches
        .map(m => parseInt(m.replace(/[^0-9]/g, ''), 10))
        .filter(n => n >= 25000 && n <= 600000);
      if (potentialPrices.length > 0) retailPrice = Math.max(...potentialPrices);
    }
  }

  // Calculate reseller & cost
  const resellerPrice = Math.round(retailPrice * 0.9);
  const costPrice = Math.max(0, retailPrice - 30000);

  // Detect category
  let category = 'Gamis';
  if (/hijab/i.test(caption)) category = 'Hijab';
  else if (/khimar/i.test(caption)) category = 'Khimar';
  else if (/tunik/i.test(caption)) category = 'Tunik';
  else if (/mukena/i.test(caption)) category = 'Mukena';

  return { name, description, category, retailPrice, resellerPrice, costPrice };
}

// ============================================================
// 4. COLLAGE GENERATOR (Using Jimp - Same Layout as Frontend)
// ============================================================
async function generateCollage(imageBuffers) {
  const W = 1500;
  const H = 2000;
  const count = imageBuffers.length;

  // Create white canvas (Jimp v1.x API)
  const canvas = new Jimp({ width: W, height: H, color: 0xFFFFFFFF });

  // Load all images
  const loadedImages = await Promise.all(
    imageBuffers.map(buf => Jimp.read(buf))
  );

  // Get layout
  const layout = calculateLayout(count, W, H);

  // Draw each image
  for (let i = 0; i < Math.min(loadedImages.length, layout.length); i++) {
    const img = loadedImages[i];
    const box = layout[i];
    const label = String.fromCharCode(65 + i); // A, B, C, ...

    // Draw image with cover fit (top-anchor)
    drawImageInBox(canvas, img, box);

    // Draw label (no longer async in v1.x)
    drawLabel(canvas, label, box);

    // Draw white border
    drawBorder(canvas, box);
  }

  // Export as JPEG buffer (Jimp v1.x uses getBuffer)
  return canvas.getBuffer('image/jpeg');
}

function calculateLayout(count, W, H) {
  const boxes = [];

  if (count === 1) {
    boxes.push({ x: 0, y: 0, w: W, h: H });
  }
  else if (count === 2) {
    const w = W / 2;
    boxes.push({ x: 0, y: 0, w: w, h: H });
    boxes.push({ x: w, y: 0, w: w, h: H });
  }
  else if (count === 3) {
    const wHalf = W / 2;
    const hHalf = H / 2;
    boxes.push({ x: 0, y: 0, w: wHalf, h: H });
    boxes.push({ x: wHalf, y: 0, w: wHalf, h: hHalf });
    boxes.push({ x: wHalf, y: hHalf, w: wHalf, h: hHalf });
  }
  else if (count === 4) {
    const w = W / 2;
    const h = H / 2;
    boxes.push({ x: 0, y: 0, w: w, h: h });
    boxes.push({ x: w, y: 0, w: w, h: h });
    boxes.push({ x: 0, y: h, w: w, h: h });
    boxes.push({ x: w, y: h, w: w, h: h });
  }
  else if (count === 5) {
    const hTop = H * 0.5;
    const hBot = H * 0.5;
    const wTop = W / 2;
    const wBot = W / 3;
    boxes.push({ x: 0, y: 0, w: wTop, h: hTop });
    boxes.push({ x: wTop, y: 0, w: wTop, h: hTop });
    boxes.push({ x: 0, y: hTop, w: wBot, h: hBot });
    boxes.push({ x: wBot, y: hTop, w: wBot, h: hBot });
    boxes.push({ x: wBot * 2, y: hTop, w: wBot, h: hBot });
  }
  else if (count === 6) {
    const w = W / 2;
    const h = H / 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        boxes.push({ x: c * w, y: r * h, w: w, h: h });
      }
    }
  }
  else if (count === 7) {
    const hHead = H * 0.4;
    const hGrid = (H - hHead) / 2;
    const wGrid = W / 3;
    boxes.push({ x: 0, y: 0, w: W, h: hHead });
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        boxes.push({ x: c * wGrid, y: hHead + (r * hGrid), w: wGrid, h: hGrid });
      }
    }
  }
  else if (count === 8) {
    const w = W / 2;
    const h = H / 4;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 2; c++) {
        boxes.push({ x: c * w, y: r * h, w: w, h: h });
      }
    }
  }
  else if (count === 9) {
    const w = W / 3;
    const h = H / 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        boxes.push({ x: c * w, y: r * h, w: w, h: h });
      }
    }
  }
  else if (count === 10) {
    const hRow1 = H * 0.4;
    const hRowOther = (H - hRow1) / 2;
    const wRow1 = W / 2;
    const wRow2 = W / 4;
    boxes.push({ x: 0, y: 0, w: wRow1, h: hRow1 });
    boxes.push({ x: wRow1, y: 0, w: wRow1, h: hRow1 });
    for (let c = 0; c < 4; c++) {
      boxes.push({ x: c * wRow2, y: hRow1, w: wRow2, h: hRowOther });
    }
    for (let c = 0; c < 4; c++) {
      boxes.push({ x: c * wRow2, y: hRow1 + hRowOther, w: wRow2, h: hRowOther });
    }
  }
  else {
    // Fallback grid
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const w = W / cols;
    const h = H / rows;
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      boxes.push({ x: c * w, y: r * h, w: w, h: h });
    }
  }

  return boxes;
}

function drawImageInBox(canvas, img, box) {
  // Object-fit: cover with top-anchor (Jimp v1.x uses .width/.height)
  const scale = Math.max(box.w / img.width, box.h / img.height);
  const scaledW = Math.round(img.width * scale);
  const scaledH = Math.round(img.height * scale);

  // Resize image (Jimp v1.x API)
  const resized = img.clone().resize({ w: scaledW, h: scaledH });

  // Center X, Top Y
  const dx = Math.round(box.x + (box.w - scaledW) / 2);
  const dy = box.y; // Top anchor

  // Composite onto canvas
  canvas.composite(resized, dx, dy);
}

function drawLabel(canvas, label, box) {
  const labelSize = 200;
  const centerX = Math.round(box.x + box.w / 2);
  const centerY = Math.round(box.y + box.h / 2);
  const x = Math.round(centerX - labelSize / 2);
  const y = Math.round(centerY - labelSize / 2);

  // Draw black semi-transparent box
  for (let px = Math.max(0, x); px < Math.min(canvas.width, x + labelSize); px++) {
    for (let py = Math.max(0, y); py < Math.min(canvas.height, y + labelSize); py++) {
      canvas.setPixelColor(0x00000099, px, py);
    }
  }

  // Draw letter using simple pixel bitmap (5x7 grid scaled up)
  const letterPatterns = {
    'A': [
      '  #  ',
      ' # # ',
      '#   #',
      '#####',
      '#   #',
      '#   #',
      '#   #',
    ],
    'B': [
      '#### ',
      '#   #',
      '#### ',
      '#   #',
      '#   #',
      '#   #',
      '#### ',
    ],
    'C': [
      ' ### ',
      '#   #',
      '#    ',
      '#    ',
      '#    ',
      '#   #',
      ' ### ',
    ],
    'D': [
      '#### ',
      '#   #',
      '#   #',
      '#   #',
      '#   #',
      '#   #',
      '#### ',
    ],
    'E': [
      '#####',
      '#    ',
      '#    ',
      '#### ',
      '#    ',
      '#    ',
      '#####',
    ],
    'F': [
      '#####',
      '#    ',
      '#    ',
      '#### ',
      '#    ',
      '#    ',
      '#    ',
    ],
    'G': [
      ' ### ',
      '#   #',
      '#    ',
      '# ###',
      '#   #',
      '#   #',
      ' ### ',
    ],
    'H': [
      '#   #',
      '#   #',
      '#   #',
      '#####',
      '#   #',
      '#   #',
      '#   #',
    ],
    'I': [
      '#####',
      '  #  ',
      '  #  ',
      '  #  ',
      '  #  ',
      '  #  ',
      '#####',
    ],
    'J': [
      '#####',
      '    #',
      '    #',
      '    #',
      '#   #',
      '#   #',
      ' ### ',
    ]
  };

  const pattern = letterPatterns[label] || letterPatterns['A'];
  const pixelSize = 20; // Size of each "pixel" in the letter
  const letterWidth = 5 * pixelSize;
  const letterHeight = 7 * pixelSize;
  const letterX = x + (labelSize - letterWidth) / 2;
  const letterY = y + (labelSize - letterHeight) / 2;

  // Draw each pixel of the letter
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (pattern[row][col] === '#') {
        // Draw a filled square for this pixel
        for (let px = 0; px < pixelSize; px++) {
          for (let py = 0; py < pixelSize; py++) {
            const drawX = Math.round(letterX + col * pixelSize + px);
            const drawY = Math.round(letterY + row * pixelSize + py);
            if (drawX >= 0 && drawX < canvas.width && drawY >= 0 && drawY < canvas.height) {
              canvas.setPixelColor(0xFFFFFFFF, drawX, drawY); // White color
            }
          }
        }
      }
    }
  }

  console.log(`   Label ${label} drawn at (${centerX}, ${centerY})`);
}

function drawBorder(canvas, box) {
  const borderWidth = 4;
  const color = 0xFFFFFFFF; // White

  // Top & Bottom borders (Jimp v1.x uses .width/.height)
  for (let px = Math.floor(box.x); px < Math.floor(box.x + box.w); px++) {
    for (let i = 0; i < borderWidth; i++) {
      if (box.y + i < canvas.height) canvas.setPixelColor(color, px, Math.floor(box.y + i));
      if (box.y + box.h - 1 - i >= 0) canvas.setPixelColor(color, px, Math.floor(box.y + box.h - 1 - i));
    }
  }
  // Left & Right borders
  for (let py = Math.floor(box.y); py < Math.floor(box.y + box.h); py++) {
    for (let i = 0; i < borderWidth; i++) {
      if (box.x + i < canvas.width) canvas.setPixelColor(color, Math.floor(box.x + i), py);
      if (box.x + box.w - 1 - i >= 0) canvas.setPixelColor(color, Math.floor(box.x + box.w - 1 - i), py);
    }
  }
}

// ============================================================
// 5. WHATSAPP CLIENT WITH AUTO-RECONNECT
// ============================================================
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let heartbeatInterval = null;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
    timeout: 60000 // 60 second timeout
  },
  qrMaxRetries: 5
});

client.on('qr', (qr) => {
  console.log('');
  console.log('📱 =========================================');
  console.log('   SCAN QR CODE INI DENGAN WHATSAPP ANDA:');
  console.log('=========================================');
  qrcode.generate(qr, { small: true });
  console.log('⚠️  QR akan expired dalam 60 detik');
  console.log('');
});

client.on('loading_screen', (percent, message) => {
  console.log(`⏳ Loading: ${percent}% - ${message}`);
});

client.on('authenticated', () => {
  console.log('✅ AUTHENTICATED - Session tersimpan');
  reconnectAttempts = 0; // Reset counter on successful auth
});

client.on('auth_failure', msg => {
  console.error('❌ AUTHENTICATION FAILURE:', msg);
  console.log('💡 Coba hapus folder .wwebjs_auth dan scan ulang QR');
});

client.on('ready', () => {
  isConnected = true;
  reconnectAttempts = 0;

  console.log('');
  console.log('🚀 =========================================');
  console.log('   WHATSAPP BRIDGE + AUTO-DRAFT PROCESSOR');
  console.log('   ✅ CONNECTED - Ready to receive messages!');
  console.log('=========================================');
  console.log('');
  console.log('📱 Kirim gambar + caption ke Note to Self');
  console.log('⏱️  Bundle akan diproses 15 detik setelah pesan terakhir');
  console.log('📦 Draft akan otomatis muncul di Dashboard');
  console.log('');
  console.log('💚 Heartbeat aktif - Log tiap 60 detik');
  console.log('');

  // Start heartbeat
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (isConnected) {
      const now = new Date().toLocaleTimeString('id-ID');
      console.log(`🟢 [${now}] Connected - Waiting for messages...`);
    }
  }, 60000); // Every 60 seconds
});

client.on('disconnected', async (reason) => {
  isConnected = false;
  console.error('');
  console.error('🔴 =========================================');
  console.error(`   DISCONNECTED: ${reason}`);
  console.error('=========================================');

  // Stop heartbeat
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Auto-reconnect
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    const delay = Math.min(reconnectAttempts * 5000, 30000); // 5s, 10s, 15s... max 30s
    console.log(`🔄 Auto-reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s...`);

    setTimeout(async () => {
      try {
        console.log('🔄 Reconnecting...');
        await client.initialize();
      } catch (err) {
        console.error('❌ Reconnect failed:', err.message);
      }
    }, delay);
  } else {
    console.error('❌ Max reconnect attempts reached. Please restart manually.');
    console.log('💡 Run: node scripts/whatsapp-bridge.cjs');
  }
});

client.on('change_state', (state) => {
  console.log(`📶 Connection state: ${state}`);
  if (state === 'CONNECTED') {
    isConnected = true;
  } else if (state === 'UNPAIRED' || state === 'CONFLICT') {
    isConnected = false;
  }
});

// --- WHITELIST ---
const ALLOWED_NUMBERS = [
  '6287815990944@c.us',
  // Add more numbers here
];

client.on('message_create', async (msg) => {
  if (!isConnected) {
    console.log('⚠️ Not connected, ignoring message');
    return;
  }

  const isAllowed = msg.fromMe || ALLOWED_NUMBERS.includes(msg.from);

  if (!isAllowed) {
    return; // Ignore
  }

  console.log(`📨 Message from ${msg.fromMe ? 'Me' : msg.from} | HasMedia: ${msg.hasMedia}`);

  if (msg.hasMedia) {
    try {
      const media = await msg.downloadMedia();
      if (!media || !media.mimetype.startsWith('image/')) {
        console.log('⚠️ Not an image, skipping');
        return;
      }

      const caption = msg.body || msg.caption || '';
      const imageBuffer = Buffer.from(media.data, 'base64');

      // Upload to storage for backup
      const filename = `pending_uploads/wa_${Date.now()}.${media.mimetype.split('/')[1]}`;
      const file = bucket.file(filename);
      await file.save(imageBuffer, { metadata: { contentType: media.mimetype } });
      const [url] = await file.getSignedUrl({ action: 'read', expires: '03-09-2491' });

      addToBuffer({
        type: 'image',
        imageBuffer: imageBuffer,
        storageUrl: url,
        caption: caption,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ Error processing image:', error);
    }
  } else if (msg.body && msg.body.trim()) {
    // Text message
    addToBuffer({
      type: 'text',
      content: msg.body,
      timestamp: Date.now()
    });
  }
});

// Handle process signals for graceful shutdown
process.on('SIGINT', async () => {
  console.log('');
  console.log('🛑 Shutting down gracefully...');
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  await client.destroy();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // Don't exit - try to keep running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  // Don't exit - try to keep running
});

console.log('🚀 Starting WhatsApp Bridge with Auto-Draft Processor...');
console.log('⏳ Initializing (this may take 30-60 seconds first time)...');
console.log('');
client.initialize();

