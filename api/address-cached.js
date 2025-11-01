// Address API with Firestore Caching
// Reduces API calls by caching provinces, cities, districts, subdistricts

const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';
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

    // Generate cache key
    let cacheKey = expectedType;
    let cacheCollection = `address_${expectedType}`;

    switch (expectedType) {
      case 'cities':
        cacheKey = `cities_${provinceId}`;
        break;
      case 'districts':
        cacheKey = `districts_${cityId}`;
        break;
      case 'subdistricts':
        cacheKey = `subdistricts_${districtId}`;
        break;
    }

    console.log(`🔍 Checking cache for ${expectedType}: ${cacheKey}`);

    // Try to get from cache first
    let dataArray = await getCachedData(cacheCollection, cacheKey);

    if (dataArray) {
      console.log(`✅ ${expectedType} loaded from cache (${dataArray.length} items)`);
      return res.status(200).json({
        success: true,
        message: `${expectedType} loaded from cache`,
        data: dataArray
      });
    }

    console.log(`❌ CACHE MISS for ${expectedType}, calling API...`);
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
      dataArray = [];
    }

    console.log(`${expectedType} array length:`, dataArray.length);

    // Save to cache
    if (dataArray.length > 0) {
      await setCachedData(cacheCollection, cacheKey, dataArray, CACHE_TTL[expectedType] || 24);
    }

    // Transform data based on type
    let transformedData = [];
    switch (expectedType) {
      case 'provinces':
        transformedData = dataArray.map(item => ({
          province_id: item.province_id || item.id,
          province: item.province || item.name
        }));
        break;

      case 'cities':
        transformedData = dataArray.map(item => ({
          city_id: item.city_id || item.id,
          city_name: item.city_name || item.name,
          province_id: item.province_id,
          province: item.province,
          type: item.type
        }));
        break;

      case 'districts':
        transformedData = dataArray.map(item => ({
          district_id: item.district_id || item.id,
          district_name: item.district_name || item.name,
          city_id: item.city_id,
          city_name: item.city_name
        }));
        break;

      case 'subdistricts':
        transformedData = dataArray.map(item => ({
          subdistrict_id: item.subdistrict_id || item.id,
          subdistrict_name: item.subdistrict_name || item.name,
          district_id: item.district_id,
          district_name: item.district_name,
          city_id: item.city_id,
          city_name: item.city_name
        }));
        break;
    }

    console.log(`✅ ${expectedType} processed: ${transformedData.length} items`);

    return res.status(200).json({
      success: true,
      message: `${expectedType} loaded successfully`,
      data: transformedData
    });

  } catch (error) {
    console.error('💥 Address API Error:', {
      message: error.message,
      stack: error.stack,
      query: req.query
    });

    return res.status(500).json({
      success: false,
      message: `Address API error: ${error.message}`,
      data: null
    });
  }
}