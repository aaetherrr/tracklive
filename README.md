# BTS Live Tracker

Situs statis (HTML, CSS, JavaScript) untuk memantau member BTS yang sedang live di YouTube,
lengkap dengan bagan struktur, blog, dan panel admin.

- Hosting: **GitHub Pages**
- Login admin dan penyimpanan data: **Firebase** (Authentication + Firestore)
- Status live otomatis: **YouTube Data API v3** (opsional)

## Isi folder

```
index.html        halaman publik (Live, Struktur, Blog)
admin.html        panel admin (tidak dilink dari situs publik)
css/style.css     seluruh tampilan
js/config.js      config Firebase dan API key YouTube  <-- satu-satunya file yang perlu diisi
js/app.js         router dan halaman publik
js/admin.js       panel admin
js/data.js        akses Firestore / mode demo
js/site.js        logo, nama situs, tautan navbar
js/theme.js       mode gelap/terang
js/youtube.js     cek status live
js/util.js        helper dan daftar tier bawaan
firestore.rules   rules Firestore (salin ke Firebase Console)
```

## 1. Buat project Firebase

1. Buka https://console.firebase.google.com, klik **Add project**.
2. Di **Project settings > General > Your apps**, klik ikon web `</>`, daftarkan app, lalu salin objek `firebaseConfig`.
3. Tempel isinya ke `js/config.js` (bagian `firebaseConfig`). Kolom yang dipakai: `apiKey`, `authDomain`, `projectId`, `appId`.

## 2. Aktifkan Authentication

1. **Authentication > Sign-in method**: aktifkan **Email/Password**.
2. Tab **Users > Add user**: buat satu akun untuk admin (email dan password yang kuat).
3. **Authentication > Settings > Authorized domains**: tambahkan `usernamekamu.github.io`
   (ganti dengan username GitHub lu).
4. Setelah akun admin jadi, matikan pendaftaran akun baru kalau opsinya ada
   (**Authentication > Settings > User actions > Enable create (sign-up)**). Ini mencegah orang lain mendaftar lewat API.

## 3. Aktifkan Firestore dan pasang rules

1. **Firestore Database > Create database** (pilih lokasi terdekat, mis. `asia-southeast2`).
2. Tab **Rules**: tempel isi `firestore.rules`, ganti `GANTI_DENGAN_EMAIL_ADMIN` dengan email admin, lalu **Publish**.

Rules ini mengizinkan semua orang membaca (supaya pengunjung bisa melihat data), tetapi hanya akun admin
yang boleh menulis. Jangan pakai rules `allow write: if request.auth != null`, karena itu mengizinkan
siapa pun yang berhasil membuat akun untuk mengubah data.

## 4. Deploy ke GitHub Pages

1. Buat repo baru di GitHub, upload seluruh isi folder ini (bukan folder pembungkusnya).
2. **Settings > Pages > Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder `/ (root)`.
3. Tunggu beberapa menit. Situs aktif di `https://usernamekamu.github.io/nama-repo/`.
4. Panel admin ada di `https://usernamekamu.github.io/nama-repo/admin.html`. Alamat ini tidak dilink dari situs.

## 5. (Opsional) Status live otomatis

Tanpa API key, admin tetap bisa menandai live secara manual lewat centang "Sedang live".

1. Buka https://console.cloud.google.com, pilih project yang sama dengan Firebase (atau buat baru).
2. **APIs & Services > Library**: cari **YouTube Data API v3**, klik **Enable**.
3. **APIs & Services > Credentials > Create credentials > API key**.
4. Klik key yang baru dibuat, lalu **batasi**:
   - **Application restrictions** = *Websites*, tambahkan `https://usernamekamu.github.io/*`
   - **API restrictions** = *Restrict key*, pilih hanya **YouTube Data API v3**
5. Salin key ke `YT_API_KEY` di `js/config.js`.

Catatan kuota: jatah gratis 10.000 unit per hari. Setiap pengecekan memakai 1 unit per 50 video, dan
tiap pengunjung yang membiarkan tab terbuka mengecek sendiri tiap `POLL_MS` (60 detik). Kalau situs ramai,
jangan percepat interval, dan pertimbangkan pengecekan di sisi server.

## 6. Cara pakai panel admin

- **Member**: nama, tier, jabatan, atasan langsung, foto, link channel, link live YouTube, judul live (mode manual).
- **Blog**: tambah, ubah, hapus tulisan.
- **Pengaturan**: nama situs, subjudul, logo (upload atau URL), daftar tier dan urutannya, tautan navbar (Discord, dll).
- Link live: tempel link video/stream YouTube milik member. Dari link itu situs mengambil status live,
  thumbnail, judul, penonton, dan lama live.

## Mode demo

Kalau `firebaseConfig.apiKey` dikosongkan, situs jalan dalam mode demo: data tersimpan di browser
masing-masing (localStorage), password admin `bts123`, dan pengunjung lain tidak melihat perubahan.
Isi `js/config.js` sebelum dipakai sungguhan.

## Masalah umum

- **`auth/unauthorized-domain`** saat login: domain GitHub Pages belum ada di Authorized domains.
- **`Missing or insufficient permissions`**: rules belum dipublish, atau email admin di rules berbeda dengan akun yang login.
- **Thumbnail/judul/penonton tidak muncul**: `YT_API_KEY` kosong, key belum dibatasi dengan benar ke domain lu,
  atau link live yang diisi bukan link video/stream yang sedang berjalan.
- **Perubahan tidak muncul setelah upload**: GitHub Pages butuh beberapa menit, lalu tekan Ctrl+F5.
