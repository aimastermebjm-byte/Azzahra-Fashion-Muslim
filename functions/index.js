/**
 * Cloud Functions for Azzahra Fashion Muslim
 * "Robot Server" for Auto-Verification 24/7
 */

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");

initializeApp();
const db = getFirestore();

/**
 * 🤖 Robot Eksekutor (Server Side)
 * Trigger: When a NEW payment detection is created in Firestore.
 */
exports.checkPaymentDetection = onDocumentWritten("paymentDetectionsPending/{detectionId}", async (event) => {
    // Debug Log
    logger.info(`🤖 Robot: Triggered! Event Type: ${event.type}`);

    const snapshot = event.data.after; // For onDocumentWritten, use data.after
    if (!snapshot) {
        // Document deleted
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

            logger.info("🤖 Robot: SUCCESS! Payment verified & Order paid.");

        } catch (error) {
            logger.error("🤖 Robot: Execution Failed", error);
        }
    } else {
        logger.info("🤖 Robot: No matching order found above threshold.");
    }
});
