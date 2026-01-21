package com.azzahra.sync;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import java.io.IOException;
import java.io.OutputStream;
import java.util.UUID;

public class BluetoothPrinterManager {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private BluetoothSocket socket;
    private OutputStream outputStream;
    private final SharedPreferences prefs;
    private PrinterStatusListener listener;

    public interface PrinterStatusListener {
        void onStatusChanged(String status);
    }

    public void setListener(PrinterStatusListener listener) {
        this.listener = listener;
    }

    public BluetoothPrinterManager(Context context) {
        this.prefs = context.getSharedPreferences("PrinterPrefs", Context.MODE_PRIVATE);
    }

    @SuppressLint("MissingPermission")
    public void connect(String address) throws IOException {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) throw new IOException("Bluetooth tidak didukung");
        
        BluetoothDevice device = adapter.getRemoteDevice(address);
        closeConnection();
        
        try {
            if (listener != null) listener.onStatusChanged("Menghubungkan...");
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
        } catch (IOException e) {
            try {
                // Jalur Insecure (Biasanya lebih tahan banting untuk printer low-end)
                socket = (BluetoothSocket) device.getClass().getMethod("createInsecureRfcommSocketToServiceRecord", UUID.class).invoke(device, SPP_UUID);
                if (socket != null) socket.connect();
            } catch (Exception ex) {
                if (listener != null) listener.onStatusChanged("Gagal!");
                throw new IOException("Koneksi gagal total.");
            }
        }
        
        if (socket != null && socket.isConnected()) {
            outputStream = socket.getOutputStream();
            // Jeda stabilisasi diperlama agar chip printer tenang
            try { Thread.sleep(1500); } catch (InterruptedException ignored) {}
            
            // Hard Reset & Clear Buffer
            outputStream.write(new byte[]{0x1B, 0x40});
            outputStream.flush();
            
            prefs.edit().putString("last_address", address).apply();
            if (listener != null) listener.onStatusChanged("Terhubung ✅");
        }
    }

    public void print(String text) throws IOException {
        // Jika tidak terkoneksi, coba paksa auto-connect dulu
        if (outputStream == null || !isConnected()) {
            autoConnect();
            // Beri waktu sebentar untuk auto-connect
            try { Thread.sleep(2000); } catch (InterruptedException ignored) {}
            if (outputStream == null) throw new IOException("Printer mati/tidak terdeteksi.");
        }
        
        try {
            // KIRIM PERINTAH CLEANING SEBELUM SETIAP PRINT
            outputStream.write(new byte[]{0x1B, 0x40}); 
            try { Thread.sleep(100); } catch (Exception e) {}
            
            outputStream.write(text.getBytes("GBK"));
            outputStream.write(new byte[]{0x0A, 0x0A, 0x0A});
            outputStream.flush();
        } catch (IOException e) {
            closeConnection();
            if (listener != null) listener.onStatusChanged("Putus ❌");
            throw e;
        }
    }

    public void closeConnection() {
        try {
            if (outputStream != null) outputStream.close();
            if (socket != null) socket.close();
        } catch (Exception ignored) {}
        outputStream = null;
        socket = null;
    }

    public boolean isConnected() {
        return socket != null && socket.isConnected();
    }

    public void autoConnect() {
        String lastAddr = prefs.getString("last_address", null);
        if (lastAddr != null && !isConnected()) {
            new Thread(() -> {
                try { connect(lastAddr); } catch (Exception ignored) {}
            }).start();
        }
    }
}
