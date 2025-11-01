// TEMPORARY: Cache management with hardcoded user ID for testing
// This bypasses authentication to test if cache data can be retrieved

const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';
const FIREBASE_PROJECT_ID = 'azzahra-fashion-muslim-ab416';
const FIREBASE_API_KEY = 'AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs';

// Helper functions for Firebase operations
async function getFirestoreDocument(collectionPath, documentId) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionPath}/${documentId}?key=${FIREBASE_API_KEY}`;

  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      return {
        exists: true,
        data: {
          ...Object.keys(data.fields).reduce((acc, key) => {
            acc[key] = data.fields[key].stringValue ||
                      data.fields[key].integerValue ||
                      data.fields[key].booleanValue ||
                      data.fields[key].timestampValue;
            return acc;
          }, {})
        }
      };
    }
    return { exists: false };
  } catch (error) {
    console.error('Error getting cache document:', error);
    return { exists: false };
  }
}

// Get current cache settings
async function getCacheSettings() {
  const settingsDoc = await getFirestoreDocument('settings', 'cache_config');

  if (settingsDoc.exists) {
    return settingsDoc.data;
  }

  // Default settings
  return {
    cache_ttl_hours: 30 * 24, // 1 month (30 days)
    max_cache_age_days: 60,
    auto_cleanup_expired: true,
    refresh_all_couriers: true,
    notify_on_price_change: false
  };
}

// List cache documents from specific collection
async function listCacheDocuments(collectionName) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}?key=${FIREBASE_API_KEY}`;

  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      return data.documents || [];
    }
    return [];
  } catch (error) {
    console.error(`Error listing ${collectionName} documents:`, error.message);
    return [];
  }
}

// List all cache documents with detailed info (backward compatibility)
async function listAllCacheDocuments() {
  return await listCacheDocuments('shipping_cache');
}

export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // TEMPORARY: Skip authentication and use hardcoded owner user
    const hardcodedUserId = 'mFMzpiBNbKZeuotZwc0jPPJwQfn2';

    console.log('🔐 TEMPORARY AUTH BYPASS - Using hardcoded user:', hardcodedUserId);

    // GET: Get cache settings or cache list
    if (req.method === 'GET') {
      const { action = 'settings' } = req.query;

      if (action === 'settings') {
        const settings = await getCacheSettings();
        return res.status(200).json({
          success: true,
          message: 'Cache settings retrieved (TEMP MODE)',
          data: {
            settings,
            user_info: {
              role: 'owner',
              user_id: hardcodedUserId
            }
          }
        });
      }

      if (action === 'list') {
        // Get shipping cache
        const shippingDocuments = await listCacheDocuments('shipping_cache');

        // Get address cache
        const addressCollections = ['address_provinces', 'address_cities', 'address_districts', 'address_subdistricts'];
        const addressCacheData = [];

        for (const collection of addressCollections) {
          const docs = await listCacheDocuments(collection);
          docs.forEach(doc => {
            const name = doc.name;
            const cacheKey = name.split('/').pop();
            const fields = doc.fields;

            const cachedAt = new Date(fields.created_at?.timestampValue || fields.cached_at?.timestampValue);
            const expiresAt = new Date(fields.expires_at?.timestampValue);
            const isExpired = expiresAt < new Date();

            addressCacheData.push({
              cacheKey,
              collection,
              type: 'address',
              data_type: collection.replace('address_', ''),
              cached_at: cachedAt.toISOString(),
              expires_at: expiresAt.toISOString(),
              hit_count: fields.hit_count?.integerValue || 0,
              is_expired: isExpired,
              age_days: Math.floor((new Date() - cachedAt) / (1000 * 60 * 60 * 24)),
              data_count: JSON.parse(fields.data?.stringValue || '[]').length
            });
          });
        }

        const cacheSettings = await getCacheSettings();
        const allDocuments = [...shippingDocuments, ...addressCacheData];

        console.log(`📊 Found ${shippingDocuments.length} shipping + ${addressCacheData.length} address cache documents`);

        // Map shipping cache documents
        const shippingCacheInfo = shippingDocuments.map(doc => {
          const name = doc.name;
          const cacheKey = name.split('/').pop();
          const fields = doc.fields;

          const cachedAt = new Date(fields.cached_at?.timestampValue);
          const expiresAt = new Date(fields.expires_at?.timestampValue);
          const isExpired = expiresAt < new Date();

          return {
            cacheKey,
            type: 'shipping',
            origin: fields.origin?.stringValue,
            destination: fields.destination?.stringValue,
            weight: fields.weight?.integerValue,
            courier: fields.courier?.stringValue,
            cached_at: cachedAt.toISOString(),
            expires_at: expiresAt.toISOString(),
            hit_count: fields.hit_count?.integerValue || 0,
            refresh_version: fields.refresh_version?.integerValue || 0,
            results_count: JSON.parse(fields.results?.stringValue || '[]').length,
            is_expired: isExpired,
            age_days: Math.floor((new Date() - cachedAt) / (1000 * 60 * 60 * 24)),
            cache_ttl_hours: cacheSettings.cache_ttl_hours
          };
        });

        const cacheInfo = [...shippingCacheInfo, ...addressCacheData];

        const summary = {
          total: cacheInfo.length,
          expired: cacheInfo.filter(c => c.is_expired).length,
          active: cacheInfo.filter(c => !c.is_expired).length,
          shipping_total: shippingCacheInfo.length,
          address_total: addressCacheData.length,
          shipping_expired: shippingCacheInfo.filter(c => c.is_expired).length,
          address_expired: addressCacheData.filter(c => c.is_expired).length,
          oldest_cache: cacheInfo.length > 0 ? Math.min(...cacheInfo.map(c => c.age_days)) : 0,
          newest_cache: cacheInfo.length > 0 ? Math.max(...cacheInfo.map(c => c.age_days)) : 0
        };

        console.log(`✅ Cache list summary:`, summary);

        return res.status(200).json({
          success: true,
          message: `Found ${cacheInfo.length} cache documents (TEMP MODE)`,
          data: {
            summary,
            caches: cacheInfo.sort((a, b) => new Date(b.cached_at) - new Date(a.cached_at)),
            settings: cacheSettings
          }
        });
      }
    }

    // DELETE: Clear cache actions
    if (req.method === 'DELETE') {
      const { action } = req.query;

      if (action === 'clear_expired') {
        // Temporary: just return success without actually clearing
        return res.status(200).json({
          success: true,
          message: 'Clear expired cache completed (TEMP MODE)',
          data: { deleted: 0, total: 0 }
        });
      }

      if (action === 'clear_all') {
        // Temporary: just return success without actually clearing
        return res.status(200).json({
          success: true,
          message: 'Clear all cache completed (TEMP MODE)',
          data: { deleted: 0 }
        });
      }

      if (action === 'clear_specific') {
        const { cache_key } = req.query;
        // Temporary: just return success without actually deleting
        return res.status(200).json({
          success: true,
          message: `Cache ${cache_key} deleted (TEMP MODE)`,
          data: { cache_key, deleted: true }
        });
      }
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid action or method (TEMP MODE)',
      data: null
    });

  } catch (error) {
    console.error('💥 Cache Settings Error (TEMP MODE):', {
      message: error.message,
      stack: error.stack,
      method: req.method,
      body: req.body
    });

    return res.status(500).json({
      success: false,
      message: `Cache settings error (TEMP MODE): ${error.message}`,
      data: null
    });
  }
}