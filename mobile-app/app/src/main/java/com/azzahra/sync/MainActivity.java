package com.azzahra.sync;

import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.FirebaseApp;

import java.util.Set;

public class MainActivity extends AppCompatActivity {

    private TextView statusText;
    private Button btnGrantNotif;
    private Button btnBatteryOpt;
    private View statusIndicator;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Initialize Firebase
        FirebaseApp.initializeApp(this);

        statusText = findViewById(R.id.statusText);
        btnGrantNotif = findViewById(R.id.btnGrantNotif);
        btnBatteryOpt = findViewById(R.id.btnBatteryOpt);
        statusIndicator = findViewById(R.id.statusIndicator);

        btnGrantNotif.setOnClickListener(v -> openNotificationSettings());
        btnBatteryOpt.setOnClickListener(v -> requestBatteryOptimization());

        // Start Foreground Service immediately
        startService();
    }

    @Override
    protected void onResume() {
        super.onResume();
        checkPermissions();
    }

    private void checkPermissions() {
        boolean isNotifGranted = isNotificationServiceEnabled();

        if (isNotifGranted) {
            statusText.setText("Status: ACTIVE (Listening...)");
            statusIndicator.setBackgroundResource(R.drawable.circle_green);
            btnGrantNotif.setEnabled(false);
            btnGrantNotif.setText("Permission Granted ✅");
        } else {
            statusText.setText("Status: INACTIVE (Need Permission)");
            statusIndicator.setBackgroundResource(R.drawable.circle_red);
            btnGrantNotif.setEnabled(true);
            btnGrantNotif.setText("Grant Permission");
        }
    }

    private boolean isNotificationServiceEnabled() {
        Set<String> packageNames = NotificationManagerCompat.getEnabledListenerPackages(this);
        return packageNames.contains(getPackageName());
    }

    private void openNotificationSettings() {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        startActivity(intent);
    }

    private void requestBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent();
            String packageName = getPackageName();
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + packageName));
                startActivity(intent);
            } else {
                Toast.makeText(this, "Battery optimization already ignored 👍", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void startService() {
        Intent serviceIntent = new Intent(this, ForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }
}
