// Test the new 1.25kg threshold weight system
const testNewWeightSystem = async () => {
  const API_URL = 'https://azzahra-fashion-muslim.vercel.app/api/rajaongkir/cost-cached';

  console.log('⚖️  TESTING NEW WEIGHT SYSTEM (1.25kg Threshold)');
  console.log('==================================================');
  console.log('Rules: 0-1250g = 1kg, 1251-2250g = 2kg, 2251-3250g = 3kg, etc.');
  console.log('');

  const weightScenarios = [
    { weight: 500, expectedKg: 1, desc: "500g = 1kg (minimum)" },
    { weight: 1000, expectedKg: 1, desc: "1000g = 1kg" },
    { weight: 1200, expectedKg: 1, desc: "1200g = 1kg (under 1250g)" },
    { weight: 1250, expectedKg: 1, desc: "1250g = 1kg (exact threshold)" },
    { weight: 1300, expectedKg: 2, desc: "1300g = 2kg (above 1250g)" },
    { weight: 1500, expectedKg: 2, desc: "1500g = 2kg" },
    { weight: 2000, expectedKg: 2, desc: "2000g = 2kg" },
    { weight: 2200, expectedKg: 2, desc: "2200g = 2kg (under 2250g)" },
    { weight: 2250, expectedKg: 2, desc: "2250g = 2kg (exact threshold)" },
    { weight: 2300, expectedKg: 3, desc: "2300g = 3kg (above 2250g)" },
    { weight: 3000, expectedKg: 3, desc: "3000g = 3kg" },
    { weight: 3250, expectedKg: 3, desc: "3250g = 3kg (exact threshold)" },
    { weight: 3300, expectedKg: 4, desc: "3300g = 4kg (above 3250g)" }
  ];

  const origin = "607"; // Banjarmasin
  const destination = "114"; // Jakarta
  const courier = "jne";

  for (let i = 0; i < weightScenarios.length; i++) {
    const scenario = weightScenarios[i];
    console.log(`\n📦 Test ${i + 1}: ${scenario.desc}`);
    console.log(`Expected: ${scenario.expectedKg}kg = Rp ${scenario.expectedKg * 20000}`);

    const payload = {
      origin: origin,
      destination: destination,
      weight: scenario.weight,
      courier: courier,
      price: "lowest"
    };

    const startTime = Date.now();
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      const endTime = Date.now();

      console.log(`⏱️  Response Time: ${endTime - startTime}ms`);
      console.log(`📊 Cached: ${data.meta?.cached || false}`);

      // Check weight info in response
      if (data.meta?.weightInfo) {
        const weightInfo = data.meta.weightInfo;
        console.log(`⚖️  Weight Info:`);
        console.log(`   - Actual: ${weightInfo.actualWeight}g (${weightInfo.actualWeightKg}kg)`);
        console.log(`   - Billable: ${weightInfo.billableWeight}g (${weightInfo.chargedKg}kg)`);
        console.log(`   - Explanation: ${weightInfo.explanation}`);
      }

      if (data.data && data.data.length > 0) {
        const cost = data.data[0].cost;
        const service = data.data[0].service;
        const expectedCost = scenario.expectedKg * 20000; // Assuming Rp 20,000/kg

        console.log(`💰 Cost: Rp ${cost.toLocaleString()}`);
        console.log(`🚚 Service: ${service}`);
        console.log(`📊 Expected: Rp ${expectedCost.toLocaleString()}`);

        // Validate
        if (cost === expectedCost) {
          console.log('✅ CORRECT: Price matches expected calculation');
        } else {
          console.log('❌ ERROR: Price mismatch!');
          const difference = cost - expectedCost;
          console.log(`   Difference: Rp ${difference.toLocaleString()}`);
        }

        // Calculate cache key
        const expectedCacheKey = `${origin}_${destination}_${scenario.expectedKg * 1000}_${courier}`;
        console.log(`🔑 Expected Cache Key: ${expectedCacheKey}`);

      } else {
        console.log('❌ No shipping data available');
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }

    // Small delay between tests
    if (i < weightScenarios.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n🎯 WEIGHT SYSTEM VALIDATION:');
  console.log('=============================');
  console.log('✅ EXPECTED BEHAVIOR:');
  console.log('- 500g-1250g = 1kg (Rp 20,000)');
  console.log('- 1251g-2250g = 2kg (Rp 40,000)');
  console.log('- 2251g-3250g = 3kg (Rp 60,000)');
  console.log('- etc...');
  console.log('');
  console.log('📊 CACHE BEHAVIOR:');
  console.log('- Same billable weight = same cache key');
  console.log('- Different billable weight = different cache key');
  console.log('- No more price inconsistencies!');
};

// Test cache behavior with the new system
const testNewCacheBehavior = async () => {
  console.log('\n🔄 CACHE BEHAVIOR TEST WITH NEW WEIGHT SYSTEM');
  console.log('===============================================');

  // Test 1200g (should be 1kg)
  console.log('\n📦 Test 1: 1200g (should use 1kg cache)');
  const test1 = await callAPI(1200);

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 1300g (should be 2kg)
  console.log('\n📦 Test 2: 1300g (should use 2kg cache)');
  const test2 = await callAPI(1300);

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 1000g (should be 1kg and hit cache from Test 1)
  console.log('\n📦 Test 3: 1000g (should hit 1kg cache from Test 1)');
  const test3 = await callAPI(1000);

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2250g (should be 2kg and hit cache from Test 2)
  console.log('\n📦 Test 4: 2250g (should hit 2kg cache from Test 2)');
  const test4 = await callAPI(2250);

  console.log('\n📊 CACHE ANALYSIS:');
  console.log('==================');
  console.log(`Test 1 (1200g): ${test1.cached ? 'Cache hit' : 'Cache miss'} - Rp ${test1.cost}`);
  console.log(`Test 2 (1300g): ${test2.cached ? 'Cache hit' : 'Cache miss'} - Rp ${test2.cost}`);
  console.log(`Test 3 (1000g): ${test3.cached ? 'Cache hit' : 'Cache miss'} - Rp ${test3.cost} (should match Test 1)`);
  console.log(`Test 4 (2250g): ${test4.cached ? 'Cache hit' : 'Cache miss'} - Rp ${test4.cost} (should match Test 2)`);

  // Validate cache behavior
  if (!test1.cached && test3.cached && test1.cost === test3.cost) {
    console.log('✅ CORRECT: 1000g hit cache from 1200g (same 1kg billing)');
  } else {
    console.log('❌ ERROR: Cache behavior incorrect for 1kg weights');
  }

  if (!test2.cached && test4.cached && test2.cost === test4.cost) {
    console.log('✅ CORRECT: 2250g hit cache from 1300g (same 2kg billing)');
  } else {
    console.log('❌ ERROR: Cache behavior incorrect for 2kg weights');
  }
};

async function callAPI(weight) {
  const API_URL = 'https://azzahra-fashion-muslim.vercel.app/api/rajaongkir/cost-cached';

  const payload = {
    origin: "607",
    destination: "114",
    weight: weight,
    courier: "jne",
    price: "lowest"
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    return {
      cached: data.meta?.cached || false,
      cost: data.data?.[0]?.cost || 0,
      weightInfo: data.meta?.weightInfo
    };
  } catch (error) {
    console.log('❌ Error:', error.message);
    return { cached: false, cost: 0 };
  }
}

// Run tests
testNewWeightSystem().then(() => {
  return testNewCacheBehavior();
}).then(() => {
  console.log('\n✅ New Weight System Test Completed!');
  console.log('📝 The system should now handle weight rounding correctly!');
}).catch(console.error);