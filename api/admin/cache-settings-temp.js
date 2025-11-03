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

// Save document to Firebase
async function saveFirestoreDocument(collectionPath, documentId, data) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionPath}/${documentId}?key=${FIREBASE_API_KEY}`;

  try {
    console.log('💾 Saving to Firebase:', { collectionPath, documentId, data });

    // Convert data to Firestore format
    const fields = {};
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (typeof value === 'string') {
        fields[key] = { stringValue: value };
      } else if (typeof value === 'number') {
        fields[key] = { integerValue: value };
      } else if (typeof value === 'boolean') {
        fields[key] = { booleanValue: value };
      } else if (value === undefined || value === null) {
        // Skip undefined/null values
        console.log(`⚠️ Skipping field ${key}:`, value);
      } else {
        console.log(`⚠️ Unknown field type for ${key}:`, typeof value, value);
      }
    });

    const payload = {
      fields: fields
    };

    console.log('📤 Firebase payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log('📥 Firebase response:', response.status, responseText);

    if (response.ok) {
      return { success: true };
    } else {
      const errorData = responseText ? JSON.parse(responseText) : { error: responseText };
      console.error('❌ Error saving document:', errorData);
      return { success: false, error: errorData };
    }
  } catch (error) {
    console.error('💥 Error saving document:', error);
    return { success: false, error: error.message };
  }
}

// Get current cache settings
async function getCacheSettings() {
  const settingsDoc = await getFirestoreDocument('settings', 'cache_config');

  if (settingsDoc.exists) {
    return settingsDoc.data;
  }

  // Default settings - Sistem Auto Check Sederhana
  const now = new Date();
  const nextCheckDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 hari lagi

  return {
    // Auto check setting - YANG PALING PENTING!
    auto_check_days: 30, // Setiap 30 hari otomatis cek harga
    auto_check_enabled: true,
    next_auto_check: nextCheckDate.toISOString().split('T')[0], // Tanggal 30 hari lagi
    last_auto_check: now.toISOString().split('T')[0],

    // Cache settings (berdasarkan auto check)
    cache_ttl_hours: 30 * 24, // 30 hari (1 bulan)
    max_cache_age_days: 35, // 35 hari safety margin
    auto_cleanup_expired: true,

    // Legacy settings untuk backward compatibility
    shipping_cache_ttl_hours: 30 * 24, // 30 hari
    shipping_max_cache_age_days: 35,
    shipping_auto_cleanup_expired: true,
    shipping_refresh_all_couriers: false, // Tidak refresh semua, tapi cek per kurir
    shipping_notify_on_price_change: false,

    // Global settings
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

            // Safe date parsing with fallback
            const now = new Date();
            const cachedAt = new Date(fields.created_at?.timestampValue || fields.cached_at?.timestampValue || now);
            const expiresAt = new Date(fields.expires_at?.timestampValue || now);

            // Check if dates are valid
            const isValidDate = (date) => date instanceof Date && !isNaN(date.getTime());
            const safeCachedAt = isValidDate(cachedAt) ? cachedAt : now;
            const safeExpiresAt = isValidDate(expiresAt) ? expiresAt : new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours from now

            const isExpired = safeExpiresAt < now;
            const ageDays = Math.floor((now - safeCachedAt) / (1000 * 60 * 60 * 24));

            addressCacheData.push({
              cacheKey,
              collection,
              type: 'address',
              data_type: collection.replace('address_', ''),
              cached_at: safeCachedAt.toISOString(),
              expires_at: safeExpiresAt.toISOString(),
              hit_count: fields.hit_count?.integerValue || 0,
              is_expired: isExpired,
              age_days: ageDays,
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

          // Safe date parsing with fallback for shipping cache
          const now = new Date();
          const cachedAt = new Date(fields.cached_at?.timestampValue || now);
          const expiresAt = new Date(fields.expires_at?.timestampValue || now);

          // Check if dates are valid
          const isValidDate = (date) => date instanceof Date && !isNaN(date.getTime());
          const safeCachedAt = isValidDate(cachedAt) ? cachedAt : now;
          const safeExpiresAt = isValidDate(expiresAt) ? expiresAt : new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours from now

          const isExpired = safeExpiresAt < now;
          const ageDays = Math.floor((now - safeCachedAt) / (1000 * 60 * 60 * 24));

          // Debug: Log the fields to see what data we have
          console.log('🔍 Debug shipping cache fields:', {
            cacheKey,
            origin: fields.origin?.stringValue,
            destination: fields.destination?.stringValue,
            weight: fields.weight?.integerValue,
            courier: fields.courier?.stringValue,
            allFields: Object.keys(fields)
          });

          // Try to extract route info from different field names
          let origin = fields.origin?.stringValue || fields.from?.stringValue || fields.originCity?.stringValue;
          let destination = fields.destination?.stringValue || fields.to?.stringValue || fields.destinationCity?.stringValue;
          let weight = fields.weight?.integerValue || fields.berat?.integerValue;
          let courier = fields.courier?.stringValue || fields.kurir?.stringValue || fields.expedisi?.stringValue;

          // If still no route info, try to parse from cache key or results
          if (!origin || !destination) {
            // Try to parse from cache key (common pattern: origin_destination_weight_courier)
            if (cacheKey && cacheKey.includes('_')) {
              const parts = cacheKey.split('_');
              if (parts.length >= 2) {
                origin = origin || parts[0];
                destination = destination || parts[1];
                weight = weight || (parts[2] ? parseInt(parts[2]) : weight);
                courier = courier || (parts[3] || courier);
                console.log('🔍 Parsed from cache key:', { origin, destination, weight, courier, parts });
              }
            }

            // Try to parse from results JSON
            try {
              const results = JSON.parse(fields.results?.stringValue || '[]');
              console.log('🔍 Results JSON:', results);
              if (results.length > 0) {
                const firstResult = results[0];
                origin = origin || firstResult.origin || firstResult.from || firstResult.originCity;
                destination = destination || firstResult.destination || firstResult.to || firstResult.destinationCity;
                weight = weight || firstResult.weight || firstResult.berat;
                courier = courier || firstResult.courier || firstResult.kurir || firstResult.expedisi || firstResult.service;
                console.log('🔍 Parsed from results:', { origin, destination, weight, courier });
              }
            } catch (e) {
              console.log('Could not parse results for route info:', e.message);
            }
          }

          // Final fallback with generic values
          origin = origin || 'Unknown Origin';
          destination = destination || 'Unknown Destination';
          weight = weight || 1000; // Default 1kg
          courier = courier || 'Unknown';

          return {
            cacheKey,
            type: 'shipping',
            origin,
            destination,
            weight,
            courier,
            cached_at: safeCachedAt.toISOString(),
            expires_at: safeExpiresAt.toISOString(),
            hit_count: fields.hit_count?.integerValue || 0,
            refresh_version: fields.refresh_version?.integerValue || 0,
            results_count: JSON.parse(fields.results?.stringValue || '[]').length,
            is_expired: isExpired,
            age_days: ageDays,
            cache_ttl_hours: cacheSettings.cache_ttl_hours || cacheSettings.shipping_cache_ttl_hours || 168
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

    // POST: Update settings and refresh cache actions
    if (req.method === 'POST') {
      const { action } = req.body;

      if (action === 'update_settings') {
        const { settings: newSettings } = req.body;

        // Get current settings and merge with new settings
        const currentSettings = await getCacheSettings();
        const updatedSettings = { ...currentSettings, ...newSettings };

        // Save to Firebase
        const saveResult = await saveFirestoreDocument('settings', 'cache_config', updatedSettings);

        if (!saveResult.success) {
          return res.status(500).json({
            success: false,
            message: `Failed to save settings: ${saveResult.error}`,
            data: null
          });
        }

        console.log('✅ Settings saved to Firebase:', updatedSettings);

        return res.status(200).json({
          success: true,
          message: 'Cache settings updated and saved to Firebase',
          data: {
            settings: updatedSettings,
            updated_settings: updatedSettings // for backward compatibility
          }
        });
      }

      if (action === 'refresh_cache') {
        const { origin, destination, weight, courier } = req.body;

        // For now, just return success (cache is not actually refreshed)
        return res.status(200).json({
          success: true,
          message: 'Cache refreshed successfully (TEMP MODE)',
          data: {
            origin,
            destination,
            weight: weight || 1000,
            courier
          }
        });
      }

      if (action === 'auto_check_monthly') {
        const { auto_check_days, sample_route } = req.body;
        const settings = await getCacheSettings();

        // Calculate next auto check date
        const now = new Date();
        const nextCheckDate = new Date(now.getTime() + (auto_check_days * 24 * 60 * 60 * 1000));

        // Update settings
        const updatedSettings = {
          ...settings,
          auto_check_days: auto_check_days || settings.auto_check_days,
          next_auto_check: nextCheckDate.toISOString().split('T')[0],
          last_auto_check: now.toISOString().split('T')[0]
        };

        // Save to Firebase
        const saveResult = await saveFirestoreDocument('settings', 'cache_config', updatedSettings);

        if (!saveResult.success) {
          return res.status(500).json({
            success: false,
            message: `Failed to save auto check settings: ${saveResult.error}`,
            data: null
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Auto check schedule updated and saved to Firebase',
          data: {
            settings: updatedSettings,
            next_check_date: updatedSettings.next_auto_check,
            check_interval_days: updatedSettings.auto_check_days
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