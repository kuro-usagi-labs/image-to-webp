# Building

Runtime development memerlukan Windows x64 dan Node.js 26+. Install dependency dengan `npm ci`, lalu jalankan `node node_modules/electron/install.js` jika kebijakan npm menunda instalasi binary Electron.

## Build Lokal Unsigned

Untuk paket lengkap (installer **dan** portable) dalam satu build:

```bash
npm run build:win
```

Jika hanya memerlukan portable, gunakan `npm run build:portable` sebagai alternatif. Jangan menjalankannya setelah build lengkap jika installer masih diperlukan: setiap script membersihkan `dist-electron/` lebih dulu.

Catatan:

- Kedua script akan membersihkan folder `dist-electron/` terlebih dahulu.
- Kedua script mematikan `CSC_IDENTITY_AUTO_DISCOVERY` agar build lokal tidak mencoba mencari sertifikat code signing otomatis.
- Konfigurasi default memakai `win.signAndEditExecutable=true` dan `win.signExecutable=false`: ikon dan metadata produk tetap diterapkan melalui resource editor, sementara code signing dinonaktifkan.
- Build standar menggunakan `--publish never`; build lokal tidak membuat release secara otomatis.
- Nama artefak: `Image-to-WebP-Setup-<version>.exe` dan `Image-to-WebP-<version>.exe`.

Setelah build lengkap `build:win` selesai, buat checksum:

```powershell
npm run release:checksums
```

Script memerlukan installer, portable, blockmap installer, dan `latest.yml` versi yang sama. `SHA256SUMS.txt` ditulis hanya jika seluruh aset tersedia dan tidak kosong.

## GitHub Release

1. Perbarui versi pada `package.json`/lockfile, README, changelog, dan `docs/releases/v<version>.md`.
2. Jalankan `npm test`, `npm run test:electron`, `npm run test:ui`, dan `npm audit` pada Windows.
3. Commit/push source dan tag versi yang sesuai.
4. Jalankan workflow manual **Publish Windows release** dengan tag tersebut. Workflow memeriksa versi, mengulang tes, membangun installer/portable, membuat checksum, mengunggah aset ke draft, lalu menerbitkannya.

Workflow publikasi hanya dijalankan secara manual; push tag sendiri tidak membuat rilis duplikat. Token workflow menggunakan `GITHUB_TOKEN` dengan izin contents/write. Jangan menyimpan token di source.

Untuk publikasi manual, unggah lima aset berikut melalui GitHub Releases:

- Installer dan portable `.exe`.
- Blockmap installer `.exe.blockmap`.
- `latest.yml`.
- `SHA256SUMS.txt`.

Nama file installer pada `latest.yml` harus sama dengan nama aset release. Verifikasi hash/ukuran dan smoke test paket sebelum draft diterbitkan. Binary tidak dimasukkan ke riwayat Git.

## Build Signed

Jika nanti sertifikat code signing sudah tersedia, gunakan:

```bash
npm run build:win:signed
npm run build:portable:signed
```

Atau, jika Anda ingin memuat env dari file lokal otomatis:

```bash
npm run build:win:signed:local
npm run build:portable:signed:local
```

Script signed build akan:

- membersihkan `dist-electron/` lebih dulu,
- mengaktifkan `signExecutable=true` khusus untuk proses build itu,
- membiarkan `electron-builder` memakai konfigurasi signing dari environment.

Environment yang umum dipakai `electron-builder` untuk Windows:

- `CSC_LINK` atau `WIN_CSC_LINK`
- `CSC_KEY_PASSWORD` atau `WIN_CSC_KEY_PASSWORD`
- Template lokal tersedia di `signing.env.example`

Contoh PowerShell:

```powershell
$env:WIN_CSC_LINK = "C:\certs\image-to-webp.pfx"
$env:WIN_CSC_KEY_PASSWORD = "ganti-dengan-password-sertifikat"
npm run build:win:signed
```

Alternatif file lokal:

1. Copy `signing.env.example` menjadi `signing.env.local`
2. Isi path `.pfx` dan password sertifikat
3. Jalankan `npm run build:win:signed:local`

Catatan penting:

- Build signed memerlukan environment Windows yang bisa menjalankan helper signing `electron-builder` dengan normal.
- Jika mesin masih memblokir pembuatan symbolic link saat ekstraksi helper `winCodeSign`, jalankan dari Windows dengan Developer Mode aktif atau sesi yang memiliki privilege symlink yang sesuai.

## Mengubah Ikon

Edit `ui/assets/app-icon.svg`, lalu jalankan `npm run generate:icon` sebelum build. Generator memperbarui `ui/app.ico` dengan tujuh ukuran (16, 24, 32, 48, 64, 128, dan 256 px) serta `ui/assets/app-icon.png` untuk dokumentasi. Header menggunakan SVG yang sama; ikon Windows, tray, notifikasi, installer, dan uninstaller menggunakan ICO tersebut. Commit ketiga aset agar checkout baru dapat langsung dibuild.

## Build Self-Signed Untuk Testing Lokal

Jika Anda hanya ingin testing lokal di Windows tanpa bergantung pada `winCodeSign`, gunakan workflow self-signed berikut:

```bash
npm run build:portable:selfsigned:local
npm run build:win:selfsigned:local
```

Workflow ini akan:

- memuat `signing.env.local`,
- build `win-unpacked` terlebih dahulu,
- menandatangani file `.exe` lokal dengan `Set-AuthenticodeSignature`,
- memaketkan hasil dari folder prepackaged,
- lalu menandatangani artifact final di `dist-electron/`.

Catatan:

- Jalur ini ditujukan untuk testing lokal dengan self-signed certificate.
- Karena memakai Authenticode dari PowerShell, workflow ini tidak membutuhkan helper `winCodeSign` milik `electron-builder`.
- Trust sertifikat tetap bersifat lokal; untuk distribusi publik Anda tetap membutuhkan layanan/sertifikat code signing yang trusted secara publik.
