# Satu workflow: Apps Script → Cloudflare

Workflow **Deploy application** (`.github/workflows/apps-script.yml`) memperbarui Apps Script terlebih dahulu, lalu Cloudflare memakai commit yang sama. Domain `payment.blueconnect.id` tetap terhubung ke Worker `payment-blueconnect` yang sudah ada. DNS dan secret `BRIDGE_SECRET` runtime tidak diganti oleh workflow.

## Hubungkan akses Cloudflare satu kali

1. Buka Cloudflare **My Profile → API Tokens → Create Token**.
2. Pilih template **Edit Cloudflare Workers**. Batasi Account Resources ke akun pemilik Worker `payment-blueconnect`. Biarkan izin deployment Worker/Workers Scripts dan pembacaan akun yang diperlukan template. Untuk alur ini domain sudah dipasang; tidak perlu memberikan Global API Key atau akses ke semua akun. Jika template meminta zona, batasi ke `blueconnect.id`.
3. Buat token dan simpan langsung sebagai GitHub Actions **repository secret** `CLOUDFLARE_API_TOKEN`: https://github.com/blueconnectin/payment.blueconnect/settings/secrets/actions/new. Jangan kirim token ke chat atau memasukkannya ke Git.
4. Salin **Account ID** dari halaman akun/Worker Cloudflare. Tambahkan repository secret kedua: `CLOUDFLARE_ACCOUNT_ID`. Account ID berbeda dari Zone ID dan Worker name.
5. Pada GitHub **Settings → Secrets and variables → Actions → Variables**, tambahkan `CLOUDFLARE_DEPLOY_ENABLED=true`.

Secret Google `CLASP_AUTH_JSON` dan variabel `APPS_SCRIPT_DEPLOYMENT_ID`, `APPS_SCRIPT_SYNC_ENABLED=true`, serta `APPS_SCRIPT_AUTO_PUBLISH=true` tetap diperlukan seperti sebelumnya. Jangan membuat ulang atau menghapus binding Google yang sudah berhasil.

## Rilis pertama

1. Buka https://github.com/blueconnectin/payment.blueconnect/actions/workflows/apps-script.yml.
2. Pilih **Run workflow**, branch **main**, centang **publish**, lalu jalankan.
3. Pastikan job **sync** dan **Deploy payment.blueconnect.id** keduanya hijau. Job Cloudflare yang **skipped** belum memperbarui domain.
4. Buka https://payment.blueconnect.id/version.json. `commit` harus cocok dengan commit workflow, kemudian buka halaman formulir dan periksa logo.
5. Setelah rilis terpadu berhasil, nonaktifkan **automatic Git builds** pada Cloudflare Worker jika sebelumnya diaktifkan, agar dua pipeline tidak saling mendahului. Pertahankan Worker, Custom Domain, dan secret runtime-nya. Workflow GitHub menjadi satu-satunya pemicu rilis.

Selanjutnya push perubahan aplikasi ke `main` memicu kedua deployment secara berurutan. Tidak perlu tombol deploy terpisah di Cloudflare.

## Jika gagal

- Cloudflare skipped: periksa `CLOUDFLARE_DEPLOY_ENABLED=true` dan pastikan publish aktif untuk run manual (atau `APPS_SCRIPT_AUTO_PUBLISH=true` untuk push).
- Autentikasi Cloudflare gagal: cek token yang belum kedaluwarsa, Account ID, dan izin ke akun Worker. Jangan memperluas izin ke semua akun untuk mengatasi salah Account ID.
- Google gagal: Cloudflare tidak dijalankan. Perbaiki job Google, kemudian jalankan ulang dengan publish aktif.
- Google berhasil tetapi Cloudflare gagal: Apps Script mungkin sudah baru, sedangkan domain masih lama. Deployment dua layanan tidak bersifat atomik; perbaiki job Cloudflare dan jalankan ulang. Jangan mengklaim keduanya sudah aktif hanya dari keberhasilan job Google.
- Domain menampilkan versi lama: cocokkan `/version.json` dengan commit run dan pastikan tidak ada pipeline Cloudflare lama yang merilis ulang source lama.

Konfigurasi ini menambahkan `/version.json` yang hanya memuat commit publik, tanpa kredensial/data pengguna. HTML memakai Cache-Control no-cache dan metadata versi memakai no-store untuk memudahkan pemeriksaan rilis.
