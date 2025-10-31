// Test Cache Performance for Ongkir System
// This script will test the caching system by making multiple API calls

const testOngkirCache = async () => {
  const API_URL = 'https://azzahra-fashion-muslim.vercel.app/api/rajaongkir/cost-cached';
  const testPayload = {
    origin: "607", // Banjarmasin
    destination: "114", // Jakarta
    weight: 1000, // 1kg
    courier: "all",
    getAllCouriers: true,
    price: "lowest"
  };

  console.log('🚀 Testing Ongkir Cache Performance...');
  console.log('========================================');

  // Test 1: First call (should be cache miss)
  console.log('\n📦 Test 1: First API Call (Cache Miss Expected)');
  const startTime1 = Date.now();
  try {
    const response1 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });
    const data1 = await response1.json();
    const endTime1 = Date.now();

    console.log(`⏱️  Response Time: ${endTime1 - startTime1}ms`);
    console.log(`📊 Cached: ${data1.meta?.cached || false}`);
    console.log(`📋 Results Count: ${data1.data?.length || 0}`);
    console.log(`💰 Sample Price: ${data1.data?.[0]?.cost || 'N/A'}`);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Second call (should be cache hit)
  console.log('\n📦 Test 2: Second API Call (Cache Hit Expected)');
  const startTime2 = Date.now();
  try {
    const response2 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });
    const data2 = await response2.json();
    const endTime2 = Date.now();

    console.log(`⏱️  Response Time: ${endTime2 - startTime2}ms`);
    console.log(`📊 Cached: ${data2.meta?.cached || false}`);
    console.log(`📋 Results Count: ${data2.data?.length || 0}`);
    console.log(`💰 Sample Price: ${data2.data?.[0]?.cost || 'N/A'}`);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Third call (should definitely be cache hit)
  console.log('\n📦 Test 3: Third API Call (Cache Hit Expected)');
  const startTime3 = Date.now();
  try {
    const response3 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });
    const data3 = await response3.json();
    const endTime3 = Date.now();

    console.log(`⏱️  Response Time: ${endTime3 - startTime3}ms`);
    console.log(`📊 Cached: ${data3.meta?.cached || false}`);
    console.log(`📋 Results Count: ${data3.data?.length || 0}`);
    console.log(`💰 Sample Price: ${data3.data?.[0]?.cost || 'N/A'}`);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n🎯 Performance Analysis:');
  console.log('========================================');
  console.log('📈 If caching is working:');
  console.log('   - First call: ~2000-5000ms (API + Cache save)');
  console.log('   - Second call: ~200-800ms (Cache hit)');
  console.log('   - Third call: ~200-800ms (Cache hit)');
  console.log('');
  console.log('💡 Cost Savings:');
  console.log('   - Each cache hit saves 1 API call to RajaOngkir');
  console.log('   - Reduces monthly API consumption significantly');
  console.log('   - Improves user experience with faster load times');
};

// Test single courier cache
const testSingleCourierCache = async () => {
  const API_URL = 'https://azzahra-fashion-muslim.vercel.app/api/rajaongkir/cost-cached';
  const testPayload = {
    origin: "607",
    destination: "114",
    weight: 500,
    courier: "jne",
    price: "lowest"
  };

  console.log('\n🚚 Testing Single Courier Cache...');
  console.log('========================================');

  // Test JNE courier
  console.log('\n📦 Testing JNE Courier Cache...');
  const startTime = Date.now();
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });
    const data = await response.json();
    const endTime = Date.now();

    console.log(`⏱️  Response Time: ${endTime - startTime}ms`);
    console.log(`📊 Cached: ${data.meta?.cached || false}`);
    console.log(`📋 Results Count: ${data.data?.length || 0}`);
    if (data.data && data.data.length > 0) {
      console.log(`🚚 Courier: ${data.data[0].name}`);
      console.log(`💰 Cost: ${data.data[0].cost}`);
      console.log(`📦 Service: ${data.data[0].service}`);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
};

// Run tests
testOngkirCache().then(() => {
  return testSingleCourierCache();
}).then(() => {
  console.log('\n✅ Cache Performance Test Completed!');
}).catch(console.error);