// Test cache system with different destinations to detect key collision
const testDifferentDestinations = async () => {
  const API_URL = 'https://azzahra-fashion-muslim.vercel.app/api/rajaongkir/cost-cached';

  console.log('🧪 Testing Cache with Different Destinations...');
  console.log('==================================================');

  // Test 1: Banjarmasin -> Cililin (should be ~28,000)
  console.log('\n📍 Test 1: Banjarmasin (607) -> Cililin (?)');
  const test1 = {
    origin: "607",
    destination: "???", // Cililin city ID - need to find
    weight: 1000,
    courier: "jne",
    price: "lowest"
  };

  // Test 2: Banjarmasin -> Landasan Ulin (should be different price)
  console.log('\n📍 Test 2: Banjarmasin (607) -> Landasan Ulin (?)');
  const test2 = {
    origin: "607",
    destination: "???", // Landasan Ulin city ID - need to find
    weight: 1000,
    courier: "jne",
    price: "lowest"
  };

  // Since we don't know exact city IDs, let's test with known different destinations
  // Jakarta (114) and Surabaya (23) should have different prices

  const realTest1 = {
    origin: "607", // Banjarmasin
    destination: "114", // Jakarta
    weight: 1000,
    courier: "jne",
    price: "lowest"
  };

  const realTest2 = {
    origin: "607", // Banjarmasin
    destination: "23", // Surabaya
    weight: 1000,
    courier: "jne",
    price: "lowest"
  };

  console.log('\n🚚 Real Test 1: Banjarmasin -> Jakarta');
  console.log('Expected: ~20,000 (JNE REG)');

  const startTime1 = Date.now();
  try {
    const response1 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(realTest1)
    });
    const data1 = await response1.json();
    const endTime1 = Date.now();

    console.log(`⏱️  Response Time: ${endTime1 - startTime1}ms`);
    console.log(`📊 Cached: ${data1.meta?.cached || false}`);
    console.log(`💰 Cost: ${data1.data?.[0]?.cost || 'N/A'}`);
    console.log(`🚚 Service: ${data1.data?.[0]?.service || 'N/A'}`);

    if (data1.data && data1.data.length > 0) {
      console.log(`📋 Full Result: ${JSON.stringify(data1.data[0], null, 2)}`);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n🚚 Real Test 2: Banjarmasin -> Surabaya');
  console.log('Expected: Different price than Jakarta (should be ~25,000-35,000)');

  const startTime2 = Date.now();
  try {
    const response2 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(realTest2)
    });
    const data2 = await response2.json();
    const endTime2 = Date.now();

    console.log(`⏱️  Response Time: ${endTime2 - startTime2}ms`);
    console.log(`📊 Cached: ${data2.meta?.cached || false}`);
    console.log(`💰 Cost: ${data2.data?.[0]?.cost || 'N/A'}`);
    console.log(`🚚 Service: ${data2.data?.[0]?.service || 'N/A'}`);

    if (data2.data && data2.data.length > 0) {
      console.log(`📋 Full Result: ${JSON.stringify(data2.data[0], null, 2)}`);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 3: Call Jakarta again to see if cache works
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n🚚 Test 3: Banjarmasin -> Jakarta (Second Call)');
  console.log('Expected: Should be cached and same price as Test 1');

  const startTime3 = Date.now();
  try {
    const response3 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(realTest1)
    });
    const data3 = await response3.json();
    const endTime3 = Date.now();

    console.log(`⏱️  Response Time: ${endTime3 - startTime3}ms`);
    console.log(`📊 Cached: ${data3.meta?.cached || false}`);
    console.log(`💰 Cost: ${data3.data?.[0]?.cost || 'N/A'}`);
    console.log(`🚚 Service: ${data3.data?.[0]?.service || 'N/A'}`);

    if (data3.data && data3.data.length > 0) {
      console.log(`📋 Full Result: ${JSON.stringify(data3.data[0], null, 2)}`);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n🎯 Analysis:');
  console.log('=============');
  console.log('If caching is working correctly:');
  console.log('- Test 1 (Jakarta): First call = cache miss, real API');
  console.log('- Test 2 (Surabaya): First call = cache miss, real API, DIFFERENT PRICE');
  console.log('- Test 3 (Jakarta): Second call = cache hit, SAME PRICE as Test 1');
  console.log('');
  console.log('❌ PROBLEM SIGNS:');
  console.log('- Test 2 shows same price as Test 1 (wrong destination cache)');
  console.log('- Test 2 shows cached: true on first call (wrong cache hit)');
  console.log('- Prices are identical for different destinations');
};

// Also check what cache keys are being generated
const checkCacheKeys = async () => {
  const FIREBASE_PROJECT_ID = 'azzahra-fashion-muslim-ab416';
  const FIREBASE_API_KEY = 'AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs';

  console.log('\n🔍 Checking Generated Cache Keys...');
  console.log('===================================');

  // Expected cache keys for our tests
  const expectedKeys = [
    '607_114_1000_jne', // Banjarmasin -> Jakarta
    '607_23_1000_jne',  // Banjarmasin -> Surabaya
  ];

  for (const key of expectedKeys) {
    console.log(`\n📦 Checking cache key: ${key}`);
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/shipping_cache/${key}?key=${FIREBASE_API_KEY}`;

    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const results = JSON.parse(data.fields.results?.stringValue || '[]');
        console.log(`✅ Found: ${results.length} results`);
        if (results.length > 0) {
          console.log(`   💰 Cost: ${results[0].cost}`);
          console.log(`   🚚 Service: ${results[0].service}`);
        }
      } else if (response.status === 404) {
        console.log(`❌ Not found (expected for new queries)`);
      } else {
        console.log(`❌ Error: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Exception: ${error.message}`);
    }
  }
};

// Run tests
testDifferentDestinations().then(() => {
  return checkCacheKeys();
}).then(() => {
  console.log('\n✅ Destination Cache Test Completed!');
}).catch(console.error);