// Test Firebase Firestore REST API Connection
const testFirebaseConnection = async () => {
  const FIREBASE_PROJECT_ID = 'azzahra-fashion-muslim-ab416';
  const FIREBASE_API_KEY = 'AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs';

  console.log('🔥 Testing Firebase Firestore REST API Connection...');
  console.log('=====================================================');

  // Test 1: Try to read a document from shipping_cache collection
  const testCacheKey = '607_114_1000_jne';
  const readUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/shipping_cache/${testCacheKey}?key=${FIREBASE_API_KEY}`;

  console.log(`\n📖 Testing READ operation...`);
  console.log(`URL: ${readUrl}`);

  try {
    const response = await fetch(readUrl);
    console.log(`Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ READ Success!');
      console.log('Document exists:', !!data.fields);
      if (data.fields) {
        console.log('Sample data:');
        console.log('- Origin:', data.fields.origin?.stringValue);
        console.log('- Destination:', data.fields.destination?.stringValue);
        console.log('- Cached at:', data.fields.cached_at?.timestampValue);
      }
    } else {
      const errorText = await response.text();
      console.log('❌ READ Failed:', response.status);
      console.log('Error:', errorText);
    }
  } catch (error) {
    console.log('❌ READ Error:', error.message);
  }

  // Test 2: Try to write a test document
  console.log(`\n✏️  Testing WRITE operation...`);
  const writeUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/shipping_cache/test_connection?key=${FIREBASE_API_KEY}`;

  const testData = {
    fields: {
      origin: { stringValue: "607" },
      destination: { stringValue: "114" },
      weight: { integerValue: 1000 },
      courier: { stringValue: "test" },
      results: { stringValue: JSON.stringify([{name: "Test", cost: 1000}]) },
      cached_at: { timestampValue: new Date().toISOString() },
      expires_at: { timestampValue: new Date(Date.now() + 24*60*60*1000).toISOString() },
      hit_count: { integerValue: 1 }
    }
  };

  try {
    const response = await fetch(writeUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    console.log(`Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ WRITE Success!');
      console.log('Document written at:', data.updateTime);
    } else {
      const errorText = await response.text();
      console.log('❌ WRITE Failed:', response.status);
      console.log('Error:', errorText);
    }
  } catch (error) {
    console.log('❌ WRITE Error:', error.message);
  }

  // Test 3: Read back the test document
  console.log(`\n🔄 Testing READ BACK operation...`);
  try {
    const response = await fetch(writeUrl);
    console.log(`Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ READ BACK Success!');
      console.log('Document exists:', !!data.fields);
      console.log('Test data verified:', data.fields.courier?.stringValue === 'test');
    } else {
      const errorText = await response.text();
      console.log('❌ READ BACK Failed:', response.status);
      console.log('Error:', errorText);
    }
  } catch (error) {
    console.log('❌ READ BACK Error:', error.message);
  }

  console.log('\n🎯 Firebase Connection Test Summary:');
  console.log('=====================================');
  console.log('If all tests pass ✅, the caching system should work.');
  console.log('If any test fails ❌, check:');
  console.log('1. Firebase Project ID is correct');
  console.log('2. Firebase API Key is valid');
  console.log('3. Firestore rules allow read/write access');
};

testFirebaseConnection().catch(console.error);