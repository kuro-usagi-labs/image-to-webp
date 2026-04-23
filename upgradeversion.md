Tentu. Karena pondasi aplikasimu sudah ada, PRD ini akan fokus pada **Pembaruan Versi (V2)**, yaitu penambahan fitur otomatisasi WordPress dan *HTML generation*.

Kamu bisa menggunakan dokumen ini sebagai panduan (blueprint) agar modifikasi kodemu terstruktur.

 **Product Requirements Document (PRD): Image Converter & WP Uploader (V2 Update)**

---

###  1. Ringkasan & Tujuan Pembaruan

Aplikasi ini sebelumnya berfungsi sebagai pengonversi gambar multi-format (JPG/PNG ke WebP, AVIF, dll) secara lokal.
Pembaruan V2 bertujuan mengubah aplikasi ini menjadi *pipeline* aset web *end-to-end*. Tujuannya adalah menghilangkan beban kerja repetitif saat mendesain *landing page* (terutama saat menyusun katalog produk pakaian atau *banner* visual untuk *brand* seperti Be-Premify), dengan menggabungkan proses konversi, *upload* ke *server*, dan penulisan kode HTML ke dalam satu aksi *drag-and-drop*.

---

###  2. Ruang Lingkup Fitur Baru (Scope of Work)

* **Mode "Auto-Upload" (Saklar / Toggle):**
* Sebuah *checkbox* atau *toggle* di antarmuka utama (UI). Jika aktif, file hasil konversi akan langsung dikirim ke WordPress. Jika tidak aktif, aplikasi hanya melakukan konversi lokal seperti biasa.


* **Credential Settings Panel:**
* Halaman atau *modal* pengaturan tersembunyi untuk menyimpan kredensial dengan aman: `WordPress URL`, `Username`, dan `Application Password`.


* **WordPress REST API Uploader:**
* Sistem di latar belakang (*background process*) yang mengambil file hasil konversi dan mengirimkannya via metode POST ke *endpoint* `/wp-json/wp/v2/media`.


* **HTML Snippet & Auto-Clipboard:**
* Sistem yang menangkap respons JSON dari WordPress, mengambil URL gambar *online*, dan merangkainya menjadi *tag* HTML lengkap (contoh: `<img src="..." alt="Be-Premify Product" loading="lazy">`). Sistem akan otomatis menyalin teks ini ke *clipboard* sistem operasi.



---

###  3. Alur Pengguna (User Flow) V2

1. Pengguna membuka aplikasi dan memastikan pengaturan kredensial WordPress sudah terisi (hanya perlu dilakukan sekali).
2. Pengguna menyalakan *toggle* **"Convert & Upload to WP"**.
3. Pengguna melakukan *drag-and-drop* file gambar (misal: foto produk katalog) ke dalam aplikasi.
4. Aplikasi memproses konversi ke WebP (atau format pilihan pengguna).
5. Setelah konversi lokal selesai, aplikasi secara otomatis memulai proses *upload* ke WordPress. UI menampilkan indikator *loading* .
6. Setelah WordPress merespons dengan status 201 (Created), aplikasi menyalin *tag* HTML ke *clipboard*.
7. Aplikasi menampilkan notifikasi sukses  (misal: "Upload Selesai! HTML siap di-paste").
8. Pengguna menempelkan (*paste*) kode langsung ke *code editor* mereka.

---

###  4. Kebutuhan Teknis (Tech Stack)

Karena menggunakan Electron, tambahkan pustaka (library) berikut jika belum ada:

| Komponen | Saran Implementasi | Keterangan |
| --- | --- | --- |
| **HTTP Request** | `axios` atau `node-fetch` | Digunakan di *Main Process* (Node.js) untuk mengirim file multipart ke API WordPress. |
| **Local Storage** | `electron-store` | Untuk menyimpan URL dan App Password secara persisten agar tidak hilang saat aplikasi ditutup. |
| **Clipboard API** | `clipboard` (Bawaan Electron) | Modul `clipboard.writeText()` untuk menyalin kode HTML secara paksa. |

---

###  5. Kriteria Penerimaan (Acceptance Criteria)

Fitur V2 ini dinyatakan selesai dan siap digunakan jika:

* Aplikasi berhasil mengunggah file ke WordPress menggunakan *Application Passwords* tanpa *error* 401 (Unauthorized) atau 403 (Forbidden).
* Jika koneksi internet mati atau URL WordPress salah, aplikasi tidak mengalami *crash* dan menampilkan pesan *error* yang jelas kepada pengguna (misal: "Gagal menyambung ke server").
* Jika *toggle* Auto-Upload dimatikan, aplikasi tetap berfungsi normal sebagai *converter* lokal tanpa mengirim *request* HTTP apa pun.
* Format HTML yang masuk ke *clipboard* harus valid dan memuat atribut `loading="lazy"` sebagai standar optimasi *landing page*.

---