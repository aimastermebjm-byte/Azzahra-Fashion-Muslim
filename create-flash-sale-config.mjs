import { initializeApp } from 'firebase/app';
import { doc, setDoc, getFirestore } from 'firebase/firestore';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

console.log('🔥 Creating Flash Sale Config...');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createFlashSaleConfig() {
  try {
    // Set flash sale untuk 24 jam dari sekarang
    const now = new Date();
    const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 jam dari sekarang

    const flashSaleConfig = {
      id: 'config',
      isActive: true,
      startTime: now.toISOString(),
      endTime: endTime.toISOString(),
      products: [], // Akan diisi otomatis dari batch
      flashSaleDiscount: 20, // 20% diskon default
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    // Write ke Firestore
    await setDoc(doc(db, 'flashSale', 'config'), flashSaleConfig);

    console.log('\n✅ Flash Sale Config Created Successfully!');
    console.log('=====================================');
    console.log(`🕐 Start Time: ${now.toLocaleString('id-ID')}`);
    console.log(`🏁 End Time: ${endTime.toLocaleString('id-ID')}`);
    console.log(`⏳ Duration: 24 hours`);
    console.log(`💰 Discount: ${flashSaleConfig.flashSaleDiscount}%`);
    console.log(`🔥 Status: ${flashSaleConfig.isActive ? 'ACTIVE' : 'INACTIVE'}`);
    console.log('\n📝 Next Steps:');
    console.log('1. Refresh browser kamu');
    console.log('2. Flash sale akan muncul dengan produk yang sudah di-set isFlashSale: true');
    console.log('3. Timer countdown akan otomatis berjalan');
    console.log('4. Produk akan hilang otomatis saat waktu berakhir');

  } catch (error) {
    console.error('❌ Error creating flash sale config:', error);
  }
}

createFlashSaleConfig();