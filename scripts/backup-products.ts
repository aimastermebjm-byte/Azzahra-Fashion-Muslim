/**
 * 💾 Manual Backup Script
 * 
 * Creates a backup of productBatches/batch_1 before any cleanup
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
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

async function createBackup() {
    console.log('💾 Creating manual backup...\n');

    try {
        const batchRef = doc(db, 'productBatches', 'batch_1');
        const batchSnap = await getDoc(batchRef);

        if (!batchSnap.exists()) {
            console.error('❌ Error: productBatches/batch_1 not found!');
            return;
        }

        const batchData = batchSnap.data();
        const backupDir = path.join(process.cwd(), 'scripts', 'backups');

        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `MANUAL_backup_${timestamp}.json`);

        fs.writeFileSync(backupFile, JSON.stringify(batchData, null, 2));

        console.log(`✅ Backup created successfully!`);
        console.log(`📁 Location: ${backupFile}`);
        console.log(`📊 Products backed up: ${batchData.products?.length || 0}`);

    } catch (error) {
        console.error('❌ Error creating backup:', error);
        throw error;
    }
}

createBackup()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
