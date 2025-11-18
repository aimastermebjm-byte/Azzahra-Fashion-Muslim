const { execSync } = require('child_process');

console.log('🔍 Checking Firebase Index Status...\n');

try {
  // Cek indexes setiap 30 detik
  const checkStatus = () => {
    console.log(`⏰ ${new Date().toLocaleTimeString()}: Checking index status...`);

    try {
      const result = execSync('firebase firestore:indexes', {
        encoding: 'utf8',
        cwd: __dirname
      });

      const indexes = JSON.parse(result);
      const productIndexes = indexes.indexes.filter(idx =>
        idx.collectionGroup === 'products'
      );

      console.log(`📊 Found ${productIndexes.length} product indexes:`);

      productIndexes.forEach((idx, i) => {
        const fields = idx.fields.map(f => f.fieldPath).join(' + ');
        console.log(`  ${i + 1}. ${fields}`);
      });

      if (productIndexes.length >= 5) {
        console.log('✅ Indexes are ready!');
        console.log('\n🚀 Test search function now - should use indexed queries');
      } else {
        console.log('⏳ Indexes still building...');
        console.log(`   Expected: 10 indexes, Found: ${productIndexes.length}`);
        console.log('   Check Firebase Console for detailed status');
      }

      console.log('\n🔗 Firebase Console:');
      console.log('https://console.firebase.google.com/project/azzahra-fashion-muslim-ab416/firestore/indexes');
      console.log('─'.repeat(60));

    } catch (error) {
      console.log('❌ Error checking indexes:', error.message);
    }
  };

  // Check pertama kali
  checkStatus();

  // Interval checking
  console.log('\n⏱️  Auto-checking every 30 seconds (Ctrl+C to stop)...\n');
  const interval = setInterval(checkStatus, 30000);

  // Stop checking
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n👋 Stopped checking');
    process.exit(0);
  });

} catch (error) {
  console.error('❌ Error:', error.message);
}