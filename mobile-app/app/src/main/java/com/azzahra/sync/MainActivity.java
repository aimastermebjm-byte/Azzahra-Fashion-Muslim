package com.azzahra.sync;

import android.Manifest;
import android.annotation.SuppressLint;
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
        initWebView();
        checkUserRole();
        handleIntent(getIntent());
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (printerManager != null && !printerManager.isConnected()) {
            printerManager.autoConnect();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (printerManager != null && !printerManager.isConnected()) {
            printerManager.autoConnect();
        }
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent != null && intent.getData() != null) {
            Uri data = intent.getData();
            if ("azzahra-print".equals(data.getScheme())) {
                String text = data.getQueryParameter("data");
                if (text != null) {
                    try {
                        byte[] decodedBytes = android.util.Base64.decode(text, android.util.Base64.DEFAULT);
                        printText(new String(decodedBytes, "UTF-8"));
                    } catch (Exception e) {
                        printText(text); // Fallback jika bukan base64
                    }
                }
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
        printerManager.autoConnect();

        btnGrantNotif.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
        btnBatteryIgnore.setOnClickListener(v -> {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        });

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

        btnSimulatePwa.setOnClickListener(v -> {
            String dummyJson = "{\"name\":\"Pembeli Test\",\"phone\":\"0812345678\",\"address\":\"Jl. Testing No. 123\",\"items\":\"1x Gamis Biru\",\"courier\":\"J&T\",\"orderId\":\"ORD001\"}";
            printBridge.printLabel(dummyJson);
        });

        loadAppList();
        triggerStartServices();
    }

    private void initTabs() {
        tabHost = findViewById(android.R.id.tabhost);
        tabHost.setup();
        tabHost.addTab(tabHost.newTabSpec("Web").setIndicator("HOME").setContent(R.id.tabWeb));
        tabHost.addTab(tabHost.newTabSpec("Sync").setIndicator("SYNC").setContent(R.id.tabSync));
        tabHost.addTab(tabHost.newTabSpec("Settings").setIndicator("SETTINGS").setContent(R.id.tabPrinter));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void initWebView() {
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(printBridge, "AndroidPrint");
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
                if ("admin".equalsIgnoreCase(role)) tabHost.getTabWidget().getChildAt(1).setVisibility(View.GONE);
            });
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

    @Override
    protected void onResume() {
        super.onResume();
        checkPermissions();
        IntentFilter f = new IntentFilter("com.azzahra.sync.NEW_LOG");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) registerReceiver(logReceiver, f, Context.RECEIVER_EXPORTED);
        else registerReceiver(logReceiver, f);

        // Smart Auto-Connect: Hanya jika BELUM konek, supaya tidak spam command saat printing
        if (printerManager != null && !printerManager.isConnected()) {
            new android.os.Handler().postDelayed(() -> printerManager.autoConnect(), 1500);
        }
    }

    private void printText(String text) {
        if (!printerManager.isConnected()) {
             printerManager.autoConnect();
             Toast.makeText(this, "Menyambungkan Printer...", Toast.LENGTH_SHORT).show();
             return;
        }

        new Thread(() -> {
            try {
                // 1. Initialize & Set Font B (42 chars/line) for WIDER layout
                // ESC @ = Reset, ESC ! 1 = Font B (9x17)
                printerManager.write(new byte[]{0x1B, 0x40, 0x1B, 0x21, 0x01});
                Thread.sleep(200);

                // 2. Buffer Logic: Split lines to prevent Buffer Overflow (Red Blinking)
                String[] lines = text.split("\n");
                for (String line : lines) {
                    // Send line + newline using GBK
                    printerManager.write((line + "\n").getBytes("GBK"));
                    // Delay per line to let printer process
                    Thread.sleep(50);
                }

                // 3. Feed & Reset Font
                printerManager.write(new byte[]{0x0A, 0x0A, 0x0A});
                printerManager.write(new byte[]{0x1B, 0x21, 0x00}); // Reset to Normal
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }
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
