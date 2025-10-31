// Simple test for cache API without React
// Run this in browser console to test API directly

async function testCacheAPI() {
  console.log('🧪 Testing Cache API directly...');

  try {
    // First, get current user from Firebase Auth
    const auth = window.firebase.auth();
    const user = auth.currentUser;

    if (!user) {
      console.error('❌ No user logged in');
      return;
    }

    console.log('✅ User found:', user.email);

    // Get token
    const token = await user.getIdToken();
    console.log('✅ Token length:', token.length);

    // Decode token to check payload
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    console.log('📋 Token payload:', {
      uid: payload.uid,
      email: payload.email,
      exp: new Date(payload.exp * 1000).toISOString(),
      iat: new Date(payload.iat * 1000).toISOString()
    });

    // Test API call
    console.log('🌐 Calling API...');
    const response = await fetch('https://azzahra-fashion-muslim.vercel.app/api/admin/cache-settings?action=settings', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('📊 Response body:', responseText);

    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('✅ Success:', data);
      } catch (e) {
        console.log('⚠️  Invalid JSON:', responseText);
      }
    } else {
      console.log('❌ API Error:', response.status, responseText);
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Auto-run if Firebase is available
if (window.firebase) {
  setTimeout(testCacheAPI, 2000);
} else {
  console.log('❌ Firebase not available');
}

// Manual trigger
window.testCacheAPI = testCacheAPI;

console.log('🚀 Cache API Test loaded. Run testCacheAPI() in console to test.');