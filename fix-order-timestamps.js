// Fix existing orders: Convert createdAt from string to Timestamp
// Run: node fix-order-timestamps.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBGPl6P_LpMWPtNAqKCjDiCxp1-zFNjBWE",
  authDomain: "azzahra-fashion-muslim-ab416.firebaseapp.com",
  projectId: "azzahra-fashion-muslim-ab416",
  storageBucket: "azzahra-fashion-muslim-ab416.firebasestorage.app",
  messagingSenderId: "389566093532",
  appId: "1:389566093532:web:9e3ceb1d73bdda62b93a36",
  measurementId: "G-DL37HR4KT1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixOrderTimestamps() {
  console.log('🔧 Fixing order timestamps...\n');

  const ordersRef = collection(db, 'orders');
  const snapshot = await getDocs(ordersRef);

  console.log(`📦 Found ${snapshot.size} orders to process\n`);

  let fixed = 0;
  let skipped = 0;

  for (const orderDoc of snapshot.docs) {
    const order = orderDoc.data();
    const orderId = orderDoc.id;

    console.log(`\n--- Processing Order: ${orderId} ---`);
    console.log('Current createdAt type:', typeof order.createdAt);
    console.log('Current createdAt value:', order.createdAt);

    // Check if createdAt is a string (needs fix)
    if (typeof order.createdAt === 'string') {
      try {
        // Convert string to Date then to Timestamp
        const createdDate = new Date(order.createdAt);
        const updatedDate = order.updatedAt ? new Date(order.updatedAt) : createdDate;

        if (isNaN(createdDate.getTime())) {
          console.error('❌ Invalid date string:', order.createdAt);
          skipped++;
          continue;
        }

        // Update with proper Timestamps
        await updateDoc(doc(db, 'orders', orderId), {
          createdAt: Timestamp.fromDate(createdDate),
          updatedAt: Timestamp.fromDate(updatedDate)
        });

        console.log('✅ Fixed!');
        console.log('  - Old createdAt (string):', order.createdAt);
        console.log('  - New createdAt (Timestamp):', createdDate.toISOString());
        fixed++;
      } catch (error) {
        console.error('❌ Error fixing order:', orderId, error.message);
        skipped++;
      }
    } else if (order.createdAt?.toDate) {
      console.log('✓ Already a Timestamp, no fix needed');
      skipped++;
    } else {
      console.log('⚠️ Unknown createdAt type, skipping');
      skipped++;
    }
  }

  console.log('\n\n📊 Summary:');
  console.log(`  - Total orders: ${snapshot.size}`);
  console.log(`  - Fixed: ${fixed}`);
  console.log(`  - Skipped: ${skipped}`);
  console.log('\n✅ Done!');
}

fixOrderTimestamps()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
