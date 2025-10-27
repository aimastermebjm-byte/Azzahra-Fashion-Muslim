// Komerce API - Subdistricts Endpoint
// Base URL: https://rajaongkir.komerce.id/api/v1/destination/sub-district/{district_id}

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

    const { districtId } = req.query;

    if (!districtId) {
      return res.status(400).json({
        success: false,
        message: 'District ID is required',
        data: null
      });
    }

    console.log('📋 Fetching subdistricts from Komerce API for district:', districtId);

    const response = await fetch(`${KOMERCE_BASE_URL}/destination/sub-district/${districtId}`, {
      method: 'GET',
      headers: {
        'Key': KOMERCE_API_KEY
      }
    });

    console.log('Subdistricts response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Komerce subdistricts API error:', errorText);
      throw new Error(`Komerce API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Subdistricts response:', JSON.stringify(data, null, 2));

    // Handle different response structures
    let subdistrictsArray = [];
    if (Array.isArray(data)) {
      subdistrictsArray = data;
    } else if (data.data && Array.isArray(data.data)) {
      subdistrictsArray = data.data;
    } else if (data.rajaongkir && data.rajaongkir.results && Array.isArray(data.rajaongkir.results)) {
      subdistrictsArray = data.rajaongkir.results;
    }

    // Transform Komerce response to match expected format
    const transformedData = subdistrictsArray.map(subdistrict => ({
      subdistrict_id: subdistrict.id.toString(),
      subdistrict_name: subdistrict.subdistrict_name,
      district_id: districtId,
      city: subdistrict.city_name,
      province: subdistrict.province_name
    }));

    console.log('✅ Successfully fetched', transformedData.length, 'subdistricts for district', districtId);

    return res.status(200).json({
      success: true,
      message: 'Subdistricts retrieved successfully',
      data: transformedData
    });

  } catch (error) {
    console.error('💥 Subdistricts endpoint error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch subdistricts',
      error: error.message,
      data: null
    });
  }
}