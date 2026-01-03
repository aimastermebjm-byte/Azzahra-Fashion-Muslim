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
- [ ] Sudah cek branch aktif (Git)?
- [ ] Sudah baca file yang akan di-edit?
- [ ] Solusi tidak merusak fitur existing?

---

## ⚠️ 3. COMMON AI PITFALLS - AVOID!

- 🔴 **Hallucination**: Membuat fungsi/API/library yang tidak ada.
- 🔴 **Over-Engineering**: Solusi kompleks untuk masalah sederhana (KISS).
- 🔴 **Breaking Changes**: Merubah signature fungsi tanpa update caller.
- 🔴 **Ignoring Errors**: Mengabaikan pesan error dari terminal/tools.
- 🔴 **Duplicate Code**: Membuat logic yang sebenarnya sudah ada (DRY).

---

## 🛡️ 4. GIT & BRANCHING STRATEGY (SAFETY TOP!)

### A. Aturan Branch
- **MAIN = ZONA SUCI**: DILARANG coding, commit, atau push langsung ke `main`.
- **Feature Branch**: Selalu kerja di branch fitur (format: `feature/nama-fitur` atau `fix/nama-bug`).

### B. Branch Safety (Cek Dulu!)
- **SEBELUM CODING**: Jalankan `git branch --show-current`.
- **TIDAK MATCH? STOP!**: Jika branch tidak sesuai task, TANYA user dulu. "Boss di branch X, tapi mau buat fitur Y. Bikin branch baru atau pindah?"
- **AUTO-SWITCH**: Hanya lakukan checkout branch baru setelah diizinkan user.

### C. Commit Standards
- **Format**: `type: deskripsi` (feat, fix, refactor, docs).
- **Contoh**: `feat: add whatsapp chatbot integration`.
- **Commit kecil**: 1 fitur = 1 commit. NO broken code!

### D. Pull & Push Workflow
- **PULL** dulu dari origin sebelum push untuk menghindari conflict.
- **PUSH** hanya diperbolehkan ke FEATURE BRANCH.

---

## 🚀 5. DEPLOYMENT (VERCEL CONTROL)

- **Preview Deploy**: Push ke feature branch akan memicu Vercel Preview. Berikan link Preview URL ke user setelah push berhasil.
- **Production Deploy**: Hanya terjadi ketika merge ke `main`. AI dilarang melakukan merge ke `main` tanpa persetujuan eksplisit user.

---

## 🎯 6. QUICK REFERENCE (SITUATION)

### When User Asks Question:
1. Pahami sepenuhnya -> Verify dengan tools -> Berikan jawaban konkret.

### When User Requests Code:
1. Konfirmasi pemahaman -> Tanya kesiapan -> Cek Branch -> Baca file -> Execute.

### When Error Occurs:
1. Baca error dengan teliti -> Fix root cause -> Test ulang -> Jangan berasumsi.

### When Stuck:
1. Jangan tebak-tebakan -> Tanya klarifikasi ke user.