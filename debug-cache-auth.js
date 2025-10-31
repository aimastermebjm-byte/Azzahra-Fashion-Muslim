// Debug authentication for cache management
// This will help us understand what's happening

async function testAuth() {
  console.log('🔍 Testing Firebase Authentication...');

  try {
    // Get current user from Firebase Auth
    const auth = window.firebase ? window.firebase.auth() : null;
    if (!auth) {
      console.error('❌ Firebase Auth not available');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No current user');
      return;
    }

    console.log('✅ Current user found:');
    console.log('   UID:', user.uid);
    console.log('   Email:', user.email);
    console.log('   DisplayName:', user.displayName);
    console.log('   Provider:', user.providerData[0]?.providerId);

    // Get ID token
    const token = await user.getIdToken();
    console.log('✅ ID Token obtained (first 50 chars):', token.substring(0, 50) + '...');

    // Decode token manually to check payload
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      console.log('📋 Token payload:');
      console.log('   User ID:', payload.uid || payload.sub || payload.user_id);
      console.log('   Email:', payload.email);
      console.log('   Name:', payload.name || payload.display_name);
      console.log('   Email verified:', payload.email_verified);
      console.log('   Expires at:', new Date(payload.exp * 1000).toISOString());
      console.log('   Issued at:', new Date(payload.iat * 1000).toISOString());

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        console.error('❌ Token is expired!');
        console.error('   Expired:', new Date(payload.exp * 1000).toISOString());
        console.error('   Current:', new Date(now * 1000).toISOString());
      } else {
        console.log('✅ Token is valid');
      }
    }

    // Test API call with detailed error handling
    console.log('\n🌐 Testing API call...');
    const response = await fetch('/api/admin/cache-settings?action=settings', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 API Response Status:', response.status);
    console.log('📊 API Response Headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.text();
    console.log('📊 API Response Body:', data);

    try {
      const jsonData = JSON.parse(data);
      console.log('✅ API Response JSON:', jsonData);
    } catch (error) {
      console.log('❌ Failed to parse JSON response');
    }

  } catch (error) {
    console.error('❌ Authentication test failed:', error);
  }
}

// Wait for Firebase to load and then test
if (window.firebase) {
  window.firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log('🔥 Firebase Auth state changed - user logged in');
      setTimeout(testAuth, 1000); // Wait a bit for everything to load
    } else {
      console.log('🔥 Firebase Auth state changed - user logged out');
    }
  });
} else {
  console.error('❌ Firebase not loaded');
}

// Manual test function
window.testCacheAuth = testAuth;

console.log('🚀 Cache Auth Debug loaded. Run testCacheAuth() in console to test.');