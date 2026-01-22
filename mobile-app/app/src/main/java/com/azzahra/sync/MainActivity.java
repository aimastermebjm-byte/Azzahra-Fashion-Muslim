package com.azzahra.sync;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Base64;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.Filter;
import android.widget.Filterable;
import android.widget.ImageView;
import android.widget.ListView;
import android.widget.TabHost;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;

import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class MainActivity extends AppCompatActivity {

    private TextView statusText, txtPrinterStatus;
    private ListView appListView, logListView, printerListView;
    private EditText searchApps;
    private View statusIndicator, indicatorAppNotif, indicatorListener, indicatorBattery;
    private Button btnGrantNotif, btnBatteryIgnore, btnScanPrinter, btnTestPrint, btnLogout, btnSimulatePwa, btnGrantAppNotif, btnClearLog;
    private SharedPreferences prefs;
    private Set<String> selectedPackages;
    private List<AppInfo> allAppInfos = new ArrayList<>();
    private List<String> logEntries = new ArrayList<>();
    private ArrayAdapter<String> logAdapter;
    private AppAdapter appAdapter;
    private TabHost tabHost;

    private BluetoothPrinterManager printerManager;
    private List<BluetoothDevice> printerDevices = new ArrayList<>();
    private ArrayAdapter<String> printerAdapter;
    private PrintBridge printBridge;

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
        initUI();
        initTabs();
        checkUserRole();
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent != null && intent.getData() != null) {
            Uri uri = intent.getData();
            if ("azzahra-print".equals(uri.getScheme())) {
                String rawData = uri.getQueryParameter("data");
                if (rawData != null) processPrintRequest(rawData);
            }
        }
    }

    private void processPrintRequest(String rawData) {
        String decoded;
        try {
            byte[] bytes = Base64.decode(rawData, Base64.DEFAULT);
            decoded = new String(bytes, "UTF-8");
        } catch (Exception e) {
            decoded = rawData;
        }

        final String finalContent = decoded;

        if (!printerManager.isConnected()) {
            Toast.makeText(this, "🔄 Menghubungkan Printer...", Toast.LENGTH_SHORT).show();
            new Thread(() -> {
                printerManager.autoConnect();
                try { Thread.sleep(2000); } catch (InterruptedException ignored) {}
                runOnUiThread(() -> {
                    if (printerManager.isConnected()) executePrint(finalContent);
                    else {
                        Toast.makeText(this, "❌ Gagal menyambung. Hubungkan manual!", Toast.LENGTH_LONG).show();
                        tabHost.setCurrentTab(1);
                    }
                });
            }).start();
        } else {
            executePrint(finalContent);
        }
    }

    private void executePrint(String content) {
        try {
            if (content.trim().startsWith("{")) printBridge.printLabel(content);
            else printerManager.print(content);
            
            Toast.makeText(this, "🖨️ Mencetak Label...", Toast.LENGTH_SHORT).show();
            
            // SILENT MODE: Sembunyikan aplikasi setelah 1 detik
            new android.os.Handler().postDelayed(() -> moveTaskToBack(true), 1500);
        } catch (Exception e) {
            Toast.makeText(this, "Gagal: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void initUI() {
        selectedPackages = new HashSet<>(prefs.getStringSet("selected_packages", new HashSet<>()));

        statusText = findViewById(R.id.statusText);
        appListView = findViewById(R.id.appList);
        logListView = findViewById(R.id.logListView);
        searchApps = findViewById(R.id.searchApps);
        statusIndicator = findViewById(R.id.statusIndicator);
        indicatorAppNotif = findViewById(R.id.indicatorAppNotif);
        indicatorListener = findViewById(R.id.indicatorListener);
        indicatorBattery = findViewById(R.id.indicatorBattery);

        btnGrantAppNotif = findViewById(R.id.btnGrantAppNotif);
        btnGrantNotif = findViewById(R.id.btnGrantNotif);
        btnBatteryIgnore = findViewById(R.id.btnBatteryIgnore);
        btnClearLog = findViewById(R.id.btnClearLog);
        btnClearLog.setOnClickListener(v -> {
            logEntries.clear();
            addLogEntry("🗑️ Log Cleared");
            addLogEntry("📱 User: " + (FirebaseAuth.getInstance().getCurrentUser() != null ? FirebaseAuth.getInstance().getCurrentUser().getEmail() : "NULL"));
            checkPermissions();
        });
        btnLogout = findViewById(R.id.btnLogout);
        btnSimulatePwa = findViewById(R.id.btnSimulatePwa);
        txtPrinterStatus = findViewById(R.id.txtPrinterStatus);
        btnScanPrinter = findViewById(R.id.btnScanPrinter);
        btnTestPrint = findViewById(R.id.btnTestPrint);
        printerListView = findViewById(R.id.printerList);

        logAdapter = new ArrayAdapter<String>(this, android.R.layout.simple_list_item_1, logEntries) {
            @NonNull @Override public View getView(int position, @Nullable View v, @NonNull ViewGroup parent) {
                TextView tv = (TextView) super.getView(position, v, parent);
                tv.setTextSize(11); tv.setPadding(8, 8, 8, 8); return tv;
            }
        };
        logListView.setAdapter(logAdapter);

        // Add initial diagnostic log
        addLogEntry("📱 App Started - User: " + (FirebaseAuth.getInstance().getCurrentUser() != null ? FirebaseAuth.getInstance().getCurrentUser().getEmail() : "NULL"));
        addLogEntry("📋 Selected Apps: " + selectedPackages.size() + " apps monitored");
        logListView.setOnItemClickListener((p, v, pos, id) -> {
            new AlertDialog.Builder(this).setTitle("Log Detail").setMessage(logEntries.get(pos)).setPositiveButton("OK", null).show();
        });

        printerAdapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, new ArrayList<>());
        printerListView.setAdapter(printerAdapter);

        printerManager = new BluetoothPrinterManager(this);
        printBridge = new PrintBridge(this, printerManager);
        
        printerManager.setListener(status -> runOnUiThread(() -> {
            txtPrinterStatus.setText(status);
            if (status.contains("Terhubung")) {
                txtPrinterStatus.setTextColor(Color.parseColor("#4CAF50"));
                btnTestPrint.setEnabled(true);
            } else {
                txtPrinterStatus.setTextColor(Color.parseColor("#D32F2F"));
            }
        }));

        printerManager.autoConnect();

        btnGrantAppNotif.setOnClickListener(v -> {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            } else {
                intent.setAction("android.settings.APP_NOTIFICATION_SETTINGS");
                intent.putExtra("app_package", getPackageName());
            }
            startActivity(intent);
        });

        btnGrantNotif.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
        btnBatteryIgnore.setOnClickListener(v -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            }
        });

        btnLogout.setOnClickListener(v -> {
            FirebaseAuth.getInstance().signOut();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
        });

        btnScanPrinter.setOnClickListener(v -> scanPrinters());
        printerListView.setOnItemClickListener((p, v, pos, id) -> {
            BluetoothDevice device = printerDevices.get(pos);
            new Thread(() -> {
                try { printerManager.connect(device.getAddress()); } 
                catch (Exception e) { runOnUiThread(() -> Toast.makeText(this, "Gagal: " + e.getMessage(), Toast.LENGTH_SHORT).show()); }
            }).start();
        });

        btnTestPrint.setOnClickListener(v -> {
            try { printerManager.print("TES PRINT AZZAHRA\nPrinter Bluetooth 58mm\nStatus: OK!\n\n\n"); } catch (Exception e) {}
        });

        btnSimulatePwa.setOnClickListener(v -> {
            String dummyJson = "{\"name\":\"Pembeli Test\",\"phone\":\"0812345678\",\"address\":\"Jl. Testing No. 123\",\"items\":\"1x Gamis Biru\",\"courier\":\"J&T\",\"orderId\":\"ORD001\"}";
            executePrint(dummyJson);
        });

        searchApps.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) { if (appAdapter != null) appAdapter.getFilter().filter(s); }
            @Override public void afterTextChanged(Editable s) {}
        });

        loadAppList();
        triggerStartServices();
    }

    private void initTabs() {
        tabHost = findViewById(android.R.id.tabhost);
        tabHost.setup();
        tabHost.addTab(tabHost.newTabSpec("Sync").setIndicator("SYNC").setContent(R.id.tabSync));
        tabHost.addTab(tabHost.newTabSpec("Settings").setIndicator("PRINTER").setContent(R.id.tabPrinter));
    }

    private void checkUserRole() {
        String uid = FirebaseAuth.getInstance().getUid();
        if (uid == null) return;
        FirebaseFirestore.getInstance().collection("users").document(uid).get()
            .addOnSuccessListener(doc -> {
                String role = doc.getString("role");
                if ("admin".equalsIgnoreCase(role)) tabHost.getTabWidget().getChildAt(0).setVisibility(View.GONE);
            });
    }

    private void scanPrinters() {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null || !adapter.isEnabled()) return;
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT}, 101);
            return;
        }
        printerDevices.clear(); printerAdapter.clear();
        Set<BluetoothDevice> paired = adapter.getBondedDevices();
        for (BluetoothDevice device : paired) {
            printerDevices.add(device);
            printerAdapter.add(device.getName() + "\n" + device.getAddress());
        }
        printerAdapter.notifyDataSetChanged();
    }

    private void triggerStartServices() {
        try {
            NotificationListenerService.requestRebind(new ComponentName(this, NotificationService.class));
            Intent fgIntent = new Intent(this, ForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(fgIntent); else startService(fgIntent);
            addLogEntry("🔄 Services Started");
        } catch (Exception e) {
            addLogEntry("❌ Service Error: " + e.getMessage());
        }
    }

    private void addLogEntry(String message) {
        String time = new java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(new java.util.Date());
        logEntries.add(0, "[" + time + "] " + message);
        if (logEntries.size() > 100) logEntries.remove(logEntries.size() - 1);
        if (logAdapter != null) logAdapter.notifyDataSetChanged();
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

    @Override protected void onResume() { super.onResume(); checkPermissions(); IntentFilter f = new IntentFilter("com.azzahra.sync.NEW_LOG"); if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) registerReceiver(logReceiver, f, Context.RECEIVER_EXPORTED); else registerReceiver(logReceiver, f); }
    @Override protected void onPause() { super.onPause(); unregisterReceiver(logReceiver); }

    private void checkPermissions() {
        boolean appNotifOk = NotificationManagerCompat.from(this).areNotificationsEnabled();
        boolean listenerOk = NotificationManagerCompat.getEnabledListenerPackages(this).contains(getPackageName());
        boolean batteryOk = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            batteryOk = pm.isIgnoringBatteryOptimizations(getPackageName());
        }
        if (indicatorAppNotif != null) indicatorAppNotif.setBackgroundResource(appNotifOk ? R.drawable.circle_green : R.drawable.circle_red);
        if (indicatorListener != null) indicatorListener.setBackgroundResource(listenerOk ? R.drawable.circle_green : R.drawable.circle_red);
        if (indicatorBattery != null) indicatorBattery.setBackgroundResource(batteryOk ? R.drawable.circle_green : R.drawable.circle_red);
        boolean allOk = appNotifOk && listenerOk && batteryOk;
        if (statusIndicator != null) statusIndicator.setBackgroundResource(allOk ? R.drawable.circle_green : R.drawable.circle_red);
        if (statusText != null) {
            statusText.setText(allOk ? "ACTIVE" : "OFF (Cek Izin!)");
            statusText.setTextColor(allOk ? Color.parseColor("#4CAF50") : Color.parseColor("#D32F2F"));
        }
        // Log permission status for debugging
        addLogEntry("🔐 Notif:" + (appNotifOk?"✅":"❌") + " Listener:" + (listenerOk?"✅":"❌") + " Battery:" + (batteryOk?"✅":"❌"));
    }

    private static class AppInfo { String name, packageName; Drawable icon; boolean selected; AppInfo(String n, String p, Drawable i, boolean s) { this.name = n; this.packageName = p; this.icon = i; this.selected = s; } }
    private class AppAdapter extends ArrayAdapter<AppInfo> implements Filterable {
        private List<AppInfo> original, filtered;
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
            cb.setOnCheckedChangeListener((bv, isChecked) -> { if (isChecked) selectedPackages.add(app.packageName); else selectedPackages.remove(app.packageName); prefs.edit().putStringSet("selected_packages", new HashSet<>(selectedPackages)).apply(); });
            v.setOnClickListener(view -> cb.performClick()); return v;
        }
        @NonNull @Override public Filter getFilter() {
            return new Filter() {
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
}
