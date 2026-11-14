# Contributing

Terima kasih sudah membantu mengembangkan Image to WebP.

## Menjalankan proyek

Gunakan Windows x64 dan Node.js 26+:

```powershell
npm ci
node node_modules/electron/install.js
npm start
```

Perubahan konversi, penyimpanan file, IPC, atau state renderer sebaiknya disertai tes regresi yang mereproduksi masalahnya. Jalankan pemeriksaan berikut sebelum mengajukan pull request:

```powershell
npm test
npm run test:electron
npm run test:ui
npm audit
```

`test:electron` dan `test:ui` menggunakan profil sementara. Hasil capture UI berada di `artifacts/ui/` dan tidak dimasukkan ke Git. Untuk memperbarui screenshot README dari keadaan awal aplikasi tanpa path atau file pribadi:

```powershell
npm run test:ui
Copy-Item artifacts/ui/empty-1220.png docs/images/workspace.png
```

## Mengirim perubahan

1. Buat branch untuk perubahan yang ingin dikerjakan.
2. Batasi satu pull request pada satu masalah atau fitur yang jelas.
3. Jelaskan perilaku sebelum/sesudah, cara menguji, serta batasan yang masih ada.
4. Sertakan screenshot untuk perubahan UI dan perbarui `CHANGELOG.md` bila perilaku pengguna berubah.

Jangan commit konfigurasi lokal, credential, sertifikat privat, `node_modules`, atau hasil build. Upload installer/portable melalui Releases. Direktori `legacy/` dan `docs/archive/` berisi prototype serta dokumen historis; runtime aktif ada di Electron/`ui/`/`lib/`.

## Melaporkan bug

Sertakan versi aplikasi dan Windows, format input/output, langkah reproduksi, serta hasil yang diharapkan. Gunakan gambar contoh yang boleh dibagikan dan hapus informasi pribadi dari screenshot/log.

Kontribusi source mengikuti [MIT License](LICENSE). Panduan packaging dan publikasi ada di [BUILDING.md](BUILDING.md).
