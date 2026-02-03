/**
 * 🔄 Restore Backup Script
 * 
 * Restores productBatches from a backup file
 * USE THIS if you need to rollback the cleanup!
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Firebase config
const firebaseConfig = {
    // TODO: Paste firebase config here
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function restoreBackup(backupFileName: string) {
    console.log('🔄 Starting restore from backup...\n');

    try {
        const backupDir = path.join(process.cwd(), 'scripts', 'backups');
        const backupFile = path.join(backupDir, backupFileName);

        if (!fs.existsSync(backupFile)) {
            console.error(`❌ Error: Backup file not found: ${backupFile}`);
            console.log('\n📁 Available backups:');
            const backups = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
            backups.forEach(f => console.log(`   - ${f}`));
            return;
        }

        console.log(`📂 Reading backup file: ${backupFileName}`);
        const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));

        console.log(`📦 Found ${backupData.products?.length || 0} products in backup`);

        // Restore to Firebase
        const batchRef = doc(db, 'productBatches', 'batch_1');

        console.log('\n📤 Restoring to Firebase...');
        await setDoc(batchRef, backupData);

        console.log('\n✅ RESTORE COMPLETE!');
        console.log(`📊 Restored ${backupData.products?.length || 0} products`);
        console.log('🎉 Your data has been restored!');

    } catch (error) {
        console.error('❌ Error during restore:', error);
        throw error;
    }
}

// Usage: node restore-backup.js <backup-filename>
const backupFileName = process.argv[2];

if (!backupFileName) {
    console.error('❌ Error: Please provide backup filename');
    console.log('\nUsage: npx tsx scripts/restore-backup.ts <backup-filename>');
    console.log('Example: npx tsx scripts/restore-backup.ts productBatch_backup_2026-02-03.json');
    process.exit(1);
}

restoreBackup(backupFileName)
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
