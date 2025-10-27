// Komerce API - Cities Endpoint
// Base URL: https://rajaongkir.komerce.id/api/v1/destination/city/{province_id}

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

    const { provinceId } = req.query;

    if (!provinceId) {
      return res.status(400).json({
        success: false,
        message: 'Province ID is required',
        data: null
      });
    }

    console.log('📋 Fetching cities from Komerce API for province:', provinceId);

    const response = await fetch(`${KOMERCE_BASE_URL}/destination/city/${provinceId}`, {
      method: 'GET',
      headers: {
        'Key': KOMERCE_API_KEY
      }
    });

    console.log('Cities response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Komerce cities API error:', errorText);
      throw new Error(`Komerce API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Cities response:', JSON.stringify(data, null, 2));

    // Handle different response structures
    let citiesArray = [];
    if (Array.isArray(data)) {
      citiesArray = data;
    } else if (data.data && Array.isArray(data.data)) {
      citiesArray = data.data;
    } else if (data.rajaongkir && data.rajaongkir.results && Array.isArray(data.rajaongkir.results)) {
      citiesArray = data.rajaongkir.results;
    }

    // Transform Komerce response to match expected format
    const transformedData = citiesArray.map(city => ({
      city_id: city.id.toString(),
      city_name: city.city_name,
      province: city.province_name,
      province_id: provinceId,
      type: city.type || 'Kota'
    }));

    console.log('✅ Successfully fetched', transformedData.length, 'cities for province', provinceId);

    return res.status(200).json({
      success: true,
      message: 'Cities retrieved successfully',
      data: transformedData
    });

  } catch (error) {
    console.error('💥 Cities endpoint error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch cities',
      error: error.message,
      data: null
    });
  }
}