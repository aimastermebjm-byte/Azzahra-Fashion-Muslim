const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 1. Initialize Firebase Admin
// Pastikan service account key ada di lokasi yang benar atau set environment variable
// Jika tidak ada service account, kita coba pakai default credentials jika di environment yang mendukung
// Tapi untuk script lokal, service account json paling stabil.
// Cek apakah ada file service account di root
const serviceAccountPath = path.join(__dirname, '../service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Service account key tidak ditemukan di:', serviceAccountPath);
  console.error('Harap download service account key dari Firebase Console -> Project Settings -> Service Accounts -> Generate Private Key');
  console.error('Dan simpan sebagai "service-account.json" di folder root project.');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'azzahra-fashion-muslim-1643c.appspot.com' // Ganti dengan bucket name Anda
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// 2. Initialize WhatsApp Client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox']
  }
});

client.on('qr', (qr) => {
  console.log('SCAN QR CODE INI DENGAN WHATSAPP ANDA:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ WhatsApp Bridge SIAP! Menunggu pesan...');
  console.log('👉 Kirim pesan ke nomor Anda sendiri (Note to Self) dengan gambar dan caption.');
});

client.on('message_create', async (msg) => {
  // Hanya proses pesan dari user sendiri (me) untuk keamanan
  if (!msg.fromMe) return;

  // Cek apakah ada gambar
  if (msg.hasMedia) {
    try {
      const media = await msg.downloadMedia();
      
      if (!media || !media.mimetype.startsWith('image/')) {
        console.log('⚠️ Pesan diterima tapi bukan gambar.');
        return;
      }

      console.log('📩 Menerima gambar baru dari WhatsApp...');
      console.log('📝 Caption:', msg.body);

      // Upload ke Firebase Storage
      const filename = `whatsapp_${Date.now()}.${media.mimetype.split('/')[1]}`;
      const file = bucket.file(`pending_uploads/${filename}`);
      
      await file.save(Buffer.from(media.data, 'base64'), {
        metadata: {
          contentType: media.mimetype
        }
      });
      
      console.log('☁️ Gambar terupload ke Storage.');

      // Buat URL publik (tapi signed url lebih aman, ini versi cepat untuk admin)
      // Kita pakai signed URL yang valid lama (e.g., 100 tahun) agar bisa diakses di dashboard
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '03-09-2491'
      });

      // Simpan ke Firestore collection 'pending_products'
      await db.collection('pending_products').add({
        imageUrl: url,
        caption: msg.body || '',
        status: 'pending',
        source: 'whatsapp',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        storagePath: `pending_uploads/${filename}`
      });

      console.log('✅ Data tersimpan di pending_products! Cek Dashboard.');
      
      // Reply ke WhatsApp (opsional)
      // msg.reply('✅ Produk diterima sistem! Cek Dashboard untuk publish.');

    } catch (error) {
      console.error('❌ Gagal memproses pesan:', error);
    }
  }
});

console.log('🚀 Memulai WhatsApp Bridge...');
client.initialize();
