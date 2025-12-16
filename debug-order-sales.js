// Debug script untuk cek order structure dan sales data
// Run: node debug-order-sales.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

// Firebase config (ganti dengan config Anda)
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

async function debugOrderSales() {
  console.log('🔍 DEBUG: Checking order sales data...\n');

  // 1. Cek semua orders (tanpa filter dulu)
  console.log('📦 Fetching ALL orders...');
  const allOrdersRef = collection(db, 'orders');
  const allOrdersSnapshot = await getDocs(allOrdersRef);
  
  console.log(`✅ Total orders in database: ${allOrdersSnapshot.size}`);
  console.log('');

  if (allOrdersSnapshot.size === 0) {
    console.log('❌ No orders found in database!');
    return;
  }

  // 2. Cek structure setiap order
  console.log('📋 Order details:\n');
  allOrdersSnapshot.docs.forEach((doc, index) => {
    const order = doc.data();
    console.log(`--- Order ${index + 1} (ID: ${doc.id}) ---`);
    console.log('Status:', order.status || 'MISSING');
    
    // Safe date handling
    let createdAtStr = 'MISSING';
    if (order.createdAt) {
      try {
        if (order.createdAt.seconds) {
          createdAtStr = new Date(order.createdAt.seconds * 1000).toISOString();
        } else if (order.createdAt.toDate) {
          createdAtStr = order.createdAt.toDate().toISOString();
        } else {
          createdAtStr = String(order.createdAt);
        }
      } catch (e) {
        createdAtStr = `ERROR: ${e.message}`;
      }
    }
    console.log('CreatedAt:', createdAtStr);
    console.log('Items count:', order.items?.length || 0);
    
    if (order.items && order.items.length > 0) {
      order.items.forEach((item, i) => {
        console.log(`  Item ${i + 1}:`);
        console.log(`    - productId: ${item.productId || 'MISSING'}`);
        console.log(`    - productName: ${item.productName || 'MISSING'}`);
        console.log(`    - quantity: ${item.quantity || 0}`);
        console.log(`    - price: ${item.price || 0}`);
        console.log(`    - category: ${item.category || 'MISSING'}`);
      });
    } else {
      console.log('  ⚠️ No items array or empty!');
    }
    console.log('');
  });

  // 3. Cek orders dengan filter (sama seperti di salesHistoryService)
  console.log('🔍 Checking orders with filter (last 3 months, paid/delivered/processing)...\n');
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3);

  console.log('Date range:', startDate.toISOString(), 'to', endDate.toISOString());

  const filteredOrdersRef = collection(db, 'orders');
  const q = query(
    filteredOrdersRef,
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    where('createdAt', '<=', Timestamp.fromDate(endDate)),
    where('status', 'in', ['paid', 'delivered', 'processing'])
  );

  try {
    const filteredSnapshot = await getDocs(q);
    console.log(`✅ Orders matching filter: ${filteredSnapshot.size}`);
    
    if (filteredSnapshot.size === 0) {
      console.log('\n❌ No orders match the filter!');
      console.log('Possible reasons:');
      console.log('  1. Order status is not "paid", "delivered", or "processing"');
      console.log('  2. Order createdAt is older than 3 months');
      console.log('  3. Order createdAt is not a proper Timestamp');
    } else {
      console.log('\n📊 Sales data by product:');
      
      const salesByProduct = new Map();
      
      filteredSnapshot.docs.forEach(doc => {
        const order = doc.data();
        const items = order.items || [];
        
        items.forEach(item => {
          if (item.productId) {
            if (!salesByProduct.has(item.productId)) {
              salesByProduct.set(item.productId, {
                productId: item.productId,
                productName: item.productName || 'Unknown',
                totalQuantity: 0,
                totalRevenue: 0
              });
            }
            
            const data = salesByProduct.get(item.productId);
            data.totalQuantity += item.quantity || 0;
            data.totalRevenue += (item.price || 0) * (item.quantity || 0);
          }
        });
      });
      
      salesByProduct.forEach((data, productId) => {
        console.log(`\n  Product: ${data.productName}`);
        console.log(`    ID: ${productId}`);
        console.log(`    Total Quantity: ${data.totalQuantity} pcs`);
        console.log(`    Total Revenue: Rp ${data.totalRevenue.toLocaleString('id-ID')}`);
      });
    }
  } catch (error) {
    console.error('❌ Error querying filtered orders:', error.message);
  }

  // 4. Cek produk "baju 5"
  console.log('\n\n🔍 Checking product "baju 5"...');
  const productsRef = collection(db, 'products');
  const productsSnapshot = await getDocs(productsRef);
  
  const baju5 = productsSnapshot.docs.find(doc => {
    const product = doc.data();
    return product.name?.toLowerCase().includes('baju 5');
  });
  
  if (baju5) {
    console.log(`✅ Found "baju 5" with ID: ${baju5.id}`);
    console.log(`   Name: ${baju5.data().name}`);
    console.log(`   Category: ${baju5.data().category}`);
  } else {
    console.log('❌ Product "baju 5" not found!');
  }
}

debugOrderSales().then(() => {
  console.log('\n✅ Debug complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Debug error:', error);
  process.exit(1);
});
