// Unified Address API - Supports both RajaOngkir and Komerce with Caching
// Single endpoint for all address operations with Firestore caching
// ✅ Now with multi-key fallback support

const { fetchWithFallback, KOMERCE_BASE_URL } = require('./utils/rajaongkir-keys');
const FIREBASE_PROJECT_ID = 'azzahra-fashion-muslim-ab416';
const FIREBASE_API_KEY = 'AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs';

// Cache TTL (hours)
const CACHE_TTL = {
  provinces: 24 * 30 * 6,  // 6 months - provinces rarely change
  cities: 24 * 30,        // 1 month
  districts: 24 * 30,     // 1 month
  subdistricts: 24 * 30   // 1 month
};

// Firebase cache functions
async function getCachedData(collectionName, documentId) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${documentId}?key=${FIREBASE_API_KEY}`;

    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const expiresAt = new Date(data.fields.expires_at?.timestampValue);

      if (expiresAt > new Date()) {
        console.log(`✅ CACHE HIT for ${collectionName}/${documentId}`);
        return JSON.parse(data.fields.data?.stringValue || '[]');
      } else {
        console.log(`⚠️ CACHE EXPIRED for ${collectionName}/${documentId}`);
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

async function setCachedData(collectionName, documentId, data, ttlHours) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${documentId}?key=${FIREBASE_API_KEY}`;

    const expiresAt = new Date(Date.now() + (ttlHours * 60 * 60 * 1000));

    const firestoreData = {
      fields: {
        data: { stringValue: JSON.stringify(data) },
        expires_at: { timestampValue: expiresAt.toISOString() },
        created_at: { timestampValue: new Date().toISOString() },
        hit_count: { integerValue: 1 }
      }
    };

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(firestoreData)
    });

    if (response.ok) {
      console.log(`💾 CACHE SAVED for ${collectionName}/${documentId} (expires: ${expiresAt.toISOString()})`);
    } else {
      console.error('Cache save error:', await response.text());
    }
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

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

    let endpoint = '';
    let expectedType = '';

    switch (type) {
      case 'provinces':
        endpoint = `/destination/province`;
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
        endpoint = `/destination/city/${provinceId}`;
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
        endpoint = `/destination/district/${cityId}`;
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
        endpoint = `/destination/sub-district/${districtId}`;
        expectedType = 'subdistricts';
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid type. Use: provinces, cities, districts, subdistricts',
          data: null
        });
    }

    console.log(`🌐 Fetching ${expectedType} from endpoint: ${endpoint}`);

    // ✅ Use fetchWithFallback for automatic key rotation
    const result = await fetchWithFallback(endpoint, {
      method: 'GET'
    });

    const { response, data: rawData, keyIndex } = result;
    console.log(`${expectedType} response status (key #${keyIndex}):`, response.status);

    if (!response.ok) {
      console.error(`Komerce ${expectedType} API error (key #${keyIndex}):`, response.status);
      throw new Error(`Komerce API error: ${response.status}`);
    }

    console.log(`Raw ${expectedType} response:`, JSON.stringify(rawData, null, 2));

    // Handle different response structures
    let dataArray = [];
    if (Array.isArray(rawData)) {
      dataArray = rawData;
      console.log(`${expectedType} is direct array`);
    } else if (rawData.data && Array.isArray(rawData.data)) {
      dataArray = rawData.data;
      console.log(`${expectedType} found in data.data`);
    } else if (rawData.rajaongkir && rawData.rajaongkir.results && Array.isArray(rawData.rajaongkir.results)) {
      dataArray = rawData.rajaongkir.results;
      console.log(`${expectedType} found in rajaongkir.results`);
    } else {
      console.log(`${expectedType} unknown structure, keys:`, Object.keys(rawData));
    }

    console.log(`${expectedType} array length:`, dataArray.length);

    // Transform data based on type
    let transformedData;
    switch (type) {
      case 'provinces':
        transformedData = dataArray.map(item => ({
          province_id: item.id.toString(),
          province: item.name || item.province_name
        }));
        break;

      case 'cities':
        transformedData = dataArray.map(item => ({
          city_id: item.id.toString(),
          city_name: item.name || item.city_name,
          province: item.province_name,
          province_id: provinceId,
          type: item.type || 'Kota'
        }));
        break;

      case 'districts':
        transformedData = dataArray.map(item => ({
          district_id: item.id.toString(),
          district_name: item.name || item.district_name,
          city_id: cityId,
          province: item.province_name
        }));
        break;

      case 'subdistricts':
        transformedData = dataArray.map(item => ({
          subdistrict_id: item.id.toString(),
          subdistrict_name: item.name || item.subdistrict_name,
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