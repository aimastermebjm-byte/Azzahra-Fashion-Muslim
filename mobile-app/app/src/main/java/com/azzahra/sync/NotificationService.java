package com.azzahra.sync;

import android.app.Notification;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Vibrator;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FirebaseFirestoreSettings;

public class NotificationService extends NotificationListenerService {
    private FirebaseFirestore db;
    private SharedPreferences prefs;
    
    private static final Map<String, Long> processedHistory = new HashMap<>();
    private static final long DUPLICATE_TIMEOUT = 10000;
    private static final String SECRET_KEY = "AZF-PAYMENT-SECRET-2024-xK9mP2vL8nQ4rT7w";

    @Override
    public void onCreate() {
        super.onCreate();
        db = FirebaseFirestore.getInstance();
        
        FirebaseFirestoreSettings settings = new FirebaseFirestoreSettings.Builder()
                .setPersistenceEnabled(true)
                .build();
        db.setFirestoreSettings(settings);
        
        prefs = getSharedPreferences("AzzahraPrefs", MODE_PRIVATE);
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        updateUILog("✅ SERVICE ACTIVE - SCANNING PENDING NOTIFS");
        performManualScan();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "SCAN_NOW".equals(intent.getAction())) {
            performManualScan();
        }
        return START_STICKY;
    }

    private void performManualScan() {
        try {
            StatusBarNotification[] active = getActiveNotifications();
            if (active != null) {
                for (StatusBarNotification sbn : active) {
                    onNotificationPosted(sbn);
                }
            }
        } catch (Exception e) {
            Log.e("AzzahraLog", "Scan error", e);
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String pkg = sbn.getPackageName();
            Set<String> selected = prefs.getStringSet("selected_packages", new HashSet<>());
            boolean isDiag = pkg.equals(getPackageName());

            if (selected.contains(pkg) || isDiag) {
                Notification n = sbn.getNotification();
                Bundle e = n.extras;
                String title = e.getString(Notification.EXTRA_TITLE, "");
                CharSequence textChar = e.getCharSequence(Notification.EXTRA_TEXT);
                String text = (textChar != null) ? textChar.toString() : "";
                String fullContent = (title + " " + text).trim();

                String uniqueId = pkg + "_" + fullContent.replaceAll("[^a-zA-Z0-9]", "");
                
                if (!isDiag) {
                    long now = System.currentTimeMillis();
                    if (processedHistory.containsKey(uniqueId) && (now - processedHistory.get(uniqueId) < DUPLICATE_TIMEOUT)) return;
                    processedHistory.put(uniqueId, now);
                }

                process(pkg, fullContent, isDiag, uniqueId);
            }
        } catch (Exception err) {
            Log.e("AzzahraLog", "Error", err);
        }
    }

    private void process(String pkg, String fullText, boolean isDiag, String docId) {
        String low = fullText.toLowerCase();
        if (isDiag) {
            updateUILog("DIAGNOSTIC OK: " + fullText);
            return;
        }
        
        if (low.contains("masuk") || low.contains("berhasil") || low.contains("terima") || low.contains("dana")) {
            long amt = extractAmount(fullText);
            
            if (amt > 0) {
                if (amt % 500 == 0) {
                    updateUILog("ℹ️ Bulat diabaikan: Rp " + String.format("%,d", amt));
                    return;
                }
                vibrate();
                updateUILog("💰 DETECTED UNIQUE: Rp " + String.format("%,d", amt));
                sendToFirebase(pkg, amt, fullText, docId);
            }
        }
    }

    private long extractAmount(String text) {
        String low = text.toLowerCase();
        try {
            Pattern p1 = Pattern.compile("(rp|idr)\\s*([0-9.,]+)");
            Matcher m1 = p1.matcher(low);
            if (m1.find()) return parseCleanAmount(m1.group(2));

            Pattern p2 = Pattern.compile("([0-9]{1,3}([.,][0-9]{3})+)");
            Matcher m2 = p2.matcher(low);
            if (m2.find()) return parseCleanAmount(m2.group());

            Pattern p3 = Pattern.compile("\\b[0-9]{4,12}\\b");
            Matcher m3 = p3.matcher(low);
            if (m3.find()) return parseCleanAmount(m3.group());
        } catch (Exception e) {}
        return 0;
    }

    private long parseCleanAmount(String raw) {
        if (raw.endsWith(".00") || raw.endsWith(",00")) raw = raw.substring(0, raw.length() - 3);
        String clean = raw.replaceAll("[^0-9]", "");
        return clean.isEmpty() ? 0 : Long.parseLong(clean);
    }

    private void vibrate() {
        Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (v != null) v.vibrate(200);
    }

    private void updateUILog(String m) {
        String time = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        String entry = "[" + time + "] " + m;
        Intent i = new Intent("com.azzahra.sync.NEW_LOG");
        i.setPackage(getPackageName());
        i.putExtra("log_message", entry);
        sendBroadcast(i);
    }

    private void sendToFirebase(String bank, long amt, String raw, String docId) {
        FirebaseUser currentUser = FirebaseAuth.getInstance().getCurrentUser();
        String ownerId = (currentUser != null) ? currentUser.getUid() : "unknown";

        Map<String, Object> d = new HashMap<>();
        d.put("amount", amt); 
        d.put("bank", bank); 
        d.put("rawText", raw);
        d.put("secretKey", SECRET_KEY);
        d.put("ownerId", ownerId); // TAMBAHKAN OWNER ID AGAR BISA DIPASTIKAN PENGIRIMNYA
        d.put("timestamp", new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date()));
        d.put("createdAt", com.google.firebase.firestore.FieldValue.serverTimestamp());

        db.collection("paymentDetectionsPending").document(docId).set(d)
            .addOnSuccessListener(aVoid -> updateUILog("☁️ SUCCESS: Sync OK!"))
            .addOnFailureListener(e -> updateUILog("❌ REJECTED: " + e.getMessage()));
    }
}
