// Debug Address Cache API - Verbose logging for testing
// Test endpoint to debug cache creation issues

const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';
const FIREBASE_PROJECT_ID = 'azzahra-fashion-muslim-ab416';
const FIREBASE_API_KEY = 'AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs';

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
    console.log(`🔍 DEBUG Address API request: type=${type}, provinceId=${provinceId}, cityId=${cityId}, districtId=${districtId}`);

    // Test cache write directly
    const testCacheKey = `debug_test_${Date.now()}`;
    const testCollection = 'address_test_debug';
    const testData = [{ test: 'data', timestamp: new Date().toISOString() }];

    console.log('🧪 Testing cache write...');

    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${testCollection}/${testCacheKey}?key=${FIREBASE_API_KEY}`;

    const firestoreData = {
      fields: {
        data: { stringValue: JSON.stringify(testData) },
        expires_at: { timestampValue: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString() },
        created_at: { timestampValue: new Date().toISOString() },
        hit_count: { integerValue: 1 }
      }
    };

    console.log('📝 Sending to Firestore URL:', url);
    console.log('📦 Data payload:', JSON.stringify(firestoreData, null, 2));

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(firestoreData)
    });

    console.log('📬 Firestore response status:', response.status);
    console.log('📬 Firestore response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('📬 Firestore response body:', responseText);

    const result = {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      response: responseText,
      testKey: testCacheKey,
      collection: testCollection,
      data: testData
    };

    if (response.ok) {
      console.log('✅ Cache write test SUCCESSFUL');
      return res.status(200).json({
        success: true,
        message: 'Cache write test successful',
        data: result
      });
    } else {
      console.error('❌ Cache write test FAILED');
      return res.status(500).json({
        success: false,
        message: 'Cache write test failed',
        data: result
      });
    }

  } catch (error) {
    console.error('💥 Debug API Error:', {
      message: error.message,
      stack: error.stack,
      query: req.query
    });

    return res.status(500).json({
      success: false,
      message: `Debug API error: ${error.message}`,
      data: {
        error: error.message,
        stack: error.stack
      }
    });
  }
}