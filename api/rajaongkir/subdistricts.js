const RAJAONGKIR_DELIVERY_API_KEY = 'LVhqbq325358dc66be91f537xYjLL3Zi';
const RAJAONGKIR_DELIVERY_URL = 'https://pro.rajaongkir.com/api';

export default async function handler(req, res) {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({ error: 'City parameter is required' });
    }

    const response = await fetch(`${RAJAONGKIR_DELIVERY_URL}/subdistrict?key=${RAJAONGKIR_DELIVERY_API_KEY}&city=${city}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('RajaOngkir API Error:', error);
    res.status(500).json({
      error: 'Failed to fetch subdistricts from RajaOngkir API',
      details: error.message || 'Unknown error'
    });
  }
}