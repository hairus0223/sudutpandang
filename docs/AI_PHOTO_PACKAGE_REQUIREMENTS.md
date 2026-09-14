# Requirement: AI Photo Package (edit, bukan generate)

Paket **AI Self Photo** di Sudut Pandang: foto studio di-edit menjadi foto bertema. Bukan generator gambar dari teks. Orang di hasil harus **identik** dengan foto asli: wajah, tubuh, pose, tangan, sudut kamera.

Dokumen ini adalah kontrak implementasi untuk UI, perilaku, dan kualitas hasil.

---

## 1. Tujuan

Customer ambil foto di kiosk. Operator pilih foto di galeri. Sistem **mengganti background** ke aset tema studio, **menyesuaikan lighting** subjek ke latar itu, dan (opsional) **mengedit kostum pada mask pakaian** saja.

Hasil terasa foto studio sungguhan: subjek menempel di latar, cahaya selaras, tanpa wajah baru atau pose baru.

---

## 2. Non-tujuan (wajib ditolak)

| Dilarang | Alasan |
|----------|--------|
| Full image generation / txt2img / “buat orang baru di scene” | Mengubah identitas |
| Mengganti wajah, umur, ekspresi, arah pandang, pose, tangan, proporsi tubuh | Objek tidak identik |
| Generate background AI per request | Tidak stabil, tidak bisa di-QA |
| Pipeline `direct` sebagai default produksi | Hasil tidak terkontrol |
| Fallback diam-diam ke generate penuh jika edit gagal | Operator tidak sadar hasil “orang lain” |

Jika OpenAI / model edit tidak tersedia: **composite-only** (subjek asli + background tema + lighting). Jangan turun ke generate scene.

---

## 3. Definisi hasil “sesuai ekspektasi”

Hasil **lulus** hanya jika semua ini benar (cek visual + side-by-side asli vs AI):

1. **Identitas** — orang yang sama; wajah, rambut, kulit, kacamata, tahi lalat, ekspresi, arah mata sama.
2. **Geometri** — pose, framing, posisi tangan, kemiringan bahu sama dengan sumber.
3. **Background** — latar tema yang dipilih (aset studio), rata, tanpa sisa studio asli, tanpa halo, tanpa “stiker” di atas backdrop.
4. **Lighting** — arah cahaya, kontras, white balance subjek mengikuti tema; tidak ada orang gelap di latar terang atau sebaliknya.
5. **Tepi** — rambut, bahu, jari menyatu ke latar; tidak bergerigi, tidak putih/merah sisa studio.
6. **Kostum (jika tema kostum)** — hanya pakaian/aksesoris berubah; wajah dan pose tidak.
7. **Cetak** — file siap cetak (sRGB JPEG, dimensi sama dengan sumber atau 4R @300 DPI sesuai print pipeline).

Hasil **gagal** (tampilkan error, kuota tidak terpotong / restore kuota) jika: wajah beda, pose berubah, background kosong/salah tema, atau tepi rusak parah.

---

## 4. Pipeline teknis (wajib)

Default produksi: **`composite-costume`** jika mask edit kostum tersedia, else **`composite-only`**.

```
foto asli
  → segmentasi subjek (alpha)
  → [opsional] masked edit pakaian saja, wajah dilindungi
  → face refine: blend wajah dari foto asli (wajib jika ada pass kostum)
  → composite ke background tema (aset file, bukan generate)
  → match lighting (exposure, WB, kontras, soft shadow ke lantai/dinding tema)
  → overlay tema (frame/props) jika ada
  → JPEG hasil `ai-{themeId}.jpg`
```

### 4.1 Segmentasi

- Sumber: foto asli, orientasi benar.
- Mask harus mencakup tubuh utuh (kepala sampai yang terlihat di frame), bukan crop wajah.
- Gagal segmentasi = job gagal dengan pesan operator, bukan composite tanpa alpha.

### 4.2 Kostum (edit, bukan generate)

- Hanya pixel di **edit-mask** (pakaian). Wajah, rambut, kulit, tangan terbuka **preserve**.
- Prompt: ganti pakaian/aksesoris tema; larangan eksplisit: jangan ubah background, wajah, pose.
- Setelah edit: **face refine dari original** wajib. Jika refine gagal, jangan publish hasil kostum yang merusak wajah — gagalkan job atau fallback composite-only tanpa kostum (kebijakan: tampilkan ke operator).

### 4.3 Background

- Hanya file tema yang sudah di-bundle / di-publish (`theme-backgrounds`, `theme-assets`).
- Satu tema = satu (atau set tetap) latar. Tidak generate latar baru per customer.
- Composite: subjek di atas latar dengan placement tema (`scale`, `yOffset`) yang sudah di-QA.

### 4.4 Lighting

- Ukur luma/WB subjek (hanya pixel opaque).
- Sesuaikan ke look tema (`lookId`, mis. `warm`) tanpa menghapus detail kulit.
- Soft contact shadow di bawah kaki/badan agar tidak “mengambang”.
- Clamp gain agar tidak blown-out.

### 4.5 Identitas (hard gate)

Sebelum `ready`:

- Face refine / copy wajah asli ke hasil jika ada mismatch kasar.
- Jika deteksi wajah di hasil tidak overlap dengan wajah asli (posisi/ukuran jauh), **fail** job.

Jangan kirim ke print variant AI jika status bukan `ready`.

---

## 5. UI flow — operator & customer

Alur tidak boleh memaksa customer “menunggu AI” di kiosk. Shoot dulu, generate di meja operator.

### 5.1 Registrasi (`/session`)

1. Pilih paket **AI Self Photo**.
2. Pilih **satu tema** (wajib). Kartu = preview foto before/after, bukan swatch warna.
3. Tap kartu → modal preview (asli vs contoh hasil). Copy: “Orang tetap sama; latar dan suasana mengikuti tema.”
4. Data customer: nama wajib; jumlah orang 1–8 dengan +/−.
5. Kuota generate = jumlah orang (1–8), ditampilkan sebelum submit.
6. Tanpa tema → tidak bisa lanjut.
7. Setelah register: tema **terkunci** (`aiThemeLocked`). Tidak ganti tema di galeri.

### 5.2 Sesi kiosk

1. Operator: mulai trial / sesi utama (tanpa tombol ambil foto di laptop).
2. Kiosk: overlay singkat tema + contoh hasil; lalu live camera.
3. Capture di kiosk. Preview operator = foto asli (bukan hasil AI).
4. Akhiri sesi → “Buka galeri” (bukan hanya “Galeri AI”).
5. Customer tidak generate di kiosk.

### 5.3 Galeri (`/gallery?user=`)

Wizard dua langkah, selalu jelas kuota:

| Langkah | Operator | Perilaku |
|---------|----------|----------|
| **Pilih & Generate** | Pilih 1..N foto (N ≤ sisa kuota) | CTA “Generate {n} foto · tema X”. Disable jika kuota 0 atau tidak ada pilihan. |
| **Hasil & Cetak** | Before/after, pilih cetak AI | Hanya foto `ready`. Gagal: retry 1× dengan alasan. |

Perilaku stabil:

- Progress per foto: `Memisahkan subjek` → `Mengedit pakaian` (jika ada) → `Menjaga wajah asli` → `Menyusun latar` → `Menyesuaikan cahaya` → selesai.
- Jangan ganti label jadi “menggambar” / “generate orang”.
- Satu antrian: generate berikutnya tidak menimpa yang sedang jalan.
- Socket selesai → modal before/after; kuota berkurang **hanya** jika `ready`.
- Gagal: toast + badge di tile; foto asli tetap; kuota tidak hangus.
- Retry memakai slot yang sama jika gagal (bukan slot baru).
- Tidak ada picker tema di galeri.

### 5.4 Cetak

- Toggle **Asli** vs **AI** eksplisit.
- Print bar menunjukkan variant.
- Editor print memakai URL `variants.ai[themeId]`.
- Kuota cetak ≠ kuota AI.

### 5.5 Error & empty state (copy tetap)

| Situasi | UI |
|---------|-----|
| Segmentasi gagal | “Tidak bisa memisahkan orang dari foto. Ambil ulang dengan latar lebih polos.” |
| Edit kostum timeout | “Edit kostum terlalu lama. Mencoba latar saja…” hanya jika kebijakan fallback composite-only **ditampilkan**. Default: gagal + retry. |
| Wajah tidak cocok | “Hasil tidak menjaga wajah asli. Tidak disimpan. Coba foto lain.” |
| Kuota habis | CTA generate disabled; teks sisa 0 / limit. |
| API AI mati | “Layanan edit AI belum siap.” Jangan antri infinite. |

---

## 6. Data & kontrak API

- `customer.json`: `packageType=ai-self-photo`, `aiThemeId`, `aiThemeLabel`, `aiGenerateLimit`, `aiThemeLockedAt`.
- Generate: `POST` job per `imageId` + tema terkunci (abaikan themeId dari client jika beda).
- Meta gambar: `variants.ai[themeId]`, `status`, `processingPhase`, `error`.
- Socket: `ai-generation-progress` (phase), `ai-generation-complete` (ready/failed).
- Output path: `processed/{imageId}/ai-{themeId}.jpg`.
- Simpan `subject.png` untuk debug tepi; jangan expose ke customer sebagai hasil akhir.

---

## 7. Tema & aset

Setiap tema produksi wajib punya:

- `background` file (resolusi ≥ hasil cetak).
- `preview` before/after untuk kartu registrasi.
- `pipelineMode`: `composite-only` atau `composite-costume` (bukan `direct` di produksi).
- `lookId` lighting.
- `placement` yang sudah diuji dengan foto sample studio.
- Overlay opsional.

Publish tema dari research lab hanya jika preview lolos cek identitas (side-by-side).

---

## 8. Kriteria penerimaan (QA)

### Fungsional

- [ ] Register AI tanpa tema ditolak.
- [ ] Kuota = jumlah orang; generate ke-(limit+1) ditolak.
- [ ] Galeri tidak bisa ganti tema.
- [ ] Hasil AI tidak menimpa file asli.
- [ ] Job gagal tidak mengurangi kuota.
- [ ] Restart API: job incomplete resume atau mark failed, tidak stuck `processing`.

### Kualitas (wajib sample studio: 5 foto berbeda, 2 tema)

- [ ] 5/5 wajah dikenali sebagai orang yang sama vs asli (operator + 1 orang kedua).
- [ ] Pose/tangan sama (tidak ada tangan extra / hilang).
- [ ] Background = aset tema, bukan sisa dinding studio.
- [ ] Tidak ada halo putih/warna studio di rambut dan bahu.
- [ ] Lighting wajah selaras latar (tidak “stiker”).
- [ ] Cetak 4R tidak pecah, warna tidak geser parah vs layar.

### UX

- [ ] Operator menyelesaikan generate tanpa instruksi tambahan.
- [ ] Progress tidak “diam” > 3 detik tanpa phase update.
- [ ] Timeout punya pesan dan tombol retry.
- [ ] Kiosk tetap bisa capture saat operator membuka galeri.

---

## 9. Lingkungan capture (agar hasil stabil)

Sama seperti pas foto: latar polos kontras, lampu dua sisi, kamera tetap. AI edit **memperkuat** setup bagus; tidak mengganti lighting jelek.

---

## 10. Ringkasan keputusan produk

| Item | Keputusan |
|------|-----------|
| Jenis AI | **Edit + composite**, bukan image generator |
| Objek | Identik dengan foto asli |
| Latar | Aset tema + composite |
| Cahaya | Match ke tema setelah composite |
| Kostum | Masked edit + face lock |
| UI | Register tema → shoot kiosk → generate di galeri → cetak |
| Gagal | Gagal eksplisit, kuota aman, foto asli utuh |
