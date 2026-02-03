/**
 * 🧹 Firebase Product Fields Cleanup Script (ADMIN SDK VERSION)
 * 
 * Uses Firebase Admin SDK with service account for direct database access
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK with service account
const serviceAccount = require('../service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Fields to remove
const FIELDS_TO_REMOVE = [
    'originalRetailPrice',
    'originalResellerPrice',
    'originalSellingPrice',
    'flashSaleDiscount',
    'discount',
    'sellingPrice',
    'price',
    'purchasePrice',
    'rating',
    'reviews',
    'featured'
];

async function createBackup(data) {
    const backupDir = path.join(__dirname, 'backups');

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `productBatch_backup_${timestamp}.json`);

    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
    console.log(`💾 Backup created: ${backupFile}\n`);

    return backupFile;
}

async function cleanupProductFields() {
    console.log('🧹 Starting Firebase product fields cleanup (Admin SDK)...\n');

    try {
        const batchRef = db.collection('productBatches').doc('batch_1');
        const batchSnap = await batchRef.get();

        if (!batchSnap.exists) {
            console.error('❌ Error: productBatches/batch_1 not found!');
            return;
        }

        const batchData = batchSnap.data();
        const products = batchData.products || [];

        console.log(`📦 Found ${products.length} products\n`);

        // 🔐 CREATE BACKUP
        console.log('💾 Creating backup before cleanup...');
        await createBackup(batchData);

        // Stats
        let totalFieldsRemoved = 0;
        let productsCleaned = 0;
        let featuresMerged = 0;

        // Clean each product
        const cleanedProducts = products.map((product, index) => {
            const productFieldsRemoved = [];
            const cleaned = {};

            // Copy all fields EXCEPT the ones to remove
            for (const key in product) {
                if (!FIELDS_TO_REMOVE.includes(key)) {
                    cleaned[key] = product[key];
                } else {
                    productFieldsRemoved.push(key);
                }
            }

            // Merge featured → isFeatured
            if (product.featured && !product.isFeatured) {
                cleaned.isFeatured = Boolean(product.featured);
                featuresMerged++;
            }

            if (productFieldsRemoved.length > 0) {
                console.log(`✓ Product ${index + 1}/${products.length} (${product.name || product.id})`);
                console.log(`  Removed: ${productFieldsRemoved.join(', ')}`);
                totalFieldsRemoved += productFieldsRemoved.length;
                productsCleaned++;
            }

            return cleaned;
        });

        // Update Firebase
        console.log('\n📤 Updating Firebase...');
        await batchRef.set({
            ...batchData,
            products: cleanedProducts,
            updatedAt: new Date().toISOString()
        });

        console.log('\n✅ CLEANUP COMPLETE!\n');
        console.log('📊 Summary:');
        console.log(`   - Total products: ${products.length}`);
        console.log(`   - Products cleaned: ${productsCleaned}`);
        console.log(`   - Total fields removed: ${totalFieldsRemoved}`);
        console.log(`   - Features merged: ${featuresMerged}`);
        console.log('\n🎉 Firebase database is now clean!');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    }
}

// Run cleanup
cleanupProductFields()
    .then(() => {
        console.log('\n✅ Script finished successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
