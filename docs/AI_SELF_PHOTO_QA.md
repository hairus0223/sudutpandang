# AI Self Photo — QA Checklist

Manual end-to-end verification after AI Self Photo v2 (PR-7–13).  
Run with **api** + **studio-kiosk** + **kiosk-app** on the same LAN/base URL.

## Automated (before manual)

```bash
cd api && npm run validate:ai-theme-previews   # bundled after.png for every theme
cd api && node server.js                       # terminal 1
cd api && npm run smoke-test                   # terminal 2
cd studio-kiosk && npm run build
cd kiosk-app && npm run build
```

## 1. Registrasi & tema

- [ ] `/session` → pilih **AI Self Photo**
- [ ] Wizard step tema menampilkan **kartu preview foto** (bukan swatch warna)
- [ ] Tap kartu → expand modal before/after untuk **Wild West**
- [ ] Submit blocked tanpa tema
- [ ] Register sukses → toast menampilkan tema + kuota AI
- [ ] `customer.json`: `aiThemeId`, `aiThemeLockedAt` terisi

## 2. Kiosk customer

- [ ] Start trial/main → **intro overlay** AI (sample foto + nama tema)
- [ ] Frame video + watermark tema saat sesi
- [ ] Capture → review copy spesifik AI (bukan generik)
- [ ] End screen → arahkan ke operator untuk generate

## 3. Galeri operator

- [ ] `/gallery?user=` → **stepper** ① Pilih → ② Generate → ③ Hasil
- [ ] **Tidak ada** grid pilih tema di galeri
- [ ] Banner tema read-only + thumbnail preview
- [ ] Langkah ①: pilih foto → CTA **Lanjut Generate**
- [ ] Langkah ②: generate → progress phase (generating → finishing)
- [ ] Langkah ③: before/after reveal + toggle **cetak AI**

## 4. Generate pipeline

| Tema | Expected phases |
|------|-----------------|
| Transform (Wild West) | generating → finishing |

- [ ] Output: `processed/{imageId}/ai-{themeId}.jpg`
- [ ] Kuota AI berkurang; PATCH tema ditolak setelah register
- [ ] Socket `ai-generation-complete` → modal reveal otomatis

## 5. Cetak

- [ ] Pilih hasil AI di langkah ③ → print bar menunjukkan variant AI
- [ ] `/print` → URL gambar AI benar (`variants.ai[themeId]`)
- [ ] Cetak asli vs AI independen (print quota ≠ AI quota)

## 6. Analytics & API

```bash
curl -s "http://localhost:4000/api/ai-analytics/summary?days=30" | jq .
curl -s "http://localhost:4000/api/print-config/{user}" | jq .aiThemePreviewUrl,.aiThemeType,.aiThemeLocked
```

- [ ] Events: `theme_selected`, `generate_started`, `generate_success`

## 7. Sample assets (production)

- [ ] Ganti placeholder Wild West di `{BASE_DIR}/themes/wild-west/` (lihat `themes/README.md`)
- [ ] Opsional: override preview tema dengan foto sample studio sendiri di `{BASE_DIR}/themes/{id}/`

## 6. Theme Research Lab (admin)

- [ ] Set `ADMIN_API_TOKEN` di `api/.env`, restart API
- [ ] Buka `/admin/ai-theme-research` (tombol **AI Research** di home operator)
- [ ] Masukkan token → upload sample portrait → edit prompt → **Generate preview**
- [ ] Before/after slider tampil jika preview sukses
- [ ] **Simpan draft** → **Publish tema** → tema muncul di `/session` wizard registrasi
- [ ] Opsional: upload `after.jpg` ke `{BASE_DIR}/themes/{id}/` untuk kartu preview

## Known limits

- Session state hilang saat API restart
- Transform quality bergantung OpenAI + prompt; uji dengan 2–3 wajah berbeda

---

*Update checklist when adding themes or changing UX.*
