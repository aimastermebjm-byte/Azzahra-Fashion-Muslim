// Komerce API Configuration (RajaOngkir via Komerce)
const RAJAONGKIR_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const RAJAONGKIR_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

// Realistic mock data based on typical Indonesian shipping costs from Banjarmasin
const ROUTED_MOCK_COSTS = {
  'jnt': {
    name: 'J&T Express',
    service: 'EZ',
    routes: {
      '177': 45000, // Surabaya
      '6': 85000,   // Medan
      '96': 55000,  // Bandung
      '137': 48000, // Semarang
      '173': 52000, // Malang
      '607': 15000, // Banjarmasin (local)
      '608': 12000  // Banjarbaru (local)
    },
    default: 35000, // Other cities
    etd: '2-3 hari'
  },
  'jne': {
    name: 'JNE',
    service: 'REG',
    routes: {
      '177': 48000, // Surabaya
      '6': 92000,   // Medan
      '96': 58000,  // Bandung
      '137': 52000, // Semarang
      '173': 55000, // Malang
      '607': 18000, // Banjarmasin (local)
      '608': 15000  // Banjarbaru (local)
    },
    default: 38000, // Other cities
    etd: '2-4 hari'
  },
  'pos': {
    name: 'POS Indonesia',
    service: 'Paket Kilat Khusus',
    routes: {
      '177': 35000, // Surabaya
      '6': 65000,   // Medan
      '96': 45000,  // Bandung
      '137': 40000, // Semarang
      '173': 42000, // Malang
      '607': 12000, // Banjarmasin (local)
      '608': 10000  // Banjarbaru (local)
    },
    default: 28000, // Other cities
    etd: '3-5 hari'
  },
  'tiki': {
    name: 'TIKI',
    service: 'REG',
    routes: {
      '177': 50000, // Surabaya
      '6': 95000,   // Medan
      '96': 60000,  // Bandung
      '137': 54000, // Semarang
      '173': 58000, // Malang
      '607': 20000, // Banjarmasin (local)
      '608': 17000  // Banjarbaru (local)
    },
    default: 40000, // Other cities
    etd: '2-3 hari'
  },
  'sicepat': {
    name: 'SiCepat Express',
    service: 'REG',
    routes: {
      '177': 55000, // Surabaya
      '6': 98000,   // Medan
      '96': 65000,  // Bandung
      '137': 58000, // Semarang
      '173': 62000, // Malang
      '607': 22000, // Banjarmasin (local)
      '608': 18000  // Banjarbaru (local)
    },
    default: 45000, // Other cities
    etd: '1-2 hari'
  },
  'wahana': {
    name: 'Wahana',
    service: 'REG',
    routes: {
      '177': 28000, // Surabaya
      '6': 55000,   // Medan
      '96': 38000,  // Bandung
      '137': 32000, // Semarang
      '173': 35000, // Malang
      '607': 10000, // Banjarmasin (local)
      '608': 8000   // Banjarbaru (local)
    },
    default: 22000, // Other cities
    etd: '3-6 hari'
  }
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

    // Komerce API - POST with JSON body
    const requestBody = JSON.stringify({
      origin: origin,
      destination: destination,
      weight: parseInt(weight),
      courier: courier
    });

    console.log('📋 Komerce Request Body:', requestBody);

    const response = await fetch(`${RAJAONGKIR_BASE_URL}/calculate/domestic-cost`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': RAJAONGKIR_API_KEY
      },
      body: requestBody
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

      // Use realistic mock data as fallback
      const { destination, weight } = req.body;
      const weightNum = parseFloat(weight) || 1;
      const weightMultiplier = Math.max(1, Math.ceil(weightNum / 1000)); // Round up to nearest kg

      const mockResults = Object.entries(ROUTED_MOCK_COSTS).map(([code, courierData]) => {
        // Get route-specific cost or default
        const routeCost = courierData.routes[destination] || courierData.default;
        const totalCost = routeCost * weightMultiplier;

        return {
          code: code.toUpperCase(),
          name: courierData.name,
          costs: [{
            service: courierData.service,
            description: `${courierData.name} - ${courierData.service}`,
            cost: [{
              value: totalCost,
              etd: courierData.etd,
              note: 'Mock calculation - realistic pricing'
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
    const { destination, weight } = req.body;
    const weightNum = parseFloat(weight) || 1;
    const weightMultiplier = Math.max(1, Math.ceil(weightNum / 1000)); // Round up to nearest kg

    const mockResults = Object.entries(ROUTED_MOCK_COSTS).map(([code, courierData]) => {
      // Get route-specific cost or default
      const routeCost = courierData.routes[destination] || courierData.default;
      const totalCost = routeCost * weightMultiplier;

      console.log(`💰 MOCK COST API for ${code} to ${destination}: Rp ${totalCost.toLocaleString('id-ID')} (${weightMultiplier}kg)`);

      return {
        code: code.toUpperCase(),
        name: courierData.name,
        costs: [{
          service: courierData.service,
          description: `${courierData.name} - ${courierData.service}`,
          cost: [{
            value: totalCost,
            etd: courierData.etd,
            note: 'Mock calculation - realistic pricing'
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