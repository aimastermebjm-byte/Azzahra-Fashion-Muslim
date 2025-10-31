// Debug cache connection - Test direct API calls
// This will help identify where the connection is failing

async function testCacheConnection() {
  console.log('🔍 Testing Cache Management API Connection...');

  try {
    // Test 1: Check if user is authenticated
    console.log('\n1️⃣ Testing Firebase Auth...');
    const auth = window.firebase ? window.firebase.auth() : null;
    if (!auth) {
      console.error('❌ Firebase Auth not available');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No current user - please login first');
      return;
    }

    console.log('✅ User authenticated:', user.email);

    // Get token
    const token = await user.getIdToken();
    console.log('✅ Token obtained successfully');

    // Test 2: Direct API call to list cache
    console.log('\n2️⃣ Testing Cache List API...');
    const listResponse = await fetch('/api/admin/cache-settings?action=list', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Cache List Response Status:', listResponse.status);
    console.log('📊 Cache List Response Headers:', Object.fromEntries(listResponse.headers.entries()));

    const listText = await listResponse.text();
    console.log('📊 Cache List Response Body:', listText);

    if (listResponse.ok) {
      try {
        const listData = JSON.parse(listText);
        console.log('✅ Cache List Success:');
        console.log('   - Total caches:', listData.data?.summary?.total || 0);
        console.log('   - Active caches:', listData.data?.summary?.active || 0);
        console.log('   - Expired caches:', listData.data?.summary?.expired || 0);
        console.log('   - Cache items:', listData.data?.caches?.length || 0);

        if (listData.data?.caches && listData.data.caches.length > 0) {
          console.log('📋 Sample cache item:', listData.data.caches[0]);
        }
      } catch (e) {
        console.error('❌ Failed to parse cache list JSON:', e);
      }
    } else {
      console.error('❌ Cache List API failed:', listResponse.status, listText);
    }

    // Test 3: Direct API call to settings
    console.log('\n3️⃣ Testing Cache Settings API...');
    const settingsResponse = await fetch('/api/admin/cache-settings?action=settings', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Settings Response Status:', settingsResponse.status);

    const settingsText = await settingsResponse.text();
    console.log('📊 Settings Response Body:', settingsText);

    if (settingsResponse.ok) {
      try {
        const settingsData = JSON.parse(settingsText);
        console.log('✅ Settings Success:', settingsData.data?.settings);
      } catch (e) {
        console.error('❌ Failed to parse settings JSON:', e);
      }
    } else {
      console.error('❌ Settings API failed:', settingsResponse.status, settingsText);
    }

    // Test 4: Test direct Firestore REST API
    console.log('\n4️⃣ Testing Direct Firestore Access...');
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/azzahra-fashion-muslim-ab416/databases/(default)/documents/shipping_cache?key=AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs`;

    const firestoreResponse = await fetch(firestoreUrl);
    console.log('📊 Firestore Response Status:', firestoreResponse.status);

    if (firestoreResponse.ok) {
      const firestoreData = await firestoreResponse.json();
      console.log('✅ Firestore Direct Access Success:');
      console.log('   - Documents found:', firestoreData.documents?.length || 0);

      if (firestoreData.documents && firestoreData.documents.length > 0) {
        console.log('📋 Sample Firestore document:', {
          name: firestoreData.documents[0].name,
          fields: firestoreData.documents[0].fields
        });
      }
    } else {
      const errorText = await firestoreResponse.text();
      console.error('❌ Firestore Direct Access failed:', firestoreResponse.status, errorText);
    }

  } catch (error) {
    console.error('💥 Cache Connection Test Failed:', error);
  }
}

// Auto-run if Firebase is available
if (window.firebase) {
  // Wait a bit for Firebase to initialize
  setTimeout(testCacheConnection, 3000);
} else {
  console.error('❌ Firebase not available');
}

// Manual trigger
window.testCacheConnection = testCacheConnection;

console.log('🚀 Cache Connection Debug loaded. Run testCacheConnection() in console to test.');