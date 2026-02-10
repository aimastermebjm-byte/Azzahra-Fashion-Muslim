const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { logger } = require("firebase-functions");
const axios = require("axios");
const path = require("path");
const { parseWithAI, parseCaption, CONFIG, isFamilyProduct } = require("./gemini");

const db = getFirestore();
const bucket = getStorage().bucket();

// Token for WABA API (Media Download)
// In production, use defineSecret or firebase functions:config
const ACCESS_TOKEN = process.env.WABA_ACCESS_TOKEN || "EAARpX7zX2ZCwBQuZBaZC8O30G0sCO8H6aZCsXF70mBss8Ma7gcPjKTCP6WsiQe4HZBZBiFfEMzX3LyYE7RMUBeFWPiBNxKxKBbwFFl3Ix0eIRZA43S2q5eiQIVA4qI4xZCGDTYOrCunltZAlt9LgxEZCZCmLsGYhGTrRUJrYNqrPJE5Uvwt0eAjMll6uyhZCNGDyFisnWQZDZD";

/**
 * Scheduled Job: Process WhatsApp Buffers
 * Runs every 1 minute to check for "ready" bundles
 */
exports.processBuffers = onSchedule("every 1 minutes", async (event) => {
    logger.info("⏰ Scheduler started: Checking for ready buffers...");

    const now = new Date();
    const DEBOUNCE_MS = 15000; // 15 seconds wait time

    // 1. Scan for eligible buffers
    // Conditions: status == 'collecting'
    const snapshot = await db.collection("whatsapp_buffer_v2")
        .where("status", "==", "collecting")
        .get();

    if (snapshot.empty) {
        logger.info("✅ No active buffers found.");
        return;
    }

    const promises = snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const lastMessageTime = data.lastMessageAt.toDate();
        const diff = now - lastMessageTime;

        // Check if bundle is "stable" (no new messages for DEBOUNCE_MS)
        if (diff >= DEBOUNCE_MS) {
            logger.info(`📦 Processing bundle for ${doc.id} (Idle for ${diff}ms)`);
            await processBundle(doc.id, data);
        }
    });

    await Promise.all(promises);
});

async function processBundle(phoneNumber, bufferData) {
    // Lock the buffer to prevent double processing
    const bufferRef = db.collection("whatsapp_buffer_v2").doc(phoneNumber);
    await bufferRef.update({ status: "processing" });

    try {
        // 1. Fetch all messages
        const msgsSnapshot = await bufferRef.collection("messages")
            .orderBy("timestamp", "asc")
            .get();

        if (msgsSnapshot.empty) {
            logger.warn(`⚠️ Empty bundle for ${phoneNumber}, deleting...`);
            await bufferRef.delete();
            return;
        }

        const messages = msgsSnapshot.docs.map(d => d.data());
        logger.info(`📄 Bundle contains ${messages.length} messages`);

        // 2. Separate Content
        const textMessages = messages.filter(m => m.type === "text");
        const imageMessages = messages.filter(m => m.type === "image");

        // Combine Caption
        const textCaption = textMessages.map(m => m.content).join("\n");
        const imageCaption = imageMessages.find(m => m.caption)?.caption || ""; // Use first image caption
        const finalCaption = (textCaption + "\n" + imageCaption).trim();

        if (imageMessages.length === 0) {
            logger.info("⚠️ No images found in bundle. Skipping draft creation.");
            // Cleanup anyway
            await cleanupBuffer(bufferRef, msgsSnapshot);
            return;
        }

        // 3. Process Images (Download & Upload to Firebase Storage)
        const downloadedImages = [];

        for (const imgMsg of imageMessages) {
            try {
                const mediaId = imgMsg.mediaId;
                if (!mediaId) continue;

                if (!ACCESS_TOKEN) {
                    throw new Error("WABA_ACCESS_TOKEN is missing!");
                }

                // A. Get Media URL
                const mediaUrlRes = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
                    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
                });
                const mediaUrl = mediaUrlRes.data.url;

                // B. Download Binary
                const imageRes = await axios.get(mediaUrl, {
                    responseType: "arraybuffer",
                    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
                });
                const buffer = Buffer.from(imageRes.data);

                // C. Upload to Firebase Storage
                const filename = `waba/${phoneNumber}/${Date.now()}_${mediaId}.jpg`;
                const file = bucket.file(filename);
                await file.save(buffer, {
                    metadata: { contentType: "image/jpeg" },
                    public: true
                });

                // D. Get Public URL
                // Note: For public access, we might need makePublic() or sign URL.
                // For simplicity, we assume generic public URL structure if bucket allows, or use signed URL
                // Best practice: file.makePublic()
                await file.makePublic();
                const publicUrl = file.publicUrl();

                downloadedImages.push(publicUrl);

            } catch (err) {
                logger.error(`❌ Failed to process image ${imgMsg.id}:`, err.message);
            }
        }

        if (downloadedImages.length === 0) {
            throw new Error("Failed to download any images from WABA");
        }

        // 4. AI Parsing
        logger.info("🤖 Sending to AI...", { captionLength: finalCaption.length });

        let aiParsed = null;
        let regexParsed = parseCaption(finalCaption);

        try {
            aiParsed = await parseWithAI(finalCaption);
        } catch (e) {
            logger.error("AI execution failed, using regex fallback");
        }

        const parsed = aiParsed || regexParsed;

        // Merge Logic (Match wweb.js logic)
        if (aiParsed) {
            parsed.name = aiParsed.nama || regexParsed.name;
            parsed.description = aiParsed.deskripsi || regexParsed.description;
            parsed.category = aiParsed.kategori || regexParsed.category;
            parsed.retailPrice = aiParsed.hargaRetail || regexParsed.retailPrice;
            parsed.resellerPrice = aiParsed.hargaReseller || regexParsed.resellerPrice;
            parsed.sizes = aiParsed.sizes || regexParsed.sizes;
            parsed.colors = aiParsed.warna || regexParsed.colors;
            parsed.stockPerVariant = aiParsed.stokPerVarian || 1;
            parsed.isFamily = aiParsed.isFamily || isFamilyProduct(finalCaption);
            parsed.variants = aiParsed.variants || null;
            parsed.brand = aiParsed.brand || '';
            parsed.setTypes = aiParsed.setTypes || null;
        }

        // 5. Create Draft
        const draftData = {
            name: parsed.name || 'Produk Baru',
            description: finalCaption || '',
            category: parsed.category || CONFIG.DEFAULT_CATEGORY,
            brand: parsed.brand || '',

            retailPrice: parsed.retailPrice || 0,
            resellerPrice: parsed.resellerPrice || 0,
            costPrice: parsed.costPrice || 0,

            sizes: parsed.sizes || ['All Size'],
            colors: parsed.colors || [],
            stockPerVariant: parsed.stockPerVariant || CONFIG.DEFAULT_STOCK,
            variantCount: downloadedImages.length, // No Collage yet
            isPreMadeCollage: false,

            isFamily: parsed.isFamily || false,
            familyVariants: parsed.variants || null,
            setTypes: parsed.setTypes || null,

            collageUrl: 'pending://waba-no-collage', // Logic collage di browser
            rawImages: downloadedImages, // WABA images hosted on Firebase

            source: 'waba', // MARK AS WABA SOURCE
            aiParsed: !!aiParsed,
            timestamp: new Date(),
            collageStatus: 'pending',
            dataComplete: !!(parsed.name && parsed.retailPrice > 0)
        };

        const docRef = await db.collection("product_drafts").add(draftData);
        logger.info(`✅ WABA Draft created: ${docRef.id}`);

        // 6. Cleanup
        await cleanupBuffer(bufferRef, msgsSnapshot);

    } catch (error) {
        logger.error(`❌ Bundle processing failed for ${phoneNumber}:`, error);
        // Reset status to retry? Or delete?
        // For now, keep it 'processing' or set to 'error' to avoid infinite loop
        await bufferRef.update({ status: "error", lastError: error.message });
    }
}

async function cleanupBuffer(bufferRef, msgsSnapshot) {
    const batch = db.batch();

    // Delete all messages
    msgsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    // Delete buffer doc
    batch.delete(bufferRef);

    await batch.commit();
    logger.info("🧹 Buffer cleaned up.");
}

