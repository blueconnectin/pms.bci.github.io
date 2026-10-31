# Pasang payment.blueconnect.id di Cloudflare

Versi ini menyajikan formulir dan endpoint upload dengan **satu Cloudflare Worker + Static Assets**. Tidak diperlukan Pages terpisah. Alamat browser tetap `https://payment.blueconnect.id`; tidak ada redirect atau iframe ke Apps Script. WhatsApp dibuka terpisah setelah pemohon memeriksa pengajuan.

Apps Script tetap menyimpan bukti ke folder Drive yang sudah disetujui. Browser mengakses `/api/config` dan `/api/evidence` di domain yang sama, kemudian Worker meneruskan request bertanda tangan ke Apps Script. `google.script.run` tetap dipakai bila formulir dibuka dari deployment Google lama.

## 1. Tunggu backend Google diperbarui

Pastikan workflow GitHub **Sync Google Apps Script** pada `main` berhasil dan mempublikasikan versi yang mengandung `doPost`. Otorisasi Drive dan properti folder yang sebelumnya diaktifkan tetap digunakan. Jika backend belum diperbarui, API domain baru belum dapat mengunggah file.

## 2. Siapkan satu kunci penghubung

Buat nilai acak minimal 32 karakter dengan password manager, atau jalankan di PowerShell:

```powershell
Set-Clipboard -Value (([guid]::NewGuid().ToString('N')) + ([guid]::NewGuid().ToString('N')))
```

Perintah tersebut membuat nilai acak ke clipboard, tanpa mencetaknya. Simpan nilai yang sama di dua tempat berikut; jangan kirim ke chat atau commit ke Git:

- **Apps Script → Project Settings → Script Properties:** `CLOUDFLARE_BRIDGE_SECRET`.
- **Cloudflare Worker → Settings → Variables and Secrets → Add:** type **Secret**, name `BRIDGE_SECRET`.

Tidak perlu menambahkan kedua kunci tersebut ke HTML atau GitHub Variables. Properti Apps Script dapat diisi sekarang; secret Worker diisi setelah Worker pertama berhasil dibuat. Nilainya harus sama persis. Memperbarui Script Properties tidak memerlukan deployment Apps Script baru.

## 3. Hubungkan repositori di Cloudflare

1. Buka akun Cloudflare yang mengelola zona `blueconnect.id`.
2. Masuk **Workers & Pages → Create application → Worker → Import a repository / Connect GitHub**. Nama menu dapat berbeda. Gunakan alur Worker yang menghubungkan repositori Git, bukan template Pages.
3. Hubungkan GitHub dan pilih `blueconnectin/payment.blueconnect`, production branch **main**.
4. Gunakan pengaturan:

| Pengaturan | Nilai |
|---|---|
| Worker/project name | `blueconnect-payment` |
| Root directory | akar repositori (`/`) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Node.js version | 24 |

`package-lock.json` dan Wrangler 4.156.0 sudah disiapkan. Instalasi dependensi dilakukan oleh build Cloudflare. Worker name di dashboard harus sama dengan `name` di `wrangler.jsonc`.

5. Deploy, lalu buka Worker **Settings → Variables and Secrets** dan tambahkan secret `BRIDGE_SECRET` dari langkah 2. Pilih simpan/deploy sesuai UI Cloudflare.
6. `APPS_SCRIPT_URL` sudah diatur di `wrangler.jsonc` menggunakan URL `/exec` saat ini. Jangan memakai URL `/dev`.

Jika akun memiliki lebih dari satu zona/akun, pilih akun pemilik `blueconnect.id`. Kredensial deployment dikelola oleh koneksi Git Cloudflare; tidak perlu mengirim API token kepada agen.

## 4. Uji URL workers.dev dahulu

Buka URL Worker yang disediakan Cloudflare. Periksa:

- Formulir tampil tanpa beralih ke Google.
- Buka `/api/config` pada URL tersebut. Hasil yang diharapkan adalah `{"enabled":true}`. Ini membuktikan Worker dapat menghubungi backend Google dan kuncinya cocok, tetapi belum membuktikan upload.
- Isi formulir dan unggah satu bukti contoh. Pastikan file masuk folder Drive, ringkasan menampilkan tautan yang benar, dan admin dapat membukanya.
- Tombol WhatsApp mengisi pesan beserta tautan bukti; pengiriman tetap dilakukan pemohon.

Jika API gagal, periksa secret di kedua layanan dan pastikan deployment Google memuat `doPost`, dapat diakses Worker tanpa login, dan `EVIDENCE_UPLOADS_READY=true`. Worker tidak mencetak token atau data file ke log. Bila backend tidak tersedia, formulir memberi tahu pengguna dan menyediakan alur lampiran manual.

## 5. Pasang domain sendiri

Setelah uji Worker berhasil:

1. Buka Worker **blueconnect-payment → Settings → Domains & Routes**.
2. Pilih **Add → Custom Domain**.
3. Masukkan **payment.blueconnect.id**, lalu konfirmasi.
4. Cloudflare mengatur DNS dan sertifikat untuk Worker. Tidak perlu CNAME ke `script.google.com`.
5. Jika ada record DNS lama dengan nama `payment`, periksa fungsi record itu sebelum menggantinya. Jangan menghapus record layanan lain.
6. Tunggu status domain/HTTPS aktif, lalu uji kembali di `https://payment.blueconnect.id`.

Jangan membuat redirect rule untuk subdomain ini ke Apps Script. Jangan menaruh Web App Google di iframe agar alamat tampak tetap: versi ini melayani HTML langsung dari Cloudflare.

## Pembaruan berikutnya

- Push ke `main` memperbarui source Google lewat GitHub Actions dan Worker lewat Cloudflare Git Builds.
- Keduanya pipeline terpisah. Untuk perubahan yang mengubah kontrak API, tunggu backend Google siap sebelum merilis frontend yang bergantung pada kontrak baru.
- Secret Worker tetap menjadi konfigurasi runtime, bukan file build. Jangan mengubah binding rahasia menjadi plaintext variable.
- Custom Domain ditambahkan lewat dashboard, bukan melalui `wrangler.jsonc`, agar deployment awal tidak mengubah DNS sebelum uji Worker.
- Deployment lama di Google masih dapat dipakai selama migrasi; jangan menghapusnya karena endpoint upload Worker menggunakannya.

## Validasi lokal

```sh
npm ci
npm run build
npm run test:bridge
npx wrangler deploy --dry-run
```

`node tests/cloudflare.browser.cjs` menguji alur browser pada domain yang sama dengan upstream Google tiruan (memerlukan Playwright/Chromium pada environment pengembangan). Pengujian tersebut tidak membuat file di Drive atau mengirim pesan WhatsApp. Unggah nyata dan DNS baru dinyatakan berhasil setelah diuji di akun pengguna.

Hanya `public/index.html` dan header keamanan yang dibangun menjadi static assets; file backend, konfigurasi lokal, serta kredensial tidak diterbitkan sebagai aset web. Folder `public/`, `.wrangler/`, dan `.dev.vars*` diabaikan Git.
