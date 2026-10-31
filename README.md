# Formulir Pengajuan Blue Connect

Formulir statis berbahasa Indonesia untuk menyiapkan pesan pengajuan ke WhatsApp admin **+62 882-2306-2197**.

## Alur

1. Isi Nama Pemohon, Tanggal Pengajuan, Jenis Pengajuan (Sales, Manage Service, Reimburst, Operasional), Nama Bank, Nomor Rekening, dan Nama Pemilik Rekening.
2. Konfirmasi data rekening dan kewajiban melampirkan bukti, lalu periksa ringkasan.
3. Pilih **Kirim ke WhatsApp Admin** untuk membuka percakapan WhatsApp dengan pesan yang sudah diisi.
4. Lampirkan foto/dokumen secara manual di WhatsApp dan tekan **Kirim**. Tautan WhatsApp tidak dapat melampirkan file atau mengirim pesan otomatis.

Nominal tidak diminta; admin proyek akan mencantumkannya pada invoice. Tidak ada unggah file, database, login, atau API key. Situs tidak menyimpan data formulir ke server maupun localStorage. Saat tombol WhatsApp dipilih, data dimasukkan ke parameter URL WhatsApp; jangan membagikan URL tersebut karena berisi data pribadi. Data tidak dikosongkan setelah membuka WhatsApp agar dapat dicoba ulang. Muat ulang halaman dapat menghapus isian, bergantung perilaku browser.

## Menjalankan secara lokal

Tidak perlu memasang dependensi atau menjalankan build.

```sh
cd /workspace/payment.blueconnect
python3 -m http.server 8000 --bind 127.0.0.1
```

Buka path `/Index.html` (huruf I besar). Hosting statis harus memakai `Index.html` sebagai dokumen awal atau memberi tautan langsung ke file tersebut. Untuk produksi, gunakan hosting HTTPS. Belum ada deployment publik yang dibuat.

Nomor admin dikonfigurasi pada konstanta `ADMIN_WHATSAPP` di `Index.html`, dengan format kode negara dan angka saja. Tanggal awal memakai tanggal lokal perangkat pengguna.

Implementasi lama dan modul Apps Script dari rancangan sebelumnya disalin ke `/workspace/payment-blueconnect-backup/` di lingkungan kerja, sebelum diganti. Formulir ini tidak memerlukan Google Apps Script atau Google Sheets.

## Google Apps Script Web App

`Code.gs` menyediakan `doGet()` untuk menampilkan `Index.html`. `appsscript.json` mendefinisikan runtime V8. Aplikasi tetap tanpa database atau penyimpanan data rekening.

Untuk proyek baru: buat proyek pada Apps Script, tambahkan `Code.gs`, dan tambahkan file HTML bernama `Index` dengan isi `Index.html` dari repositori. Kemudian pilih **Deploy → New deployment → Web app**. Pilih akses sesuai kebutuhan organisasi. Gunakan URL deployment `/exec` untuk pemohon. Uji tombol WhatsApp dari URL tersebut; pengujian lokal tidak membuktikan navigasi dari sandbox Apps Script.

Untuk sinkronisasi melalui `clasp`, diperlukan Script ID proyek tujuan, autentikasi Google yang berhak mengedit proyek, dan Apps Script API aktif pada akun. Gunakan OAuth interaktif yang aman; jangan kirim token atau berkas kredensial melalui chat atau commit ke Git. `.claspignore` membatasi unggahan pada tiga file aplikasi. Sebelum `clasp push` ke proyek lama, baca dan cadangkan sumber proyek serta deployment yang ada: sinkronisasi dapat menimpa file. Jangan gunakan `--force` atau mengganti manifest proyek lama tanpa memeriksa konfigurasi dan fungsinya.

Push source dan deployment adalah dua langkah berbeda. Setelah source diperbarui, deployment yang sudah ada perlu diarahkan ke versi baru agar URL `/exec` menampilkan perubahan. Periksa formulir dan navigasi WhatsApp di deployment sebelum menyatakan aplikasi aktif.

## Sinkronisasi GitHub Actions

Ikuti [panduan koneksi Google dan GitHub Secrets](CONNECT_APPS_SCRIPT.md) untuk mengaktifkan workflow. Sinkronisasi otomatis dan publikasi otomatis dinonaktifkan sampai variabel repositori terkait diaktifkan. Workflow mempertahankan manifest serta file remote lain, membuat versi cadangan sebelum push, dan memverifikasi source setelah unggah. Kredensial wajib disimpan di GitHub Secrets, bukan dalam repositori.

## Pemeriksaan ringkasan di Apps Script

Tombol **Periksa Pengajuan** tidak melakukan submit/navigasi. Ringkasan ditampilkan di panel dalam halaman yang sama, agar tetap berada di iframe Apps Script. Formulir baru dapat diperiksa setelah JavaScript selesai diinisialisasi; handler dibatasi dalam scope lokal agar tidak berbenturan dengan script pembungkus.

Pengujian regresi browser (memerlukan Playwright dan Chromium yang tersedia di cloud environment):

```sh
node tests/whatsapp-form.browser.cjs
```

Pengujian memakai iframe sandbox, memeriksa validasi, ringkasan, edit, nomor rekening dengan nol di depan, dan URL WhatsApp tanpa mengirim pesan. Pengujian ini tidak menggantikan pemeriksaan URL `/exec` setelah deployment GitHub Actions berhasil.
