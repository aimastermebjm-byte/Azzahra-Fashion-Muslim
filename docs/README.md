# Azzahra Fashion Muslim

## 📋 Project Info
- **Tech Stack**: React + Vite + TypeScript + Firebase + Tailwind CSS
- **Frontend Host**: Vercel (auto deploy via Git)
- **Backend Bot**: VPS (manual deploy via SSH)

---

## 🖥️ VPS & SSH

### Server Info
- **SSH Login**: `azzahra@103.196.155.223`
- **Password**: (tanya user, jangan simpan di sini)

### Directory Structure di VPS
```
~/whatsapp-bridge/
├── whatsapp-bridge.cjs    # File utama bot WA
├── .wwebjs_auth/          # Session WhatsApp (JANGAN HAPUS!)
├── node_modules/
└── ...
```

---

## 🤖 WhatsApp Bot

### ⚠️ PENTING - JANGAN BUAT BOT BARU!
Bot WhatsApp sudah berjalan dengan konfigurasi:
- **PM2 Process Name**: `wa-bridge`
- **PM2 Process ID**: `0`
- **Status**: Online

### Cara Cek Status Bot
```bash
ssh azzahra@103.196.155.223 "pm2 list"
```

### Cara Restart Bot (BUKAN buat baru!)
```bash
ssh azzahra@103.196.155.223 "pm2 restart 0"
```

### ❌ DILARANG!
```bash
# JANGAN JALANKAN INI! Akan membuat bot duplikat!
pm2 start whatsapp-bridge.cjs --name bridge
```

---

## 🚀 Deployment

### Frontend (Otomatis via Vercel)
```powershell
git add .
git commit -m "feat: deskripsi perubahan"
git push origin feature/firebase-collage
```
Vercel akan auto build setelah push.

### Backend WhatsApp Bot (Manual via PowerShell)

**Step 1: Upload file ke VPS**
```powershell
scp "d:\My Project\Azzahra Fashion Muslim\project\scripts\whatsapp-bridge.cjs" azzahra@103.196.155.223:./whatsapp-bridge/whatsapp-bridge.cjs
```
(Masukkan password saat diminta)

**Step 2: Restart bot**
```powershell
ssh azzahra@103.196.155.223 "pm2 restart 0"
```

---

## 📁 File Penting

| File | Lokasi | Fungsi |
|------|--------|--------|
| `whatsapp-bridge.cjs` | `scripts/` (lokal) & `~/whatsapp-bridge/` (VPS) | Bot WA + Parsing AI |
| `ManualUploadModal.tsx` | `src/components/` | Modal upload produk manual |
| `WhatsAppInboxModal.tsx` | `src/components/` | Modal inbox draft dari WA |

---

## 🔥 Fitur Parsing AI (Gemini)

Bot WA menggunakan Gemini AI untuk parsing:
1. **Parsing Biasa** - Retail/Reseller price
2. **Set Types** - SET SCARF, SET KHIMAR dengan harga berbeda
3. **Family Products** - Dad, Mom, Boy, Girl dengan size & harga masing-masing

### Catatan Penting:
- Kategori default: **Gamis** (kecuali ada keyword lain di judul)
- Nama produk: Ambil dari judul, skip "Open PO"
- Harga: Ambil persis dari teks, JANGAN halusinasi

---

## 🛠️ Troubleshooting

### Bot tidak merespons?
1. Cek status: `pm2 list`
2. Cek log: `pm2 log 0`
3. Restart: `pm2 restart 0`

### Harus scan QR ulang?
1. SSH ke VPS
2. `cd ~/whatsapp-bridge`
3. `pm2 stop 0`
4. `node whatsapp-bridge.cjs` (jalankan manual, scan QR)
5. Setelah login, Ctrl+C
6. `pm2 start 0`

### Nama/Harga salah?
- Cek prompt di `whatsapp-bridge.cjs` (function `parseProductInfo`)
- Frontend ada fallback di `ManualUploadModal.tsx`