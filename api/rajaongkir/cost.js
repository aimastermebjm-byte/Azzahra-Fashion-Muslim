// RajaOngkir Komerce API Configuration
const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://api-sandbox.collaborator.komerce.id';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { origin, destination, weight, courier } = req.query;

    if (!origin || !destination || !weight) {
      return res.status(400).json({
        error: 'Missing required parameters: origin, destination, weight'
      });
    }

    // Use Komerce Calculate API - GET method with query parameters
    let url = `${KOMERCE_BASE_URL}/tariff/api/v1/calculate`;
    const params = new URLSearchParams({
      origin: origin,
      destination: destination,
      weight: weight.toString()
    });

    if (courier) {
      params.append('courier', courier);
    }

    url += `?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        'x-api-key': KOMERCE_API_KEY,
        'Content-Type': 'application/json'
      }
    });

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
    console.error('Komerce Cost API Error:', error);
    res.status(500).json({
      error: 'Failed to calculate shipping cost from Komerce API',
      details: error.message || 'Unknown error'
    });
  }
}