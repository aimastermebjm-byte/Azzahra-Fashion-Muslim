// Debug token payload and user ID extraction
// This will help identify why user ID doesn't match Firestore

async function debugTokenUserId() {
  console.log('🔍 Debugging Token and User ID...');

  try {
    // Get current user
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

    console.log('✅ Firebase Auth User Info:');
    console.log('   - UID:', user.uid);
    console.log('   - Email:', user.email);
    console.log('   - DisplayName:', user.displayName);

    // Get ID token
    const token = await user.getIdToken();
    console.log('✅ Token obtained (length):', token.length);

    // Decode token manually
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(atob(parts[1]));
        console.log('📋 Token Payload:');
        console.log('   - uid:', payload.uid);
        console.log('   - sub:', payload.sub);
        console.log('   - user_id:', payload.user_id);
        console.log('   - email:', payload.email);
        console.log('   - email_verified:', payload.email_verified);
        console.log('   - name:', payload.name);
        console.log('   - display_name:', payload.display_name);
        console.log('   - All fields:', Object.keys(payload));

        // Determine which ID will be used
        const extractedUserId = payload.uid || payload.sub || payload.user_id;
        console.log('🎯 Extracted User ID (what API will use):', extractedUserId);

        // Check what's in Firestore for this user
        console.log('\n🔥 Checking Firestore for extracted user ID...');
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/azzahra-fashion-muslim-ab416/databases/(default)/documents/users/${extractedUserId}?key=AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs`;

        const response = await fetch(firestoreUrl);
        console.log('📊 Firestore Response Status:', response.status);

        if (response.ok) {
          const userData = await response.json();
          console.log('✅ User found in Firestore:');
          console.log('   - Role:', userData.fields?.role?.stringValue);
          console.log('   - Email:', userData.fields?.email?.stringValue);
          console.log('   - Name:', userData.fields?.name?.stringValue);
        } else if (response.status === 404) {
          console.error('❌ User NOT found in Firestore with extracted ID');
          console.error('💡 This is the problem! User exists but with different ID');

          // Let's also check with Firebase Auth UID
          console.log('\n🔥 Checking Firestore with Firebase Auth UID...');
          const authUidUrl = `https://firestore.googleapis.com/v1/projects/azzahra-fashion-muslim-ab416/databases/(default)/documents/users/${user.uid}?key=AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs`;

          const authUidResponse = await fetch(authUidUrl);
          console.log('📊 Firestore Auth UID Response Status:', authUidResponse.status);

          if (authUidResponse.ok) {
            const authUidData = await authUidResponse.json();
            console.log('✅ User found with Firebase Auth UID:');
            console.log('   - Role:', authUidData.fields?.role?.stringValue);
            console.log('   - Email:', authUidData.fields?.email?.stringValue);
            console.log('💡 SOLUTION: Use Firebase Auth UID instead of token payload');
          } else {
            console.error('❌ User not found with Firebase Auth UID either');
          }
        } else {
          const errorText = await response.text();
          console.error('❌ Firestore error:', response.status, errorText);
        }

        // Test API call with current token
        console.log('\n🌐 Testing Cache API with current token...');
        const apiResponse = await fetch('/api/admin/cache-settings?action=settings', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('📊 API Response Status:', apiResponse.status);
        const apiText = await apiResponse.text();
        console.log('📊 API Response:', apiText);

      } catch (e) {
        console.error('❌ Failed to decode token payload:', e);
      }
    } else {
      console.error('❌ Invalid token format');
    }

  } catch (error) {
    console.error('💥 Token Debug Failed:', error);
  }
}

// Make function available globally
window.debugTokenUserId = debugTokenUserId;

console.log('🚀 Token User ID Debug loaded. Run debugTokenUserId() in console to debug.');