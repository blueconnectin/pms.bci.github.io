# Formulir Pengajuan Blue Connect

Formulir berbahasa Indonesia untuk menyiapkan pesan pengajuan ke WhatsApp admin **+62 882-2306-2197**.

Web App: https://script.google.com/macros/s/AKfycbzSlPMUFTn6WUINNiRJjF6sSQ_WvEeXZIatAJ6wCgyCFlvOGVS9f2_DTMsvytClhwM/exec

## Alur

Isi Nama Pemohon, Tanggal Pengajuan, Jenis Pengajuan (Sales, Manage Service, Reimburst, Operasional), Nama Bank, Nomor Rekening, dan Nama Pemilik Rekening. Nominal tidak diminta; admin mencantumkannya pada invoice.

Setelah unggah Drive diaktifkan, pemohon memilih 1–3 bukti (JPG/JPEG, PNG, WEBP, PDF, DOCX, XLSX), maksimal 5 MB per file dan 10 MB total. Tombol **Periksa Pengajuan** mengunggah file, lalu menampilkan ringkasan beserta tautan bukti. Pemohon kemudian membuka WhatsApp dengan pesan terisi dan menekan **Kirim** sendiri. Lampiran berupa tautan Drive, bukan file media WhatsApp. Tidak ada pengiriman pesan otomatis.

Bila penyimpanan Drive belum diotorisasi atau koneksinya gagal, kolom lampiran tetap terlihat dengan pesan masalah dan tombol coba kembali. Pengajuan diblokir sampai koneksi siap; aplikasi tidak mengalihkan lampiran menjadi manual di WhatsApp.

## Aktivasi Google Drive satu kali

1. Tunggu workflow GitHub **Sync Google Apps Script** selesai memperbarui source dan deployment.
2. Buka proyek Apps Script sebagai **pemilik deployment**.
3. Pilih fungsi **authorizeEvidenceStorage**, klik **Run**, lalu selesaikan izin Google Drive melalui dialog Google.
4. Folder bawaan sudah ditetapkan sesuai pilihan pengguna: `1t3eqlI9VK7y4Gt157bP4_YLKuyfSsM8B`. Akun pelaksana Web App harus bisa menambah file ke folder itu. Pastikan akun Google admin penerima memiliki akses baca folder, sehingga tautan dari WhatsApp dapat dibuka admin.
5. Fungsi ini memeriksa akses folder dan mengisi Script Properties `UPLOAD_FOLDER_ID` dan `EVIDENCE_UPLOADS_READY=true`. Muat ulang URL `/exec`. Bagian unggah akan muncul tanpa perlu deployment ulang untuk perubahan properti tersebut.

Jika folder ingin diganti, isi `UPLOAD_FOLDER_ID` di **Project Settings → Script Properties**, lalu jalankan fungsi otorisasi lagi. Untuk mematikan unggah, set `EVIDENCE_UPLOADS_READY=false`. Izin deployment tetap harus sesuai kebutuhan organisasi. Aplikasi tidak mengubah kebijakan akses Web App atau memberi akses publik pada file.

Tidak perlu menaruh kredensial Google Drive di HTML, GitHub Variables, atau chat. Otorisasi Drive diberikan langsung pada proyek Apps Script. GitHub OAuth yang dipakai untuk sinkronisasi source tidak menggantikan otorisasi runtime pemilik Web App.

## Penyimpanan dan akses

File disimpan di folder pilihan dan mewarisi akses folder. Jangan membuat folder publik jika buktinya mengandung informasi pribadi. Aplikasi tidak memanggil `setSharing` dan tidak mengirim undangan email. Nama file diberi UUID untuk menghindari benturan. File tetap berada di Drive walaupun pemohon membatalkan atau mengubah pilihan setelah unggah; admin mengelola retensi/penghapusan melalui Drive.

Data rekening tidak disimpan ke database atau localStorage. Pesan dan tautan Drive diteruskan ke parameter URL WhatsApp, jadi jangan membagikan URL pesan yang berisi data pribadi. Unggah ulang permintaan yang sama memakai ID dan fingerprint file untuk deduplikasi selama cache server tersedia (maksimal enam jam); ini bukan jaminan deduplikasi permanen.

Endpoint upload hanya menerima format/ukuran yang divalidasi, memeriksa header biner dasar, dan menyimpan ke folder yang ditetapkan server. Pemeriksaan ini bukan pemindaian antivirus atau validasi isi lengkap dokumen Office. Jika deployment dapat diakses siapa pun, unggah juga dapat diakses pengunjung publik: sesuaikan akses Web App dengan anggota tim serta pantau penggunaan/kuota Drive. Kegagalan sebagian batch dibersihkan ke Trash sejauh izin memungkinkan.

## Pengembangan dan pengujian

Tidak ada build aplikasi. Jalankan server statis untuk menguji tampilan; unggah memerlukan backend yang tersambung:

```sh
cd /workspace/payment.blueconnect
python3 -m http.server 8000 --bind 127.0.0.1
```

Buka path `/Index.html` (I besar). Unggah hanya berfungsi melalui Web App Apps Script dengan `google.script.run`.

```sh
node tests/evidence-upload.test.cjs
node tests/whatsapp-form.browser.cjs
node tests/evidence-upload.browser.cjs
```

Tes backend memakai layanan Google tiruan, meliputi validasi, deduplikasi, pembersihan kegagalan batch, dan aktivasi folder. Tes browser memeriksa iframe, review/edit, kegagalan unggah, retry, serta pesan WhatsApp tanpa mengirim pesan. Tes ini tidak membuktikan unggah Drive nyata. Uji penerimaan setelah otorisasi: unggah satu bukti contoh, periksa file di folder, buka tautannya sebagai admin, dan pastikan URL bukti tercantum dalam pesan WhatsApp.

## GitHub → Apps Script

Ikuti [panduan koneksi](CONNECT_APPS_SCRIPT.md). Workflow mempertahankan manifest dan file remote lain, membuat versi cadangan, memperbarui `Code` serta `Index`, lalu memverifikasi source. Jangan memasukkan template literal berisi URL `https://` ke script HTML: transformasi HtmlService pada deployment ini pernah memotongnya dan menyebabkan syntax error. Gunakan string biasa untuk URL.

Nomor tujuan WhatsApp dikonfigurasi melalui `ADMIN_WHATSAPP` di `Index.html`. Kredensial sinkronisasi hanya berada di GitHub Secrets. Implementasi lama dicadangkan di `/workspace/payment-blueconnect-backup/` pada lingkungan kerja sebelumnya.

## Domain payment.blueconnect.id

Versi Cloudflare Worker + Static Assets tersedia untuk menampilkan formulir pada domain sendiri tanpa redirect ke Google. Ikuti [panduan Cloudflare](CONNECT_CLOUDFLARE.md). Unggah Drive melewati endpoint server dengan tanda tangan HMAC; kunci berada di Cloudflare Secrets dan Script Properties. Tidak ada token Google di browser.

Status: source dan paket deployment disiapkan; pemasangan akun Cloudflare, secret penghubung, Custom Domain, serta uji unggah pada domain sendiri harus dilakukan sebelum menyatakan domain aktif. Deployment Google yang sudah ada tetap berfungsi dan dipertahankan sebagai backend Drive.

## Deployment terpadu

Ikuti [hubungkan deployment Google dan Cloudflare](CONNECT_DEPLOYMENTS.md) untuk memakai satu workflow yang merilis backend Google dahulu, lalu tampilan domain sendiri dari commit yang sama. Aktivasi memerlukan dua GitHub Secrets Cloudflare dan variable enable satu kali. Versi yang tersaji dapat diperiksa pada `/version.json` setelah rilis Cloudflare berhasil.
