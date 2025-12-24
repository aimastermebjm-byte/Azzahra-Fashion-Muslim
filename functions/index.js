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
        // For group payments, use actual order IDs, not group ID
        const isGroup = isGroupMatch && bestMatch.data;
        const actualOrderIds = isGroup ? (bestMatch.data.orderIds || []) : [bestMatch.orderId];

        const logData = {
            timestamp: new Date(),
            // For display: show first order ID or all if group
            orderId: isGroup ? actualOrderIds.join(', ') : bestMatch.orderId,
            orderIds: actualOrderIds, // Array of actual order IDs
            paymentGroupId: isGroup ? bestMatch.orderId : null, // PG ID if group
            orderAmount: detection.amount,
            customerName: detection.senderName || 'Unknown',
            detectionId: detectionId,
            detectedAmount: detection.amount,
            senderName: detection.senderName || 'Unknown',
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
