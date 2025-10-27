// Unified Address API - Supports both RajaOngkir and Komerce
// Single endpoint for all address operations

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

    const { type, provinceId, cityId, districtId } = req.query;

    console.log(`📍 Address API request: type=${type}, provinceId=${provinceId}, cityId=${cityId}, districtId=${districtId}`);

    let apiUrl = '';
    let expectedType = '';

    switch (type) {
      case 'provinces':
        apiUrl = `${KOMERCE_BASE_URL}/destination/province`;
        expectedType = 'provinces';
        break;

      case 'cities':
        if (!provinceId) {
          return res.status(400).json({
            success: false,
            message: 'Province ID is required for cities',
            data: null
          });
        }
        apiUrl = `${KOMERCE_BASE_URL}/destination/city/${provinceId}`;
        expectedType = 'cities';
        break;

      case 'districts':
        if (!cityId) {
          return res.status(400).json({
            success: false,
            message: 'City ID is required for districts',
            data: null
          });
        }
        apiUrl = `${KOMERCE_BASE_URL}/destination/district/${cityId}`;
        expectedType = 'districts';
        break;

      case 'subdistricts':
        if (!districtId) {
          return res.status(400).json({
            success: false,
            message: 'District ID is required for subdistricts',
            data: null
          });
        }
        apiUrl = `${KOMERCE_BASE_URL}/destination/sub-district/${districtId}`;
        expectedType = 'subdistricts';
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid type. Use: provinces, cities, districts, subdistricts',
          data: null
        });
    }

    console.log(`🌐 Fetching ${expectedType} from: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Key': KOMERCE_API_KEY
      }
    });

    console.log(`${expectedType} response status:`, response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Komerce ${expectedType} API error:`, errorText);
      throw new Error(`Komerce API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log(`Raw ${expectedType} response:`, JSON.stringify(data, null, 2));

    // Handle different response structures
    let dataArray = [];
    if (Array.isArray(data)) {
      dataArray = data;
      console.log(`${expectedType} is direct array`);
    } else if (data.data && Array.isArray(data.data)) {
      dataArray = data.data;
      console.log(`${expectedType} found in data.data`);
    } else if (data.rajaongkir && data.rajaongkir.results && Array.isArray(data.rajaongkir.results)) {
      dataArray = data.rajaongkir.results;
      console.log(`${expectedType} found in rajaongkir.results`);
    } else {
      console.log(`${expectedType} unknown structure, keys:`, Object.keys(data));
    }

    console.log(`${expectedType} array length:`, dataArray.length);

    // Transform data based on type
    let transformedData;
    switch (type) {
      case 'provinces':
        transformedData = dataArray.map(item => ({
          province_id: item.id.toString(),
          province: item.province_name
        }));
        break;

      case 'cities':
        transformedData = dataArray.map(item => ({
          city_id: item.id.toString(),
          city_name: item.city_name,
          province: item.province_name,
          province_id: provinceId,
          type: item.type || 'Kota'
        }));
        break;

      case 'districts':
        transformedData = dataArray.map(item => ({
          district_id: item.id.toString(),
          district_name: item.district_name,
          city_id: cityId,
          province: item.province_name
        }));
        break;

      case 'subdistricts':
        transformedData = dataArray.map(item => ({
          subdistrict_id: item.id.toString(),
          subdistrict_name: item.subdistrict_name,
          district_id: districtId,
          city: item.city_name,
          province: item.province_name
        }));
        break;
    }

    console.log(`✅ Successfully processed ${transformedData.length} ${expectedType}`);

    return res.status(200).json({
      success: true,
      message: `${expectedType} retrieved successfully`,
      data: transformedData
    });

  } catch (error) {
    console.error('💥 Address API error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch address data',
      error: error.message,
      data: null
    });
  }
}