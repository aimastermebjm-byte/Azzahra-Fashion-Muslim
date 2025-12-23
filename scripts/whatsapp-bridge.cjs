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
  storageBucket: 'azzahra-fashion-muslim-ab416.firebasestorage.app' // Correct bucket from .env.local
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

client.on('loading_screen', (percent, message) => {
  console.log('LOADING SCREEN', percent, message);
});

client.on('authenticated', () => {
  console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
  console.error('AUTHENTICATION FAILURE', msg);
});

// Listener khusus debug untuk melihat SEMUA pesan yang masuk
client.on('message', async (msg) => {
  console.log('🔔 EVENT: message received from', msg.from);
});

client.on('ready', () => {
  console.log('✅ WhatsApp Bridge SIAP! Menunggu pesan...');
  console.log('👉 Kirim pesan ke nomor Anda sendiri (Note to Self) dengan gambar dan caption.');
});

client.on('message_create', async (msg) => {
  // Debug log sangat detail
  console.log('------------------------------------------------');
  console.log('📨 EVENT: message_create');
  console.log('From:', msg.from);
  console.log('To:', msg.to);
  console.log('FromMe:', msg.fromMe);
  console.log('HasMedia:', msg.hasMedia);
  console.log('Body:', msg.body.substring(0, 50));
  console.log('Type:', msg.type);
  console.log('------------------------------------------------');

  // --- KONFIGURASI WHITELIST ---
  // Masukkan nomor HP staff/admin lain yang diizinkan (Format: 628xxx@c.us)
  const ALLOWED_NUMBERS = [
    '6287815990944@c.us', // Staff (087815990944)
    // '62898765432@c.us', // Contoh: Staff B
  ];

  const isAllowed = msg.fromMe || ALLOWED_NUMBERS.includes(msg.from);

  if (!isAllowed) {
    console.log(`⛔ Diabaikan: Pesan dari ${msg.from} tidak diizinkan.`);
    console.log(`ℹ️ Tips: Jika ingin mengizinkan nomor ini, tambahkan '${msg.from}' ke dalam array ALLOWED_NUMBERS di script.`);
    return;
  }

  // Cek pesan gambar
  if (msg.hasMedia) {
    try {
      console.log('📥 Mencoba download media...');
      const media = await msg.downloadMedia();

      if (!media) {
        console.log('⚠️ Media gagal didownload (null returned).');
        return;
      }

      // Coba ambil caption dari berbagai sumber kemungkinan
      const finalCaption = msg.body || msg.caption || (msg._data ? msg._data.caption : '') || '';

      console.log('📝 Caption ditemukan:', finalCaption);

      if (!media.mimetype.startsWith('image/')) {
        console.log('⚠️ Pesan diterima tapi bukan gambar (Mimetype: ' + media.mimetype + ')');
        return;
      }

      console.log('📩 Menerima gambar valid!');

      // Upload ke Firebase Storage
      const filename = `whatsapp_${Date.now()}.${media.mimetype.split('/')[1]}`;
      const file = bucket.file(`pending_uploads/${filename}`);

      console.log('☁️ Mengupload ke Storage:', filename);
      await file.save(Buffer.from(media.data, 'base64'), {
        metadata: {
          contentType: media.mimetype
        }
      });
      console.log('✅ Upload ke Firebase Storage BERHASIL.');

      // Buat URL publik
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '03-09-2491'
      });

      console.log('🔗 URL Gambar:', url);

      // Simpan ke Firestore collection 'pending_products'
      console.log('💾 Menyimpan data ke Firestore...');
      const docRef = await db.collection('pending_products').add({
        imageUrl: url,
        caption: finalCaption, // Gunakan caption yang sudah dilacak
        status: 'pending',
        source: 'whatsapp',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        storagePath: `pending_uploads/${filename}`
      });

      console.log('✅ Data TERSEIMPAN di pending_products! ID:', docRef.id);
      console.log('👉 SILAKAN CEK DASHBOARD ADMIN SEKARANG.');

    } catch (error) {
      console.error('❌ ERROR FATAL saat memproses pesan:', error);
    }
  } else {
    // Handling Text-Only
    console.log('📝 INFO: Pesan Teks diterima.');
    console.log('   Isi Pesan:', msg.body);

    try {
      // Simpan pesan teks ke Firestore juga agar bisa digabung di frontend
      const docRef = await db.collection('pending_products').add({
        imageUrl: null, // Tidak ada gambar
        caption: msg.body,
        status: 'pending',
        source: 'whatsapp',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        type: 'text' // Penanda tipe pesan
      });
      console.log('✅ Pesan Teks TERSIMPAN di pending_products! ID:', docRef.id);
    } catch (error) {
      console.error('❌ Gagal menyimpan pesan teks:', error);
    }
  }
});

console.log('🚀 Memulai WhatsApp Bridge...');
const axios = require('axios');

// ... (Existing code) ...

client.on('ready', async () => {
  console.log('✅ WhatsApp Bridge SIAP! Menunggu pesan...');
  console.log('👉 Kirim pesan ke nomor Anda sendiri (Note to Self) dengan gambar dan caption.');

  // --- FITUR AUTOMATIC POSTING ---
  console.log('📡 Mengaktifkan listener untuk Auto-Post...');

  // Listen to pending posts
  db.collection('pending_whatsapp_group_posts')
    .where('status', '==', 'pending')
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const postData = change.doc.data();
          const docId = change.doc.id;
          console.log(`🆕 Mendeteksi Pending Post baru: ${docId}`);

          try {
            // 1. Download Gambar
            console.log('⬇️ Mengunduh gambar dari URL...');
            const response = await axios.get(postData.imageUrl, { responseType: 'arraybuffer' });
            const media = new MessageMedia(
              response.headers['content-type'],
              Buffer.from(response.data).toString('base64'),
              'image.jpg'
            );

            // 2. Cari Target Groups (Filter nama 'Reseller' atau 'Katalog' atau 'Gamis')
            // Note: Fetching chats might take a moment on startup
            /*
            DISABLED BY USER REQUEST - DO NOT SEND TO GROUPS YET
            const chats = await client.getChats();
            const targetGroups = chats.filter(chat =>
              chat.isGroup && (
                  chat.name.toLowerCase().includes('reseller') ||
                  chat.name.toLowerCase().includes('katalog') ||
                  chat.name.toLowerCase().includes('azzahra')
              )
            );

            console.log(`🎯 Ditemukan ${targetGroups.length} grup target:`, targetGroups.map(g => g.name));

            if (targetGroups.length === 0) {
               console.log('⚠️ Tidak ada grup yang cocok dengan filter. Mengirim ke Note to Self saja.');
               targetGroups.push({ id: { _serialized: client.info.wid._serialized }, name: 'Me (Self)' });
            }

            // 3. Kirim ke setiap grup
            for (const group of targetGroups) {
              console.log(`🚀 Mengirim ke ${group.name}...`);
              await client.sendMessage(group.id._serialized, media, { caption: postData.caption });
              // Jeda 2 detik biar aman
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            */

            console.log('⚠️ Auto-Post ke Group DINONAKTIFKAN sementara (Safety Mode).');
            // Kirim ke self only sebagai indikator sistem hidup (Optional, but better safe to disable all for now)
            /*
            await client.sendMessage(client.info.wid._serialized, "System Ready (Auto-Post Disabled)");
            */

            // 4. Update Status di Firestore (Skip updating to 'published' so it stays pending/processed?)
            // Better to mark as 'skipped' so it doesn't retry infinitely if we re-enable
            await db.collection('pending_whatsapp_group_posts').doc(docId).update({
              status: 'skipped_safety_mode',
              publishedAt: admin.firestore.FieldValue.serverTimestamp(),
              note: 'User disabled auto-posting'
            });

            console.log('✅ Post SKIPPED (Safety Mode).');

          } catch (error) {
            console.error('❌ Gagal mengirim post:', error);
            await db.collection('pending_whatsapp_group_posts').doc(docId).update({
              status: 'failed',
              error: error.message
            });
          }
        }
      });
    });
});

// Helper for cleanup
const { MessageMedia } = require('whatsapp-web.js');

client.initialize();
