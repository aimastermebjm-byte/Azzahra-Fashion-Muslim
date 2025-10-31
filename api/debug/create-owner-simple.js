// Simple API to create owner without authentication
// TEMPORARY DEBUG ONLY - REMOVE IN PRODUCTION

export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        message: 'Debug create-owner API is running',
        usage: 'POST with uid, email, displayName fields'
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed',
        data: null
      });
    }

    const { uid, email, displayName } = req.body;

    if (!uid || !email) {
      return res.status(400).json({
        success: false,
        message: 'uid and email are required',
        received: { uid, email, displayName }
      });
    }

    console.log('👤 Creating owner user (DEBUG API):', { uid, email, displayName });

    const FIREBASE_PROJECT_ID = 'azzahra-fashion-muslim-ab416';
    const FIREBASE_API_KEY = 'AIzaSyDYGOfg7BSk1W8KuqjA0RzVMGOmfKZdOUs';

    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}?key=${FIREBASE_API_KEY}`;

    const firestoreData = {
      fields: {
        uid: { stringValue: uid },
        email: { stringValue: email },
        displayName: { stringValue: displayName || email },
        name: { stringValue: displayName || email },
        role: { stringValue: 'owner' },
        createdAt: { timestampValue: new Date().toISOString() },
        updatedAt: { timestampValue: new Date().toISOString() },
        isActive: { booleanValue: true },
        phone: { stringValue: '' },
        address: { stringValue: '' }
      }
    };

    console.log('📡 Sending request to Firestore...');
    console.log('URL:', url);
    console.log('Data:', JSON.stringify(firestoreData, null, 2));

    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreData)
    });

    console.log('📊 Response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS: Owner user created!');

      // Verify creation
      const verifyResponse = await fetch(url + `?key=${FIREBASE_API_KEY}`);
      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        const userRole = verifyData.fields?.role?.stringValue;
        console.log('✅ Verification successful. Role:', userRole);

        return res.status(200).json({
          success: true,
          message: 'Owner user created and verified successfully',
          data: {
            uid,
            email,
            displayName: displayName || email,
            role: userRole,
            created: true,
            verified: true,
            fields: Object.keys(verifyData.fields).reduce((acc, key) => {
              const value = verifyData.fields[key];
              if (value.stringValue) acc[key] = value.stringValue;
              else if (value.booleanValue) acc[key] = value.booleanValue;
              else if (value.timestampValue) acc[key] = value.timestampValue;
              return acc;
            }, {})
          }
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'User created but verification failed',
          data: null
        });
      }
    } else {
      const errorText = await response.text();
      console.error('❌ FAILED to create user');
      console.error('Status:', response.status);
      console.error('Error:', errorText);

      return res.status(500).json({
        success: false,
        message: `Failed to create owner user: ${response.status}`,
        error: errorText,
        request_data: { uid, email, displayName }
      });
    }

  } catch (error) {
    console.error('💥 Create Owner Error:', error);

    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`,
      error: error.stack,
      data: null
    });
  }
}