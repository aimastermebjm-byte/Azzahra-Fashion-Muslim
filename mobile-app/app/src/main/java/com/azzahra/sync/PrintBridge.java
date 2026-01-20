package com.azzahra.sync;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import org.json.JSONObject;

public class PrintBridge {
    private Context context;
    private BluetoothPrinterManager printerManager;

    public PrintBridge(Context context, BluetoothPrinterManager printerManager) {
        this.context = context;
        this.printerManager = printerManager;
    }

    @JavascriptInterface
    public void printLabel(String jsonData) {
        try {
            JSONObject obj = new JSONObject(jsonData);
            String name = obj.optString("name", "");
            String phone = obj.optString("phone", "");
            String address = obj.optString("address", "");
            String items = obj.optString("items", "");
            String courier = obj.optString("courier", "");
            String orderId = obj.optString("orderId", "");

            StringBuilder sb = new StringBuilder();
            sb.append("================================\n");
            sb.append("         AZZAHRA FASHION        \n");
            sb.append("================================\n");
            sb.append("Kepada : ").append(name).append("\n");
            sb.append("Telp   : ").append(phone).append("\n");
            sb.append("Alamat : ").append(formatAddress(address)).append("\n");
            sb.append("--------------------------------\n");
            sb.append("Item   : ").append(formatItems(items)).append("\n");
            sb.append("Ekspedisi: ").append(courier).append("\n");
            sb.append("--------------------------------\n");
            sb.append("Order #").append(orderId).append("\n");
            sb.append("================================\n");

            if (printerManager.isConnected()) {
                printerManager.print(sb.toString());
                showToast("Mencetak Label...");
            } else {
                showToast("Printer belum terkoneksi! Hubungkan di menu Printer.");
            }
        } catch (Exception e) {
            showToast("Gagal parse data cetak: " + e.getMessage());
        }
    }

    private String formatAddress(String addr) {
        // Logika sederhana memotong alamat per 32 karakter agar rapi
        return wrapText(addr, 23); // 32 - 9 (panjang "Alamat : ")
    }

    private String formatItems(String items) {
        return wrapText(items, 23);
    }

    private String wrapText(String text, int limit) {
        StringBuilder sb = new StringBuilder();
        int count = 0;
        for (String word : text.split(" ")) {
            if (count + word.length() > limit) {
                sb.append("\n         "); // indentasi untuk baris baru
                count = 0;
            }
            sb.append(word).append(" ");
            count += word.length() + 1;
        }
        return sb.toString();
    }

    private void showToast(String msg) {
        new Handler(Looper.getMainLooper()).post(() -> 
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
        );
    }
}
