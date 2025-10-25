import { NextApiRequest, NextApiResponse } from 'next';

const RAJAONGKIR_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const RAJAONGKIR_BASE_URL = 'https://api.rajaongkir.com/starter';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { province } = req.query;

    let url = `${RAJAONGKIR_BASE_URL}/city?key=${RAJAONGKIR_API_KEY}`;
    if (province) {
      url += `&province=${province}`;
    }

    const response = await fetch(url);

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
      error: 'Failed to fetch cities from RajaOngkir API',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}