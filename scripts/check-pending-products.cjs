const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkPendingProducts() {
    console.log('🔍 Checking pending_products collection...');
    try {
        const snapshot = await db.collection('pending_products').get();

        if (snapshot.empty) {
            console.log('❌ No documents found in pending_products.');
        } else {
            console.log(`✅ Found ${snapshot.size} documents:`);
            snapshot.forEach(doc => {
                console.log(`- ID: ${doc.id}`);
                console.log(`  Data:`, JSON.stringify(doc.data(), null, 2));
            });
        }
    } catch (error) {
        console.error('Error checking Firestore:', error);
    }
}

checkPendingProducts();
