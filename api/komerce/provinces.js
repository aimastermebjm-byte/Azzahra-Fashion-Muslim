// Komerce API - Provinces Endpoint
// Base URL: https://rajaongkir.komerce.id/api/v1/destination/province

const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed',
        data: null
      });
    }

    console.log('📋 Fetching provinces from Komerce API...');

    const response = await fetch(`${KOMERCE_BASE_URL}/destination/province`, {
      method: 'GET',
      headers: {
        'Key': KOMERCE_API_KEY
      }
    });

    console.log('Provinces response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Komerce provinces API error:', errorText);
      throw new Error(`Komerce API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Provinces response:', JSON.stringify(data, null, 2));

    // Handle different response structures
    let provincesArray = [];
    if (Array.isArray(data)) {
      provincesArray = data;
    } else if (data.data && Array.isArray(data.data)) {
      provincesArray = data.data;
    } else if (data.rajaongkir && data.rajaongkir.results && Array.isArray(data.rajaongkir.results)) {
      provincesArray = data.rajaongkir.results;
    }

    // Transform Komerce response to match expected format
    const transformedData = provincesArray.map(province => ({
      province_id: province.id.toString(),
      province: province.province_name
    }));

    console.log('✅ Successfully fetched', transformedData.length, 'provinces');

    return res.status(200).json({
      success: true,
      message: 'Provinces retrieved successfully',
      data: transformedData
    });

  } catch (error) {
    console.error('💥 Provinces endpoint error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch provinces',
      error: error.message,
      data: null
    });
  }
}