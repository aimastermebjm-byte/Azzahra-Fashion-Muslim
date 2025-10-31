// Komerce API Integration - Calculate Domestic Cost with Caching
// Based on official Komerce documentation
// Added Firestore caching for cost optimization

const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

// Firebase Admin SDK for caching
// Note: For Vercel deployment, we'll use Firebase REST API instead of Admin SDK
const CACHE_TTL_HOURS = 24; // Cache for 24 hours

// Helper functions for Firebase REST API (for Vercel compatibility)
async function getFirestoreDocument(collectionPath, documentId) {
  const FIREBASE_PROJECT_ID = 'azzahra-fashion-muslim-ab416';
  const FIREBASE_API_KEY = 'AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs';

  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionPath}/${documentId}?key=${FIREBASE_API_KEY}`;

  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      // Convert timestamp to Date object
        const expiresAt = data.fields.expires_at?.timestampValue;
        const cachedAt = data.fields.cached_at?.timestampValue;

        return {
        exists: true,
        data: {
          origin: data.fields.origin?.stringValue,
          destination: data.fields.destination?.stringValue,
          weight: data.fields.weight?.integerValue,
          courier: data.fields.courier?.stringValue,
          results: JSON.parse(data.fields.results?.stringValue || '[]'),
          cached_at: cachedAt,
          expires_at: new Date(expiresAt),
          hit_count: data.fields.hit_count?.integerValue || 0
        }
      };
    }
    return { exists: false };
  } catch (error) {
    console.error('Error getting cache document:', error);
    return { exists: false };
  }
}

async function setFirestoreDocument(collectionPath, documentId, data) {
  const FIREBASE_PROJECT_ID = 'azzahra-fashion-muslim-ab416';
  const FIREBASE_API_KEY = 'AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs';

  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionPath}/${documentId}?key=${FIREBASE_API_KEY}`;

  const firestoreData = {
    fields: {
      origin: { stringValue: data.origin },
      destination: { stringValue: data.destination },
      weight: { integerValue: data.weight },
      courier: { stringValue: data.courier },
      results: { stringValue: JSON.stringify(data.results) },
      cached_at: { timestampValue: new Date().toISOString() },
      expires_at: { timestampValue: data.expires_at.toISOString() },
      hit_count: { integerValue: data.hit_count || 0 }
    }
  };

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(firestoreData)
    });

    if (response.ok) {
      console.log('✅ Cache saved successfully');
    } else {
      console.error('❌ Failed to save cache:', await response.text());
    }
  } catch (error) {
    console.error('Error setting cache document:', error);
  }
}

// Smart weight rounding: 1.25kg threshold system
// 0-1250g = 1kg, 1251-2250g = 2kg, 2251-3250g = 3kg, etc.
function calculateBillableWeight(actualWeight) {
  if (actualWeight <= 1250) {
    return 1000; // 1kg
  }

  // For weight above 1250g, calculate with 250g tolerance per kg
  const baseKg = Math.floor(actualWeight / 1000);
  const remainingGrams = actualWeight % 1000;

  if (remainingGrams > 250) {
    return (baseKg + 1) * 1000; // Round up to next kg
  } else {
    return baseKg * 1000; // Keep current kg
  }
}

// Generate cache key with smart weight rounding
function generateCacheKey(origin, destination, weight, courier) {
  const billableWeight = calculateBillableWeight(weight);
  return `${origin}_${destination}_${billableWeight}_${courier}`;
}

// Get billable weight info for logging/debugging
function getWeightInfo(actualWeight) {
  const billableWeight = calculateBillableWeight(actualWeight);
  const chargedKg = billableWeight / 1000;

  return {
    actualWeight: actualWeight,
    actualWeightKg: actualWeight / 1000,
    billableWeight: billableWeight,
    chargedKg: chargedKg,
    explanation: actualWeight <= 1250
      ? `${actualWeight}g = 1kg (minimum weight)`
      : `${actualWeight}g = ${chargedKg}kg (rounded with 250g tolerance)`
  };
}

// Check if cache is still valid
function isCacheValid(expiresAt) {
  return new Date(expiresAt) > new Date();
}

export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, key');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'POST') {
      return res.status(405).json({
        meta: {
          message: 'Method not allowed',
          code: 405,
          status: 'error'
        },
        data: null
      });
    }

    const { origin, destination, weight, courier, price = 'lowest', getAllCouriers = false } = req.body;

    // Validate required parameters
    if (!origin || !destination || !weight || !courier) {
      return res.status(400).json({
        meta: {
          message: 'Missing required parameters: origin, destination, weight, courier',
          code: 400,
          status: 'error'
        },
        data: null
      });
    }

    // Calculate billable weight and log
    const weightInfo = getWeightInfo(weight);
    const billableWeight = weightInfo.billableWeight;

    console.log('🚚 SHIPPING API REQUEST:', {
      origin,
      destination,
      actualWeight: weight,
      billableWeight: billableWeight,
      weightExplanation: weightInfo.explanation,
      courier,
      getAllCouriers,
      timestamp: new Date().toISOString()
    });

    // Available couriers
    const availableCouriers = ['jne', 'jnt', 'pos', 'tiki', 'sicepat', 'wahana'];

    let results = [];
    let cacheHit = false;
    let cacheKeys = [];

    if (getAllCouriers) {
      // For getAllCouriers mode, check cache for each courier
      console.log('📦 Checking cache for ALL COURIERS...');

      for (const courierCode of availableCouriers) {
        const cacheKey = generateCacheKey(origin, destination, billableWeight, courierCode);
        cacheKeys.push(cacheKey);

        console.log(`🔍 Checking cache for ${courierCode}: ${cacheKey}`);
        const cacheDoc = await getFirestoreDocument('shipping_cache', cacheKey);

        if (cacheDoc.exists && isCacheValid(cacheDoc.data.expires_at)) {
          console.log(`✅ CACHE HIT for ${courierCode}:`, cacheKey);
          results = results.concat(cacheDoc.data.results);
          cacheHit = true;

          // Update hit count
          await setFirestoreDocument('shipping_cache', cacheKey, {
            ...cacheDoc.data,
            hit_count: cacheDoc.data.hit_count + 1
          });
        } else {
          console.log(`❌ CACHE MISS for ${courierCode}:`, cacheKey);
          // Fetch from API for this courier using BILLABLE weight
          try {
            const apiResults = await fetchCourierFromAPI(courierCode, origin, destination, billableWeight, price);
            if (apiResults && apiResults.length > 0) {
              results = results.concat(apiResults);

              // Save to cache with BILLABLE weight
              const expiresAt = new Date(Date.now() + (CACHE_TTL_HOURS * 60 * 60 * 1000));
              await setFirestoreDocument('shipping_cache', cacheKey, {
                origin,
                destination,
                weight: billableWeight, // Store billable weight
                courier: courierCode,
                results: apiResults,
                expires_at: expiresAt,
                hit_count: 1
              });
              console.log(`💾 CACHE SAVED for ${courierCode}:`, cacheKey, `(using ${billableWeight}g)`);
            }
          } catch (error) {
            console.error(`❌ API Error for ${courierCode}:`, error.message);
          }
        }
      }
    } else {
      // Single courier mode
      const cacheKey = generateCacheKey(origin, destination, billableWeight, courier);
      console.log('📦 Checking cache for single courier:', cacheKey);

      const cacheDoc = await getFirestoreDocument('shipping_cache', cacheKey);

      if (cacheDoc.exists && isCacheValid(cacheDoc.data.expires_at)) {
        console.log('✅ CACHE HIT:', cacheKey);
        console.log('📊 Cache stats:', {
          cached_at: cacheDoc.data.cached_at,
          expires_at: cacheDoc.data.expires_at,
          hit_count: cacheDoc.data.hit_count + 1,
          billableWeight: billableWeight,
          weightExplanation: weightInfo.explanation
        });

        // Update hit count
        await setFirestoreDocument('shipping_cache', cacheKey, {
          ...cacheDoc.data,
          hit_count: cacheDoc.data.hit_count + 1
        });

        // Return cached response with weight info
        const cachedResponse = {
          meta: {
            message: 'Success Get Domestic Shipping costs (CACHED)',
            code: 200,
            status: 'success',
            cached: true,
            cached_at: cacheDoc.data.cached_at,
            weightInfo: weightInfo
          },
          data: cacheDoc.data.results
        };

        return res.status(200).json(cachedResponse);
      } else {
        console.log('❌ CACHE MISS:', cacheKey);
        // Fetch from API using BILLABLE weight
        results = await fetchCourierFromAPI(courier, origin, destination, billableWeight, price);

        if (results && results.length > 0) {
          // Save to cache with BILLABLE weight
          const expiresAt = new Date(Date.now() + (CACHE_TTL_HOURS * 60 * 60 * 1000));
          await setFirestoreDocument('shipping_cache', cacheKey, {
            origin,
            destination,
            weight: billableWeight, // Store billable weight
            courier,
            results,
            expires_at: expiresAt,
            hit_count: 1
          });
          console.log('💾 CACHE SAVED:', cacheKey, `(using ${billableWeight}g - ${weightInfo.explanation})`);
        }
      }
    }

    // Return results
    if (getAllCouriers) {
      // Sort by cost (lowest first)
      results.sort((a, b) => a.cost - b.cost);

      const allCouriersResponse = {
        meta: {
          message: 'Success Get All Couriers Domestic Shipping costs',
          code: 200,
          status: 'success',
          cached: cacheHit,
          cache_keys: cacheKeys,
          weightInfo: weightInfo
        },
        data: results
      };

      console.log('📋 ALL COURIERS RESULT:', {
        total_results: results.length,
        cache_hit: cacheHit,
        cache_keys_checked: cacheKeys.length,
        timestamp: new Date().toISOString()
      });

      return res.status(200).json(allCouriersResponse);
    } else {
      // Single courier response
      const response = {
        meta: {
          message: 'Success Get Domestic Shipping costs',
          code: 200,
          status: 'success',
          cached: false
        },
        data: results
      };

      console.log('📋 SINGLE COURIER RESULT:', {
        courier,
        total_results: results.length,
        cache_hit: cacheHit,
        timestamp: new Date().toISOString()
      });

      return res.status(200).json(response);
    }

  } catch (error) {
    console.error('💥 Komerce API Error:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });

    // NO MOCK DATA FALLBACK - Return error directly
    return res.status(500).json({
      meta: {
        message: `API Error: ${error.message}`,
        code: 500,
        status: 'error'
      },
      data: null
    });
  }
}

// Helper function to fetch from Komerce API
async function fetchCourierFromAPI(courierCode, origin, destination, weight, price) {
  try {
    const formData = new URLSearchParams();
    formData.append('origin', origin.toString());
    formData.append('destination', destination.toString());
    formData.append('weight', weight.toString());
    formData.append('courier', courierCode);

    if (price && price !== 'all') {
      formData.append('price', price);
    }

    console.log('📡 Calling Komerce API:', {
      courier: courierCode,
      origin,
      destination,
      weight,
      price
    });

    const response = await fetch(`${KOMERCE_BASE_URL}/calculate/domestic-cost`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'key': KOMERCE_API_KEY
      },
      body: formData.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Komerce API Error:', errorText);
      return null;
    }

    const data = await response.json();

    if (data.meta?.status === 'success' && data.data && data.data.length > 0) {
      console.log(`✅ API Success for ${courierCode}:`, {
        results_count: data.data.length,
        sample_result: data.data[0]
      });
      return data.data;
    }

    return null;
  } catch (error) {
    console.error(`❌ API Error for ${courierCode}:`, error.message);
    return null;
  }
}