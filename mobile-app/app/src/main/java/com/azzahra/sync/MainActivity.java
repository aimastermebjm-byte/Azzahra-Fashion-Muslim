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

import com.google.firebase.FirebaseApp;

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
        setContentView(R.layout.activity_main);

        FirebaseApp.initializeApp(this);
        prefs = getSharedPreferences("AzzahraPrefs", MODE_PRIVATE);
        
        Set<String> saved = prefs.getStringSet("selected_packages", new HashSet<>());
        selectedPackages = new HashSet<>(saved);

        statusText = findViewById(R.id.statusText);
        appListView = findViewById(R.id.appList);
        logListView = findViewById(R.id.logListView);
        searchApps = findViewById(R.id.searchApps);
        statusIndicator = findViewById(R.id.statusIndicator);

        // Setup Log List
        logAdapter = new ArrayAdapter<String>(this, android.R.layout.simple_list_item_1, logEntries) {
            @NonNull
            @Override
            public View getView(int position, @Nullable View convertView, @NonNull ViewGroup parent) {
                TextView tv = (TextView) super.getView(position, convertView, parent);
                tv.setTextSize(11);
                tv.setPadding(8, 8, 8, 8);
                return tv;
            }
        };
        logListView.setAdapter(logAdapter);
        logListView.setOnItemClickListener((parent, view, position, id) -> {
            new AlertDialog.Builder(this)
                    .setTitle("Detail Log")
                    .setMessage(logEntries.get(position))
                    .setPositiveButton("Close", null)
                    .show();
        });

        findViewById(R.id.btnGrantNotif).setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
        findViewById(R.id.btnBatteryOpt).setOnClickListener(v -> requestBatteryOptimization());
        findViewById(R.id.btnTestNotif).setOnClickListener(v -> sendTestNotification());
        
        findViewById(R.id.btnClearLog).setOnClickListener(v -> {
            logEntries.clear();
            logAdapter.notifyDataSetChanged();
            prefs.edit().putString("log_history_list", "").apply();
        });

        findViewById(R.id.btnRefresh).setOnClickListener(v -> {
            NotificationListenerService.requestRebind(new ComponentName(this, NotificationService.class));
            Toast.makeText(this, "Refreshing Connection...", Toast.LENGTH_SHORT).show();
        });

        loadAppList();
        searchApps.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (appAdapter != null) appAdapter.getFilter().filter(s);
            }
            @Override public void afterTextChanged(Editable s) {}
        });

        startService();
    }

    private void loadAppList() {
        PackageManager pm = getPackageManager();
        List<ApplicationInfo> packages = pm.getInstalledApplications(PackageManager.GET_META_DATA);
        allAppInfos.clear();
        for (ApplicationInfo app : packages) {
            allAppInfos.add(new AppInfo(app.loadLabel(pm).toString(), app.packageName, app.loadIcon(pm), selectedPackages.contains(app.packageName)));
        }
        Collections.sort(allAppInfos, (a, b) -> a.name.compareToIgnoreCase(b.name));
        appAdapter = new AppAdapter(this, allAppInfos);
        appListView.setAdapter(appAdapter);
    }

    private static class AppInfo {
        String name, packageName;
        Drawable icon;
        boolean selected;
        AppInfo(String name, String pkg, Drawable icon, boolean sel) { this.name = name; this.packageName = pkg; this.icon = icon; this.selected = sel; }
    }

    private class AppAdapter extends ArrayAdapter<AppInfo> {
        private List<AppInfo> originalList;
        private List<AppInfo> filteredList;
        AppAdapter(Context context, List<AppInfo> apps) { super(context, 0, apps); this.originalList = new ArrayList<>(apps); this.filteredList = apps; }
        @Override public int getCount() { return filteredList.size(); }
        @Nullable @Override public AppInfo getItem(int position) { return filteredList.get(position); }
        @NonNull @Override public View getView(int position, @Nullable View convertView, @NonNull ViewGroup parent) {
            if (convertView == null) convertView = LayoutInflater.from(getContext()).inflate(R.layout.item_app, parent, false);
            AppInfo app = filteredList.get(position);
            ((TextView)convertView.findViewById(R.id.appName)).setText(app.name);
            ((TextView)convertView.findViewById(R.id.appPkg)).setText(app.packageName);
            ((ImageView)convertView.findViewById(R.id.appIcon)).setImageDrawable(app.icon);
            CheckBox cb = convertView.findViewById(R.id.appCheck);
            cb.setOnCheckedChangeListener(null);
            cb.setChecked(selectedPackages.contains(app.packageName));
            cb.setOnCheckedChangeListener((bv, isChecked) -> {
                if (isChecked) selectedPackages.add(app.packageName);
                else selectedPackages.remove(app.packageName);
                prefs.edit().putStringSet("selected_packages", new HashSet<>(selectedPackages)).apply();
            });
            convertView.setOnClickListener(v -> cb.performClick());
            return convertView;
        }
        @NonNull @Override public android.widget.Filter getFilter() {
            return new android.widget.Filter() {
                @Override protected FilterResults performFiltering(CharSequence c) {
                    FilterResults r = new FilterResults();
                    List<AppInfo> f = new ArrayList<>();
                    if (c == null || c.length() == 0) f.addAll(originalList);
                    else {
                        String p = c.toString().toLowerCase().trim();
                        for (AppInfo i : originalList) if (i.name.toLowerCase().contains(p) || i.packageName.toLowerCase().contains(p)) f.add(i);
                    }
                    r.values = f; r.count = f.size(); return r;
                }
                @Override protected void publishResults(CharSequence c, FilterResults r) { filteredList = (List<AppInfo>) r.values; notifyDataSetChanged(); }
            };
        }
    }

    private void requestBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
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
        statusText.setText(ok ? "Status: ACTIVE" : "Status: OFF");
        statusIndicator.setBackgroundResource(ok ? R.drawable.circle_green : R.drawable.circle_red);
    }

    private void startService() {
        Intent si = new Intent(this, ForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(si);
        else startService(si);
    }
}
