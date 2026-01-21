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
        
        // Tutup koneksi lama dengan bersih
        closeConnection();
        
        try {
            if (listener != null) listener.onStatusChanged("Menghubungkan...");
            
            // COBA JALUR 1: Jalur Standar
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
        } catch (IOException e) {
            Log.e("Printer", "Jalur 1 gagal, mencoba jalur alternatif...");
            // COBA JALUR 2: Jalur Alternatif (Lebih kuat untuk printer China)
            try {
                socket = (BluetoothSocket) device.getClass().getMethod("createInsecureRfcommSocketToServiceRecord", UUID.class)
                                .invoke(device, SPP_UUID);
                if (socket != null) socket.connect();
            } catch (Exception ex) {
                if (listener != null) listener.onStatusChanged("Gagal Terhubung");
                throw new IOException("Semua jalur koneksi gagal. Pastikan printer nyala.");
            }
        }
        
        if (socket != null && socket.isConnected()) {
            outputStream = socket.getOutputStream();
            // JEDA STABILISASI: Penting agar printer tidak error
            try { Thread.sleep(1000); } catch (InterruptedException ignored) {}
            
            // KIRIM PERINTAH RESET: Biar lampu merah berhenti jika karena error data
            outputStream.write(new byte[]{0x1B, 0x40}); 
            outputStream.flush();
            
            prefs.edit().putString("last_address", address).apply();
            if (listener != null) listener.onStatusChanged("Terhubung ke " + device.getName());
        }
    }

    public void print(String text) throws IOException {
        if (outputStream == null || !isConnected()) {
            throw new IOException("Printer belum siap. Silakan hubungkan lagi.");
        }
        
        try {
            // Reset & Set Font Standard
            outputStream.write(new byte[]{0x1B, 0x40}); 
            // Print
            outputStream.write(text.getBytes("GBK"));
            // Feed paper
            outputStream.write(new byte[]{0x0A, 0x0A, 0x0A});
            outputStream.flush();
        } catch (IOException e) {
            closeConnection();
            if (listener != null) listener.onStatusChanged("Koneksi Putus (Broken Pipe)");
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
                try {
                    connect(lastAddr);
                } catch (Exception e) {
                    Log.e("Printer", "AutoConnect gagal: " + e.getMessage());
                }
            }).start();
        }
    }
}
