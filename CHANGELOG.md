# Changelog

## 2.4.0 - 2026-04-22

- Memindahkan password WordPress per preset ke penyimpanan aman, sehingga tidak lagi dibundle plaintext di renderer.
- Menambahkan migrasi data lama agar override preset yang pernah tersimpan tetap terbaca tanpa mempertahankan format lama yang tidak aman.
- Memperbaiki status `cancel batch` supaya hasil akhir benar-benar menandai proses yang dibatalkan.
- Memperbaiki alur pilih folder agar menekan `Cancel` tidak lagi memunculkan pesan "folder tidak berisi gambar".
- Merapikan workflow build lokal: output `dist-electron` dibersihkan sebelum build, artefak lama tidak tercampur, dan signed build punya script terpisah.
