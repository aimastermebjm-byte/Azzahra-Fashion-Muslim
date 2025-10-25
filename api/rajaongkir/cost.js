// RajaOngkir API Configuration (Starter Package)
const RAJAONGKIR_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const RAJAONGKIR_BASE_URL = 'https://api.rajaongkir.com/starter';

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
        error: 'Missing required parameters: origin, destination, weight, courier'
      });
    }

    console.log('🚀 RajaOngkir API Request:', {
      origin,
      destination,
      weight,
      courier,
      apiKey: RAJAONGKIR_API_KEY ? 'Set' : 'Missing'
    });

    // RajaOngkir standard cost API - POST with form data
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

    res.status(200).json(data);
  } catch (error) {
    console.error('💥 RajaOngkir Cost API Error:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });

    res.status(500).json({
      error: 'Failed to calculate shipping cost from RajaOngkir API',
      details: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}