export default async function handler(req, res) {
  try {
    console.log('🧪 Testing REAL RajaOngkir API connection...');

    const RAJAONGKIR_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
    const RAJAONGKIR_BASE_URL = 'https://api.rajaongkir.com/starter';

    // Test 1: Check if we can reach RajaOngkir servers
    console.log('Test 1: Ping RajaOngkir servers');
    try {
      const pingResponse = await fetch(`${RAJAONGKIR_BASE_URL}/province?key=${RAJAONGKIR_API_KEY}`, {
        method: 'GET'
      });

      console.log('Ping status:', pingResponse.status);

      if (pingResponse.ok) {
        const provincesData = await pingResponse.json();
        console.log('✅ Provinces API works! Found', provincesData.rajaongkir?.results?.length, 'provinces');

        if (provincesData.rajaongkir?.results?.length > 0) {
          console.log('✅ First province:', provincesData.rajaongkir.results[0]);
        }
      } else {
        console.log('❌ Ping failed, status:', pingResponse.status);
        const errorText = await pingResponse.text();
        console.log('Error response:', errorText);
      }
    } catch (error) {
      console.log('❌ Network error:', error.message);
    }

    // Test 2: Test cost calculation with real API
    console.log('\nTest 2: Test real cost calculation');
    try {
      const formData = new URLSearchParams();
      formData.append('key', RAJAONGKIR_API_KEY);
      formData.append('origin', '607'); // Banjarmasin
      formData.append('destination', '177'); // Surabaya
      formData.append('weight', '1000'); // 1kg
      formData.append('courier', 'jne'); // JNE

      console.log('Request data:', {
        origin: '607',
        destination: '177',
        weight: '1000g',
        courier: 'jne'
      });

      const costResponse = await fetch(`${RAJAONGKIR_BASE_URL}/cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });

      console.log('Cost status:', costResponse.status);

      if (costResponse.ok) {
        const costData = await costResponse.json();
        console.log('✅ Cost API works!');
        console.log('Response:', JSON.stringify(costData, null, 2));

        if (costData.rajaongkir?.results?.length > 0) {
          console.log('✅ Real shipping costs found:');
          costData.rajaongkir.results.forEach((result, index) => {
            console.log(`  ${index + 1}. ${result.name}:`);
            result.costs.forEach((cost, costIndex) => {
              console.log(`     ${costIndex + 1}. ${cost.description}: Rp ${cost.cost[0]?.value || 0}`);
            });
          });
        } else {
          console.log('❌ No results from cost API');
        }
      } else {
        console.log('❌ Cost API failed, status:', costResponse.status);
        const errorText = await costResponse.text();
        console.log('Error response:', errorText);
      }
    } catch (error) {
      console.log('❌ Cost calculation error:', error.message);
    }

    // Test 3: API Key validation
    console.log('\nTest 3: API Key validation');
    console.log('API Key:', RAJAONGKIR_API_KEY ? `${RAJAONGKIR_API_KEY.substring(0, 8)}...` : 'Missing');
    console.log('API Key length:', RAJAONGKIR_API_KEY.length);

    // Get actual test results to return
    let provincesTest = { status: 'failed', count: 0, sample: [] };
    let costTest = { status: 'failed', results: [] };

    try {
      const provincesResponse = await fetch(`${RAJAONGKIR_BASE_URL}/province?key=${RAJAONGKIR_API_KEY}`);
      if (provincesResponse.ok) {
        const provincesData = await provincesResponse.json();
        const provinces = provincesData.rajaongkir?.results || [];
        provincesTest = {
          status: provinces.length > 0 ? 'success' : 'failed',
          count: provinces.length,
          sample: provinces.slice(0, 3)
        };
      }
    } catch (e) {
      console.log('Provinces test error:', e.message);
    }

    try {
      const formData = new URLSearchParams();
      formData.append('key', RAJAONGKIR_API_KEY);
      formData.append('origin', '607');
      formData.append('destination', '177');
      formData.append('weight', '1000');
      formData.append('courier', 'jne');

      const costResponse = await fetch(`${RAJAONGKIR_BASE_URL}/cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      if (costResponse.ok) {
        const costData = await costResponse.json();
        costTest = {
          status: 'success',
          results: costData.rajaongkir?.results || []
        };
      }
    } catch (e) {
      console.log('Cost test error:', e.message);
    }

    res.status(200).json({
      success: true,
      message: 'RajaOngkir API connection test completed',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      apiKeyConfigured: !!RAJAONGKIR_API_KEY,
      apiKeyLength: RAJAONGKIR_API_KEY ? RAJAONGKIR_API_KEY.length : 0,
      testResults: {
        provincesTest,
        costTest
      },
      conclusion: {
        usingRealAPI: provincesTest.count > 10 && costTest.status === 'success',
        recommendation: provincesTest.count > 10 ? 'API connected to real RajaOngkir servers' : 'Still using mock data',
        hasRealPricing: costTest.results.some(result =>
          result.costs && result.costs[0] && result.costs[0].cost[0] &&
          result.costs[0].cost[0].value > 20000 && result.costs[0].cost[0].value < 200000
        )
      }
    });

  } catch (error) {
    console.error('💥 Test endpoint error:', error);
    res.status(500).json({
      error: 'Test endpoint failed',
      details: error.message
    });
  }
}