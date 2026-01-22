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
    
    private static String cachedRole = null;

    @Override
    public void onCreate() {
        super.onCreate();
        db = FirebaseFirestore.getInstance();
        FirebaseFirestoreSettings settings = new FirebaseFirestoreSettings.Builder()
                .setPersistenceEnabled(true)
                .setCacheSizeBytes(FirebaseFirestoreSettings.CACHE_SIZE_UNLIMITED)
                .build();
        db.setFirestoreSettings(settings);
        prefs = getSharedPreferences("AzzahraPrefs", MODE_PRIVATE);
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        updateUILog("✅ SERVICE ACTIVE");
        performManualScan();
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
            FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
            if (user == null) return;

            String pkg = sbn.getPackageName();
            Set<String> selected = prefs.getStringSet("selected_packages", new HashSet<>());
            boolean isDiag = pkg.equals(getPackageName());

            if (selected.contains(pkg) || isDiag) {
                String appName = pkg.contains(".") ? pkg.substring(pkg.lastIndexOf(".") + 1) : pkg;
                
                // LANGSUNG LOG AGAR BOSS TAHU NOTIF TERLIHAT
                if (!isDiag) updateUILog("🔍 Menangkap notif dari " + appName);

                if (cachedRole == null) {
                    db.collection("users").document(user.getUid()).get().addOnSuccessListener(doc -> {
                        if (doc.exists()) {
                            cachedRole = doc.getString("role");
                            if ("owner".equalsIgnoreCase(cachedRole)) {
                                processNotification(sbn);
                            } else {
                                updateUILog("⚠️ Role '" + cachedRole + "' ditolak.");
                            }
                        }
                    });
                } else if ("owner".equalsIgnoreCase(cachedRole)) {
                    processNotification(sbn);
                }
            }
        } catch (Exception err) {
            Log.e("AzzahraLog", "Error", err);
        }
    }

    private void processNotification(StatusBarNotification sbn) {
        try {
            Notification n = sbn.getNotification();
            if (n == null) return;
            Bundle e = n.extras;
            String title = e.getString(Notification.EXTRA_TITLE, "");
            CharSequence textChar = e.getCharSequence(Notification.EXTRA_TEXT);
            String text = (textChar != null) ? textChar.toString() : "";
            String fullContent = (title + " " + text).trim();

            if (fullContent.isEmpty()) return;

            String uniqueId = sbn.getPackageName() + "_" + fullContent.replaceAll("[^a-zA-Z0-9]", "");
            long now = System.currentTimeMillis();
            if (processedHistory.containsKey(uniqueId) && (now - processedHistory.get(uniqueId) < DUPLICATE_TIMEOUT)) return;
            processedHistory.put(uniqueId, now);

            String low = fullContent.toLowerCase(Locale.getDefault());
            
            if (sbn.getPackageName().equals(getPackageName())) {
                updateUILog("⚙️ DIAGNOSTIC: " + fullContent);
                return;
            }

            // FILTER KATA KUNCI (LOG LEBIH DETAIL)
            if (low.contains("masuk") || low.contains("pemasukan")) {
                long amt = extractAmount(fullContent);
                if (amt > 0) {
                    if (amt % 500 == 0) {
                        updateUILog("ℹ️ Abaikan (Bulat): Rp " + String.format("%,d", amt));
                        return;
                    }
                    vibrate();
                    updateUILog("💰 TERDETEKSI: Rp " + String.format("%,d", amt));
                    sendToFirebase(sbn.getPackageName(), amt, fullContent, uniqueId);
                } else {
                    updateUILog("⏩ Diabaikan: Tidak ada angka nominal.");
                }
            } else {
                updateUILog("⏩ Diabaikan: Tidak ada kata 'masuk'");
            }
        } catch (Exception err) {
            Log.e("AzzahraLog", "Error", err);
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
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) v.vibrate(200);
        } catch (Exception ignored) {}
    }

    private void updateUILog(String m) {
        String time = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        Intent i = new Intent("com.azzahra.sync.NEW_LOG");
        i.setPackage(getPackageName());
        i.putExtra("log_message", "[" + time + "] " + m);
        sendBroadcast(i);
    }

    private void sendToFirebase(String bank, long amt, String raw, String docId) {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        Map<String, Object> d = new HashMap<>();
        d.put("amount", amt); 
        d.put("bank", bank); 
        d.put("rawText", raw);
        d.put("secretKey", SECRET_KEY);
        d.put("ownerId", user.getUid());
        d.put("timestamp", new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date()));
        d.put("createdAt", com.google.firebase.firestore.FieldValue.serverTimestamp());

        db.collection("paymentDetectionsPending").document(docId).set(d)
            .addOnSuccessListener(aVoid -> updateUILog("☁️ SYNC OK: Rp " + String.format("%,d", amt)))
            .addOnFailureListener(e -> updateUILog("❌ FIREBASE REJECT: " + e.getMessage()));
    }
}
