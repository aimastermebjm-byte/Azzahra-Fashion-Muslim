/**
 * 🧹 Batch Metadata Cleanup Script (WITH SAFETY BACKUP!)
 * 
 * This script removes legacy metadata fields from productBatches documents.
 * 
 * SAFETY FEATURES:
 * ✅ Creates automatic backup before cleanup
 * ✅ Only removes specific legacy fields
 * ✅ NEVER touches 'products' array or 'flashSaleConfig'
 * 
 * FIELDS TO REMOVE (Root Level):
 * - hasFlashSale (deprecated)
 * - hasFeatured (deprecated)
 * - minPrice (unused)
 * - maxPrice (unused)
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
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
    'hasFlashSale',
    'hasFeatured',
    'minPrice',
    'maxPrice'
];

async function createBackup(batchId: string, data: any) {
    const backupDir = path.join(process.cwd(), 'scripts', 'backups');

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `${batchId}_metadata_backup_${timestamp}.json`);

    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
    console.log(`💾 Backup created for ${batchId}: ${backupFile}`);

    return backupFile;
}

async function cleanupBatchMetadata() {
    console.log('🧹 Starting Batch Metadata Cleanup...');
    console.log('🛡️  Safety Mode: ON (Backup enabled)\n');

    try {
        // We will check batch_1 to batch_10 (just to be safe and thorough)
        const batchesToCheck = Array.from({ length: 10 }, (_, i) => `batch_${i + 1}`);
        let totalCleaned = 0;

        for (const batchId of batchesToCheck) {
            const batchRef = doc(db, 'productBatches', batchId);
            const batchSnap = await getDoc(batchRef);

            if (!batchSnap.exists()) {
                // Batch doesn't exist, skip silently
                continue;
            }

            const data = batchSnap.data();
            const fieldsFound = FIELDS_TO_REMOVE.filter(field => data[field] !== undefined);

            if (fieldsFound.length > 0) {
                console.log(`\n🔍 Checking ${batchId}...`);
                console.log(`   Found legacy fields: ${fieldsFound.join(', ')}`);

                // 🔐 CREATE BACKUP
                await createBackup(batchId, data);

                // PREPARE UPDATES
                const updates: any = {};
                fieldsFound.forEach(field => {
                    updates[field] = deleteField();
                });

                // EXECUTE UPDATE
                console.log(`🧹 Removing ${fieldsFound.length} fields from ${batchId}...`);
                await updateDoc(batchRef, updates);

                console.log(`✅ ${batchId} Cleaned!`);
                totalCleaned++;
            }
        }

        if (totalCleaned === 0) {
            console.log('\n✨ All batches are already clean! No changes made.');
        } else {
            console.log(`\n🎉 Cleanup Complete! Cleaned ${totalCleaned} batches.`);
        }

    } catch (error) {
        console.error('\n❌ Error during cleanup:', error);
        throw error;
    }
}

// Run cleanup
cleanupBatchMetadata()
    .then(() => {
        console.log('\n✅ Script finished successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
