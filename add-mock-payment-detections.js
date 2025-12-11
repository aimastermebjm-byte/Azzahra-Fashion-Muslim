/**
 * Script untuk menambahkan mock payment detections untuk testing
 * Run: node add-mock-payment-detections.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
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

// Mock payment detections
const mockDetections = [
  {
    amount: 250000,
    senderName: 'SITI NURHALIZA',
    bank: 'BRI',
    timestamp: new Date().toISOString(),
    rawText: 'BRIMo\nTransfer Masuk\nRp250.000,00\ndari SITI NURHALIZA',
    screenshotUrl: null,
    confidence: 95,
    status: 'pending'
  },
  {
    amount: 180000,
    senderName: 'AHMAD DHANI',
    bank: 'Mandiri',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(), // 5 minutes ago
    rawText: "Livin' by Mandiri\nTransaksi Berhasil\nTransfer Diterima Rp 180.000\nDari: AHMAD DHANI (1234567890)",
    screenshotUrl: null,
    confidence: 85,
    status: 'pending'
  },
  {
    amount: 320000,
    senderName: 'RINA SUSANTI',
    bank: 'BCA',
    timestamp: new Date(Date.now() - 10 * 60000).toISOString(), // 10 minutes ago
    rawText: 'BCA mobile\nInfo Rekening\nTransfer masuk Rp320.000\ndari 9876543210 a.n RINA SUSANTI',
    screenshotUrl: null,
    confidence: 90,
    status: 'pending'
  },
  {
    amount: 95000,
    senderName: 'BUDI SETIAWAN',
    bank: 'BRI',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(), // 15 minutes ago
    rawText: 'BRIMo\nTransfer Masuk\nRp95.000,00\ndari BUDI SETIAWAN',
    screenshotUrl: null,
    confidence: null, // No match
    status: 'pending'
  }
];

async function addMockDetections() {
  try {
    console.log('🔄 Adding mock payment detections...\n');

    for (const detection of mockDetections) {
      const detectionRef = doc(collection(db, 'payment-detections/pending/items'));
      
      await setDoc(detectionRef, {
        ...detection,
        createdAt: serverTimestamp()
      });

      console.log(`✅ Added detection: Rp${detection.amount.toLocaleString('id-ID')} from ${detection.senderName}`);
    }

    console.log('\n✨ All mock detections added successfully!');
    console.log('\n📱 Open the app and navigate to: Admin > Verifikasi Pembayaran');
    console.log('\nYou should see 4 mock payment detections ready for testing.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding mock detections:', error);
    process.exit(1);
  }
}

// Run the script
addMockDetections();
