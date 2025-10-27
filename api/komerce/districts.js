// Komerce API - Districts Endpoint
// Base URL: https://rajaongkir.komerce.id/api/v1/destination/district/{city_id}

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

    const { cityId } = req.query;

    if (!cityId) {
      return res.status(400).json({
        success: false,
        message: 'City ID is required',
        data: null
      });
    }

    console.log('📋 Fetching districts from Komerce API for city:', cityId);

    const response = await fetch(`${KOMERCE_BASE_URL}/destination/district/${cityId}`, {
      method: 'GET',
      headers: {
        'Key': KOMERCE_API_KEY
      }
    });

    console.log('Districts response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Komerce districts API error:', errorText);
      throw new Error(`Komerce API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Districts response:', JSON.stringify(data, null, 2));

    // Handle different response structures
    let districtsArray = [];
    if (Array.isArray(data)) {
      districtsArray = data;
    } else if (data.data && Array.isArray(data.data)) {
      districtsArray = data.data;
    } else if (data.rajaongkir && data.rajaongkir.results && Array.isArray(data.rajaongkir.results)) {
      districtsArray = data.rajaongkir.results;
    }

    // Transform Komerce response to match expected format
    const transformedData = districtsArray.map(district => ({
      district_id: district.id.toString(),
      district_name: district.district_name,
      city_id: cityId,
      province: district.province_name
    }));

    console.log('✅ Successfully fetched', transformedData.length, 'districts for city', cityId);

    return res.status(200).json({
      success: true,
      message: 'Districts retrieved successfully',
      data: transformedData
    });

  } catch (error) {
    console.error('💥 Districts endpoint error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch districts',
      error: error.message,
      data: null
    });
  }
}