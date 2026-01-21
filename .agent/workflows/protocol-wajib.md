---
description: Protocol wajib yang HARUS dipatuhi oleh AI assistant
---

# 🤖 AI AGENTS PROTOCOL - USER RULES (FINAL)

> **"Understand deeply, execute precisely, communicate clearly."**

---

## 🚨 1. CORE PROTOCOL (WAJIB!)

### A. Bahasa
- **SELALU gunakan Bahasa Indonesia** dalam komunikasi.
- Istilah teknis boleh Bahasa Inggris (commit, merge, refactor).

### B. Scope Pekerjaan
- **HANYA kerjakan yang diminta**. Jangan melebar atau menambah fitur tanpa izin.
- **YAGNI** (You Aren't Gonna Need It).

### C. Sebelum Generate Code (Tanya Dulu!)
- **PASTIKAN sudah paham alur** dan maksud user sepenuhnya.
- **TANYA BALIK** jika ada yang kurang jelas.
- **KONFIRMASI**: "Apakah siap untuk dibuatkan code?" ⚠️

### D. File Management
- **Perbaiki code existing** dulu sebelum bikin file baru.
- **Read before edit**: Selalu baca file/outline sebelum melakukan perubahan.

### E. Integritas
- **JANGAN halusinasi**. Jika tidak tahu, bilang tidak tahu.
- **VERIFIKASI** sebelum menjawab atau claim sesuatu.

---

## ✅ 2. CHECKLIST SEBELUM CODING

- [ ] Sudah paham requirement 100%?
- [ ] User sudah bilang "siap" atau "lanjut"?
- [ ] Sudah cek branch aktif (Git)? **HARUS di `develop`!**
- [ ] Sudah baca file yang akan di-edit?
- [ ] Solusi tidak merusak fitur existing?

---

## ⚠️ 3. COMMON AI PITFALLS - AVOID!

- 🔴 **Hallucination**: Membuat fungsi/API/library yang tidak ada.
- 🔴 **Over-Engineering**: Solusi kompleks untuk masalah sederhana (KISS).
- 🔴 **Breaking Changes**: Merubah signature fungsi tanpa update caller.
- 🔴 **Ignoring Errors**: Mengabaikan pesan error dari terminal/tools.
- 🔴 **Duplicate Code**: Membuat logic yang sebenarnya sudah ada (DRY).
- 🔴 **Coding di Main**: JANGAN PERNAH coding langsung di `main`!

---

## 🛡️ 4. GIT & BRANCHING STRATEGY (SAFETY TOP!)

### A. Struktur Branch
```
main     → Production (SUCI, JANGAN coding di sini!)
develop  → Development (tempat kerja sehari-hari)
feature/ → Fitur besar/risky saja (optional)
```

### B. Aturan Branch
- **MAIN = ZONA SUCI**: DILARANG coding, commit, atau push langsung ke `main`.
- **DEVELOP = Branch Kerja**: Semua coding sehari-hari dilakukan di sini.
- **Feature Branch (Optional)**: Hanya untuk fitur besar/risky (format: `feature/nama-fitur`).

### C. Branch Safety (Cek Dulu!)
- **SEBELUM CODING**: Jalankan `git branch --show-current`.
- **Harus di `develop`** atau `feature/xxx`. JANGAN di `main`!
- **Jika di `main`**: Langsung checkout ke `develop` sebelum mulai kerja.

### D. Commit Standards
- **Format**: `type: deskripsi` (feat, fix, refactor, docs).
- **Contoh**: `feat: add whatsapp chatbot integration`.
- **Commit kecil**: 1 fitur = 1 commit. NO broken code!

### E. Workflow Harian
1. **Kerja di `develop`** → commit → push ke `develop`
2. **Siap production?** → Merge `develop` ke `main` (dengan izin user)
3. **⚠️ SETELAH MERGE**: Langsung checkout balik ke `develop`!
4. **Fitur besar?** → Buat `feature/xxx` dari `develop`, selesai hapus branch-nya

### F. Pull & Push Workflow
- **PULL** dulu dari origin sebelum push untuk menghindari conflict.
- **PUSH** ke `develop` atau `feature/xxx`. TIDAK BOLEH langsung ke `main`.

---

## 🚀 5. DEPLOYMENT (VERCEL CONTROL)

- **Preview Deploy**: Push ke `develop` akan memicu Vercel Preview.
- **Production Deploy**: Hanya terjadi ketika merge ke `main`. 
- **AI dilarang** melakukan merge ke `main` tanpa persetujuan eksplisit user.

---

## 🎯 6. QUICK REFERENCE (SITUATION)

### When User Asks Question:
1. Pahami sepenuhnya -> Verify dengan tools -> Berikan jawaban konkret.

### When User Requests Code:
1. Konfirmasi pemahaman -> Tanya kesiapan -> **Cek Branch (harus di develop)** -> Baca file -> Execute.

### When Merge to Main:
1. Minta izin user -> Checkout main -> Pull -> Merge develop -> Push -> **⚠️ CHECKOUT BALIK KE DEVELOP!**

### When Error Occurs:
1. Baca error dengan teliti -> Fix root cause -> Test ulang -> Jangan berasumsi.

### When Stuck:
1. Jangan tebak-tebakan -> Tanya klarifikasi ke user.

---

## 🎯 7. SKILL SYSTEM (AUTO CHECK)

### A. Kapan Cek Skills
- **TUGAS KOMPLEKS**: fitur baru, debugging, security audit, optimization, refactoring
- **BUKAN** untuk pertanyaan simple atau fix 1-2 baris

### B. Skill Index Location
```
C:\Users\LENOVO\.antigravity\skills\SKILL_INDEX.md
```

### C. Workflow
1. **Baca INDEX** - Match keyword dari tugas user
2. **Suggest Skills** - Usulkan 1-3 skills yang relevan ke user
3. **Tunggu Konfirmasi** - User harus setuju dulu
4. **Baca SKILL.md** - Dari skill yang disetujui saja
5. **Execute** - Terapkan metodologi skill tersebut

### D. Aturan PENTING
- ❌ **JANGAN** baca semua 89 skills sekaligus
- ❌ **JANGAN** langsung baca skill tanpa konfirmasi
- ✅ **SELALU** konfirmasi skill sebelum execute
- ✅ **HANYA** baca skill yang sudah disetujui user

### E. Skill Location
```
C:\Users\LENOVO\.antigravity\skills\.agent\skills\<skill-name>\SKILL.md
```