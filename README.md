# VILLIND JUNIOR TOURNAMENT - Villind Cup II 2026

Website jadwal, skor langsung, dan klasemen turnamen. Tanpa instalasi rumit: hanya file HTML, CSS, dan JavaScript.

## Isi website
- Beranda (hitung mundur, pertandingan live, berikutnya, hasil terbaru)
- Jadwal (filter U-11 / U-15), detail pertandingan, Klasemen otomatis, Live + YouTube, Info
- `admin.html` = panel panitia (HP): mulai/half time/babak 2/akhiri, tambah gol, batalkan gol, riwayat, tambah Semi Final/Final, atur YouTube/Saweria/WhatsApp
- Pelanggaran, kartu kuning, dan kartu merah per tim (dicatat dari panel panitia, tampil di halaman pertandingan)
- `stats.html` = statistik layar penuh untuk vMix (skor, logo, pencetak gol, pelanggaran, kartu)
- Logo 13 tim ada di `icons/teams/` (RT yang sama di U-11 dan U-15 memakai satu logo)
- Bisa dipasang di HP (PWA) dan ada halaman offline

## Langkah pemasangan (kerjakan berurutan, satu per satu)

### Langkah 1. Unggah ke GitHub
1. Buka github.com, masuk.
2. Tekan tombol **+** di kanan atas, pilih **New repository**.
3. Nama: `villind-junior`. Pilih **Public**. Tekan **Create repository**.
4. Tekan **uploading an existing file**. Ekstrak file zip, lalu tarik SEMUA isi folder (admin.html, index.html, css, js, icons, dan lainnya) ke halaman itu.
5. Tekan **Commit changes**.

### Langkah 2. Hidupkan website
1. Di repository, buka **Settings**, lalu **Pages**.
2. Pada **Branch** pilih `main`, folder `/ (root)`, tekan **Save**.
3. Tunggu 1-2 menit. Alamat website muncul di halaman itu.
Website sudah menampilkan jadwal resmi walau Supabase belum diisi.

### Langkah 3. Buat database (Supabase)
1. Buka supabase.com, masuk, **New project**, nama `villind-cup`, Region **Singapore**.
2. Menu kiri **SQL Editor**, **New query**. Buka file `supabase/schema.sql`, salin semua isinya, tempel, tekan **Run**.
3. **New query** lagi. Salin isi `supabase/seed.sql`, tempel, **Run**. (Hanya SEKALI. Jika dua kali, jadwal dobel.)
4. Menu **Authentication**, **Users**, **Add user**. Isi email dan kata sandi panitia, centang **Auto Confirm User**. Ulangi untuk operator lain.
5. Menu **Authentication**, **Sign In / Providers**, matikan **Allow new users to sign up** agar orang luar tidak bisa mendaftar.

### Langkah 4. Sambungkan website ke database
1. Di Supabase: **Project Settings**, **API**. Salin **Project URL** dan kunci **anon public**.
2. Di GitHub, buka file `js/config.js`, tekan ikon pensil, ganti `ISI_URL_SUPABASE` dan `ISI_KUNCI_ANON`, tekan **Commit changes**.
3. JANGAN pernah memakai kunci `service_role`.

### Langkah 5. Pakai saat pertandingan
1. Buka `alamat-website/admin.html`, masuk dengan akun panitia.
2. Pilih pertandingan, tekan **Mulai**. Tekan **+1** saat gol. Tekan **Half Time**, **Mulai Babak 2**, **Akhiri**.
3. Klasemen terisi otomatis dari pertandingan berstatus Full Time.
4. Semi Final dan Final: tambahkan lewat bagian **Tambah pertandingan**.

## Update fitur pelanggaran dan kartu (jika database sudah dibuat)
Jika Supabase sudah dipasang sebelum fitur ini ada, jalankan SEKALI file `supabase/update-pelanggaran-kartu.sql` di SQL Editor (tidak menghapus data). Jika baru memasang dari awal dengan `schema.sql` terbaru, tidak perlu.

## Statistik layar penuh di vMix
1. Di vMix: Add Input, Web Browser, alamat `https://alamat-website/stats.html`, ukuran 1920 x 1080.
2. Di `admin.html`, pilih pertandingan, lalu tekan **Tampilkan statistik** (di bagian Statistik layar penuh). Tekan **Sembunyikan** untuk menutup. Tampil dan hilang memakai efek pudar.
3. Uji tampilan: `stats.html?demo=1` (data contoh) atau `stats.html?always=1` (selalu tampil).
4. Overlay skor kecil (`overlay.html`) tetap bisa dipakai bersamaan.

## Catatan penting
- Kategori kuning di kalender dibaca sebagai **U-11**, biru sebagai **U-15**. Untuk mengganti label, ubah `CATEGORY_LABEL` di `js/core.js`.
- Semua akun yang dibuat di Supabase bisa mengubah skor. Buat akun hanya untuk panitia yang dipercaya. Pengunjung hanya bisa membaca.
- Klasemen dihitung per kategori (satu tabel). Pembagian grup A/B belum ada di kalender sehingga belum dipisah.
- Data privasi anak: website tidak menyimpan alamat, telepon, atau tanggal lahir. Nama pencetak gol sebaiknya nama panggilan.

## vMix (belum diuji)
Data skor dapat dibaca vMix sebagai sumber data JSON dari alamat berikut (ganti URL dan KUNCI dengan milik Anda):
`URL/rest/v1/matches?select=team_a,team_b,score_a,score_b,status,period,category,clock_base,clock_started_at&status=in.(LIVE,HALF%20TIME)&apikey=KUNCI`
Pengaturan Data Source di vMix perlu dicoba langsung di komputer siaran.

## Belum dibuat
Berita, galeri, profil tim/pemain, top scorer, bracket visual, role terpisah (Operator/Editor), dan overlay vMix siap pakai. Ini bisa dilanjutkan setelah turnamen berjalan.

## Update: logo tim, daftar pemain, kartu di overlay, statistik di tab Live

1. Jalankan SEKALI file `supabase/update-tim-pemain.sql` di Supabase > SQL Editor > New query > Run.
2. Admin > "Tim: logo dan pemain": ganti logo tim (unggah gambar) dan tempel daftar pemain (satu baris satu pemain, contoh `7 Raka`).
3. Saat mencatat gol/kartu, kolom nama pemain menampilkan saran dari daftar pemain dua tim yang bertanding.
4. `overlay.html` kini menampilkan kartu kuning/merah di samping nama tim. Uji tampilan: `overlay.html?demo=1`.
5. Tab Live di website menampilkan statistik (pelanggaran, kartu kuning, kartu merah) di bawah tiap pertandingan live.
