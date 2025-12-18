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

            if (selected.contains(pkg)) {
                updateUILog("MATCHED: [" + pkg + "] " + text);
                process(pkg, title + " " + text);
            } else if (pkg.equals(getPackageName())) {
                updateUILog("DIAGNOSTIC: " + text);
                process(pkg, title + " " + text); // Allow diagnostic to send to Firebase for testing
            }
        } catch (Exception e) {}
    }

    private void process(String pkg, String fullText) {
        String low = fullText.toLowerCase();
        
        // Pemicu filter
        boolean trigger = low.contains("idr") || low.contains("rp") || low.contains("pemasukan") || 
                         low.contains("transfer") || low.contains("berhasil") || low.contains("terima") || 
                         low.contains("masuk") || low.contains("kredit");

        if (trigger) {
            long amt = extractAmount(low);
            if (amt > 0) {
                updateUILog("🚀 SENDING TO FIREBASE: " + amt);
                send(pkg, amt, fullText);
            } else {
                updateUILog("⚠️ Keywords matched, but amount NOT found.");
            }
        }
    }

    private long extractAmount(String text) {
        try {
            // Regex lebih kuat: Cari angka setelah IDR/Rp atau angka yang mengandung titik/koma
            // Pattern 1: Mencari angka setelah IDR atau Rp
            Pattern p1 = Pattern.compile("(idr|rp)\\s*([0-9.,]+)");
            Matcher m1 = p1.matcher(text);
            if (m1.find()) {
                return parseCleanAmount(m1.group(2));
            }

            // Pattern 2: Jika tidak ada Rp/IDR, cari angka besar (ribuan) yang punya titik
            Pattern p2 = Pattern.compile("([0-9]{1,3}(\\.[0-9]{3})+)");
            Matcher m2 = p2.matcher(text);
            if (m2.find()) {
                return parseCleanAmount(m2.group(1));
            }
        } catch (Exception e) {}
        return 0;
    }

    private long parseCleanAmount(String raw) {
        // Buang desimal .00 atau ,00 di akhir
        if (raw.endsWith(".00") || raw.endsWith(",00")) {
            raw = raw.substring(0, raw.length() - 3);
        }
        // Buang semua karakter kecuali angka
        String clean = raw.replaceAll("[^0-9]", "");
        return clean.isEmpty() ? 0 : Long.parseLong(clean);
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
            .addOnSuccessListener(doc -> updateUILog("☁️ SUCCESS: Sent to Firebase!"))
            .addOnFailureListener(e -> updateUILog("❌ FIREBASE ERROR: " + e.getMessage()));
    }
}
