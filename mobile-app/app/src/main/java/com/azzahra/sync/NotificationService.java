package com.azzahra.sync;

import android.app.Notification;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
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
        
        try {
            StatusBarNotification[] activeNotifs = getActiveNotifications();
            if (activeNotifs != null) {
                updateUILog("Scanning " + activeNotifs.length + " notifications...");
                for (StatusBarNotification sbn : activeNotifs) {
                    onNotificationPosted(sbn);
                }
            }
        } catch (Exception e) {
            Log.e("AzzahraLog", "Initial scan error", e);
        }
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

            if (selected.contains(pkg) || pkg.equals(getPackageName())) {
                process(pkg, title + " " + text);
            }
        } catch (Exception e) {}
    }

    private void process(String pkg, String fullText) {
        String low = fullText.toLowerCase();
        
        if (low.contains("masuk") || pkg.equals(getPackageName())) {
            long amt = extractAmount(low);
            
            if (amt > 0) {
                updateUILog("💰 DETECTED: [" + pkg + "] Rp " + amt);
                send(pkg, amt, fullText);
            } else if (pkg.equals(getPackageName())) {
                updateUILog("DIAGNOSTIC: " + fullText);
            }
        }
    }

    private long extractAmount(String text) {
        try {
            Pattern p1 = Pattern.compile("(idr|rp)\\s*([0-9.,]+)");
            Matcher m1 = p1.matcher(text);
            if (m1.find()) return parseCleanAmount(m1.group(2));

            Pattern p2 = Pattern.compile("([0-9]{1,3}(\\.[0-9]{3})+)");
            Matcher m2 = p2.matcher(text);
            if (m2.find()) return parseCleanAmount(m2.group(1));
        } catch (Exception e) {}
        return 0;
    }

    private long parseCleanAmount(String raw) {
        if (raw.endsWith(".00") || raw.endsWith(",00")) raw = raw.substring(0, raw.length() - 3);
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

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkInfo ani = cm.getActiveNetworkInfo();
        return ani != null && ani.isConnected();
    }

    private void send(String bank, long amt, String raw) {
        Map<String, Object> d = new HashMap<>();
        d.put("amount", amt); d.put("bank", bank); d.put("rawText", raw);
        d.put("timestamp", new Date().toString());
        d.put("createdAt", com.google.firebase.firestore.FieldValue.serverTimestamp());
        
        if (!isNetworkAvailable()) {
            updateUILog("🌐 OFFLINE: Data queued in phone (will sync later)");
        } else {
            updateUILog("🚀 SENDING TO CLOUD...");
        }

        db.collection("paymentDetectionsPending").add(d)
            .addOnSuccessListener(doc -> updateUILog("☁️ SUCCESS: Saved to Firebase!"))
            .addOnFailureListener(e -> updateUILog("❌ FIREBASE ERROR: " + e.getMessage()));
    }
}
