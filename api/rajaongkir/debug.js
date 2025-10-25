export default async function handler(req, res) {
  try {
    console.log('🧪 DEBUG: Testing Komerce API directly');

    const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
    const KOMERCE_BASE_URL = 'https://api-sandbox.collaborator.komerce.id';

    // Test 1: Simple API health check
    console.log('Test 1: Health check');
    try {
      const healthResponse = await fetch(`${KOMERCE_BASE_URL}/`, {
        headers: {
          'x-api-key': KOMERCE_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      console.log('Health check status:', healthResponse.status);
      const healthData = await healthResponse.text();
      console.log('Health check response:', healthData);
    } catch (error) {
      console.log('Health check error:', error.message);
    }

    // Test 2: Search destination (to get valid IDs)
    console.log('\nTest 2: Search destination');
    try {
      const searchResponse = await fetch(`${KOMERCE_BASE_URL}/tariff/api/v1/destination/?search=banjarmasin`, {
        headers: {
          'x-api-key': KOMERCE_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      console.log('Search status:', searchResponse.status);
      const searchData = await searchResponse.text();
      console.log('Search response:', searchData);
    } catch (error) {
      console.log('Search error:', error.message);
    }

    // Test 3: Calculate with minimal parameters
    console.log('\nTest 3: Calculate shipping');
    try {
      const testUrl = `${KOMERCE_BASE_URL}/tariff/api/v1/calculate?shipper_destination_id=607&receiver_destination_id=177&weight=1&item_value=100000&cod=no&origin_pin_point=-3.3186111,114.5908333&destination_pin_point=-6.2087634,106.845599`;

      console.log('Testing URL:', testUrl);

      const calcResponse = await fetch(testUrl, {
        headers: {
          'x-api-key': KOMERCE_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      console.log('Calculate status:', calcResponse.status);
      console.log('Calculate headers:', Object.fromEntries(calcResponse.headers.entries()));

      const calcData = await calcResponse.text();
      console.log('Calculate response:', calcData);
    } catch (error) {
      console.log('Calculate error:', error.message);
      console.log('Calculate stack:', error.stack);
    }

    // Test 4: Check if API key is valid
    console.log('\nTest 4: API key validation');
    console.log('API Key exists:', !!KOMERCE_API_KEY);
    console.log('API Key length:', KOMERCE_API_KEY.length);
    console.log('API Key starts with:', KOMERCE_API_KEY.substring(0, 10));

    res.status(200).json({
      message: 'Debug completed - check Vercel logs for details',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Debug endpoint error:', error);
    res.status(500).json({
      error: 'Debug endpoint failed',
      details: error.message,
      stack: error.stack
    });
  }
}