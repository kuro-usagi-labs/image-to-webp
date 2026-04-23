# Building

## Build Lokal Unsigned

Gunakan script berikut untuk build lokal biasa:

```bash
npm run build:win
npm run build:portable
```

Catatan:

- Kedua script akan membersihkan folder `dist-electron/` terlebih dahulu.
- Kedua script mematikan `CSC_IDENTITY_AUTO_DISCOVERY` agar build lokal tidak mencoba mencari sertifikat code signing otomatis.
- Konfigurasi default project memakai `win.signAndEditExecutable=false` agar workflow build lokal tetap stabil di mesin Windows yang tidak punya privilege symlink untuk helper `winCodeSign`.

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
- mengaktifkan kembali `signAndEditExecutable` khusus untuk proses build itu,
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
