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
import java.net.URLDecoder;
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
    private Button btnGrantNotif, btnBatteryIgnore, btnScanPrinter, btnTestPrint, btnSaveUrl, btnLogout, btnSimulatePwa;
    private SharedPreferences prefs;
    private Set<String> selectedPackages;
    private List<AppInfo> allAppInfos = new ArrayList<>();
    private List<String> logEntries = new ArrayList<>();
    private ArrayAdapter<String> logAdapter;
    private AppAdapter appAdapter;
    private TabHost tabHost;

    private WebView webView;
    private ProgressBar webProgress;
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
        initUI();
        initTabs();
        checkUserRole();

        // Handle Deep Link (azzahra-print://) if app opened via link
        handleIntent(getIntent());
    }

    @Override
    protected void onStart() {
        super.onStart();
        // Force auto-connect every time app comes to foreground
        if (printerManager != null && !printerManager.isConnected()) {
            printerManager.autoConnect();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        
        // Force auto-connect when app triggered by deep link
        if (printerManager != null && !printerManager.isConnected()) {
            printerManager.autoConnect();
        }
        
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null) {
            String url = intent.getData().toString();
            if (url.startsWith("azzahra-print://")) {
                handleCustomPrintScheme(url);
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void initUI() {
        prefs = getSharedPreferences("AzzahraPrefs", MODE_PRIVATE);
        selectedPackages = new HashSet<>(prefs.getStringSet("selected_packages", new HashSet<>()));

        statusText = findViewById(R.id.statusText);
        appListView = findViewById(R.id.appList);
        logListView = findViewById(R.id.logListView);
        searchApps = findViewById(R.id.searchApps);
        statusIndicator = findViewById(R.id.statusIndicator);
        btnGrantNotif = findViewById(R.id.btnGrantNotif);
        btnBatteryIgnore = findViewById(R.id.btnBatteryIgnore);

        webView = findViewById(R.id.webView);
        webProgress = findViewById(R.id.webProgress);
        etWebUrl = findViewById(R.id.etWebUrl);
        
        // LOAD SAVED URL
        String savedUrl = prefs.getString("pwa_url", "https://azzahra-fashion-muslim.vercel.app");
        etWebUrl.setText(savedUrl);

        btnSaveUrl = findViewById(R.id.btnSaveUrl);
        btnLogout = findViewById(R.id.btnLogout);
        btnSimulatePwa = findViewById(R.id.btnSimulatePwa);
        txtPrinterStatus = findViewById(R.id.txtPrinterStatus);
        btnScanPrinter = findViewById(R.id.btnScanPrinter);
        btnTestPrint = findViewById(R.id.btnTestPrint);
        printerListView = findViewById(R.id.printerList);

        logAdapter = new ArrayAdapter<String>(this, android.R.layout.simple_list_item_1, logEntries);
        logListView.setAdapter(logAdapter);

        printerAdapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, new ArrayList<>());
        printerListView.setAdapter(printerAdapter);

        printerManager = new BluetoothPrinterManager(this);
        printBridge = new PrintBridge(this, printerManager);
        
        // Listen for Printer Status & Update UI
        printerManager.setListener(status -> {
            runOnUiThread(() -> {
                txtPrinterStatus.setText(status);
                if (status.contains("Terhubung")) {
                    Toast.makeText(MainActivity.this, "Printer Siap! 🖨️", Toast.LENGTH_SHORT).show();
                }
            });
        });

        printerManager.autoConnect();

        btnGrantNotif.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
        btnBatteryIgnore.setOnClickListener(v -> {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        });
        
        // SETUP WEBVIEW FOR JS INTERFACE (Powerful Printing)
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);
        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidPrint");
        webView.setWebViewClient(new WebViewClient()); // Default client
        
        // Load initial URL if available
        String savedUrl = prefs.getString("pwa_url", "https://azzahra-fashion-muslim.vercel.app");
        webView.loadUrl(savedUrl);

        btnSaveUrl.setOnClickListener(v -> {
            String url = etWebUrl.getText().toString().trim();
            if (!url.startsWith("http")) url = "https://" + url;
            prefs.edit().putString("pwa_url", url).apply();
            webView.loadUrl(url);
            Toast.makeText(this, "URL Saved", Toast.LENGTH_SHORT).show();
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
                        txtPrinterStatus.setText("Connected: " + device.getName());
                        txtPrinterStatus.setTextColor(Color.parseColor("#4CAF50"));
                    });
                } catch (Exception e) {
                    runOnUiThread(() -> Toast.makeText(this, "Connect Error", Toast.LENGTH_SHORT).show());
                }
            }).start();
        });

        btnTestPrint.setOnClickListener(v -> {
            try { printerManager.print("Test Print Azzahra\n\n"); } catch (Exception e) {}
        });

        // SIMULASI PRINT LABEL SEPERTI DARI PWA
        btnSimulatePwa.setOnClickListener(v -> {
            String dummyJson = "{" +
                    "\"name\": \"Pembeli Test\"," +
                    "\"phone\": \"0812345678\"," +
                    "\"address\": \"Jl. Testing No. 123, Kota Simulasi\"," +
                    "\"items\": \"1x Gamis Biru, 2x Jilbab\"," +
                    "\"courier\": \"J&T Express\"," +
                    "\"orderId\": \"ORD-SIMULASI-001\"" +
                    "}";
            printBridge.printLabel(dummyJson);
        });

        loadAppList();
        triggerStartServices();
    }

    private void initTabs() {
        tabHost = findViewById(android.R.id.tabhost);
        tabHost.setup();
        // Restore HOME (WebView) because JS Interface works ONLY inside WebView
        tabHost.addTab(tabHost.newTabSpec("Web").setIndicator("WEB").setContent(R.id.tabHome)); // Assuming tabHome exists in XML layout
        tabHost.addTab(tabHost.newTabSpec("Sync").setIndicator("SYNC").setContent(R.id.tabSync));
        tabHost.addTab(tabHost.newTabSpec("Settings").setIndicator("SETTINGS").setContent(R.id.tabPrinter));
    }

    // initWebView removed - Simplify App to Printer Service

    private void checkUserRole() {
        String uid = FirebaseAuth.getInstance().getUid();
        if (uid == null) return;
        FirebaseFirestore.getInstance().collection("users").document(uid).get()
            .addOnSuccessListener(doc -> {
                String role = doc.getString("role");
                if ("admin".equalsIgnoreCase(role)) tabHost.getTabWidget().getChildAt(1).setVisibility(View.GONE);
            });
    }

    private void handleCustomPrintScheme(String url) {
        try {
            Uri uri = Uri.parse(url);
            String data = uri.getQueryParameter("data");
            if (data != null) {
                // Decode Base64 data (More robust than plain URL decode)
                byte[] decodedBytes = android.util.Base64.decode(data, android.util.Base64.DEFAULT);
                String printText = new String(decodedBytes, "UTF-8");
                
                // Jika belum connect, coba autoConnect dulu & beri jeda sedikit
                if (!printerManager.isConnected()) {
                    printerManager.autoConnect();
                    // Jeda 1.5 detik tunggu koneksi
                    try { Thread.sleep(1500); } catch (InterruptedException e) {}
                }

                // Print directly using PrinterManager
                if (printerManager.isConnected()) {
                    printerManager.print(printText);
                    Toast.makeText(this, "Mencetak...", Toast.LENGTH_SHORT).show();
                    // Optional: Kembali ke home/minimize setelah print (biar user balik ke Chrome)
                    moveTaskToBack(true);
                } else {
                    Toast.makeText(this, "Gagal Connect Printer. Coba lagi!", Toast.LENGTH_LONG).show();
                    // Buka tab setting biar user bisa connect manual kalau gagal
                    tabHost.setCurrentTab(1); // Index 1 = Settings Tab (karena Tab 0 = Sync)
                }
            }
        } catch (Exception e) {
            Toast.makeText(this, "Error Print: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void scanPrinters() {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null || !adapter.isEnabled()) return;
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT}, 101);
            return;
        }
        printerDevices.clear();
        printerAdapter.clear();
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

    @Override protected void onResume() { super.onResume(); checkPermissions(); IntentFilter f = new IntentFilter("com.azzahra.sync.NEW_LOG"); if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) registerReceiver(logReceiver, f, Context.RECEIVER_EXPORTED); else registerReceiver(logReceiver, f); }
    @Override protected void onPause() { super.onPause(); unregisterReceiver(logReceiver); }
    private void checkPermissions() { boolean listenerOk = NotificationManagerCompat.getEnabledListenerPackages(this).contains(getPackageName()); statusIndicator.setBackgroundResource(listenerOk ? R.drawable.circle_green : R.drawable.circle_red); }
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
    }
}
