import { NextApiRequest, NextApiResponse } from 'next';

const RAJAONGKIR_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const RAJAONGKIR_BASE_URL = 'https://api.rajaongkir.com/starter';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { origin, destination, weight, courier } = req.body;

    if (!origin || !destination || !weight || !courier) {
      return res.status(400).json({
        error: 'Missing required parameters: origin, destination, weight, courier'
      });
    }

    const formData = new URLSearchParams();
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

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('RajaOngkir Cost API Error:', error);
    res.status(500).json({
      error: 'Failed to calculate shipping cost from RajaOngkir API',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}