package com.azzahra.sync;

import android.app.Notification;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
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

            Notification notification = sbn.getNotification();
            Bundle extras = notification.extras;
            String title = extras.getString(Notification.EXTRA_TITLE, "");
            CharSequence textChar = extras.getCharSequence(Notification.EXTRA_TEXT);
            String text = (textChar != null) ? textChar.toString() : "";

            // Jika aplikasi dipilih atau ini notifikasi diagnostic
            if (selected.contains(pkg) || pkg.equals(getPackageName())) {
                process(pkg, title + " " + text);
            }
        } catch (Exception e) {}
    }

    private void process(String pkg, String fullText) {
        String low = fullText.toLowerCase();
        
        // FILTER KETAT: Hanya proses jika ada kata "masuk" atau ini Diagnostic
        if (low.contains("masuk") || pkg.equals(getPackageName())) {
            long amt = extractAmount(low);
            
            if (amt > 0) {
                // Tampilkan log di HP hanya jika lolos filter uang masuk
                updateUILog("💰 DETECTED: [" + pkg + "] Rp " + amt);
                updateUILog("Detail: " + fullText);
                
                // Kirim ke Firebase
                send(pkg, amt, fullText);
            } else if (pkg.equals(getPackageName())) {
                // Khusus diagnostic tetap muncul biarpun nominal 0
                updateUILog("DIAGNOSTIC: " + fullText);
            }
        } else {
            // Notifikasi lain dari aplikasi bank (seperti promo/info saldo) diabaikan total
            Log.d("AzzahraLog", "Ignored notification from " + pkg + " (No 'masuk' keyword)");
        }
    }

    private long extractAmount(String text) {
        try {
            Pattern p1 = Pattern.compile("(idr|rp)\\s*([0-9.,]+)");
            Matcher m1 = p1.matcher(text);
            if (m1.find()) {
                return parseCleanAmount(m1.group(2));
            }

            Pattern p2 = Pattern.compile("([0-9]{1,3}(\\.[0-9]{3})+)");
            Matcher m2 = p2.matcher(text);
            if (m2.find()) {
                return parseCleanAmount(m2.group(1));
            }
        } catch (Exception e) {}
        return 0;
    }

    private long parseCleanAmount(String raw) {
        if (raw.endsWith(".00") || raw.endsWith(",00")) {
            raw = raw.substring(0, raw.length() - 3);
        }
        String clean = raw.replaceAll("[^0-9]", "");
        return clean.isEmpty() ? 0 : Long.parseLong(clean);
    }

    private void updateUILog(String m) {
        Intent i = new Intent("com.azzahra.sync.NEW_LOG");
        String time = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        String entry = "[" + time + "] " + m;
        i.putExtra("log_message", entry);
        sendBroadcast(i);
    }

    private void send(String bank, long amt, String raw) {
        Map<String, Object> d = new HashMap<>();
        d.put("amount", amt); d.put("bank", bank); d.put("rawText", raw);
        d.put("timestamp", new Date().toString());
        d.put("createdAt", com.google.firebase.firestore.FieldValue.serverTimestamp());
        
        db.collection("paymentDetectionsPending").add(d)
            .addOnSuccessListener(doc -> updateUILog("☁️ SUCCESS: Data saved to Cloud!"))
            .addOnFailureListener(e -> updateUILog("❌ CLOUD ERROR: " + e.getMessage()));
    }
}
