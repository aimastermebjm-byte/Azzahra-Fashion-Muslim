// RajaOngkir API Configuration (Standard API)
const RAJAONGKIR_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const RAJAONGKIR_BASE_URL = 'https://api.rajaongkir.com/starter';

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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { origin, destination, weight, courier } = req.body;

    if (!origin || !destination || !weight || !courier) {
      return res.status(400).json({
        error: 'Missing required parameters: origin, destination, weight, courier',
        received: { origin, destination, weight, courier }
      });
    }

    console.log('🚀 RajaOngkir API Request:', {
      origin,
      destination,
      weight,
      courier,
      apiKey: RAJAONGKIR_API_KEY ? 'Set' : 'Missing'
    });

    // RajaOngkir standard API - POST with form data
    const formData = new URLSearchParams();
    formData.append('key', RAJAONGKIR_API_KEY);
    formData.append('origin', origin);
    formData.append('destination', destination);
    formData.append('weight', weight.toString());
    formData.append('courier', courier);

    const response = await fetch(`${RAJAONGKIR_BASE_URL}/cost`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'key': RAJAONGKIR_API_KEY
      },
      body: formData.toString()
    });

    console.log('📊 RajaOngkir Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ RajaOngkir API Error:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ RajaOngkir API Response:', data);

    // RajaOngkir standard API returns data in rajaongkir.results format
    let transformedResponse = data;

    // Check if real API returned valid data
    if (!data.rajaongkir?.results || data.rajaongkir.results.length === 0) {
      console.log('⚠️ RajaOngkir returned no valid data, using mock data');

      // Use mock data as fallback
      const { origin, destination, weight } = req.body;
      const weightNum = parseFloat(weight) || 1;
      const distanceFactor = Math.abs(parseInt(destination) - parseInt(origin)) / 100;

      const mockResults = Object.entries(REALISTIC_MOCK_COSTS).map(([code, courierData]) => {
        const distanceCost = Math.floor(distanceFactor * 5000) + 5000;
        const weightCost = Math.max(1, weightNum) * courierData.baseCost;
        const totalCost = Math.round(weightCost + distanceCost);

        return {
          code: code.toUpperCase(),
          name: courierData.name,
          costs: [{
            service: 'Regular Package',
            description: `${courierData.name} - Regular`,
            cost: [{
              value: totalCost,
              etd: courierData.etd,
              note: 'Mock calculation (API unavailable)'
            }]
          }]
        };
      });

      transformedResponse = {
        rajaongkir: {
          status: { code: 200, description: "OK" },
          results: mockResults
        }
      };
      console.log('🔄 Using realistic mock data');
    } else {
      console.log('✅ Using real RajaOngkir data');
    }

    res.status(200).json(transformedResponse);
  } catch (error) {
    console.error('💥 RajaOngkir Cost API Error:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });

    // Fallback to realistic mock data when API fails
    const { origin, destination, weight } = req.body;
    const weightNum = parseFloat(weight) || 1;
    const distanceFactor = Math.abs(parseInt(destination) - parseInt(origin)) / 100;

    const mockResults = Object.entries(REALISTIC_MOCK_COSTS).map(([code, courierData]) => {
      const distanceCost = Math.floor(distanceFactor * 5000) + 5000;
      const weightCost = Math.max(1, weightNum) * courierData.baseCost;
      const totalCost = Math.round(weightCost + distanceCost);

      return {
        code: code.toUpperCase(),
        name: courierData.name,
        costs: [{
          service: 'Regular Package',
          description: `${courierData.name} - Regular`,
          cost: [{
            value: totalCost,
            etd: courierData.etd,
            note: 'Mock calculation (API failed)'
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

    console.log('🔄 Using fallback mock data:', mockResponse);
    res.status(200).json(mockResponse);
  }
}