/**
 * Cloud Functions for Azzahra Fashion Muslim
 * "Robot Server" for Auto-Verification 24/7
 * + Image Analysis & Collage Generator for WhatsApp Bridge
 */

// 🔧 FIX: Use onDocumentCreated instead of onDocumentWritten to prevent duplicate triggers
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineString } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { logger } = require("firebase-functions");
const Jimp = require("jimp");
const { GoogleGenerativeAI } = require("@google/generative-ai");

initializeApp();
const db = getFirestore();
const bucket = getStorage().bucket();

// Gemini API Key (set via: firebase functions:config:set gemini.apikey="...")
// Or hardcoded for quick deploy (TEMPORARY - should use secrets in production)
const GEMINI_API_KEY = "AIzaSyB5oDXhIXOaOrukCayVPCdRtbvHSTAqUo4";

// 🔐 SECRET KEY - Must match the key in Android APK
// Change this to a random secure string and keep it secret!
const PAYMENT_DETECTION_SECRET_KEY = "AZF-PAYMENT-SECRET-2024-xK9mP2vL8nQ4rT7w";

/**
 * 🤖 Robot Eksekutor (Server Side)
 * Trigger: When a NEW payment detection is created in Firestore.
 * 🔧 FIX: Use onDocumentCreated to trigger ONLY on new documents (not updates)
 */
exports.checkPaymentDetection = onDocumentCreated("paymentDetectionsPending/{detectionId}", async (event) => {
    // Debug Log
    logger.info(`🤖 Robot: Triggered! New document created.`);

    const snapshot = event.data; // For onDocumentCreated, use data directly
    if (!snapshot) {
        // Document not found
        return;
    }

    const detection = snapshot.data();
    const detectionId = event.params.detectionId;

    logger.info(`🤖 Robot: New detection received! ${detectionId}`, { amount: detection.amount });

    // 🔐 SECRET KEY VALIDATION
    if (detection.secretKey !== PAYMENT_DETECTION_SECRET_KEY) {
        logger.error(`🚫 Robot: INVALID SECRET KEY! Detection ${detectionId} rejected.`);
        logger.error(`🚫 Expected key but got: ${detection.secretKey ? 'wrong key' : 'no key'}`);

        // Delete the invalid detection for security
        await db.collection("paymentDetectionsPending").doc(detectionId).delete();
        logger.info(`🗑️ Robot: Invalid detection deleted for security.`);
        return;
    }

    logger.info(`✅ Robot: Secret key validated for ${detectionId}`);

    // 1. Cek User Settings (Apakah Full Auto?)
    // Note: Settings biasanya disimpan di collection 'admin' doc 'settings' atau sejenisnya
    // Kita coba ambil dari path yang umum digunakan di app client: paymentSettings/default atau admin/settings
    // Berdasarkan code client: paymentDetectionService.getSettings() -> doc(db, 'settings', 'paymentDetection')

    const settingsDoc = await db.collection("paymentDetectionSettings").doc("config").get();

    if (!settingsDoc.exists) {
        logger.warn("🤖 Robot: Settings not found. Aborting.");
        return;
    }

    const settings = settingsDoc.data();

    if (settings.mode !== "full-auto") {
        logger.info(`🤖 Robot: Mode is '${settings.mode}', not 'full-auto'. Skipping.`);
        return;
    }

    if (!settings.enabled) {
        logger.info("🤖 Robot: System disabled. Skipping.");
        return;
    }

    // 🧪 TEST MODE CHECK - Only log, don't execute verification
    const isTestMode = settings.testMode === true;
    if (isTestMode) {
        logger.info("🧪 Robot: TEST MODE ACTIVE - Will log but NOT execute verification.");
    }

    // 2. Ambil List Order Pending / Waiting Payment
    // Kita butuh order yang belum lunas
    const ordersSnapshot = await db.collection("orders")
        .where("status", "in", ["pending", "waiting_payment"])
        .get();

    if (ordersSnapshot.empty) {
        logger.info("🤖 Robot: No pending orders found.");
        return;
    }

    const pendingOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3. LOGIC MATCHING (Mirip client side)
    // Trust Unique Code: 100% Match kalau Exact Amount sama

    // PRIORITAS: Cek Payment Groups DULU!
    // Kenapa? Karena jika user bayar Group (Gabungan), amountnya pasti unik untuk group itu.
    // Jika kita cek individual dulu, bisa jadi ada salah satu order yang "kebetulan" atau "terupdate"
    // memiliki amount yang sama, sehingga system mengira ini bayar satuan.

    logger.info(`🤖 Robot: Scanning for matches... Detection Amount: ${detection.amount}`);

    let bestMatch = null;
    const threshold = settings.autoConfirmThreshold || 90;
    let isGroupMatch = false;

    // A. Cek Payment Groups (PRIORITY)
    const groupsSnapshot = await db.collection("paymentGroups")
        .where("status", "in", ["pending", "pending_selection"])
        .get();

    if (!groupsSnapshot.empty) {
        const pendingGroups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        logger.info(`🤖 Robot: Scanning ${pendingGroups.length} payment groups...`);

        for (const group of pendingGroups) {
            // Check Exact Amount (Unique Code di level Group)
            if (group.exactPaymentAmount === detection.amount) {
                bestMatch = {
                    orderId: group.id,
                    confidence: 100,
                    reason: "Payment Group Match (Unique Code)",
                    data: group
                };
                isGroupMatch = true;
                logger.info(`🤖 Robot: GROUP MATCH FOUND! Group ${group.id}`);
                break;
            }
        }
    }

    // B. Cek Individual Orders (Fallback)
    if (!bestMatch) {
        logger.info(`🤖 Robot: No group match. Scanning ${pendingOrders.length} pending orders...`);

        for (const order of pendingOrders) {
            const isExactMatch =
                (order.exactPaymentAmount === detection.amount) ||
                (order.groupPaymentAmount === detection.amount) ||
                (order.finalTotal === detection.amount);

            if (isExactMatch) {
                bestMatch = {
                    orderId: order.id,
                    confidence: 100,
                    reason: "Exact amount match (Unique Code)"
                };
                logger.info(`🤖 Robot: MATCH FOUND! Order ${order.id}`);
                break;
            }
        }
    }

    // 4. EKSEKUSI JIKA MATCH
    if (bestMatch && bestMatch.confidence >= threshold) {
        logger.info(`🤖 Robot: Executing Auto-Verify for ${detectionId} -> ${bestMatch.orderId}`);

        // 📋 PREPARE AUDIT LOG DATA
        // For group payments: orderId = PG ID (header), orderIds = AZ order IDs (detail)
        // For single payments: orderId = AZ order ID
        const isGroup = isGroupMatch && bestMatch.data;
        const actualOrderIds = isGroup ? (bestMatch.data.orderIds || []) : [bestMatch.orderId];

        // 🆕 Fetch order details with amounts for each order
        let orderDetails = [];
        for (const orderId of actualOrderIds) {
            try {
                const orderDoc = await db.collection("orders").doc(orderId).get();
                if (orderDoc.exists) {
                    const orderData = orderDoc.data();
                    orderDetails.push({
                        id: orderId,
                        amount: orderData.finalTotal || orderData.totalAmount || 0,
                        customerName: orderData.userName || orderData.customerName || 'Unknown'
                    });
                } else {
                    orderDetails.push({ id: orderId, amount: 0, customerName: 'Unknown' });
                }
            } catch (err) {
                logger.warn(`⚠️ Could not fetch order ${orderId}: ${err.message}`);
                orderDetails.push({ id: orderId, amount: 0, customerName: 'Unknown' });
            }
        }

        // Get customer name from order data (username), not bank sender
        const buyerName = orderDetails.length > 0 ? orderDetails[0].customerName : 'Unknown';

        const logData = {
            timestamp: new Date(),
            // Header display: PG ID for group, AZ ID for single
            orderId: bestMatch.orderId, // PG ID for group, AZF ID for single
            orderIds: actualOrderIds, // Array of actual AZ order IDs
            orderDetails: orderDetails, // 🆕 Array with id + amount for each order
            orderAmount: detection.amount,
            customerName: buyerName, // 🔧 FIX: Use buyer username, not bank sender
            detectionId: detectionId,
            detectedAmount: detection.amount,
            senderName: detection.senderName || 'Unknown', // Keep bank sender separately
            bank: detection.bank || detection.serviceProvider || 'Unknown',
            rawNotification: detection.rawText || '',
            confidence: bestMatch.confidence,
            matchReason: bestMatch.reason || `Auto-match (Confidence: ${bestMatch.confidence}%)`,
            executedBy: 'system_cloud_function',
            isGroupPayment: isGroup
        };

        // 🧪 TEST MODE: Only log, don't execute
        if (isTestMode) {
            logger.info("🧪 Robot: TEST MODE - Writing dry-run log but NOT executing verification");

            // Write audit log as dry-run
            await db.collection("autoVerificationLogs").add({
                ...logData,
                status: 'dry-run'
            });

            logger.info("🧪 Robot: DRY-RUN log written. Order NOT marked as paid.");
            return; // EXIT WITHOUT EXECUTING
        }

        // 🚀 PRODUCTION MODE: Execute verification
        try {
            const batch = db.batch();

            // Move to Verified
            const verifiedRef = db.collection("paymentDetectionsVerified").doc(detectionId);
            batch.set(verifiedRef, {
                ...detection,
                status: "verified",
                matchedOrderId: bestMatch.orderId,
                confidence: bestMatch.confidence,
                verificationMode: "auto",
                verifiedAt: new Date().toISOString(),
                verifiedBy: "system_cloud_function",
                notes: `Auto-verified by Cloud Function (Confidence: ${bestMatch.confidence}%)`
            });

            // Delete from Pending
            const pendingRef = db.collection("paymentDetectionsPending").doc(detectionId);
            batch.delete(pendingRef);

            if (isGroupMatch) {
                // --- HANDLE GROUP PAYMENT ---
                const group = bestMatch.data;

                // 1. Update Payment Group Status
                const groupRef = db.collection("paymentGroups").doc(group.id);
                batch.update(groupRef, {
                    status: "paid",
                    paidAt: new Date().toISOString(),
                    paymentMethod: detection.serviceProvider || "Bank Transfer"
                });

                // 2. Update ALL Linked Orders
                if (group.orderIds && Array.isArray(group.orderIds)) {
                    for (const oid of group.orderIds) {
                        const orderRef = db.collection("orders").doc(oid);
                        batch.update(orderRef, {
                            status: "paid",
                            paymentStatus: "paid",
                            paidAt: new Date().toISOString(),
                            paymentMethod: detection.serviceProvider || "Bank Transfer",
                            paymentGroupId: group.id
                        });
                    }
                }
            } else {
                // --- HANDLE INDIVIDUAL ORDER ---
                const orderRef = db.collection("orders").doc(bestMatch.orderId);
                batch.update(orderRef, {
                    status: "paid",
                    paymentStatus: "paid", // Some apps use this too
                    paidAt: new Date().toISOString(),
                    paymentMethod: detection.serviceProvider || "Bank Transfer"
                });
            }

            // Commit Transaction
            await batch.commit();

            // 📋 Write SUCCESS audit log
            await db.collection("autoVerificationLogs").add({
                ...logData,
                status: 'success'
            });

            logger.info("🤖 Robot: SUCCESS! Payment verified & Order paid.");

        } catch (error) {
            logger.error("🤖 Robot: Execution Failed", error);

            // 📋 Write FAILED audit log
            await db.collection("autoVerificationLogs").add({
                ...logData,
                status: 'failed',
                errorMessage: error.message || 'Unknown error'
            });
        }
    } else {
        logger.info("🤖 Robot: No matching order found above threshold.");
    }
});

// ============================================================
// 🎨 PRODUCT DRAFT PROCESSOR - DISABLED
// Collage is now generated in browser to save Firebase Function costs
// Keep this code for reference in case we need to re-enable
// ============================================================
/*
exports.processProductDraft = onDocumentCreated(
    {
        document: "product_drafts/{draftId}",
        memory: "2GiB",
        timeoutSeconds: 540
    },
    async (event) => {
        // DISABLED - collage now generated in browser
        // See WhatsAppInboxModal.tsx for collage generation
    }
);
*/

// ============================================================
// Helper: Analyze single image with Gemini AI
// ============================================================
async function analyzeImage(visionModel, imageBuffer) {
    try {
        const base64Image = imageBuffer.toString('base64');

        const prompt = `Analisis gambar fashion ini:

1. HIJAB TYPE: Jenis hijab/kerudung yang dipakai:
   - "KHIMAR" = Hijab PANJANG menutupi dada
   - "SCARF" = Hijab PERSEGI dilipat, tampak PENDEK
   - "PASHMINA" = Hijab panjang rectangular
   - "TANPA" = Tidak pakai hijab

2. FAMILY TYPE: Siapa yang mengenakan:
   - "AYAH" = Pria DEWASA
   - "IBU" = Wanita DEWASA
   - "ANAK_LAKI" = Anak laki-laki
   - "ANAK_PEREMPUAN" = Anak perempuan
   - "DEWASA" = Default

Format jawaban PERSIS:
HIJAB:KHIMAR
FAMILY:DEWASA`;

        const result = await visionModel.generateContent([
            prompt,
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
        ]);

        const response = result.response.text();
        const hijabMatch = response.match(/HIJAB\s*:\s*(\w+)/i);
        const familyMatch = response.match(/FAMILY\s*:\s*(\w+)/i);

        return {
            hijabType: hijabMatch ? hijabMatch[1].toUpperCase() : 'UNKNOWN',
            familyType: familyMatch ? familyMatch[1].toUpperCase() : 'DEWASA'
        };
    } catch (error) {
        logger.warn(`AI analysis failed: ${error.message}`);
        return { hijabType: 'UNKNOWN', familyType: 'DEWASA' };
    }
}

// ============================================================
// Helper: Match image analysis with pricing from setTypes/familyVariants
// ============================================================
function matchPricing(imageAnalysis, setTypes, familyVariants) {
    const pricing = [];

    // Combine all potential pricing sources into a single candidates array
    // Normalize structure: { type: string, retailPrice: number, resellerPrice: number, origin: string }
    const candidates = [];

    if (setTypes && Array.isArray(setTypes)) {
        candidates.push(...setTypes.map(s => ({
            type: s.type,
            retailPrice: s.hargaRetail,
            resellerPrice: s.hargaReseller,
            origin: 'setTypes'
        })));
    }

    if (familyVariants && Array.isArray(familyVariants)) {
        candidates.push(...familyVariants.map(s => ({
            type: s.nama || s.type,
            retailPrice: s.hargaRetail,
            resellerPrice: s.hargaReseller,
            origin: 'familyVariants'
        })));
    }

    for (const img of imageAnalysis) {
        let matched = null;

        // Try to find best match among all candidates
        for (const candidate of candidates) {
            const typeUpper = (candidate.type || '').toUpperCase();

            // LOGIC 1: Match HIJAB Types (Khimar/Scarf/Pashmina)
            // Only if image detected confident hijab type
            if (['KHIMAR', 'SCARF', 'PASHMINA'].includes(img.hijabType)) {
                if (typeUpper.includes(img.hijabType)) {
                    matched = candidate;
                    break; // Found strong match
                }
            }

            // LOGIC 2: Match FAMILY Types
            if (img.familyType && img.familyType !== 'DEWASA' && img.familyType !== 'UNKNOWN') {
                if (typeUpper.includes(img.familyType) ||
                    (img.familyType === 'ANAK_LAKI' && typeUpper.includes('ANAK')) ||
                    (img.familyType === 'ANAK_PEREMPUAN' && typeUpper.includes('ANAK'))) {
                    matched = candidate;
                    break;
                }
            }
        }

        if (matched) {
            pricing.push({
                label: img.label,
                type: matched.type,
                retailPrice: matched.retailPrice,
                resellerPrice: matched.resellerPrice,
                matchedBy: matched.origin
            });
        }
    }

    return pricing;
}

// ============================================================
// Helper: Generate collage from image buffers
// ============================================================
async function generateCollageFromBuffers(imageBuffers) {
    const W = 1500;
    const H = 2000;
    const count = Math.min(imageBuffers.length, 10);

    // Create white canvas
    const canvas = new Jimp(W, H, 0xFFFFFFFF);

    // Load and resize images
    const loadedImages = [];
    for (let i = 0; i < count; i++) {
        try {
            let img = await Jimp.read(imageBuffers[i]);
            // Pre-resize to max 800x800
            const maxDim = 800;
            if (img.getWidth() > maxDim || img.getHeight() > maxDim) {
                const scale = maxDim / Math.max(img.getWidth(), img.getHeight());
                img = img.resize(Math.round(img.getWidth() * scale), Math.round(img.getHeight() * scale));
            }
            loadedImages.push(img);
        } catch (err) {
            logger.warn(`Failed to load image ${i}: ${err.message}`);
        }
    }

    if (loadedImages.length === 0) {
        throw new Error("No images could be loaded");
    }

    // Calculate layout
    const layout = calculateLayout(loadedImages.length, W, H);

    // Draw images
    for (let i = 0; i < loadedImages.length; i++) {
        const img = loadedImages[i];
        const box = layout[i];

        const scale = Math.max(box.w / img.getWidth(), box.h / img.getHeight());
        const scaledW = Math.round(img.getWidth() * scale);
        const scaledH = Math.round(img.getHeight() * scale);

        const resized = img.clone().resize(scaledW, scaledH);
        const cropX = Math.round((scaledW - box.w) / 2);
        const cropY = 0;
        const cropped = resized.crop(cropX, cropY, Math.min(box.w, scaledW), Math.min(box.h, scaledH));

        canvas.composite(cropped, Math.round(box.x), Math.round(box.y));
    }

    return canvas.getBufferAsync(Jimp.MIME_JPEG);
}

// ============================================================
// Helper: Calculate collage layout
// ============================================================
function calculateLayout(count, W, H) {
    const boxes = [];

    if (count === 1) {
        boxes.push({ x: 0, y: 0, w: W, h: H });
    } else if (count === 2) {
        const w = W / 2;
        boxes.push({ x: 0, y: 0, w: w, h: H });
        boxes.push({ x: w, y: 0, w: w, h: H });
    } else if (count === 3) {
        const wHalf = W / 2;
        const hHalf = H / 2;
        boxes.push({ x: 0, y: 0, w: wHalf, h: H });
        boxes.push({ x: wHalf, y: 0, w: wHalf, h: hHalf });
        boxes.push({ x: wHalf, y: hHalf, w: wHalf, h: hHalf });
    } else if (count === 4) {
        const w = W / 2;
        const h = H / 2;
        boxes.push({ x: 0, y: 0, w: w, h: h });
        boxes.push({ x: w, y: 0, w: w, h: h });
        boxes.push({ x: 0, y: h, w: w, h: h });
        boxes.push({ x: w, y: h, w: w, h: h });
    } else if (count === 5) {
        const hTop = H * 0.5;
        const hBot = H * 0.5;
        const wTop = W / 2;
        const wBot = W / 3;
        boxes.push({ x: 0, y: 0, w: wTop, h: hTop });
        boxes.push({ x: wTop, y: 0, w: wTop, h: hTop });
        boxes.push({ x: 0, y: hTop, w: wBot, h: hBot });
        boxes.push({ x: wBot, y: hTop, w: wBot, h: hBot });
        boxes.push({ x: wBot * 2, y: hTop, w: wBot, h: hBot });
    } else if (count === 6) {
        const h = H / 2;
        const w = W / 3;
        for (let c = 0; c < 3; c++) boxes.push({ x: c * w, y: 0, w: w, h: h });
        for (let c = 0; c < 3; c++) boxes.push({ x: c * w, y: h, w: w, h: h });
    } else if (count <= 8) {
        const h = H / 2;
        const w = W / 4;
        for (let c = 0; c < 4; c++) boxes.push({ x: c * w, y: 0, w: w, h: h });
        for (let c = 0; c < Math.min(count - 4, 4); c++) boxes.push({ x: c * w, y: h, w: w, h: h });
    } else {
        const h = H / 2;
        const w = W / 5;
        for (let c = 0; c < 5; c++) boxes.push({ x: c * w, y: 0, w: w, h: h });
        for (let c = 0; c < Math.min(count - 5, 5); c++) boxes.push({ x: c * w, y: h, w: w, h: h });
    }

    return boxes;
}
