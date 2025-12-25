package com.azzahra.sync;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.service.notification.NotificationListenerService;

import androidx.core.app.NotificationCompat;

public class ForegroundService extends Service {

    public static final String CHANNEL_ID = "AzzahraSyncChannelV2";
    private final Handler watchdogHandler = new Handler(Looper.getMainLooper());
    private Runnable watchdogRunnable;

    @Override
    public void onCreate() {
        super.onCreate();
        // Memulai sistem penjaga otomatis
        startWatchdog();
    }

    private void startWatchdog() {
        watchdogRunnable = new Runnable() {
            @Override
            public void run() {
                // REFRESH SYSTEM: Memaksa penyambungan ulang listener setiap 60 detik
                // Ini mencegah kondisi "Zombie Listener" atau macet di background
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        NotificationListenerService.requestRebind(new ComponentName(ForegroundService.this, NotificationService.class));
                    }
                } catch (Exception e) {
                    // Abaikan jika gagal, akan dicoba lagi 60 detik kemudian
                }
                watchdogHandler.postDelayed(this, 60000); // Detak setiap 60 detik
            }
        };
        watchdogHandler.post(watchdogRunnable);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createNotificationChannel();

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Azzahra Tools")
                .setContentText("Monitoring system notifications...")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();

        startForeground(1, notification);

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        // Hentikan timer saat service dimatikan
        if (watchdogHandler != null && watchdogRunnable != null) {
            watchdogHandler.removeCallbacks(watchdogRunnable);
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Azzahra Tools Monitoring",
                    NotificationManager.IMPORTANCE_LOW);
            serviceChannel.setDescription("Layanan untuk sinkronisasi data");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }
}
