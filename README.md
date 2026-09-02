# Sudut Pandang

Sistem self-photo studio lokal: customer berfoto di layar kiosk (TV), staf menjalankan registrasi, sesi, galeri, dan cetak dari Studio Kiosk, API menghubungkan semuanya.

Customer mengambil foto sendiri memakai **remote shutter** (bukan operator yang memotret).

## Aplikasi

| Aplikasi | Peran |
| --- | --- |
| **api** | Backend (port 4000) |
| **studio-kiosk** | UI operator di browser (port 5173) |
| **kiosk-app** | Layar customer (Electron, TV portrait) |

## Menjalankan di Windows (produksi)

Persiapan sekali: Node.js, PM2 (`npm install -g pm2`), lalu dari folder repo:

```bat
build-production.cmd
```

Itu memasang dependency, membuild Studio Kiosk, mem-pack Electron Kiosk, dan membuat shortcut di Desktop.

### Shortcut admin

- **Mulai Sudut Pandang** — API, Studio Kiosk, nginx (jika ada), lalu Kiosk
- **Hentikan Sudut Pandang** — hentikan semua layanan
- **Status Sudut Pandang** — status ringkas

Detail tambahan: [docs/WINDOWS_PRODUCTION.md](docs/WINDOWS_PRODUCTION.md).

## Memperbarui setelah ubah kode

Studio Kiosk dan Kiosk **tidak** ter-update dengan cara yang sama. Shortcut produksi **tidak** memakai `npm run dev`.

### 1. Tutup Kiosk dulu

Tutup jendela **Sudut Pandang Kiosk**, atau pakai shortcut **Hentikan Sudut Pandang**. File `.exe` yang sedang jalan mengunci build Electron.

### 2. Studio Kiosk (operator) + API

Dari folder repo:

```bat
cd studio-kiosk
npm run build
```

Lalu **Mulai Sudut Pandang** lagi (PM2 memuat build `.next` dari repo). Perubahan API: restart lewat shortcut yang sama (`pm2 startOrReload`).

### 3. Kiosk-app (layar customer)

`npm run build` di `kiosk-app` **tidak cukup**. Shortcut menjalankan aplikasi yang sudah di-pack.

```bat
cd kiosk-app
npm run pack
```

Itu menjalankan Vite build lalu `electron-builder --dir`, hasilnya:

`kiosk-app\release\win-unpacked\Sudut Pandang Kiosk.exe`

Launcher memakai file itu. Setelah `pack` selesai, jalankan **Mulai Sudut Pandang**.

### 4. Build penuh (semua aplikasi + installer)

```bat
build-production.cmd
```

Pakai ini jika ingin installer/portable baru di `kiosk-app\release`, atau setelah clone/setup mesin baru.

## Development (bukan shortcut produksi)

```bat
cd api && npm start
cd studio-kiosk && npm run dev
cd kiosk-app && npm run dev
```

Mode ini hanya untuk development. Layar customer di studio memakai shortcut produksi.
