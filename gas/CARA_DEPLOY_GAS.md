# Panduan Deploy Google Apps Script (GAS) — SIT Terpadu

## File GAS yang Tersedia

| File | Modul | Spreadsheet | Env Variable |
|------|-------|------------|--------------|
| `Kesiswaan.gs`   | Kesiswaan          | Data_Kesiswaan         | `VITE_GAS_KESISWAAN_URL`   |
| `Kepegawaian.gs` | Kepegawaian        | Data_Kepegawaian       | `VITE_GAS_KEPEGAWAIAN_URL` |
| `Sarana.gs`      | Sarana & Prasarana | Data_Sarana_Prasarana  | `VITE_GAS_SARANA_URL`      |
| `Persuratan.gs`  | Persuratan         | Data_Persuratan        | `VITE_GAS_PERSURATAN_URL`  |

---

## Langkah Deploy (lakukan untuk SETIAP file .gs)

### 1. Siapkan Folder Drive

1. Buka [Google Drive](https://drive.google.com)
2. Buat folder baru, contoh: **"SIT Terpadu Data"**
3. Buka folder tersebut, lihat URL browser:
   ```
   https://drive.google.com/drive/folders/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```
4. Salin ID folder (bagian `XXXXXXX...` setelah `/folders/`)
5. Ganti nilai `ROOT_FOLDER_ID` di **semua 4 file .gs** dengan ID tersebut:
   ```javascript
   const ROOT_FOLDER_ID = 'ID_FOLDER_ANDA_DI_SINI'
   ```

---

### 2. Buat Project GAS Baru (per modul)

1. Buka [script.google.com](https://script.google.com)
2. Klik **"+ New project"**
3. Beri nama project, contoh: `SIT - Kesiswaan`
4. Hapus kode default yang ada
5. Paste seluruh isi file `.gs` yang sesuai
6. Klik **💾 Save** (Ctrl+S)

---

### 3. Jalankan setupSheet() untuk Inisialisasi

1. Di GAS editor, pilih fungsi `setupSheet` dari dropdown fungsi (di sebelah tombol Run)
2. Klik **▶ Run**
3. Saat pertama kali, Google akan minta izin akses:
   - Klik **"Review permissions"**
   - Pilih akun Google Anda
   - Klik **"Advanced"** → **"Go to [nama project] (unsafe)"**
   - Klik **"Allow"**
4. Cek Log di bawah — pastikan ada pesan: `Setup [modul] selesai`
5. Cek Google Drive → folder Anda → spreadsheet baru sudah terbuat otomatis

---

### 4. Deploy sebagai Web App

1. Di GAS editor, klik **"Deploy"** → **"New deployment"**
2. Klik ikon ⚙️ di sebelah "Select type" → pilih **"Web app"**
3. Isi konfigurasi:
   - **Description**: `SIT Kesiswaan v1` (atau nama modul)
   - **Execute as**: `Me (email@gmail.com)`
   - **Who has access**: `Anyone`
4. Klik **"Deploy"**
5. Klik **"Authorize access"** jika diminta
6. **Salin URL Web App** yang muncul, contoh:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

---

### 5. Isi URL di File .env

Buka file `.env` di root project, isi URL yang sudah disalin:

```env
VITE_GAS_KESISWAAN_URL=https://script.google.com/macros/s/XXXXXX/exec
VITE_GAS_KEPEGAWAIAN_URL=https://script.google.com/macros/s/YYYYYY/exec
VITE_GAS_SARANA_URL=https://script.google.com/macros/s/ZZZZZZ/exec
VITE_GAS_PERSURATAN_URL=https://script.google.com/macros/s/WWWWWW/exec
```

---

### 6. Redeploy Setelah Ada Perubahan Kode

Jika kode GAS diubah, URL lama masih pakai versi lama.  
Untuk update: **Deploy → Manage deployments → Edit → versi "New version" → Deploy**

---

## Struktur Folder Drive yang Akan Terbuat

```
📁 SIT Terpadu Data/
  ├── 📊 Data_Kesiswaan (spreadsheet)
  ├── 📊 Data_Kepegawaian (spreadsheet)
  ├── 📊 Data_Sarana_Prasarana (spreadsheet)
  ├── 📊 Data_Persuratan (spreadsheet)
  ├── 📁 Ijazah SD/
  ├── 📁 Ijazah SMP/
  ├── 📁 Akte/
  ├── 📁 Kartu Keluarga/
  ├── 📁 Nilai Raport/
  ├── 📁 Dokumen Pribadi/
  ├── 📁 Dokumen Kepegawaian/
  ├── 📁 Dokumen Absensi/
  ├── 📁 SKP/
  ├── 📁 KIB A/
  ├── 📁 KIB B/
  ├── 📁 KIB C/
  ├── 📁 KIB E/
  ├── 📁 Surat Masuk/
  └── 📁 Surat Keluar/
```

---

## Cara Kerja Integrasi

```
Browser (React App)
      │
      │  POST/GET fetch (mode: no-cors)
      ▼
Google Apps Script (Web App)
      │
      ├── Simpan data ke Google Sheets
      └── Upload file PDF ke Google Drive
```

- **GET `?action=getData`** → ambil semua data dari spreadsheet
- **POST `action=uploadRow`** → tambah 1 baris + upload PDF
- **POST `action=updateRow`** → update baris existing + upload PDF baru
- **POST `action=deleteRow`** → hapus baris + trash file PDF di Drive

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `ROOT_FOLDER_ID not found` | Pastikan ID folder benar dan akun GAS punya akses ke folder |
| Tidak bisa akses setelah deploy | Pastikan "Who has access" diset ke **Anyone** |
| Data tidak tersimpan ke Drive | Jalankan ulang `setupSheet()` dan cek izin |
| URL GAS tidak dikenali di React | Pastikan sudah isi `.env` dan jalankan ulang `npm run dev` |
| File PDF tidak terupload | Cek ukuran file — GAS max payload ~50MB |
