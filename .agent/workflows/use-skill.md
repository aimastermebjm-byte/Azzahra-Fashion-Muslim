---
description: Gunakan skill yang relevan untuk menyelesaikan tugas kompleks
---

# /use-skill - Auto Skill Selection Workflow

Workflow ini membantu agent memilih dan menerapkan skill yang tepat berdasarkan tugas yang diberikan.

## Langkah-langkah

1. **Baca SKILL_INDEX.md**
   - Baca file `C:\Users\LENOVO\.antigravity\skills\SKILL_INDEX.md`
   - Cari keyword yang match dengan tugas user

2. **Identifikasi Skills yang Relevan**
   - Dari index, tentukan 1-3 skill yang paling cocok
   - Jangan overload dengan terlalu banyak skill

3. **Konfirmasi ke User**
   - Sebutkan skill yang akan digunakan
   - Tanya apakah user setuju atau mau skill lain

4. **Baca SKILL.md**
   - Baca file `C:\Users\LENOVO\.antigravity\skills\.agent\skills\<skill-name>\SKILL.md`
   - Pahami metodologi dan best practices

5. **Execute Tugas**
   - Terapkan metodologi dari skill
   - Ikuti checklist/pattern yang ada di skill

## Contoh Penggunaan

User: "Tolong cek Firebase saya biar aman dan optimal"

Agent akan:
1. Baca SKILL_INDEX.md
2. Match keywords: "firebase", "aman", "optimal"
3. Suggest skills: `database-admin`, `backend-security-coder`, `database-optimizer`
4. Setelah konfirmasi, baca SKILL.md masing-masing
5. Terapkan metodologi untuk cek Firebase

## Catatan Penting

- **JANGAN** baca semua skill sekaligus - hanya yang relevan
- **SELALU** konfirmasi skill yang dipilih sebelum execute
- **PRIORITAS**: Pilih skill yang paling spesifik untuk tugas
