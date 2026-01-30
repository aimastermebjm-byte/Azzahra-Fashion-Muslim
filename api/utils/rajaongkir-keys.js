/**
 * RajaOngkir API Key Manager with Fallback Support
 * 
 * Features:
 * - Multiple API keys with automatic fallback
 * - Detects rate limit (429) and quota exceeded errors
 * - Automatically switches to next available key
 */

const API_KEYS = [
    'L3abavkD5358dc66be91f537G8MkpZHi',  // Primary key
    'nJFX74nma6890752436be846QFngTohb'   // Secondary key (fallback)
];

const KOMERCE_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

// Track which key is currently active (persists in memory during request lifecycle)
let currentKeyIndex = 0;

/**
 * Check if error indicates rate limit or quota exceeded
 */
function isRateLimitError(response, data) {
    // HTTP 429 Too Many Requests
    if (response.status === 429) return true;

    // Komerce-specific error messages
    if (data?.meta?.status === 'error') {
        const message = (data.meta.message || '').toLowerCase();
        if (message.includes('limit') ||
            message.includes('quota') ||
            message.includes('exceeded') ||
            message.includes('rate')) {
            return true;
        }
    }

    return false;
}

/**
 * Fetch with automatic API key fallback
 * 
 * @param {string} endpoint - API endpoint (e.g., '/calculate/domestic-cost')
 * @param {object} options - Fetch options (method, body, etc.)
 * @param {number} keyIndex - Current key index (for recursion)
 * @returns {Promise<{response: Response, data: any, keyUsed: string}>}
 */
async function fetchWithFallback(endpoint, options = {}, keyIndex = 0) {
    if (keyIndex >= API_KEYS.length) {
        throw new Error('All API keys exhausted - rate limit reached on all keys');
    }

    const apiKey = API_KEYS[keyIndex];
    const url = `${KOMERCE_BASE_URL}${endpoint}`;

    // Merge API key into headers
    const headers = {
        ...options.headers,
        'key': apiKey,
        'Key': apiKey // Some endpoints use different casing
    };

    console.log(`🔑 Using API key #${keyIndex + 1} for ${endpoint}`);

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        // Clone response to read body without consuming it
        const responseClone = response.clone();
        let data;

        try {
            data = await responseClone.json();
        } catch {
            // Response might not be JSON
            data = null;
        }

        // Check if rate limited
        if (isRateLimitError(response, data)) {
            console.warn(`⚠️ API key #${keyIndex + 1} rate limited, trying next key...`);
            return fetchWithFallback(endpoint, options, keyIndex + 1);
        }

        // Success - update current key index for subsequent requests
        currentKeyIndex = keyIndex;

        return {
            response,
            data,
            keyUsed: apiKey,
            keyIndex: keyIndex + 1
        };

    } catch (error) {
        // Network error - might be temporary, try next key
        console.error(`❌ Network error with key #${keyIndex + 1}:`, error.message);

        if (keyIndex + 1 < API_KEYS.length) {
            console.log(`🔄 Retrying with next key...`);
            return fetchWithFallback(endpoint, options, keyIndex + 1);
        }

        throw error;
    }
}

/**
 * Get current active API key
 */
function getCurrentKey() {
    return API_KEYS[currentKeyIndex];
}

/**
 * Get all available keys count
 */
function getKeysCount() {
    return API_KEYS.length;
}

/**
 * Reset to primary key (useful for daily reset)
 */
function resetToFirstKey() {
    currentKeyIndex = 0;
}

module.exports = {
    fetchWithFallback,
    getCurrentKey,
    getKeysCount,
    resetToFirstKey,
    KOMERCE_BASE_URL,
    API_KEYS
};
