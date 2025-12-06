import admin from 'firebase-admin';

let adminAppInitialized = false;

const initFirebaseAdmin = () => {
  if (adminAppInitialized && admin.apps.length) {
    return {
      admin,
      db: admin.firestore()
    };
  }

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || `firebase-adminsdk@${projectId}.iam.gserviceaccount.com`;

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error('Missing Firebase admin credentials (projectId, clientEmail, or privateKey).');
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
  }

  adminAppInitialized = true;
  return {
    admin,
    db: admin.firestore()
  };
};

const formatMethodDoc = (doc) => {
  const data = doc.data() || {};
  return {
    id: doc.id,
    name: data.name || 'Tanpa nama',
    isActive: data.isActive ?? true,
    createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : null
  };
};

const extractUserRole = async (adminInstance, uid) => {
  try {
    const userDoc = await adminInstance.firestore().collection('users').doc(uid).get();
    if (userDoc.exists) {
      return userDoc.data()?.role || null;
    }
  } catch (error) {
    console.error('Failed to read user role from Firestore:', error.message);
  }
  return null;
};

const verifyOwnerRequest = async (req, adminInstance) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    const error = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    const error = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }

  const decoded = await adminInstance.auth().verifyIdToken(token);
  let role = decoded.role || decoded.claims?.role;

  if (!role) {
    role = await extractUserRole(adminInstance, decoded.uid);
  }

  if (role !== 'owner') {
    const error = new Error('Hanya owner yang dapat mengelola metode pembayaran');
    error.status = 403;
    throw error;
  }

  return {
    uid: decoded.uid,
    role
  };
};

const parseRequestBody = async (req) => {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (!req.body || typeof req.body !== 'string') {
    return {};
  }

  try {
    return JSON.parse(req.body);
  } catch (error) {
    console.error('Failed to parse JSON body:', error.message);
    return {};
  }
};

export default async function handler(req, res) {
  try {
    const { admin: adminInstance, db } = initFirebaseAdmin();

    if (req.method === 'GET') {
      const snapshot = await db
        .collection('financial_payment_methods')
        .orderBy('createdAt', 'desc')
        .get();

      const methods = snapshot.docs.map(formatMethodDoc);

      return res.status(200).json({
        success: true,
        data: { methods }
      });
    }

    const requester = await verifyOwnerRequest(req, adminInstance);

    if (req.method === 'POST') {
      const body = await parseRequestBody(req);
      const name = typeof body.name === 'string' ? body.name.trim() : '';

      if (!name) {
        return res.status(400).json({ success: false, message: 'Nama metode wajib diisi' });
      }

      const docRef = await db.collection('financial_payment_methods').add({
        name,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: requester.uid,
        createdByRole: requester.role
      });

      return res.status(201).json({
        success: true,
        data: {
          method: {
            id: docRef.id,
            name,
            isActive: true
          }
        }
      });
    }

    if (req.method === 'DELETE') {
      const methodId = typeof req.query.id === 'string' ? req.query.id : Array.isArray(req.query.id) ? req.query.id[0] : null;

      if (!methodId) {
        return res.status(400).json({ success: false, message: 'Parameter id wajib diisi' });
      }

      await db.collection('financial_payment_methods').doc(methodId).delete();

      return res.status(200).json({
        success: true,
        data: { id: methodId }
      });
    }

    res.setHeader('Allow', 'GET,POST,DELETE');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (error) {
    const status = error?.status || 500;
    const message = error?.message || 'Payment methods API error';
    console.error('Payment methods API error:', error);

    return res.status(status).json({ success: false, message });
  }
}
