# Hubungkan GitHub → Google Apps Script

Tujuan: Script ID `1KnwZq7MWdh-HDyJYSixXWBJY7zScSbQU1Y33zg7I35aqaShYaK0W2tHq`.
Workflow `.github/workflows/apps-script.yml` memakai clasp **3.4.1** dan Node.js 24. Workflow tidak otomatis berjalan pada push sampai Anda mengaktifkannya. Tidak ada kredensial yang disimpan dalam Git.

## 1. Otorisasi Google di komputer Anda

1. Masuk dengan akun Google yang memiliki akses edit ke proyek tujuan.
2. Buka https://script.google.com/home/usersettings dan aktifkan **Google Apps Script API**.
3. Pasang Node.js 24 LTS dari https://nodejs.org jika belum tersedia.
4. Buka Terminal atau PowerShell di komputer Anda. Buat folder **di luar repositori**, kemudian jalankan:

```sh
mkdir blueconnect-google-login
cd blueconnect-google-login
npx --yes --package @google/clasp@3.4.1 clasp --auth ./blueconnect-oauth.json login
```

Browser akan terbuka. Pilih akun yang memiliki akses proyek dan selesaikan otorisasi. Token disimpan ke `blueconnect-oauth.json`. Gunakan default user, tanpa opsi `--user`. Jangan kirim file, isinya, kode otorisasi, atau token ke chat. Jika kebijakan organisasi memblokir clasp, minta administrator mengizinkannya atau gunakan OAuth client milik organisasi sesuai dokumentasi resmi https://github.com/google/clasp#bring-your-own-projectcredentials. Jangan menonaktifkan pembatasan organisasi.

## 2. Simpan kredensial di GitHub Secrets

1. Buka https://github.com/blueconnectin/payment.blueconnect/settings/secrets/actions/new.
2. **Name:** `CLASP_AUTH_JSON`.
3. Buka file `blueconnect-oauth.json` secara lokal melalui editor teks, lalu salin **seluruh JSON** ke kolom **Secret** dan klik **Add secret**. Jangan menyalinnya ke file repositori, issue, log, atau chat.
4. Setelah berhasil, hapus file sementara OAuth dari komputer bila tidak diperlukan untuk penggunaan lokal. Hapus secret dan cabut otorisasi Google bila integrasi dihentikan. Jika Google mencabut atau mengakhiri refresh token, ulangi login dan perbarui secret.

Secret ini memberi GitHub Actions akses sesuai izin akun OAuth. Berikan hak edit repositori hanya kepada orang tepercaya karena perubahan workflow dapat mengakses secret saat berjalan.

## 3. Uji sinkronisasi pertama

1. Buka https://github.com/blueconnectin/payment.blueconnect/actions/workflows/apps-script.yml.
2. Pilih **Run workflow**, branch **main**, dan biarkan **publish** tidak dicentang.
3. Workflow mengunduh sumber proyek saat ini, mempertahankan manifest serta file lain, memeriksa konflik `doGet`, membuat versi cadangan, lalu memperbarui `Code` dan `Index`. Setelah upload, workflow membaca ulang dan membandingkan kedua file sebelum menyatakan sukses.
4. Buka Apps Script dan pastikan formulir berada di `Index` serta entry point berada di `Code`.

Proyek harus memakai runtime V8. Bila ada `doGet` di file lain, workflow berhenti tanpa mengunggah; selesaikan konflik di editor terlebih dahulu. Perubahan langsung oleh editor lain selama sinkronisasi dapat bertabrakan: gunakan GitHub sebagai sumber perubahan aplikasi dan hindari edit serentak saat workflow berjalan.

Setiap sinkronisasi membuat versi cadangan yang dapat dipulihkan melalui Apps Script Project History. Jangan menghapus versi lama otomatis untuk melewati kuota. Bila batas jumlah versi tercapai, workflow berhenti; arsipkan dan kelola versi secara manual sesuai kebutuhan proyek.

## 4. Publikasikan Web App sekali dari editor Google

Jika belum ada Web App, buka proyek tujuan lalu **Deploy → New deployment → Web app**. Atur **Execute as** dan **Who has access** sesuai pemohon yang akan memakai aplikasi. Klik **Deploy** dan selesaikan otorisasi jika diminta. Workflow tidak mengubah kebijakan akses atau membuat deployment publik baru.

Salin **Deployment ID** dari **Deploy → Manage deployments** (berbeda dari Script ID). Buka https://github.com/blueconnectin/payment.blueconnect/settings/variables/actions dan buat repository variable:

- `APPS_SCRIPT_DEPLOYMENT_ID`: Deployment ID dari Web App tersebut.

Jalankan workflow lagi dengan **publish** dicentang. Workflow membuat versi rilis dan memperbarui deployment yang sama sehingga URL `/exec` tetap. Lalu uji URL Web App: formulir tampil, ringkasan benar, dan WhatsApp terbuka dengan nomor admin tepat. Lampiran serta tombol Kirim tetap dilakukan pengguna di WhatsApp.

## 5. Aktifkan otomatis setelah uji manual berhasil

Di **Settings → Secrets and variables → Actions → Variables**, tambahkan:

- `APPS_SCRIPT_SYNC_ENABLED` = `true`: sinkronkan source saat file aplikasi/workflow berubah di `main`.
- `APPS_SCRIPT_AUTO_PUBLISH` = `true`: opsional, sekaligus perbarui Web App saat push. Memerlukan `APPS_SCRIPT_DEPLOYMENT_ID` yang benar.

Tanpa auto-publish, perubahan source tidak mengubah versi yang dilihat pengguna melalui URL `/exec`. Tombol Run workflow tetap bisa dipakai untuk rilis manual. Workflow hanya memakai izin GitHub `contents: read`; seluruh perubahan pada Google menggunakan secret OAuth yang Anda simpan.

## Jika gagal

- **Secret belum ada / format tidak valid:** simpan seluruh file OAuth dari clasp 3.4.1 sebagai `CLASP_AUTH_JSON`.
- **Clone gagal:** pastikan Apps Script API aktif, akun OAuth memiliki akses edit, dan token masih berlaku.
- **Versi cadangan gagal:** cek izin proyek atau batas jumlah versi. Tidak ada source yang diunggah jika cadangan tidak terkonfirmasi.
- **Read-back gagal:** deployment tidak diperbarui. Periksa source di Apps Script dan ulangi setelah penyebabnya diperbaiki.
- **Update deployment gagal:** periksa Deployment ID dan hak pemilik deployment. Source mungkin sudah tersinkron, tetapi Web App belum berpindah versi.

Untuk memulihkan, gunakan nomor versi cadangan yang dicatat di log dan Apps Script Project History. Log workflow tidak mencetak token, file OAuth, atau isi source proyek remote. Pengujian lokal workflow tidak membuktikan koneksi Google sudah aktif; koneksi baru terkonfirmasi setelah run dengan otorisasi Anda berhasil.
