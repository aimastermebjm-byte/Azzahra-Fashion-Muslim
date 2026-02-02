// Address API with Firestore Caching
// Reduces API calls by caching provinces, cities, districts, subdistricts
// ✅ Now with multi-key fallback support

const { fetchWithFallback, API_KEYS, KOMERCE_BASE_URL } = require('./utils/rajaongkir-keys');
const FIREBASE_PROJECT_ID = 'azzahra-fashion-muslim-ab416';
const FIREBASE_API_KEY = 'AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs';

// Cache TTL (hours) - will be loaded from settings
// Address data = PERMANENT (user-requested: only refresh manually if needed)
// Shipping data = 30 days
const DEFAULT_CACHE_TTL = {
  provinces: 24 * 365 * 100,    // 100 years (permanent)
  cities: 24 * 365 * 100,       // 100 years (permanent)
  districts: 24 * 365 * 100,    // 100 years (permanent)
  subdistricts: 24 * 365 * 100  // 100 years (permanent)
};

// Load cache TTL from settings
async function loadAddressCacheTTL() {
  try {
    const FIREBASE_PROJECT_ID = 'azzahra-fashion-muslim-ab416';
    const FIREBASE_API_KEY = 'AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs';
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/cache_config?key=${FIREBASE_API_KEY}`;

    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      return {
        provinces: data.fields.address_provinces_ttl_hours?.integerValue || DEFAULT_CACHE_TTL.provinces,
        cities: data.fields.address_cities_ttl_hours?.integerValue || DEFAULT_CACHE_TTL.cities,
        districts: data.fields.address_districts_ttl_hours?.integerValue || DEFAULT_CACHE_TTL.districts,
        subdistricts: data.fields.address_subdistricts_ttl_hours?.integerValue || DEFAULT_CACHE_TTL.subdistricts
      };
    }
  } catch (error) {
    console.log('⚠️ Using default address cache TTL (could not load from settings)');
  }
  return DEFAULT_CACHE_TTL;
}

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

    // Using the same structure as working shipping cache
    const firestoreData = {
      fields: {
        data: { stringValue: JSON.stringify(data) },
        expires_at: { timestampValue: expiresAt.toISOString() },
        cached_at: { timestampValue: new Date().toISOString() },
        hit_count: { integerValue: 1 },
        cache_type: { stringValue: 'address' },
        address_type: { stringValue: collectionName.replace('address_', '') }
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
      const errorText = await response.text();
      console.error('❌ Cache save error:', errorText);
      console.error('📝 Failed data structure:', JSON.stringify(firestoreData, null, 2));
    }
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

export default async function handler(req, res) {
  try {
    // Load cache TTL from settings (owner configurable)
    const cacheTTL = await loadAddressCacheTTL();

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

      // Transform cached data to match frontend expectations
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

      console.log(`✅ ${expectedType} transformed from cache: ${transformedData.length} items`);
      return res.status(200).json({
        success: true,
        message: `${expectedType} loaded from cache`,
        data: transformedData
      });
    }

    console.log(`❌ CACHE MISS for ${expectedType}, calling API...`);
    console.log(`🌐 Fetching ${expectedType} from: ${apiUrl}`);

    // ✅ Use fetchWithFallback for automatic key rotation
    // Note: Need to extract endpoint from full URL
    const endpoint = apiUrl.replace(KOMERCE_BASE_URL, '');
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
      dataArray = [];
    }

    console.log(`${expectedType} array length:`, dataArray.length);

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

    // Save TRANSFORMED data to cache (not raw data)
    if (transformedData.length > 0) {
      const ttl = cacheTTL[expectedType] || 24;
      console.log(`💾 Saving TRANSFORMED ${expectedType} cache with TTL: ${ttl} hours`);
      await setCachedData(cacheCollection, cacheKey, transformedData, ttl);
    }

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