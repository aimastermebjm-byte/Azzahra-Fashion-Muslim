/**
 * Script untuk setup Firebase collection payment-detections
 * Run: node setup-payment-detection-firebase.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setupPaymentDetectionFirebase() {
  try {
    console.log('🔧 Setting up Firebase collections for Payment Detection System\n');

    // 1. Create default settings
    console.log('📝 Creating default settings...');
    const settingsRef = doc(db, 'paymentDetectionSettings', 'config');
    await setDoc(settingsRef, {
      mode: 'semi-auto',
      enabled: true,
      autoConfirmThreshold: 90,
      autoConfirmRules: {
        exactAmountMatch: true,
        nameSimilarity: 80,
        maxOrderAge: 7200 // 2 hours in seconds
      },
      createdAt: serverTimestamp(),
      lastModified: serverTimestamp()
    });
    console.log('✅ Settings created with default values (Semi-Auto mode)');

    // 2. Add mock detection data for testing
    console.log('\n📝 Adding mock payment detections for testing...');
    
    const mockDetections = [
      {
        amount: 250000,
        senderName: 'SITI NURHALIZA',
        bank: 'BRI',
        timestamp: new Date().toISOString(),
        rawText: 'BRIMo\nTransfer Masuk\nRp250.000,00\ndari SITI NURHALIZA',
        screenshotUrl: null,
        matchedOrderId: null,
        confidence: null,
        status: 'pending',
        createdAt: serverTimestamp()
      },
      {
        amount: 180000,
        senderName: 'AHMAD DHANI',
        bank: 'Mandiri',
        timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
        rawText: "Livin' by Mandiri\nTransaksi Berhasil\nTransfer Diterima Rp 180.000\nDari: AHMAD DHANI (1234567890)",
        screenshotUrl: null,
        matchedOrderId: null,
        confidence: null,
        status: 'pending',
        createdAt: serverTimestamp()
      },
      {
        amount: 320000,
        senderName: 'RINA SUSANTI',
        bank: 'BCA',
        timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
        rawText: 'BCA mobile\nInfo Rekening\nTransfer masuk Rp320.000\ndari 9876543210 a.n RINA SUSANTI',
        screenshotUrl: null,
        matchedOrderId: null,
        confidence: null,
        status: 'pending',
        createdAt: serverTimestamp()
      }
    ];

    for (const detection of mockDetections) {
      const detectionRef = doc(collection(db, 'paymentDetectionsPending'));
      await setDoc(detectionRef, detection);
      console.log(`✅ Added mock: Rp${detection.amount.toLocaleString('id-ID')} from ${detection.senderName}`);
    }

    console.log('\n✨ Firebase setup complete!\n');
    console.log('📋 Collections created:');
    console.log('   ✅ paymentDetectionSettings (Semi-Auto mode, threshold: 90%)');
    console.log('   ✅ paymentDetectionsPending (3 mock detections)');
    console.log('   ✅ paymentDetectionsVerified (ready for use)');
    console.log('   ✅ paymentDetectionsIgnored (ready for use)');
    console.log('\n🎯 Next steps:');
    console.log('   1. Open your app');
    console.log('   2. Login as admin/owner');
    console.log('   3. Navigate to: Account > Verifikasi Pembayaran');
    console.log('   4. You should see 3 mock detections ready for testing!');
    console.log('\n💡 Tips:');
    console.log('   - The mock detections will try to auto-match with pending orders');
    console.log('   - If no orders match, they will show as "No Match"');
    console.log('   - Create some test orders first to see auto-matching in action');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error setting up Firebase:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Check if .env.local file exists with Firebase credentials');
    console.error('2. Verify Firebase project ID is correct');
    console.error('3. Ensure you have write permissions to Firestore');
    process.exit(1);
  }
}

// Run the setup
setupPaymentDetectionFirebase();
