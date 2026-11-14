# Changelog

## 2.5.3 - 2026-11-15

- Ikon ImgConv baru: bingkai foto, panah konversi, aksen lime/pink, dan outline hitam.
- Menyamakan ikon pada header, taskbar, tray, notifikasi, installer, dan uninstaller.
- Generator ICO multi-resolusi 16-256 px dan PNG dari sumber SVG melalui `npm run generate:icon`.

## 2.5.2 - 2026-11-15

- Menyusun ulang layout khusus alur konversi gambar: header ringkas, antrean utama yang mengisi ruang, sidebar pengaturan, dan dock aksi/progres yang tetap terlihat.
- Menggabungkan dropzone dengan antrean; berubah menjadi strip tambah file setelah gambar dimasukkan. Tombol file/folder berada langsung di toolbar antrean.
- Menghapus panel promosi/dekoratif dan susunan layout yang meniru aplikasi pada referensi; mempertahankan bahasa visual, warna, font, garis, serta bayangannya.
- Menambahkan akses langsung ke riwayat konversi.
- Memperbaiki Buka hasil untuk output di folder asal dan mengaktifkan konversi ulang setelah lokasi output diganti.
- Menguji gulir antrean, ruang kerja dominan, dock persisten, serta layout desktop tanpa gulir seluruh halaman.

## 2.5.1 - 2026-11-15

- Mendesain ulang UI mengikuti referensi: grid kertas krem, aksen lime, panel putih dengan garis hitam tebal dan hard shadow, serta detail brown/peach/pink.
- Memisahkan panel input di kiri dan workspace konversi di kanan; mengganti dropdown format dengan empat kartu radio yang tetap menyimpan preferensi.
- Membundel Space Grotesk dan Space Mono secara lokal, termasuk lisensi; tidak memuat font dari internet.
- Menyesuaikan layout untuk jendela kecil dan tema gelap, serta menyelaraskan tampilan preview, About, Preferences, progress, dan log.
- Menambahkan pengelolaan fokus dialog dan nama aksesibel pada tombol antrean; memperbaiki nilai awal pertahankan struktur folder.
- Menambahkan regresi UI, render Electron pada beberapa ukuran, dan pemeriksaan aksesibilitas otomatis pada tema/dialog.

## 2.5.0 - 2026-11-15

- Mencegah output saling menimpa dengan reservasi nama file secara eksklusif, termasuk batch paralel dan konversi menu konteks.
- Menghapus fitur WordPress: upload, preset, pengaturan, password, HTML clipboard, dan seluruh IPC terkait. Data WordPress lama dibersihkan saat startup tanpa membacanya ke renderer.
- Menampilkan pesan log sebagai teks DOM agar tidak dapat menyisipkan HTML atau event handler.
- Membatasi IPC ke frame utama aplikasi dan lima pengaturan konversi yang diizinkan; menambahkan sandbox, CSP, serta penolakan navigasi, popup, dan izin browser.
- Memperbarui Electron, Sharp, electron-store, electron-updater, dan alat build; memperbaiki dependency transitif yang terdampak advisory.
- Menerapkan orientasi EXIF sebelum encoding. Menghapus BMP dari daftar input karena decoder bawaan tidak mendukungnya.
- Membatasi konversi paralel hingga empat, mencegah batch bertumpuk, dan melaporkan kegagalan direktori sebagai kegagalan per file.
- Menyamakan preferensi kualitas menu konteks dengan UI; mengaktifkan kembali antrean saat format/kualitas berubah.
- Memperbarui satu item antrean dan satu baris log saat progress, tanpa membangun ulang seluruh daftar.
- Menambahkan pengujian regresi Node.js dan smoke test Electron nyata dengan profil sementara yang terisolasi.

## 2.4.0 - 2026-04-22

- Memindahkan password WordPress per preset ke penyimpanan aman, sehingga tidak lagi dibundle plaintext di renderer.
- Menambahkan migrasi data lama agar override preset yang pernah tersimpan tetap terbaca tanpa mempertahankan format lama yang tidak aman.
- Memperbaiki status `cancel batch` supaya hasil akhir benar-benar menandai proses yang dibatalkan.
- Memperbaiki alur pilih folder agar menekan `Cancel` tidak lagi memunculkan pesan "folder tidak berisi gambar".
- Merapikan workflow build lokal: output `dist-electron` dibersihkan sebelum build, artefak lama tidak tercampur, dan signed build punya script terpisah.
