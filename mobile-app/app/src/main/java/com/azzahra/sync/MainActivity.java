package com.azzahra.sync;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
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
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.ListView;
import android.widget.ProgressBar;
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

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class MainActivity extends AppCompatActivity {

    private TextView statusText, txtPrinterStatus;
    private ListView appListView, logListView, printerListView;
    private EditText searchApps, etWebUrl;
    private View statusIndicator;
    private Button btnGrantNotif, btnBatteryIgnore, btnAppNotif, btnScanPrinter, btnTestPrint, btnSaveUrl, btnLogout;
    private SharedPreferences prefs;
    private Set<String> selectedPackages;
    private List<AppInfo> allAppInfos = new ArrayList<>();
    private List<String> logEntries = new ArrayList<>();
    private ArrayAdapter<String> logAdapter;
    private AppAdapter appAdapter;
    private TabHost tabHost;

    // WebView & Printer
    private WebView webView;
    private ProgressBar webProgress;
    private BluetoothPrinterManager printerManager;
    private List<BluetoothDevice> printerDevices = new ArrayList<>();
    private ArrayAdapter<String> printerAdapter;

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
        initUI();
        initTabs();
        initWebView();
        checkUserRole();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void initUI() {
        prefs = getSharedPreferences("AzzahraPrefs", MODE_PRIVATE);
        selectedPackages = new HashSet<>(prefs.getStringSet("selected_packages", new HashSet<>()));

        // Sync UI
        statusText = findViewById(R.id.statusText);
        appListView = findViewById(R.id.appList);
        logListView = findViewById(R.id.logListView);
        searchApps = findViewById(R.id.searchApps);
        statusIndicator = findViewById(R.id.statusIndicator);
        btnGrantNotif = findViewById(R.id.btnGrantNotif);
        btnBatteryIgnore = findViewById(R.id.btnBatteryIgnore);
        btnAppNotif = findViewById(R.id.btnAppNotif);

        // Web & Printer UI
        webView = findViewById(R.id.webView);
        webProgress = findViewById(R.id.webProgress);
        etWebUrl = findViewById(R.id.etWebUrl);
        btnSaveUrl = findViewById(R.id.btnSaveUrl);
        btnLogout = findViewById(R.id.btnLogout);
        txtPrinterStatus = findViewById(R.id.txtPrinterStatus);
        btnScanPrinter = findViewById(R.id.btnScanPrinter);
        btnTestPrint = findViewById(R.id.btnTestPrint);
        printerListView = findViewById(R.id.printerList);

        // Setup Adapters
        logAdapter = new ArrayAdapter<String>(this, android.R.layout.simple_list_item_1, logEntries) {
            @NonNull @Override public View getView(int position, @Nullable View v, @NonNull ViewGroup parent) {
                TextView tv = (TextView) super.getView(position, v, parent);
                tv.setTextSize(11); tv.setPadding(8, 8, 8, 8); return tv;
            }
        };
        logListView.setAdapter(logAdapter);

        printerAdapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, new ArrayList<>());
        printerListView.setAdapter(printerAdapter);

        // Printer Manager
        printerManager = new BluetoothPrinterManager(this);
        printerManager.autoConnect();

        // Listeners
        btnGrantNotif.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
        btnBatteryIgnore.setOnClickListener(v -> {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        });

        findViewById(R.id.btnClearLog).setOnClickListener(v -> { logEntries.clear(); logAdapter.notifyDataSetChanged(); });
        
        btnSaveUrl.setOnClickListener(v -> {
            String url = etWebUrl.getText().toString().trim();
            if (!url.startsWith("http")) url = "https://" + url;
            prefs.edit().putString("pwa_url", url).apply();
            webView.loadUrl(url);
            Toast.makeText(this, "URL disimpan & memuat ulang...", Toast.LENGTH_SHORT).show();
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
                try {
                    printerManager.connect(device.getAddress());
                    runOnUiThread(() -> {
                        txtPrinterStatus.setText("Status: CONNECTED (" + device.getName() + ")");
                        txtPrinterStatus.setTextColor(Color.parseColor("#4CAF50"));
                        btnTestPrint.setEnabled(true);
                    });
                } catch (Exception e) {
                    runOnUiThread(() -> Toast.makeText(this, "Gagal konek: " + e.getMessage(), Toast.LENGTH_SHORT).show());
                }
            }).start();
        });

        btnTestPrint.setOnClickListener(v -> {
            try { printerManager.print("TES PRINT AZZAHRA SYNC\nPrinter 58mm OK!\n\n\n"); } catch (Exception e) {}
        });

        loadAppList();
        searchApps.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) { if (appAdapter != null) appAdapter.getFilter().filter(s); }
            @Override public void afterTextChanged(Editable s) {}
        });

        triggerStartServices();
    }

    private void initTabs() {
        tabHost = findViewById(android.R.id.tabhost);
        tabHost.setup();
        tabHost.addTab(tabHost.newTabSpec("Web").setIndicator("HOME").setContent(R.id.tabWeb));
        tabHost.addTab(tabHost.newTabSpec("Sync").setIndicator("SYNC").setContent(R.id.tabSync));
        tabHost.addTab(tabHost.newTabSpec("Printer").setIndicator("SETTINGS").setContent(R.id.tabPrinter));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void initWebView() {
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            public void onProgressChanged(WebView view, int newProgress) {
                webProgress.setProgress(newProgress);
                webProgress.setVisibility(newProgress == 100 ? View.GONE : View.VISIBLE);
            }
        });

        // REGISTER JAVASCRIPT INTERFACE SESUAI SPEK AGENT PWA
        webView.addJavascriptInterface(new PrintBridge(this, printerManager), "AndroidPrint");

        String savedUrl = prefs.getString("pwa_url", "https://azzahra-fashion-muslim.vercel.app");
        etWebUrl.setText(savedUrl);
        webView.loadUrl(savedUrl);
    }

    private void checkUserRole() {
        String uid = FirebaseAuth.getInstance().getUid();
        if (uid == null) return;
        FirebaseFirestore.getInstance().collection("users").document(uid).get()
            .addOnSuccessListener(doc -> {
                String role = doc.getString("role");
                if ("admin".equalsIgnoreCase(role)) {
                    // ADMIN HANYA LIHAT WEB & SETTINGS
                    tabHost.getTabWidget().getChildAt(1).setVisibility(View.GONE);
                }
            });
    }

    private void scanPrinters() {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            Toast.makeText(this, "Nyalakan Bluetooth HP!", Toast.LENGTH_SHORT).show();
            return;
        }

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT}, 101);
                return;
            }
        }

        printerDevices.clear();
        printerAdapter.clear();
        Set<BluetoothDevice> paired = adapter.getBondedDevices();
        for (BluetoothDevice device : paired) {
            printerDevices.add(device);
            printerAdapter.add(device.getName() + "\n" + device.getAddress());
        }
        printerAdapter.notifyDataSetChanged();
        if (printerDevices.isEmpty()) Toast.makeText(this, "Pairing printer dulu di pengaturan Bluetooth HP!", Toast.LENGTH_LONG).show();
    }

    private void triggerStartServices() {
        try {
            NotificationListenerService.requestRebind(new ComponentName(this, NotificationService.class));
            Intent fgIntent = new Intent(this, ForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(fgIntent);
            else startService(fgIntent);
        } catch (Exception e) {}
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
        boolean listenerOk = NotificationManagerCompat.getEnabledListenerPackages(this).contains(getPackageName());
        statusText.setText(listenerOk ? "Status: ACTIVE" : "Status: OFF");
        statusIndicator.setBackgroundResource(listenerOk ? R.drawable.circle_green : R.drawable.circle_red);
    }

    private static class AppInfo { String name, packageName; Drawable icon; boolean selected; AppInfo(String n, String p, Drawable i, boolean s) { this.name = n; this.packageName = p; this.icon = i; this.selected = s; } }
    private class AppAdapter extends ArrayAdapter<AppInfo> {
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

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
