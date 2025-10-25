// RajaOngkir Komerce API Configuration
const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://api-sandbox.collaborator.komerce.id';

export default async function handler(req, res) {
  try {
    const { search, province } = req.query;

    // Use Komerce Search Destination API
    let url = `${KOMERCE_BASE_URL}/tariff/api/v1/destination/`;
    if (search) {
      url += `?search=${encodeURIComponent(search)}`;
    }

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
    console.error('Cities API Error:', error);
    res.status(500).json({
      error: 'Failed to fetch cities from Komerce API',
      details: error.message || 'Unknown error'
    });
  }
}