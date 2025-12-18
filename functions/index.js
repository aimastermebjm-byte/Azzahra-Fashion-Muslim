/**
 * Cloud Functions for Azzahra Fashion Muslim
 * "Robot Server" for Auto-Verification 24/7
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");

initializeApp();
const db = getFirestore();

/**
 * 🤖 Robot Eksekutor (Server Side)
 * Trigger: When a NEW payment detection is created in Firestore.
 */
exports.checkPaymentDetection = onDocumentCreated("paymentDetectionsPending/{detectionId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        logger.error("No data associated with the event");
        return;
    }

    const detection = snapshot.data();
    const detectionId = event.params.detectionId;

    logger.info(`🤖 Robot: New detection received! ${detectionId}`, { amount: detection.amount });

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

    logger.info(`🤖 Robot: Scanning ${pendingOrders.length} pending orders for amount ${detection.amount}...`);

    let bestMatch = null;
    const threshold = settings.autoConfirmThreshold || 90;

    for (const order of pendingOrders) {
        // Cek Exact Amount (Ini kunci utamanya)
        // Ingat: createPaymentGroup sudah menjamin exactPaymentAmount itu UNIK global.
        const isExactMatch =
            (order.exactPaymentAmount === detection.amount) ||
            (order.groupPaymentAmount === detection.amount) ||
            (order.finalTotal === detection.amount); // Fallback

        if (isExactMatch) {
            // 100% Confidence!
            bestMatch = {
                orderId: order.id,
                confidence: 100,
                reason: "Exact amount match (Unique Code)"
            };

            logger.info(`🤖 Robot: MATCH FOUND! Order ${order.id} matches amount ${detection.amount}`);
            break; // Ketemu satu langsung stop, karena unique code guarantee
        }
    }

    // 4. EKSEKUSI JIKA MATCH
    if (bestMatch && bestMatch.confidence >= threshold) {
        logger.info(`🤖 Robot: Executing Auto-Verify for ${detectionId} -> ${bestMatch.orderId}`);

        try {
            const batch = db.batch();

            // Update Detection
            const detectionRef = db.collection("paymentDetections").doc(detectionId);
            batch.update(detectionRef, {
                status: "verified",
                matchedOrderId: bestMatch.orderId,
                confidence: bestMatch.confidence,
                verificationMode: "auto",
                verifiedAt: new Date().toISOString(),
                verifiedBy: "system_cloud_function", // Tanda tangan Robot Server
                notes: `Auto-verified by Cloud Function (Confidence: ${bestMatch.confidence}%)`
            });

            // Update Order
            const orderRef = db.collection("orders").doc(bestMatch.orderId);
            batch.update(orderRef, {
                status: "paid",
                paymentStatus: "paid", // Some apps use this too
                paidAt: new Date().toISOString(),
                paymentMethod: detection.serviceProvider || "Bank Transfer"
            });

            // Commit Transaction
            await batch.commit();

            logger.info("🤖 Robot: SUCCESS! Payment verified & Order paid.");

        } catch (error) {
            logger.error("🤖 Robot: Execution Failed", error);
        }
    } else {
        logger.info("🤖 Robot: No matching order found above threshold.");
    }
});
