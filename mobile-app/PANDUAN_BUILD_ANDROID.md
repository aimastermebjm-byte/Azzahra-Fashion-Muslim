# 📱 Panduan Build Aplikasi Android (Azzahra Sync)

Ini adalah panduan cara mengubah kode mentah di folder `mobile-app` menjadi aplikasi siap pakai di HP Boss.

## 1. Persiapan Awal

1.  **Download & Install Android Studio**: [Klik di sini](https://developer.android.com/studio) (Gratis).
2.  **Download `google-services.json`**:
    *   Buka Firebase Console project Boss (`azzahra-fashion-muslim-ab416`).
    *   Klik icon ⚙️ (Project Settings).
    *   Scroll ke bawah, klik "Add App" -> Pilih icon **Android**.
    *   Isi Package Name: `com.azzahra.sync` (Wajib sama persis!).
    *   Download file `google-services.json`.
    *   **PENTING**: Copy file tersebut ke dalam folder: `mobile-app/app/` (sejajar dengan `build.gradle`).

## 2. Cara Membuka Project

1.  Buka aplikasi **Android Studio**.
2.  Pilih **Open**.
3.  Cari folder `mobile-app` yang ada di dalam folder project Azzahra Boss.
4.  Klik OK/Open.
5.  Tunggu sebentar (Android Studio akan download library yang dibutuhkan/Syncing Gradle). Ini butuh koneksi internet.

## 3. Cara Build APK (Memasak Aplikasi)

Kalau proses sync di bawah layar sudah berhenti (centang hijau):

1.  Klik menu di atas: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
2.  Tunggu prosesnya (bisa 1-5 menit tergantung spek laptop).
3.  Kalau sukses, akan muncul notifikasi di pojok kanan bawah: *"APK(s) generated successfully"*.
4.  Klik tulisan **"locate"** di notifikasi itu.
5.  Boss akan melihat file `app-debug.apk`. 

## 4. Cara Install di HP

1.  Kirim file `app-debug.apk` tadi ke HP Boss (bisa via WhatsApp/Telegram ke diri sendiri).
2.  Buka di HP, lalu Install.
3.  Kalau ada peringatan "Unsafe App" atau "Unknown Source", abaikan dan pilih "Install Anyway" (karena ini aplikasi buatan sendiri, belum masuk PlayStore).

## 5. Cara Pakai (Setting Awal)

1.  Buka aplikasi **"Azzahra Sync"**.
2.  Klik tombol **"Step 1: Grant Access Permission"**.
    *   Boss akan dibawa ke menu setting HP.
    *   Cari "Azzahra Sync", lalu **Centang/Aktifkan**.
    *   Tekan Back kembali ke aplikasi.
3.  Tombol Step 1 akan berubah jadi hijau.
4.  Selesai! Kalau indikator di atas sudah **Hijau**, berarti aplikasi sudah jalan.
5.  Boss bisa tutup aplikasinya (pencet Home), dia akan tetap jalan di background (lihat notifikasi di bar atas HP).

---

**Selamat!** Sekarang setiap ada notifikasi bank masuk di HP itu, datanya akan otomatis terkirim ke Dashboard Admin Website Boss. 🎉
