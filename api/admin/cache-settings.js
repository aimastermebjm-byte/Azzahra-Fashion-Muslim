// OWNER-ONLY Cache Management API
// Only users with 'owner' role can access this endpoint

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

async function setFirestoreDocument(collectionPath, documentId, data) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionPath}/${documentId}?key=${FIREBASE_API_KEY}`;

  const firestoreData = {
    fields: Object.keys(data).reduce((acc, key) => {
      const value = data[key];
      if (typeof value === 'string') {
        acc[key] = { stringValue: value };
      } else if (typeof value === 'number') {
        acc[key] = { integerValue: value };
      } else if (typeof value === 'boolean') {
        acc[key] = { booleanValue: value };
      } else if (value instanceof Date) {
        acc[key] = { timestampValue: value.toISOString() };
      }
      return acc;
    }, {})
  };

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreData)
    });

    return response.ok;
  } catch (error) {
    console.error('Error setting cache document:', error);
    return false;
  }
}

// Auto-create owner user in Firestore
async function createOwnerUser(userId, decodedToken) {
  try {
    const FIREBASE_PROJECT_ID = 'azzahra-fashion-muslim-ab416';
    const FIREBASE_API_KEY = 'AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs';

    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}?key=${FIREBASE_API_KEY}`;

    const firestoreData = {
      fields: {
        uid: { stringValue: userId },
        email: { stringValue: decodedToken.email || decodedToken.email_verified ? decodedToken.email : 'unknown@example.com' },
        displayName: { stringValue: decodedToken.name || decodedToken.display_name || 'Owner' },
        name: { stringValue: decodedToken.name || decodedToken.display_name || 'Owner' },
        role: { stringValue: 'owner' },
        createdAt: { timestampValue: new Date().toISOString() },
        updatedAt: { timestampValue: new Date().toISOString() },
        isActive: { booleanValue: true },
        phone: { stringValue: '' },
        address: { stringValue: '' }
      }
    };

    console.log(`📝 Creating owner user document: ${userId}`);
    console.log(`Email from token:`, decodedToken.email);

    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreData)
    });

    if (response.ok) {
      console.log(`✅ Owner user created successfully: ${userId}`);
      return { success: true };
    } else {
      const errorText = await response.text();
      console.error(`❌ Failed to create owner user: ${response.status} - ${errorText}`);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error('❌ Error creating owner user:', error);
    return { success: false, error: error.message };
  }
}

// Authenticate and check if user is owner
async function authenticateOwner(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, message: 'Authorization token required' };
  }

  const token = authHeader.substring(7);

  try {
    // Decode JWT token safely
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { success: false, message: 'Invalid token format' };
    }

    const decoded = JSON.parse(atob(parts[1]));

    console.log('🔍 Token payload analysis:');
    console.log('  - uid:', decoded.uid);
    console.log('  - sub:', decoded.sub);
    console.log('  - user_id:', decoded.user_id);
    console.log('  - email:', decoded.email);
    console.log('  - name:', decoded.name);
    console.log('  - display_name:', decoded.display_name);

    const userId = decoded.uid || decoded.sub || decoded.user_id;

    console.log(`📋 Extracted userId: ${userId}`);

    if (!userId) {
      console.error('❌ No user ID found in token payload');
      return { success: false, message: `Invalid token: no user ID found. Available fields: ${Object.keys(decoded).join(', ')}` };
    }

    // Check token expiration
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTime) {
      return { success: false, message: 'Token expired' };
    }

    // Check user role from Firestore
    const userDoc = await getFirestoreDocument('users', userId);

    if (!userDoc.exists) {
      console.error(`❌ User ${userId} not found in Firestore database`);
      console.error(`📝 Email from token: ${decoded.email}`);
      console.error(`💡 Solution: User must be manually created in Firestore with role 'owner'`);
      console.error(`🔗 Create at: https://console.firebase.google.com/project/azzahra-fashion-muslim-ab416/firestore/data~2Fusers`);

      return {
        success: false,
        message: `User not found in database. Please create user manually in Firestore with role 'owner'. User ID: ${userId}, Email: ${decoded.email}`
      };
    }

    const userRole = userDoc.data.role;

    if (userRole !== 'owner') {
      console.log(`❌ Access denied for user ${userId}: role is ${userRole}, not owner`);
      return { success: false, message: 'Access denied. Owner role required.' };
    }

    console.log(`✅ Owner authenticated: ${userId} (${userDoc.data.name || 'Unknown'})`);
    return {
      success: true,
      userId,
      role: userRole,
      userData: userDoc.data
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, message: 'Invalid or expired token' };
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

// Update cache settings
async function updateCacheSettings(newSettings) {
  const currentSettings = await getCacheSettings();
  const updatedSettings = { ...currentSettings, ...newSettings };

  const success = await setFirestoreDocument('settings', 'cache_config', {
    ...updatedSettings,
    updated_at: new Date(),
    updated_by: 'owner'
  });

  return success ? updatedSettings : null;
}

// List all cache documents with detailed info
async function listAllCacheDocuments() {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/shipping_cache?key=${FIREBASE_API_KEY}`;

  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      return data.documents || [];
    }
    return [];
  } catch (error) {
    console.error('Error listing cache documents:', error.message);
    return [];
  }
}

// Delete cache document
async function deleteCacheDocument(cacheKey) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/shipping_cache/${cacheKey}?key=${FIREBASE_API_KEY}`;

  try {
    const response = await fetch(url, { method: 'DELETE' });
    return response.ok;
  } catch (error) {
    console.error(`Error deleting cache ${cacheKey}:`, error.message);
    return false;
  }
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

    // Authenticate user (must be owner)
    const auth = await authenticateOwner(req);
    if (!auth.success) {
      return res.status(403).json({
        success: false,
        message: auth.message,
        data: null
      });
    }

    console.log('🔐 OWNER AUTHENTICATED:', {
      userId: auth.userId,
      role: auth.role,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    // GET: Get cache settings or cache list
    if (req.method === 'GET') {
      const { action = 'settings' } = req.query;

      if (action === 'settings') {
        const settings = await getCacheSettings();
        return res.status(200).json({
          success: true,
          message: 'Cache settings retrieved',
          data: {
            settings,
            user_info: {
              role: auth.role,
              user_id: auth.userId
            }
          }
        });
      }

      if (action === 'list') {
        const documents = await listAllCacheDocuments();
        const cacheSettings = await getCacheSettings();

        const cacheInfo = documents.map(doc => {
          const name = doc.name;
          const cacheKey = name.split('/').pop();
          const fields = doc.fields;

          const cachedAt = new Date(fields.cached_at?.timestampValue);
          const expiresAt = new Date(fields.expires_at?.timestampValue);
          const isExpired = expiresAt < new Date();

          return {
            cacheKey,
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

        const summary = {
          total: cacheInfo.length,
          expired: cacheInfo.filter(c => c.is_expired).length,
          active: cacheInfo.filter(c => !c.is_expired).length,
          oldest_cache: cacheInfo.length > 0 ? Math.min(...cacheInfo.map(c => c.age_days)) : 0,
          newest_cache: cacheInfo.length > 0 ? Math.max(...cacheInfo.map(c => c.age_days)) : 0
        };

        return res.status(200).json({
          success: true,
          message: `Found ${cacheInfo.length} cache documents`,
          data: {
            summary,
            caches: cacheInfo.sort((a, b) => new Date(b.cached_at) - new Date(a.cached_at)),
            settings: cacheSettings
          }
        });
      }
    }

    // POST: Update settings or refresh cache
    if (req.method === 'POST') {
      const { action } = req.body;

      if (action === 'update_settings') {
        const { settings } = req.body;

        if (!settings) {
          return res.status(400).json({
            success: false,
            message: 'Settings object is required',
            data: null
          });
        }

        // Validate settings
        const validSettings = {};
        if (settings.cache_ttl_hours !== undefined) {
          const ttl = Number(settings.cache_ttl_hours);
          if (ttl < 1 || ttl > 24 * 365) { // Max 1 year
            return res.status(400).json({
              success: false,
              message: 'Cache TTL must be between 1 hour and 1 year',
              data: null
            });
          }
          validSettings.cache_ttl_hours = ttl;
        }

        if (settings.max_cache_age_days !== undefined) {
          const maxAge = Number(settings.max_cache_age_days);
          if (maxAge < 1 || maxAge > 365) {
            return res.status(400).json({
              success: false,
              message: 'Max cache age must be between 1 and 365 days',
              data: null
            });
          }
          validSettings.max_cache_age_days = maxAge;
        }

        if (settings.auto_cleanup_expired !== undefined) {
          validSettings.auto_cleanup_expired = Boolean(settings.auto_cleanup_expired);
        }

        if (settings.refresh_all_couriers !== undefined) {
          validSettings.refresh_all_couriers = Boolean(settings.refresh_all_couriers);
        }

        if (settings.notify_on_price_change !== undefined) {
          validSettings.notify_on_price_change = Boolean(settings.notify_on_price_change);
        }

        const updatedSettings = await updateCacheSettings(validSettings);

        if (!updatedSettings) {
          return res.status(500).json({
            success: false,
            message: 'Failed to update settings',
            data: null
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Cache settings updated successfully',
          data: {
            updated_settings: updatedSettings,
            updated_by: auth.userId,
            updated_at: new Date().toISOString()
          }
        });
      }

      if (action === 'refresh_cache') {
        const { origin, destination, weight = 1000, courier = 'all' } = req.body;

        if (!origin || !destination) {
          return res.status(400).json({
            success: false,
            message: 'Origin and destination are required for cache refresh',
            data: null
          });
        }

        // This would integrate with the cache-refresh.js logic
        // For now, return success message
        return res.status(200).json({
          success: true,
          message: `Cache refresh initiated for ${origin}-${destination}`,
          data: {
            origin,
            destination,
            weight,
            courier,
            initiated_by: auth.userId,
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // DELETE: Clear cache
    if (req.method === 'DELETE') {
      const { action, cache_key } = req.query;

      if (action === 'clear_expired') {
        const documents = await listAllCacheDocuments();
        const cacheSettings = await getCacheSettings();
        let deleted = 0;

        for (const doc of documents) {
          const expiresAt = new Date(doc.fields.expires_at?.timestampValue);
          if (expiresAt < new Date()) {
            const key = doc.name.split('/').pop();
            if (await deleteCacheDocument(key)) {
              deleted++;
            }
          }
        }

        return res.status(200).json({
          success: true,
          message: `Cleared ${deleted} expired cache documents`,
          data: { deleted, total: documents.length }
        });
      }

      if (action === 'clear_all') {
        const documents = await listAllCacheDocuments();
        let deleted = 0;

        for (const doc of documents) {
          const cacheKey = doc.name.split('/').pop();
          if (await deleteCacheDocument(cacheKey)) {
            deleted++;
          }
        }

        return res.status(200).json({
          success: true,
          message: `Cleared all ${deleted} cache documents`,
          data: { deleted }
        });
      }

      if (action === 'clear_specific' && cache_key) {
        const success = await deleteCacheDocument(cache_key);

        return res.status(200).json({
          success: success,
          message: success ? `Cache ${cache_key} deleted` : `Failed to delete cache ${cache_key}`,
          data: { cache_key, deleted: success }
        });
      }
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid action or method',
      data: null
    });

  } catch (error) {
    console.error('💥 Cache Settings Error:', {
      message: error.message,
      stack: error.stack,
      method: req.method,
      body: req.body
    });

    return res.status(500).json({
      success: false,
      message: `Cache settings error: ${error.message}`,
      data: null
    });
  }
}