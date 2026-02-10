const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");

const db = getFirestore();

// Token Verification (Match this with Meta App Dashboard)
const VERIFY_TOKEN = "AZZAHRA_WABA_VRFY";

/**
 * Webhook Handler for WhatsApp Business API
 * Handles Verification (GET) and Incoming Messages (POST)
 */
exports.webhook = onRequest(async (req, res) => {
    // 1. Verify Request (GET)
    if (req.method === "GET") {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        if (mode && token) {
            if (mode === "subscribe" && token === VERIFY_TOKEN) {
                logger.info("✅ Webhook verified!");
                res.status(200).send(challenge);
            } else {
                logger.warn("❌ Webhook verification failed", { mode, token });
                res.status(403).send("Forbidden");
            }
        } else {
            res.status(400).send("Bad Request");
        }
        return;
    }

    // 2. Handle Incoming Messages (POST)
    if (req.method === "POST") {
        const body = req.body;

        logger.info("📥 Webhook payload received", JSON.stringify(body, null, 2));

        if (body.object) {
            if (
                body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0] &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                const message = body.entry[0].changes[0].value.messages[0];
                const value = body.entry[0].changes[0].value;
                const metadata = value.metadata;

                const from = message.from; // Sender phone number
                const messageId = message.id;
                const type = message.type;
                const timestamp = message.timestamp;

                // Extract Content
                let content = null;
                let mediaId = null;
                let caption = null;

                if (type === "text") {
                    content = message.text.body;
                } else if (type === "image") {
                    mediaId = message.image.id;
                    caption = message.image.caption || "";
                    content = "[IMAGE] " + caption;
                } else {
                    logger.info(`Skipping unhandled message type: ${type}`);
                    res.status(200).send("EVENT_RECEIVED");
                    return;
                }

                // SAVE TO BUFFER (Firestore)
                // Path: whatsapp_buffer_v2/{phoneNumber}/messages/{messageId}
                const bufferRef = db.collection("whatsapp_buffer_v2").doc(from);
                const msgRef = bufferRef.collection("messages").doc(messageId);

                try {
                    const batch = db.batch();

                    // 1. Save Message Detail
                    batch.set(msgRef, {
                        id: messageId,
                        type: type,
                        content: content,
                        mediaId: mediaId, // Valid for image
                        caption: caption, // Valid for image
                        timestamp: timestamp,
                        raw: message,
                        createdAt: new Date()
                    });

                    // 2. Update Buffer Status (Debounce Trigger)
                    batch.set(bufferRef, {
                        phoneNumber: from,
                        lastMessageAt: new Date(),
                        status: "collecting", // collecting -> processing
                        metadata: metadata
                    }, { merge: true });

                    await batch.commit();
                    logger.info(`✅ Message buffered: ${messageId} from ${from}`);

                } catch (error) {
                    logger.error("Error buffering message:", error);
                }
            }

            res.status(200).send("EVENT_RECEIVED");
        } else {
            res.status(404).send("Not Found");
        }
    }
});
