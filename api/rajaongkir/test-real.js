// Test RajaOngkir API Integration
// This endpoint tests real RajaOngkir API connectivity and returns detailed results

const RAJAONGKIR_API_KEY = process.env.RAJAONGKIR_API_KEY;
const RAJAONGKIR_BASE_URL = 'https://api.rajaongkir.com/starter';

export default async function handler(req, res) {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const logs = [];

  try {
    logs.push('🧪 Starting RajaOngkir API test...');
    logs.push(`🔑 API Key: ${RAJAONGKIR_API_KEY ? `${RAJAONGKIR_API_KEY.substring(0, 10)}...` : 'NOT SET'}`);
    logs.push(`🌐 Base URL: ${RAJAONGKIR_BASE_URL}`);

    if (!RAJAONGKIR_API_KEY) {
      logs.push('❌ RAJAONGKIR_API_KEY not found in environment');
      return res.status(500).json({
        success: false,
        message: 'RAJAONGKIR_API_KEY not configured',
        logs
      });
    }

    // Test 1: Get provinces
    logs.push('📡 Testing provinces endpoint...');
    let provincesData = null;
    try {
      const provincesResponse = await fetch(`${RAJAONGKIR_BASE_URL}/province`, {
        method: 'GET',
        headers: {
          'key': RAJAONGKIR_API_KEY
        }
      });

      const provincesText = await provincesResponse.text();
      logs.push(`📋 Provinces response status: ${provincesResponse.status}`);
      logs.push(`📄 Provinces response (first 200 chars): ${provincesText.substring(0, 200)}...`);

      if (provincesResponse.ok) {
        const provincesResult = JSON.parse(provincesText);
        if (provincesResult.rajaongkir && provincesResult.rajaongkir.status && provincesResult.rajaongkir.status.code === 200) {
          provincesData = provincesResult.rajaongkir.results;
          logs.push(`✅ Provinces test successful! Found ${provincesData.length} provinces`);
        } else {
          logs.push(`❌ Provinces API error: ${JSON.stringify(provincesResult.rajaongkir?.status || 'Unknown error')}`);
        }
      } else {
        logs.push(`❌ Provinces HTTP error: ${provincesResponse.status} ${provincesResponse.statusText}`);
      }
    } catch (error) {
      logs.push(`❌ Provinces test failed: ${error.message}`);
    }

    // Test 2: Calculate shipping cost (real test)
    logs.push('📦 Testing cost calculation...');
    let costData = null;
    try {
      // Use real RajaOngkir API format - POST with form data
      const formData = new URLSearchParams();
      formData.append('key', RAJAONGKIR_API_KEY);
      formData.append('origin', '607'); // Banjarmasin
      formData.append('destination', '23'); // Jakarta
      formData.append('weight', '1000'); // 1kg
      formData.append('courier', 'jne');

      logs.push('📤 Sending cost request...');
      logs.push(`📋 Parameters: origin=607 (Banjarmasin), destination=23 (Jakarta), weight=1000g, courier=jne`);

      const costResponse = await fetch(`${RAJAONGKIR_BASE_URL}/cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'key': RAJAONGKIR_API_KEY
        },
        body: formData.toString()
      });

      const costText = await costResponse.text();
      logs.push(`📋 Cost response status: ${costResponse.status}`);
      logs.push(`📄 Cost response (first 500 chars): ${costText.substring(0, 500)}...`);

      if (costResponse.ok) {
        const costResult = JSON.parse(costText);
        if (costResult.rajaongkir && costResult.rajaongkir.status && costResult.rajaongkir.status.code === 200) {
          costData = costResult.rajaongkir;
          logs.push(`✅ Cost test successful!`);

          if (costData.results && costData.results.length > 0) {
            const firstResult = costData.results[0];
            logs.push(`📦 Courier: ${firstResult.code || 'unknown'}`);

            if (firstResult.costs && firstResult.costs.length > 0) {
              firstResult.costs.forEach((cost, index) => {
                if (cost.cost && cost.cost.length > 0) {
                  const price = cost.cost[0].value;
                  const etd = cost.cost[0].etd;
                  logs.push(`  ${index + 1}. ${cost.service}: Rp ${price.toLocaleString('id-ID')} (${etd})`);
                }
              });
            }
          }
        } else {
          logs.push(`❌ Cost API error: ${JSON.stringify(costResult.rajaongkir?.status || 'Unknown error')}`);
        }
      } else {
        logs.push(`❌ Cost HTTP error: ${costResponse.status} ${costResponse.statusText}`);
      }
    } catch (error) {
      logs.push(`❌ Cost test failed: ${error.message}`);
    }

    // Return detailed results
    return res.status(200).json({
      success: true,
      message: 'RajaOngkir API connection test completed',
      timestamp: new Date().toISOString(),
      config: {
        apiKey: RAJAONGKIR_API_KEY ? `${RAJAONGKIR_API_KEY.substring(0, 10)}...` : 'not set',
        baseUrl: RAJAONGKIR_BASE_URL
      },
      results: {
        provincesTest: {
          status: provincesData ? 'success' : 'failed',
          data: provincesData ? {
            count: provincesData.length,
            sample: provincesData.slice(0, 3).map(p => ({ id: p.province_id, name: p.province }))
          } : null
        },
        costTest: {
          status: costData ? 'success' : 'failed',
          data: costData ? {
            query: costData.query || {},
            results: costData.results || []
          } : null
        }
      },
      logs: {
        consoleOutput: logs
      }
    });

  } catch (error) {
    logs.push(`💥 Fatal error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message,
      logs
    });
  }
}