// One-time API to create owner user
// This should be called manually to setup the initial owner

export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
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
        data: null
      });
    }

    console.log('👤 Creating owner user:', { uid, email, displayName });

    // Use Firebase Admin SDK would be better, but let's use REST API for now
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

    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreData)
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Owner user created successfully');

      return res.status(200).json({
        success: true,
        message: 'Owner user created successfully',
        data: {
          uid,
          email,
          role: 'owner',
          created: true
        }
      });
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to create owner user:', response.status, errorText);

      return res.status(500).json({
        success: false,
        message: `Failed to create owner user: ${response.status} - ${errorText}`,
        data: null
      });
    }

  } catch (error) {
    console.error('💥 Create Owner Error:', error);

    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`,
      data: null
    });
  }
}