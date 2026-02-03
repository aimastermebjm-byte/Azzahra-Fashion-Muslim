/**
 * 🧹 Firebase Product Fields Cleanup Script (WITH SAFETY BACKUP!)
 * 
 * This script removes unused/deprecated fields from all products in Firebase productBatches collection.
 * 
 * SAFETY FEATURES:
 * ✅ Creates automatic backup before cleanup
 * ✅ Dry-run mode to preview changes
 * ✅ Only removes fields, NEVER deletes products
 * 
 * FIELDS TO REMOVE (10 total):
 * - originalRetailPrice, originalResellerPrice, originalSellingPrice
 * - flashSaleDiscount, discount
 * - sellingPrice, price, purchasePrice
 * - rating, reviews
 * 
 * MERGE: featured → isFeatured
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs",
    authDomain: "azzahra-fashion-muslim-ab416.firebaseapp.com",
    projectId: "azzahra-fashion-muslim-ab416",
    storageBucket: "azzahra-fashion-muslim-ab416.firebasestorage.app",
    messagingSenderId: "822661485961",
    appId: "1:822661485961:web:4603488d8bef0119f3fd58"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
    'featured' // Will be merged into isFeatured
];

// DRY RUN MODE - Set to true to preview without actually updating Firebase
const DRY_RUN = false; // ✅ EXECUTING CLEANUP

async function createBackup(data: any) {
    const backupDir = path.join(process.cwd(), 'scripts', 'backups');

    // Create backups directory if not exists
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
    console.log('🧹 Starting Firebase product fields cleanup...');
    console.log(`🔧 Mode: ${DRY_RUN ? 'DRY RUN (Preview Only)' : 'LIVE EXECUTION'}\n`);

    try {
        // Get productBatches/batch_1
        const batchRef = doc(db, 'productBatches', 'batch_1');
        const batchSnap = await getDoc(batchRef);

        if (!batchSnap.exists()) {
            console.error('❌ Error: productBatches/batch_1 not found!');
            return;
        }

        const batchData = batchSnap.data();
        const products = batchData.products || [];

        console.log(`📦 Found ${products.length} products\n`);

        // 🔐 CREATE BACKUP
        if (!DRY_RUN) {
            console.log('💾 Creating backup before cleanup...');
            await createBackup(batchData);
        }

        // Stats
        let totalFieldsRemoved = 0;
        let productsCleaned = 0;
        let featuresMerged = 0;

        // Clean each product
        const cleanedProducts = products.map((product: any, index: number) => {
            const productFieldsRemoved: string[] = [];

            // Create cleaned product (only keep non-deprecated fields)
            const cleaned: any = {};

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
                if (!productFieldsRemoved.includes('featured')) {
                    productFieldsRemoved.push('featured (merged to isFeatured)');
                }
            }

            // Log progress (only first 5 and last 5 in dry run)
            if (DRY_RUN && (index < 5 || index >= products.length - 5)) {
                if (productFieldsRemoved.length > 0) {
                    console.log(`✓ Product ${index + 1}/${products.length} (${product.name || product.id})`);
                    console.log(`  Removed: ${productFieldsRemoved.join(', ')}`);
                }
            } else if (!DRY_RUN && productFieldsRemoved.length > 0) {
                console.log(`✓ Product ${index + 1}/${products.length} (${product.name || product.id})`);
                console.log(`  Removed: ${productFieldsRemoved.join(', ')}`);
            }

            if (productFieldsRemoved.length > 0) {
                totalFieldsRemoved += productFieldsRemoved.length;
                productsCleaned++;
            }

            return cleaned;
        });

        if (DRY_RUN) {
            console.log('\n... (showing first 5 and last 5 products) ...\n');
        }

        // Update Firebase
        if (!DRY_RUN) {
            console.log('\n📤 Updating Firebase...');
            await setDoc(batchRef, {
                ...batchData,
                products: cleanedProducts,
                updatedAt: new Date().toISOString()
            });
            console.log('✅ Firebase updated successfully!');
        } else {
            console.log('\n⚠️ DRY RUN - No changes made to Firebase');
        }

        console.log('\n📊 Summary:');
        console.log(`   - Total products: ${products.length}`);
        console.log(`   - Products to clean: ${productsCleaned}`);
        console.log(`   - Total fields to remove: ${totalFieldsRemoved}`);
        console.log(`   - Features to merge: ${featuresMerged}`);

        if (DRY_RUN) {
            console.log('\n💡 TIP: Set DRY_RUN = false in script to execute cleanup');
        } else {
            console.log('\n🎉 Firebase database is now clean!');
        }

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
