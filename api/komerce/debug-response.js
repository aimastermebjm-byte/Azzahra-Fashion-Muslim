// Debug Komerce API Response Structure
// Simple endpoint to see raw response format

const KOMERCE_API_KEY = 'L3abavkD5358dc66be91f537G8MkpZHi';
const KOMERCE_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

export default async function handler(req, res) {
  try {
    console.log('🔍 Debug: Testing raw Komerce API response...');

    // Test just provinces endpoint
    const response = await fetch(`${KOMERCE_BASE_URL}/destination/province`, {
      method: 'GET',
      headers: {
        'Key': KOMERCE_API_KEY
      }
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    console.log('Raw response type:', typeof data);
    console.log('Raw response is array:', Array.isArray(data));
    console.log('Raw response keys:', Object.keys(data));
    console.log('Raw response length:', data.length);
    console.log('Raw response sample:', JSON.stringify(data, null, 2));

    return res.status(200).json({
      success: true,
      message: 'Debug completed - check Vercel logs for raw response',
      responseType: typeof data,
      isArray: Array.isArray(data),
      keys: Object.keys(data),
      length: data.length,
      sampleData: data
    });

  } catch (error) {
    console.error('Debug error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}