// Komerce API Configuration (Komship Delivery API)
const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://api-sandbox.collaborator.komerce.id';

// Realistic mock data based on typical Indonesian shipping costs
const REALISTIC_MOCK_COSTS = {
  'jnt': { name: 'J&T Express', baseCost: 15000, etd: '2-3 hari' },
  'jne': { name: 'JNE', baseCost: 18000, etd: '2-4 hari' },
  'pos': { name: 'POS Indonesia', baseCost: 20000, etd: '3-5 hari' },
  'tiki': { name: 'TIKI', baseCost: 17000, etd: '2-3 hari' },
  'sicepat': { name: 'SiCepat Express', baseCost: 16000, etd: '1-2 hari' },
  'wahana': { name: 'Wahana', baseCost: 12000, etd: '3-6 hari' }
};

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

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
      shipper_destination_id: origin,
      receiver_destination_id: destination,
      weight,
      item_value = 100000,
      cod = 'no',
      origin_pin_point = '-3.3186111,114.5908333', // Banjarmasin coordinates
      destination_pin_point = '-6.2087634,106.845599' // Jakarta coordinates (default)
    } = req.query;

    if (!origin || !destination || !weight) {
      return res.status(400).json({
        error: 'Missing required parameters: shipper_destination_id, receiver_destination_id, weight',
        received: { origin, destination, weight, item_value, cod }
      });
    }

    console.log('🚀 Komerce API Request:', {
      shipper_destination_id: origin,
      receiver_destination_id: destination,
      weight: `${weight} kg`,
      item_value,
      cod,
      origin_pin_point,
      destination_pin_point,
      apiKey: KOMERCE_API_KEY ? 'Set' : 'Missing'
    });

    // Build URL with query parameters for Komerce API
    const params = new URLSearchParams({
      shipper_destination_id: origin.toString(),
      receiver_destination_id: destination.toString(),
      weight: weight.toString(),
      item_value: item_value.toString(),
      cod: cod.toString(),
      origin_pin_point: origin_pin_point,
      destination_pin_point: destination_pin_point
    });

    const url = `${KOMERCE_BASE_URL}/tariff/api/v1/calculate?${params.toString()}`;
    console.log('📡 Komerce API URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': KOMERCE_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Komerce Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Komerce API Error:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Komerce API Response:', data);

    // Transform Komerce response to match expected format
    const transformedResponse = {
      rajaongkir: {
        status: {
          code: data.meta?.code || 200,
          description: data.meta?.message || "OK"
        },
        results: []
      }
    };

    // Transform regular shipping data
    if (data.data?.calculate_reguler) {
      data.data.calculate_reguler.forEach(item => {
        transformedResponse.rajaongkir.results.push({
          code: item.shipping_name?.toLowerCase() || 'unknown',
          name: item.shipping_name || 'Unknown',
          costs: [{
            service: item.service_name || 'Regular',
            description: `${item.shipping_name} ${item.service_name}`,
            cost: [{
              value: item.shipping_cost_net || item.shipping_cost || 0,
              etd: item.etd || '2-4 days',
              note: `COD: ${item.is_cod ? 'Yes' : 'No'}`
            }]
          }]
        });
      });
    }

    res.status(200).json(transformedResponse);
  } catch (error) {
    console.error('💥 Komerce Cost API Error:', {
      message: error.message,
      stack: error.stack,
      query: req.query
    });

    // Fallback to realistic mock data when API fails
    const { origin, destination, weight } = req.query;
    const weightNum = parseFloat(weight) || 1;
    const distanceFactor = Math.abs(parseInt(destination) - parseInt(origin)) / 100;

    // Get available couriers (use all since we don't know which ones are available)
    const mockResults = Object.entries(REALISTIC_MOCK_COSTS).map(([code, data]) => {
      const distanceCost = Math.floor(distanceFactor * 5000) + 5000; // 5k-10k distance cost
      const weightCost = Math.max(1, weightNum) * data.baseCost;
      const totalCost = Math.round(weightCost + distanceCost);

      return {
        code: code.toUpperCase(),
        name: data.name,
        costs: [{
          service: 'Regular Package',
          description: `${data.name} - Regular`,
          cost: [{
            value: totalCost,
            etd: data.etd,
            note: 'Mock calculation (API unavailable)'
          }]
        }]
      };
    });

    const mockResponse = {
      rajaongkir: {
        status: { code: 200, description: "OK" },
        results: mockResults
      }
    };

    console.log('🔄 Using realistic mock data:', mockResponse);
    res.status(200).json(mockResponse);
  }
}