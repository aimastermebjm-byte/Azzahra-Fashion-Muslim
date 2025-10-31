// Debug cache data by checking what's stored in Firebase
const debugCacheData = async () => {
  const FIREBASE_PROJECT_ID = 'azzahra-fashion-muslim-ab416';
  const FIREBASE_API_KEY = 'AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs';

  console.log('🔍 Debugging Cache Data in Firebase...');
  console.log('========================================');

  // Check specific cache keys that should be created
  const expectedCacheKeys = [
    '607_114_1000_jne',
    '607_114_1000_jnt',
    '607_114_1000_pos',
    '607_114_1000_tiki',
    '607_114_1000_sicepat',
    '607_114_1000_wahana'
  ];

  for (const cacheKey of expectedCacheKeys) {
    console.log(`\n📦 Checking cache key: ${cacheKey}`);
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/shipping_cache/${cacheKey}?key=${FIREBASE_API_KEY}`;

    try {
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Found cached data:`);
        console.log(`   - Origin: ${data.fields.origin?.stringValue}`);
        console.log(`   - Destination: ${data.fields.destination?.stringValue}`);
        console.log(`   - Weight: ${data.fields.weight?.integerValue}`);
        console.log(`   - Courier: ${data.fields.courier?.stringValue}`);
        console.log(`   - Cached at: ${data.fields.cached_at?.timestampValue}`);
        console.log(`   - Expires at: ${data.fields.expires_at?.timestampValue}`);
        console.log(`   - Hit count: ${data.fields.hit_count?.integerValue}`);

        // Parse and show results
        const results = JSON.parse(data.fields.results?.stringValue || '[]');
        console.log(`   - Results count: ${results.length}`);
        if (results.length > 0) {
          console.log(`   - Sample result: ${JSON.stringify(results[0], null, 2)}`);
        }
      } else if (response.status === 404) {
        console.log(`❌ Cache key not found (expected for new cache)`);
      } else {
        const errorText = await response.text();
        console.log(`❌ Error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.log(`❌ Exception: ${error.message}`);
    }
  }

  // Also check all documents in shipping_cache collection
  console.log(`\n🗂️  Listing all documents in shipping_cache collection...`);
  try {
    const listUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/shipping_cache?key=${FIREBASE_API_KEY}`;
    const response = await fetch(listUrl);

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Found ${data.documents?.length || 0} cached documents:`);

      if (data.documents && data.documents.length > 0) {
        data.documents.forEach(doc => {
          const name = doc.name;
          const cacheKey = name.split('/').pop();
          console.log(`   - ${cacheKey}`);
          console.log(`     Origin: ${doc.fields.origin?.stringValue}`);
          console.log(`     Results: ${JSON.parse(doc.fields.results?.stringValue || '[]').length} items`);
        });
      }
    } else {
      console.log(`❌ Failed to list documents: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Exception listing documents: ${error.message}`);
  }

  console.log('\n🎯 Debug Summary:');
  console.log('========================================');
  console.log('If cache keys exist but results are empty, the issue might be:');
  console.log('1. API call succeeded but returned empty results');
  console.log('2. Data serialization/deserialization issue');
  console.log('3. Cache write succeeded but data corrupted');
};

// Make function available globally
window.debugCacheData = debugCacheData;

// Auto-run if needed
// debugCacheData().catch(console.error);

console.log('🚀 Cache Data Debug loaded. Run debugCacheData() in console to debug.');