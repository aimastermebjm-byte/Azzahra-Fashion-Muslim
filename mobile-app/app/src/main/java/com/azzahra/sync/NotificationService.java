package com.azzahra.sync;

import android.app.Notification;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import com.google.firebase.firestore.FirebaseFirestore;

public class NotificationService extends NotificationListenerService {
    private FirebaseFirestore db;
    private SharedPreferences prefs;

    @Override
    public void onCreate() {
        super.onCreate();
        db = FirebaseFirestore.getInstance();
        prefs = getSharedPreferences("AzzahraPrefs", MODE_PRIVATE);
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        updateUILog("✅ SERVICE ACTIVE");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String pkg = sbn.getPackageName();
            Set<String> selected = prefs.getStringSet("selected_packages", new HashSet<>());

            if (selected.contains(pkg)) {
                Notification notification = sbn.getNotification();
                Bundle extras = notification.extras;
                String title = extras.getString(Notification.EXTRA_TITLE, "");
                CharSequence textChar = extras.getCharSequence(Notification.EXTRA_TEXT);
                String text = (textChar != null) ? textChar.toString() : "";

                updateUILog("MATCHED: [" + pkg + "] " + text);
                process(pkg, title + " " + text);
            } else if (pkg.equals(getPackageName())) {
                Bundle extras = sbn.getNotification().extras;
                CharSequence textChar = extras.getCharSequence(Notification.EXTRA_TEXT);
                updateUILog("DIAGNOSTIC: " + (textChar != null ? textChar.toString() : ""));
            }
        } catch (Exception e) {}
    }

    private void process(String pkg, String fullText) {
        String low = fullText.toLowerCase();
        if (low.contains("idr") || low.contains("rp") || low.contains("pemasukan") || 
            low.contains("transfer") || low.contains("berhasil") || low.contains("terima") || low.contains("masuk")) {
            
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(rp|idr)\\s*([0-9.,]+)").matcher(low);
            if (m.find()) {
                long amt = Long.parseLong(m.group(2).replaceAll("[^0-9]", ""));
                if (amt > 0) {
                    updateUILog("🚀 SENDING TO FIREBASE: " + amt);
                    send(pkg, amt, fullText);
                }
            }
        }
    }

    private void updateUILog(String m) {
        Intent i = new Intent("com.azzahra.sync.NEW_LOG");
        String time = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        String entry = "[" + time + "] " + m;
        i.putExtra("log_message", entry);
        sendBroadcast(i);
        
        String history = prefs.getString("log_history", "");
        prefs.edit().putString("log_history", entry + "\n---\n" + (history.length() > 5000 ? history.substring(0, 5000) : history)).apply();
    }

    private void send(String bank, long amt, String raw) {
        Map<String, Object> d = new HashMap<>();
        d.put("amount", amt); d.put("bank", bank); d.put("rawText", raw);
        d.put("timestamp", new Date().toString());
        d.put("createdAt", com.google.firebase.firestore.FieldValue.serverTimestamp());
        
        db.collection("paymentDetectionsPending").add(d)
            .addOnSuccessListener(doc -> updateUILog("☁️ SUCCESS: Sent to Firebase! ID: " + doc.getId()))
            .addOnFailureListener(e -> updateUILog("❌ FIREBASE ERROR: " + e.getMessage()));
    }
}
