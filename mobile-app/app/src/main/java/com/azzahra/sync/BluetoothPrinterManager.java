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

    public BluetoothPrinterManager(Context context) {
        this.prefs = context.getSharedPreferences("PrinterPrefs", Context.MODE_PRIVATE);
    }

    @SuppressLint("MissingPermission")
    public void connect(String address) throws IOException {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) throw new IOException("Bluetooth not supported");
        
        BluetoothDevice device = adapter.getRemoteDevice(address);
        if (socket != null) {
            try { socket.close(); } catch (Exception ignored) {}
        }
        
        socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
        socket.connect();
        outputStream = socket.getOutputStream();
        
        // Simpan address terakhir untuk auto-reconnect
        prefs.edit().putString("last_address", address).apply();
    }

    public void print(String text) throws IOException {
        if (outputStream == null) throw new IOException("Printer not connected");
        
        // ESC/POS Command: Reset Printer
        outputStream.write(new byte[]{0x1B, 0x40});
        // Print Text
        outputStream.write(text.getBytes("GBK"));
        outputStream.write(new byte[]{0x0A, 0x0A, 0x0A});
        outputStream.flush();
    }

    public void write(byte[] data) throws IOException {
        if (outputStream == null) throw new IOException("Printer not connected");
        outputStream.write(data);
        outputStream.flush();
    }

    public boolean isConnected() {
        return socket != null && socket.isConnected();
    }

    // Listener Interface
    public interface StatusListener {
        void onStatusChanged(String status);
    }
    private StatusListener listener;

    public void setListener(StatusListener listener) {
        this.listener = listener;
    }

    private void updateStatus(String status) {
        if (listener != null) listener.onStatusChanged(status);
    }

    public void autoConnect() {
        String lastAddr = prefs.getString("last_address", null);
        if (lastAddr != null && !isConnected()) {
            new Thread(() -> {
                updateStatus("Mencoba Auto-Connect...");
                int retry = 0;
                while (retry < 3) {
                    try {
                        connect(lastAddr);
                        if (isConnected()) {
                            updateStatus("Terhubung ke Printer ✅");
                            return; // Success
                        }
                    } catch (Exception e) {
                        retry++;
                        updateStatus("Gagal Connect (" + retry + "/3)...");
                        try { Thread.sleep(1000); } catch (Exception ignored) {}
                    }
                }
                updateStatus("Gagal Auto-Connect. Cek Printer.");
            }).start();
        } else {
            if (isConnected()) updateStatus("Printer Sudah Terhubung ✅");
            else updateStatus("Belum ada Printer Tersimpan");
        }
    }
}
