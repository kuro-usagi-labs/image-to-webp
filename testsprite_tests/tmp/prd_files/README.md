# Image to WebP

Desktop app Electron yang compact untuk mengonversi banyak gambar ke format WebP di Windows.

## Fitur

- Dukungan input `PNG`, `JPG`, `JPEG`, `GIF`, `BMP`, `TIFF`, `TIF`, `WEBP`, `AVIF`, dan `SVG`
- Drag-and-drop file ke jendela app
- Pilih file satuan atau scan satu folder gambar
- Jika folder output tidak dipilih, hasil otomatis disimpan ke folder asal gambar
- Preview popup per file
- Simpan `output folder`, `quality`, tema, dan opsi struktur folder
- Opsi mempertahankan struktur subfolder saat konversi dari folder
- Progress real-time dan tombol buka folder output

## Menjalankan aplikasi

Install dependency:

```bash
npm install
```

Jalankan mode desktop:

```bash
npm start
```

## Build Windows

Build installer:

```bash
npm run build:win
```

Build portable:

```bash
npm run build:portable
```

Hasil build akan muncul di folder `dist-electron/`.

## Catatan

- Sumber icon aplikasi ada di `ui/webp2.ico`
- Target build Windows menggunakan Electron Builder + NSIS
- Repo ini masih menyimpan prototype lama berbasis Flask dan Tkinter, tetapi app utama yang aktif adalah versi Electron di folder `ui/`
