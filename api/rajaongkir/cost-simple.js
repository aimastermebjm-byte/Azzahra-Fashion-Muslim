export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    console.log('🧪 SIMPLE COST TEST');
    console.log('Query params:', req.query);
    console.log('Headers:', req.headers);

    const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
    const KOMERCE_BASE_URL = 'https://api-sandbox.collaborator.komerce.id';

    // Hardcode parameters for testing
    const testParams = {
      shipper_destination_id: '607',
      receiver_destination_id: '177',
      weight: '1',
      item_value: '100000',
      cod: 'no',
      origin_pin_point: '-3.3186111,114.5908333',
      destination_pin_point: '-6.2087634,106.845599'
    };

    console.log('Using test params:', testParams);
    console.log('API Key:', KOMERCE_API_KEY ? 'Present' : 'Missing');

    const params = new URLSearchParams(testParams);
    const url = `${KOMERCE_BASE_URL}/tariff/api/v1/calculate?${params.toString()}`;

    console.log('Full URL:', url);

    const response = await fetch(url, {
      headers: {
        'x-api-key': KOMERCE_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Response text:', responseText);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    try {
      const jsonResponse = JSON.parse(responseText);
      console.log('JSON response:', jsonResponse);
      res.status(200).json(jsonResponse);
    } catch (parseError) {
      console.log('Raw response (not JSON):', responseText);
      res.status(200).json({ rawResponse: responseText });
    }

  } catch (error) {
    console.error('💥 Cost Simple Error:', {
      message: error.message,
      stack: error.stack,
      query: req.query
    });

    res.status(500).json({
      error: 'Simple cost test failed',
      details: error.message,
      query: req.query
    });
  }
}