package com.azzahra.sync;

import android.app.AlertDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.auth.FirebaseAuth;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class MainActivity extends AppCompatActivity {

    private TextView statusText;
    private ListView appListView, logListView;
    private EditText searchApps;
    private View statusIndicator;
    private SharedPreferences prefs;
    private Set<String> selectedPackages;
    private List<AppInfo> allAppInfos = new ArrayList<>();
    private List<String> logEntries = new ArrayList<>();
    private ArrayAdapter<String> logAdapter;
    private AppAdapter appAdapter;

    private final BroadcastReceiver logReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String newLog = intent.getStringExtra("log_message");
            if (newLog != null) {
                runOnUiThread(() -> {
                    logEntries.add(0, newLog);
                    if (logEntries.size() > 100) logEntries.remove(logEntries.size() - 1);
                    logAdapter.notifyDataSetChanged();
                });
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        if (FirebaseAuth.getInstance().getCurrentUser() == null) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        setContentView(R.layout.activity_main);

        prefs = getSharedPreferences("AzzahraPrefs", MODE_PRIVATE);
        selectedPackages = new HashSet<>(prefs.getStringSet("selected_packages", new HashSet<>()));

        statusText = findViewById(R.id.statusText);
        appListView = findViewById(R.id.appList);
        logListView = findViewById(R.id.logListView);
        searchApps = findViewById(R.id.searchApps);
        statusIndicator = findViewById(R.id.statusIndicator);

        // Load saved history
        String history = prefs.getString("log_history_list", "");
        if (!history.isEmpty()) {
            String[] items = history.split("\\|\\|\\|");
            for (String item : items) if (!item.trim().isEmpty()) logEntries.add(item);
        }

        logAdapter = new ArrayAdapter<String>(this, android.R.layout.simple_list_item_1, logEntries) {
            @NonNull @Override public View getView(int position, @Nullable View v, @NonNull ViewGroup parent) {
                TextView tv = (TextView) super.getView(position, v, parent);
                tv.setTextSize(11); tv.setPadding(8, 8, 8, 8); return tv;
            }
        };
        logListView.setAdapter(logAdapter);
        logListView.setOnItemClickListener((p, v, pos, id) -> {
            new AlertDialog.Builder(this).setTitle("Detail Log").setMessage(logEntries.get(pos)).setPositiveButton("Close", null).show();
        });

        findViewById(R.id.btnGrantNotif).setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));

        findViewById(R.id.btnTestNotif).setOnClickListener(v -> {
            Intent i = new Intent(this, NotificationService.class); 
            i.setAction("SCAN_NOW"); 
            startService(i);
            sendTestNotification();
        });
        
        findViewById(R.id.btnClearLog).setOnClickListener(v -> {
            logEntries.clear(); 
            logAdapter.notifyDataSetChanged();
            prefs.edit().putString("log_history_list", "").apply();
        });

        findViewById(R.id.btnRefresh).setOnClickListener(v -> {
            NotificationListenerService.requestRebind(new ComponentName(this, NotificationService.class));
            startForegroundService(new Intent(this, ForegroundService.class));
            checkPermissions();
            Toast.makeText(this, "System Restored!", Toast.LENGTH_SHORT).show();
        });

        loadAppList();
        searchApps.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) { if (appAdapter != null) appAdapter.getFilter().filter(s); }
            @Override public void afterTextChanged(Editable s) {}
        });
    }

    private void loadAppList() {
        new Thread(() -> {
            PackageManager pm = getPackageManager();
            List<ApplicationInfo> packages = pm.getInstalledApplications(PackageManager.GET_META_DATA);
            List<AppInfo> temp = new ArrayList<>();
            for (ApplicationInfo app : packages) temp.add(new AppInfo(app.loadLabel(pm).toString(), app.packageName, app.loadIcon(pm), selectedPackages.contains(app.packageName)));
            Collections.sort(temp, (a, b) -> a.name.compareToIgnoreCase(b.name));
            runOnUiThread(() -> { allAppInfos.clear(); allAppInfos.addAll(temp); appAdapter = new AppAdapter(this, allAppInfos); appListView.setAdapter(appAdapter); });
        }).start();
    }

    private static class AppInfo {
        String name, packageName; Drawable icon; boolean selected;
        AppInfo(String n, String p, Drawable i, boolean s) { this.name = n; this.packageName = p; this.icon = i; this.selected = s; }
    }

    private class AppAdapter extends ArrayAdapter<AppInfo> {
        private List<AppInfo> original; private List<AppInfo> filtered;
        AppAdapter(Context c, List<AppInfo> a) { super(c, 0, a); this.original = new ArrayList<>(a); this.filtered = a; }
        @Override public int getCount() { return filtered.size(); }
        @Nullable @Override public AppInfo getItem(int p) { return filtered.get(p); }
        @NonNull @Override public View getView(int p, @Nullable View v, @NonNull ViewGroup parent) {
            if (v == null) v = LayoutInflater.from(getContext()).inflate(R.layout.item_app, parent, false);
            AppInfo app = filtered.get(p);
            ((TextView)v.findViewById(R.id.appName)).setText(app.name);
            ((TextView)v.findViewById(R.id.appPkg)).setText(app.packageName);
            ((ImageView)v.findViewById(R.id.appIcon)).setImageDrawable(app.icon);
            CheckBox cb = v.findViewById(R.id.appCheck);
            cb.setOnCheckedChangeListener(null); cb.setChecked(selectedPackages.contains(app.packageName));
            cb.setOnCheckedChangeListener((bv, isChecked) -> {
                if (isChecked) selectedPackages.add(app.packageName); else selectedPackages.remove(app.packageName);
                prefs.edit().putStringSet("selected_packages", new HashSet<>(selectedPackages)).apply();
            });
            v.setOnClickListener(view -> cb.performClick()); return v;
        }
        @NonNull @Override public android.widget.Filter getFilter() {
            return new android.widget.Filter() {
                @Override protected FilterResults performFiltering(CharSequence c) {
                    FilterResults r = new FilterResults(); List<AppInfo> f = new ArrayList<>();
                    if (c == null || c.length() == 0) f.addAll(original);
                    else { String p = c.toString().toLowerCase().trim(); for (AppInfo i : original) if (i.name.toLowerCase().contains(p) || i.packageName.toLowerCase().contains(p)) f.add(i); }
                    r.values = f; r.count = f.size(); return r;
                }
                @Override protected void publishResults(CharSequence c, FilterResults r) { filtered = (List<AppInfo>) r.values; notifyDataSetChanged(); }
            };
        }
    }

    private void sendTestNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) nm.createNotificationChannel(new NotificationChannel("diag", "Diag", NotificationManager.IMPORTANCE_DEFAULT));
        nm.notify(77, new NotificationCompat.Builder(this, "diag").setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("Diagnostic Test").setContentText("Pemasukan IDR 10.000").build());
    }

    @Override
    protected void onResume() {
        super.onResume();
        checkPermissions();
        IntentFilter f = new IntentFilter("com.azzahra.sync.NEW_LOG");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) registerReceiver(logReceiver, f, Context.RECEIVER_EXPORTED);
        else registerReceiver(logReceiver, f);
    }

    @Override protected void onPause() { super.onPause(); unregisterReceiver(logReceiver); }

    private void checkPermissions() {
        boolean ok = NotificationManagerCompat.getEnabledListenerPackages(this).contains(getPackageName());
        statusText.setText(ok ? "Status: ACTIVE" : "Status: OFF (Setup Permissions)");
        statusIndicator.setBackgroundResource(ok ? R.drawable.circle_green : R.drawable.circle_red);
    }
}
