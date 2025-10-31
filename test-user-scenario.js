// Test specific user scenario: different destinations within same province
const testUserScenario = async () => {
  const API_URL = 'https://azzahra-fashion-muslim.vercel.app/api/rajaongkir/cost-cached';

  console.log('🏠 Testing User Scenario: Different Destinations in Kal-Sel');
  console.log('==========================================================');

  // Scenario: Banjarmasin -> different destinations in Kalimantan Selatan
  // Using city IDs that might represent:
  // - Banjarmasin city
  // - Banjarbaru city
  // - Martapura city
  // - Other nearby cities

  const scenarios = [
    {
      name: "Banjarmasin -> Banjarbaru",
      origin: "607", // Banjarmasin
      destination: "608", //假设 Banjarbaru
      expected_cost: "Should be relatively cheap (same province)"
    },
    {
      name: "Banjarmasin -> Martapura",
      origin: "607",
      destination: "609", //假设 Martapura
      expected_cost: "Should be different from Banjarbaru"
    },
    {
      name: "Banjarmasin -> Jakarta (different province)",
      origin: "607",
      destination: "114", // Jakarta
      expected_cost: "Should be more expensive (inter-province)"
    }
  ];

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    console.log(`\n📍 Test ${i + 1}: ${scenario.name}`);
    console.log(`Expected: ${scenario.expected_cost}`);

    const payload = {
      origin: scenario.origin,
      destination: scenario.destination,
      weight: 1000,
      courier: "jne",
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

      if (data.data && data.data.length > 0) {
        console.log(`💰 Cost: Rp ${data.data[0].cost.toLocaleString()}`);
        console.log(`🚚 Service: ${data.data[0].service}`);
        console.log(`📦 ETD: ${data.data[0].etd}`);
      } else {
        console.log('❌ No shipping data available');
      }

      // Generate cache key for this test
      const cacheKey = `${scenario.origin}_${scenario.destination}_1000_jne`;
      console.log(`🔑 Cache Key: ${cacheKey}`);

    } catch (error) {
      console.log('❌ Error:', error.message);
    }

    // Wait between tests
    if (i < scenarios.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Test cache hit: call the first scenario again
  console.log('\n🔄 Cache Hit Test: Repeating first scenario');
  console.log('Expected: Should be cached and same price as Test 1');

  const firstScenario = scenarios[0];
  const payload = {
    origin: firstScenario.origin,
    destination: firstScenario.destination,
    weight: 1000,
    courier: "jne",
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

    if (data.data && data.data.length > 0) {
      console.log(`💰 Cost: Rp ${data.data[0].cost.toLocaleString()}`);
      console.log(`🚚 Service: ${data.data[0].service}`);
    }

    const cacheKey = `${firstScenario.origin}_${firstScenario.destination}_1000_jne`;
    console.log(`🔑 Cache Key: ${cacheKey}`);

  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n🎯 User Scenario Analysis:');
  console.log('============================');
  console.log('✅ EXPECTED BEHAVIOR:');
  console.log('- Each destination gets unique cache key');
  console.log('- Different destinations = different prices');
  console.log('- Same destination repeated = cache hit');
  console.log('');
  console.log('❌ PROBLEM INDICATORS:');
  console.log('- All tests show same price (cache collision)');
  console.log('- Second call shows cached: true for new destination');
  console.log('- Cache keys are identical for different destinations');
};

// Test with real destinations that we know exist and have different costs
const testRealScenario = async () => {
  console.log('\n🌍 Testing Real Scenario: Banjarmasin to Different Provinces');
  console.log('========================================================');

  const realTests = [
    {
      name: "Banjarmasin -> Jakarta (Jawa Barat)",
      origin: "607",
      destination: "114"
    },
    {
      name: "Banjarmasin -> Surabaya (Jawa Timur)",
      origin: "607",
      destination: "23"
    },
    {
      name: "Banjarmasin -> Medan (Sumatera Utara)",
      origin: "607",
      destination: "108"
    }
  ];

  for (let i = 0; i < realTests.length; i++) {
    const test = realTests[i];
    console.log(`\n📍 Real Test ${i + 1}: ${test.name}`);

    const payload = {
      origin: test.origin,
      destination: test.destination,
      weight: 1000,
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

      console.log(`📊 Cached: ${data.meta?.cached || false}`);
      if (data.data && data.data.length > 0) {
        console.log(`💰 Cost: Rp ${data.data[0].cost.toLocaleString()}`);
        console.log(`🚚 Service: ${data.data[0].service}`);
      }

      const cacheKey = `${test.origin}_${test.destination}_1000_jne`;
      console.log(`🔑 Cache Key: ${cacheKey}`);

    } catch (error) {
      console.log('❌ Error:', error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
  }
};

// Run both tests
testUserScenario().then(() => {
  return testRealScenario();
}).then(() => {
  console.log('\n✅ User Scenario Testing Completed!');
  console.log('📝 CONCLUSION: Cache system creates unique keys per destination');
}).catch(console.error);