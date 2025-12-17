package com.azzahra.sync;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.google.firebase.firestore.FirebaseFirestore;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class NotificationService extends NotificationListenerService {

    private static final String TAG = "AzzahraNotif";
    private FirebaseFirestore db;

    @Override
    public void onCreate() {
        super.onCreate();
        db = FirebaseFirestore.getInstance();
        Log.d(TAG, "Notification Service Started");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String packageName = sbn.getPackageName();

        // Filter: Only listen to specific financial apps (Add more as needed)
        if (!isFinancialApp(packageName))
            return;

        Notification notification = sbn.getNotification();
        Bundle extras = notification.extras;

        String title = extras.getString(Notification.EXTRA_TITLE);
        String text = extras.getCharSequence(Notification.EXTRA_TEXT) != null
                ? extras.getCharSequence(Notification.EXTRA_TEXT).toString()
                : "";

        Log.d(TAG, "Notif received from " + packageName + ": " + title + " - " + text);

        // Process notification content
        processPaymentNotification(packageName, title, text);
    }

    private boolean isFinancialApp(String packageName) {
        // Add package names of supported banks/wallets
        return packageName.contains("bri") ||
                packageName.contains("bca") ||
                packageName.contains("mandiri") ||
                packageName.contains("gojek") || // Gopay
                packageName.contains("ovo") ||
                packageName.contains("dana");
    }

    private void processPaymentNotification(String appName, String title, String text) {
        if (text == null)
            return;

        // Keywords for incoming money
        String lowerText = text.toLowerCase();
        if (lowerText.contains("transfer masuk") ||
                lowerText.contains("dana masuk") ||
                lowerText.contains("terima") ||
                lowerText.contains("received") ||
                lowerText.contains("kredit")) {

            Log.d(TAG, "💰 POTENTIAL PAYMENT DETECTED!");

            // Extract amount using Regex (Basic pattern, can be improved)
            // Looks for "Rp" followed by numbers
            long amount = extractAmount(text);
            String sender = extractSender(text);

            if (amount > 0) {
                sendToFirebase(appName, amount, sender, text);
            }
        }
    }

    private long extractAmount(String text) {
        try {
            // Remove non-numeric chars except Rp/dots/commas first logic
            // Regex for currency: Rp 50.000 or 50000
            Pattern p = Pattern.compile("Rp\\s*[0-9.,]+");
            Matcher m = p.matcher(text);
            if (m.find()) {
                String rawAmount = m.group();
                // Clean up string to number
                String cleanAmount = rawAmount.replaceAll("[^0-9]", "");
                return Long.parseLong(cleanAmount);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error parsing amount", e);
        }
        return 0;
    }

    private String extractSender(String text) {
        // This is tricky as every bank has different format.
        // For now, we return "Unknown" or simple guessing logic.
        // Ideally, we need specific parsers for each bank app.
        if (text.contains("dari")) {
            int index = text.indexOf("dari");
            // Grab up to 20 chars after "dari"
            int endIndex = Math.min(text.length(), index + 25);
            return text.substring(index + 5, endIndex).trim();
        }
        return "Unknown Sender";
    }

    private void sendToFirebase(String appName, long amount, String sender, String rawText) {
        Map<String, Object> detection = new HashMap<>();
        detection.put("amount", amount);
        detection.put("senderName", sender);
        detection.put("bank", appName);
        detection.put("rawText", rawText);
        detection.put("timestamp", new Date().toString());
        detection.put("status", "pending");
        detection.put("createdAt", com.google.firebase.firestore.FieldValue.serverTimestamp());

        db.collection("paymentDetectionsPending")
                .add(detection)
                .addOnSuccessListener(doc -> Log.d(TAG, "✅ Detection sent to Firebase: " + doc.getId()))
                .addOnFailureListener(e -> Log.e(TAG, "❌ Failed to send to Firebase", e));
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // Ignore
    }
}
