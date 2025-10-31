// CRITICAL TEST: Check if cache system handles weight correctly
// This could cause revenue loss if prices are wrong!

const testWeightCaching = async () => {
  const API_URL = 'https://azzahra-fashion-muslim.vercel.app/api/rajaongkir/cost-cached';

  console.log('⚖️  CRITICAL TEST: Weight-Based Caching Analysis');
  console.log('===============================================');
  console.log('🚨 THIS COULD CAUSE REVENUE LOSS IF WRONG!');
  console.log('');

  // Test same destination with different weights
  const origin = "607"; // Banjarmasin
  const destination = "114"; // Jakarta
  const courier = "jne";

  const weightTests = [
    { weight: 1000, desc: "1 kg (base test)" },
    { weight: 2000, desc: "2 kg (should be ~2x price)" },
    { weight: 3000, desc: "3 kg (should be ~3x price)" },
    { weight: 500,  desc: "0.5 kg (should be ~0.5x price)" }
  ];

  const results = [];

  for (let i = 0; i < weightTests.length; i++) {
    const test = weightTests[i];
    console.log(`\n📦 Test ${i + 1}: ${test.desc}`);
    console.log(`Expected: ${(test.weight / 1000) * 20000} (if base price is 20,000/kg)`);

    const payload = {
      origin: origin,
      destination: destination,
      weight: test.weight,
      courier: courier,
      price: "lowest"
    };

    const cacheKey = `${origin}_${destination}_${test.weight}_${courier}`;
    console.log(`🔑 Cache Key: ${cacheKey}`);

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
        const cost = data.data[0].cost;
        const service = data.data[0].service;
        const etd = data.data[0].etd;

        console.log(`💰 Cost: Rp ${cost.toLocaleString()}`);
        console.log(`🚚 Service: ${service}`);
        console.log(`📦 ETD: ${etd}`);

        // Calculate price per kg
        const pricePerKg = cost / (test.weight / 1000);
        console.log(`📊 Price per kg: Rp ${pricePerKg.toLocaleString()}`);

        results.push({
          weight: test.weight,
          cost: cost,
          pricePerKg: pricePerKg,
          service: service,
          cached: data.meta?.cached || false,
          cacheKey: cacheKey
        });
      } else {
        console.log('❌ No shipping data available');
        results.push({
          weight: test.weight,
          cost: null,
          cached: data.meta?.cached || false,
          cacheKey: cacheKey
        });
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }

    // Wait between tests
    if (i < weightTests.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n📊 WEIGHT ANALYSIS RESULTS:');
  console.log('============================');

  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.weight}g:`);
    console.log(`   Cost: Rp ${result.cost?.toLocaleString() || 'N/A'}`);
    console.log(`   Price/kg: Rp ${result.pricePerKg?.toLocaleString() || 'N/A'}`);
    console.log(`   Cached: ${result.cached}`);
    console.log(`   Cache Key: ${result.cacheKey}`);
  });

  console.log('\n🚨 REVENUE RISK ANALYSIS:');
  console.log('========================');

  // Check if price per kg is consistent
  const validResults = results.filter(r => r.cost !== null);
  if (validResults.length > 1) {
    const basePricePerKg = validResults[0].pricePerKg;
    let priceConsistency = true;
    let issues = [];

    validResults.forEach((result, index) => {
      const difference = Math.abs(result.pricePerKg - basePricePerKg);
      const percentDiff = (difference / basePricePerKg) * 100;

      if (percentDiff > 5) { // Allow 5% variance
        priceConsistency = false;
        issues.push(`${result.weight}g: ${percentDiff.toFixed(1)}% difference`);
      }
    });

    if (priceConsistency) {
      console.log('✅ GOOD: Price per kg is consistent across weights');
      console.log(`   Base price: Rp ${basePricePerKg.toLocaleString()}/kg`);
    } else {
      console.log('❌ DANGER: Price inconsistency detected!');
      console.log('   Issues:');
      issues.forEach(issue => console.log(`   - ${issue}`));
      console.log('   This could cause revenue loss or overcharging!');
    }
  }

  // Check cache behavior
  const cacheHits = results.filter(r => r.cached).length;
  console.log(`\n📊 Cache Performance: ${cacheHits}/${results.length} cache hits`);

  if (cacheHits > 0) {
    console.log('✅ Cache is working for weight-based queries');
  } else {
    console.log('ℹ️  All calls were cache misses (expected for different weights)');
  }

  return results;
};

// Test the same weight multiple times to see if cache works
const testWeightCacheHit = async () => {
  console.log('\n🔄 CACHE HIT TEST: Same Weight, Same Destination');
  console.log('==================================================');

  const payload = {
    origin: "607",
    destination: "114",
    weight: 1500, // 1.5kg
    courier: "jne",
    price: "lowest"
  };

  console.log('\n📦 First Call (should be cache miss):');
  const startTime1 = Date.now();
  try {
    const response1 = await fetch('https://azzahra-fashion-muslim.vercel.app/api/rajaongkir/cost-cached', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data1 = await response1.json();
    const endTime1 = Date.now();

    console.log(`⏱️  Time: ${endTime1 - startTime1}ms`);
    console.log(`📊 Cached: ${data1.meta?.cached || false}`);
    console.log(`💰 Cost: Rp ${data1.data?.[0]?.cost?.toLocaleString() || 'N/A'}`);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n📦 Second Call (should be cache hit):');
  const startTime2 = Date.now();
  try {
    const response2 = await fetch('https://azzahra-fashion-muslim.vercel.app/api/rajaongkir/cost-cached', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data2 = await response2.json();
    const endTime2 = Date.now();

    console.log(`⏱️  Time: ${endTime2 - startTime2}ms`);
    console.log(`📊 Cached: ${data2.meta?.cached || false}`);
    console.log(`💰 Cost: Rp ${data2.data?.[0]?.cost?.toLocaleString() || 'N/A'}`);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
};

// Run all tests
testWeightCaching().then(() => {
  return testWeightCacheHit();
}).then(() => {
  console.log('\n✅ Weight Caching Analysis Completed!');
  console.log('📝 Check results above for potential revenue risks!');
}).catch(console.error);