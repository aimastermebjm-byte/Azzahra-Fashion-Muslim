/**
 * 🧹 Browser-Based Firebase Cleanup Tool
 * 
 * Run this in browser console while logged in as OWNER/ADMIN
 * This bypasses Node.js permission issues by using your authenticated session
 * 
 * HOW TO USE:
 * 1. Login to app as OWNER
 * 2. Open browser DevTools (F12)
 * 3. Copy-paste entire code into Console
 * 4. Press Enter
 * 5. Script will auto-cleanup with backup!
 */

(async function cleanupFirebaseFields() {
    console.log('🧹 Starting Browser-Based Firebase Cleanup...\n');

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

    try {
        // Import Firebase (already loaded in app)
        const { doc, getDoc, setDoc } = window.firebaseImports ||
            await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

        // Get Firestore instance (already initialized)
        const db = window.db; // From your app

        if (!db) {
            console.error('❌ Error: Firestore not found! Make sure you are on the app page.');
            return;
        }

        // Get productBatches/batch_1
        console.log('📥 Fetching products from Firebase...');
        const batchRef = doc(db, 'productBatches', 'batch_1');
        const batchSnap = await getDoc(batchRef);

        if (!batchSnap.exists()) {
            console.error('❌ Error: productBatches/batch_1 not found!');
            return;
        }

        const batchData = batchSnap.data();
        const products = batchData.products || [];

        console.log(`📦 Found ${products.length} products\n`);

        // Create backup in localStorage
        console.log('💾 Creating backup in localStorage...');
        localStorage.setItem(
            'FIREBASE_BACKUP_' + new Date().toISOString(),
            JSON.stringify(batchData)
        );
        console.log('✅ Backup saved to localStorage\n');

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
                totalFieldsRemoved += productFieldsRemoved.length;
                productsCleaned++;

                // Log progress every 10 products
                if (index % 10 === 0 || index < 3 || index >= products.length - 3) {
                    console.log(`✓ Product ${index + 1}/${products.length} (${product.name || product.id})`);
                    console.log(`  Removed: ${productFieldsRemoved.join(', ')}`);
                }
            }

            return cleaned;
        });

        // Show summary
        console.log('\n📊 Cleanup Summary:');
        console.log(`   - Total products: ${products.length}`);
        console.log(`   - Products cleaned: ${productsCleaned}`);
        console.log(`   - Total fields removed: ${totalFieldsRemoved}`);
        console.log(`   - Features merged: ${featuresMerged}`);

        // Confirm before updating
        const confirm = window.confirm(
            `🚨 READY TO CLEANUP!\n\n` +
            `Will remove ${totalFieldsRemoved} deprecated fields from ${productsCleaned} products.\n\n` +
            `✅ Backup created in localStorage\n` +
            `✅ Products will NOT be deleted\n\n` +
            `Continue?`
        );

        if (!confirm) {
            console.log('❌ Cleanup cancelled by user.');
            return;
        }

        // Update Firebase
        console.log('\n📤 Updating Firebase...');
        await setDoc(batchRef, {
            ...batchData,
            products: cleanedProducts,
            updatedAt: new Date().toISOString()
        });

        console.log('\n✅ CLEANUP COMPLETE!\n');
        console.log('🎉 Firebase database is now clean!');
        console.log('\n💡 Backup location: localStorage key starting with "FIREBASE_BACKUP_"');
        console.log('💡 To restore: Run the restore script or manually copy from localStorage');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        console.error('\n💡 Make sure you are:');
        console.error('   1. Logged in as OWNER');
        console.error('   2. On the app page (not admin panel)');
        console.error('   3. Have necessary permissions');
    }
})();
