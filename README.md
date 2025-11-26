# E-Sign PDF ✍️📄

**E-Sign PDF** adalah aplikasi web modern yang memungkinkan pengguna untuk menandatangani, menggambar, dan mengedit dokumen PDF secara langsung di browser. Aplikasi ini dirancang dengan fokus pada privasi dan keamanan, karena seluruh proses pengolahan dokumen dilakukan secara **lokal di sisi klien (client-side)** tanpa perlu mengunggah file ke server eksternal.

Aplikasi ini sangat cocok untuk kebutuhan tanda tangan dokumen digital yang cepat, aman, dan tanpa ribet.

## 🚀 Fitur Utama

Aplikasi ini dilengkapi dengan berbagai fitur canggih untuk memudahkan pengelolaan dokumen PDF Anda:

### 1. **Tanda Tangan Digital** ✒️
*   **Buat Tanda Tangan**: Gambar tanda tangan langsung menggunakan mouse atau layar sentuh.
*   **Tanda Tangan Teks**: Ketik nama Anda dan pilih dari berbagai font tulisan tangan estetik (seperti *Alex Brush*, *Dancing Script*, dll).
*   **Upload Gambar**: Unggah gambar tanda tangan atau stempel yang sudah ada (PNG/JPG) dan otomatis hapus latar belakang putih (transparan).
*   **Kustomisasi**: Ubah warna tinta (Hitam, Biru, Merah, Hijau) dan ketebalan garis.

### 2. **Editor PDF Interaktif** 🛠️
*   **Drag & Drop**: Geser posisi tanda tangan ke mana saja di halaman PDF.
*   **Resize & Rotate**: Ubah ukuran dan putar tanda tangan dengan mudah menggunakan *handle* interaktif.
*   **Snapping Guides**: Panduan garis otomatis (garis putus-putus cyan) untuk membantu menyejajarkan tanda tangan dengan elemen formulir, tepi halaman, atau tanda tangan lainnya.
*   **Kunci Rasio**: Opsi untuk mengunci atau membuka rasio aspek saat mengubah ukuran.
*   **Duplikat**: Salin tanda tangan yang sudah ada dengan satu klik untuk mempercepat proses pada banyak halaman.

### 3. **Gambar Bebas (Free Draw)** ✏️
*   Mode khusus untuk mencoret-coret, memberi paraf, atau menandai bagian penting pada dokumen.
*   Pilihan warna dan ukuran kuas yang fleksibel.
*   Fitur **Undo/Redo** khusus untuk goresan gambar.

### 4. **Navigasi & Tampilan** 👁️
*   **Thumbnail Sidebar**: Pratinjau cepat seluruh halaman PDF untuk navigasi yang mudah.
*   **Zoom In/Out**: Perbesar atau perkecil tampilan dokumen untuk presisi yang lebih baik.
*   **Dark Mode**: Dukungan mode gelap untuk kenyamanan mata saat bekerja di kondisi minim cahaya.

### 5. **Keamanan & Privasi** 🔒
*   **Local Processing**: Dokumen PDF Anda **TIDAK PERNAH** dikirim ke server manapun. Semua proses (rendering, editing, saving) terjadi di dalam browser Anda menggunakan teknologi WebAssembly.
*   **Konfirmasi Unduhan**: Notifikasi konfirmasi sebelum menyimpan dokumen untuk mencegah kesalahan.

### 6. **Ekspor Fleksibel** 💾
*   **Unduh PDF**: Simpan dokumen yang sudah ditandatangani kembali ke format PDF.
*   **Ekspor Gambar**: Simpan halaman tertentu beserta tanda tangannya sebagai file gambar (PNG) berkualitas tinggi.

## 🛠️ Teknologi yang Digunakan

Aplikasi ini dibangun menggunakan teknologi web modern:

*   **React** (TypeScript) - Framework UI utama.
*   **Vite** - Build tool yang super cepat.
*   **PDF.js** - Library standar industri untuk merender PDF di browser.
*   **pdf-lib** - Library kuat untuk memodifikasi dan menyimpan file PDF.
*   **Tailwind CSS** - Untuk styling yang responsif dan modern.
*   **Lucide React** - Ikon vektor yang ringan dan indah.

## 📦 Cara Menjalankan (Development)

Jika Anda ingin mengembangkan atau menjalankan proyek ini di komputer lokal Anda:

1.  **Clone Repositori**
    ```bash
    git clone https://github.com/username-anda/e-sign-pdf-agent-rantau.git
    cd e-sign-pdf-agent-rantau
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Jalankan Server Development**
    ```bash
    npm run dev
    ```
    Buka browser dan akses `http://localhost:5173`.

4.  **Build untuk Produksi**
    ```bash
    npm run build
    ```

## 🤝 Kontribusi

Kontribusi selalu diterima! Jika Anda menemukan bug atau memiliki ide fitur baru, silakan buat *Issue* atau *Pull Request*.

## 📝 Lisensi

Proyek ini bersifat *open-source*. Silakan gunakan dan modifikasi sesuai kebutuhan Anda.

---
*Dibuat dengan ❤️ oleh [Max NM](https://makmurriansyah.github.io/)*
