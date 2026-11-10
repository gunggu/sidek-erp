# SIDEK ERP — Dashboard Monitoring Penelitian

Dashboard interaktif: `index.html` pada repositori [gunggu/sidek-erp](https://github.com/gunggu/sidek-erp).

## Ketersediaan data (snapshot 10 November 2026)

| Dataset | Jumlah baris respons |
| --- | ---: |
| SMK T0 | 80 |
| SMK T1 | 73 |
| SMK T2–T3 | 213 |
| SMK T4 | 0 |
| UMKM T0 | 83 |
| UMKM T1 | 78 |
| UMKM T2–T3 | 42 |
| UMKM T4 | 0 |

Total: **569 baris respons**, bukan 569 responden unik. T2–T3 adalah pengukuran berulang.

Jumlah SMK yang dikenali = **4**. Nama usaha yang berbeda dalam satu wave = **79 T0, 75 T1, 11 T2–T3**; angka antar-wave tidak boleh dijumlahkan. Untuk penelitian, UMKM mitra implementasi harus dipisahkan dari seluruh UMKM peserta pelatihan.

Rancangan pendampingan mencakup sekitar **10 sesi**, sehingga pengisian T2–T3 berulang merupakan bagian desain, bukan otomatis duplikasi. Urutan submit bukan bukti nomor atau tanggal sesi. Tambahan 15 respons SMK dan satu respons UMKM pada 9–10 November telah ditautkan ke identitas komposit yang ada tanpa menimpa baris lama. Master berisi **116** pasangan T0–T1 (57 siswa, 8 guru, 51 UMKM) serta **294** entri `Identity_QA`, termasuk satu entri baru terkait perbedaan peran di sumber. Seluruh catatan QA terdahulu dipertahankan.

## Pembaruan manual melalui ChatGPT

Bila ingin memperbarui, minta ChatGPT meninjau seluruh delapan spreadsheet, memeriksa konsistensi identitas, peran, dan timestamp tanpa menghapus pengisian berulang yang memang merupakan sesi pendampingan, lalu memperbarui agregat pada repositori ini. Jangan menambahkan nama individu, NIS, alamat surel, atau isi jawaban individu ke repositori publik.

Langkah kontrol sebelum commit:
1. Verifikasi akses delapan Google Sheets dan hitung respons **dari baris bertimestamp**, bukan `rowCount` grid.
2. Bandingkan snapshot lama dan baru; angka lama yang tidak pernah tercatat harus tetap `null`, bukan nol.
3. Audit klasifikasi sekolah dan wilayah, normalisasi nama usaha per wave, serta perbedaan respons dan unit analisis.
4. Ubah `source`, `schoolUnits`, `businessUnits`, `businessUniqueByWave`, label snapshot, dan narasi secara konsisten pada `index.html`.
5. Jalankan pemeriksaan sintaks JavaScript dan uji seluruh filter, grafik, tabel, ekspor CSV dan mobile.
6. Commit ke `main`. Jika halaman Cloudflare menggunakan deployment terpisah dari GitHub, deploy ulang artefak statisnya.

Dashboard **tidak** membaca Google Sheets secara langsung. Tombol pembaruan, kode OAuth, Worker Google Sheets, dan kredensial tidak digunakan.

## Validitas angka

- Jumlah respons T0 dan T1 tidak membuktikan adanya pasangan responden.
- SMK T2–T3 dan UMKM T2–T3 dapat memuat respons berulang dari unit sama.
- Nama usaha unik per wave bukan pengenal bisnis tervalidasi lintas wave.
- T4 masih kosong pada tanggal snapshot.
- Baris sekolah hanya menampilkan empat nama sekolah yang telah dikenali.

## Deployment

GitHub Pages: https://gunggu.github.io/sidek-erp/

Konfigurasi Pages: **Settings → Pages → Deploy from a branch → main → / (root)**.

Jika menggunakan Cloudflare Workers atau custom domain, periksa route/deployment secara terpisah. Perubahan file GitHub tidak membuktikan bahwa versi Cloudflare sudah ter-deploy.
