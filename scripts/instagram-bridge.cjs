const { IgApiClient } = require('instagram-private-api');
const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');
const { promisify } = require('util');

// Initialize Firebase Admin (reuse existing if possible)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: "azzahra-fashion-muslim.firebasestorage.app" // Adjust if needed
    });
}

const db = admin.firestore();

// Instagram Client
const ig = new IgApiClient();

// Helper: Download Image
const downloadImage = async (url) => {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'arraybuffer'
    });
    return Buffer.from(response.data, 'binary');
};

// Login Logic
const loginToInstagram = async () => {
    // Try to load session
    const sessionPath = path.join(__dirname, 'ig-session.json');
    let sessionExists = false;

    // Logic to save/load state would go here, simplified for now to prompt login
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = promisify(rl.question).bind(rl);

    try {
        if (fs.existsSync(sessionPath)) {
            const state = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
            await ig.state.deserialize(state);
            console.log('✅ Loaded Instagram session');
            // Check if valid?
            try {
                await ig.account.currentUser();
                console.log('✅ Session valid!');
                return;
            } catch (e) {
                console.log('⚠️ Session invalid, please login again.');
            }
        }

        console.log('🔐 Instagram Login Required');
        const username = await question('Username: ');
        const password = await question('Password: ');

        ig.state.generateDevice(username);

        console.log('⏳ Logging in...');
        await ig.account.login(username, password);
        console.log('✅ Login successful!');

        // Save session
        const serialized = await ig.state.serialize();
        delete serialized.constants; // Optimization
        fs.writeFileSync(sessionPath, JSON.stringify(serialized));

    } catch (error) {
        console.error('❌ Login failed:', error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
};

const processQueue = async () => {
    console.log('👀 Watching pending_instagram_posts...');

    // Listen for new posts
    db.collection('pending_instagram_posts')
        .where('status', '==', 'pending')
        .onSnapshot(async (snapshot) => {
            if (snapshot.empty) return;

            for (const doc of snapshot.docs) {
                const data = doc.data();
                console.log(`🚀 Processing post for: ${data.productName}`);

                try {
                    // Mark as processing
                    await doc.ref.update({ status: 'processing' });

                    const imageBuffer = await downloadImage(data.imageUrl);

                    console.log('📸 Uploading to Instagram...');
                    const publishResult = await ig.publish.photo({
                        file: imageBuffer,
                        caption: data.caption,
                    });

                    console.log('✅ Posted! Status:', publishResult.status);

                    await doc.ref.update({
                        status: 'published',
                        instagramMediaId: publishResult.media.id,
                        postedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                } catch (error) {
                    console.error('❌ Failed to post:', error);
                    await doc.ref.update({
                        status: 'failed',
                        error: error.message
                    });
                }
            }
        }, (err) => {
            console.error('Snapshot error:', err);
        });
};

(async () => {
    await loginToInstagram();
    await processQueue();
})();
