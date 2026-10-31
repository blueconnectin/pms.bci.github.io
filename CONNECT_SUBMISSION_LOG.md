# Catatan otomatis pengajuan

Spreadsheet pilihan pengguna: https://docs.google.com/spreadsheets/d/1A6hKNV7NCqQ8D5Vdiu5KTWi1FydTemvSJsF2YdcM2Lo/edit

## Aktivasi satu kali

1. Tunggu workflow **Deploy application** memperbarui Apps Script dan Cloudflare.
2. Buka proyek Apps Script sebagai pemilik deployment. Pilih fungsi **authorizeSubmissionLog**, klik **Run**, dan selesaikan persetujuan Google Sheets. Akun pelaksana Web App harus memiliki akses edit ke spreadsheet.
3. Fungsi menggunakan spreadsheet di atas, membuat tab **Pengajuan** bila belum ada, lalu menyimpan Script Properties `SUBMISSION_SPREADSHEET_ID` dan `SUBMISSION_LOG_READY=true`. Tab lain tidak dihapus atau diubah. Jika tab Pengajuan berisi header berbeda, fungsi berhenti agar data tidak tertimpa.
4. Muat ulang formulir. API `/api/config` akan mengandung `recordingEnabled:true` di samping `enabled:true`. Perubahan Script Properties tidak memerlukan deployment ulang.
5. Isi satu pengajuan uji, lampirkan bukti, dan pilih **Periksa Pengajuan**. Periksa baris baru pada tab **Pengajuan** sebelum menekan tombol WhatsApp.

Jika penambahan scope Sheets membuat API meminta otorisasi ulang pemilik, jalankan fungsi aktivasi tersebut di editor Google, lalu ulangi pemeriksaan. Jangan menonaktifkan pemeriksaan koneksi atau melewati persetujuan Google.

## Kapan catatan disimpan

Penyimpanan dilakukan setelah bukti diunggah dan sebelum ringkasan ditampilkan. Status `TERSIMPAN` berarti data sudah dicatat. Status WhatsApp selalu `PENGIRIMAN_BELUM_DIKONFIRMASI`: tautan wa.me tidak memberi callback untuk membuktikan pengguna menekan Kirim atau admin menerima pesan. Catatan dapat ada meskipun pengguna membatalkan sebelum mengirim pesan.

Jika pencatatan belum diaktifkan, aplikasi memberi keterangan pada ringkasan dan alur WhatsApp yang sudah ada tetap berjalan. Setelah diaktifkan, kegagalan penyimpanan catatan menahan langkah berikutnya dan menampilkan pesan untuk mencoba kembali. File yang sudah diunggah dipakai ulang saat retry.

Setiap sesi draft memiliki ID acak. Retry atau revisi draft memperbarui baris yang sama. Setelah WhatsApp dibuka, perubahan data berikutnya mendapat ID baru agar catatan lama tetap ada. Memuat ulang halaman memulai sesi baru. Ini bukan deduplikasi lintas perangkat atau deteksi pengajuan isi identik.

## Isi dan akses spreadsheet

Kolom: ID Pengajuan, Waktu Catat UTC, Terakhir Diperbarui UTC, Status Catatan, Status WhatsApp, Nama Pemohon, Tanggal Pengajuan, Jenis Proyek, Kategori, Jenis Pengajuan, Detail Pengajuan, Nama Bank, Nomor Rekening, Pemilik Rekening, Folder Bukti, Jumlah Lampiran.

Detail dinormalisasi di server sesuai jenis pengajuan dan disimpan sebagai JSON dalam satu kolom agar rincian Reimburst berulang serta variasi periode/volume tidak hilang. Nomor rekening disimpan sebagai teks. Data pengguna diperlakukan sebagai teks agar tidak dieksekusi sebagai formula. Folder bukti harus berada langsung dalam folder induk yang dikonfigurasi.

Spreadsheet berisi data rekening: beri akses hanya kepada admin yang membutuhkan. Aplikasi tidak mempublikasikan spreadsheet, mengirim undangan email, atau menyediakan endpoint publik untuk membaca catatan. ID sheet dapat diganti melalui `SUBMISSION_SPREADSHEET_ID`, kemudian jalankan fungsi aktivasi lagi untuk memverifikasi header. Set `SUBMISSION_LOG_READY=false` jika pencatatan sengaja dinonaktifkan; formulir akan memberi tahu bahwa catatan otomatis belum aktif.

## Validasi

```sh
npm run test:bridge
node tests/submission-record.browser.cjs
```

Tes memakai layanan Google tiruan. Uji Sheets nyata harus dilakukan setelah otorisasi: periksa baris, angka nol di depan rekening, rincian yang sesuai, tautan subfolder bukti, serta tidak ada baris ganda saat draft ditinjau ulang. Jangan menandai catatan sebagai pesan WhatsApp terkirim hanya karena tombol membuka WhatsApp.
