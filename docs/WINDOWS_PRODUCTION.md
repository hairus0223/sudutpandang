# Menjalankan Sudut Pandang di Windows

## Persiapan sekali saja

Komputer produksi membutuhkan:

- Node.js dan npm
- PM2 yang tersedia secara global (`npm install -g pm2`)
- nginx di `C:\nginx` (opsional jika akses proxy tidak digunakan)

Jalankan `build-production.cmd` dari folder utama. Proses ini:

1. memasang dependency yang terkunci;
2. membuild Studio Kiosk dalam mode produksi;
3. membuat installer dan aplikasi portable Electron;
4. membuat shortcut Start, Stop, dan Status di Desktop.

File installer tersimpan di `kiosk-app\release`. Installer boleh dipasang agar
Kiosk juga tersedia melalui Start Menu.

Shortcut **Mulai Sudut Pandang** memakai
`kiosk-app\release\win-unpacked` dari repo ini (hasil `npm run pack` atau
`build-production.cmd`). Salinan NSIS di AppData hanya dipakai jika folder
`win-unpacked` belum ada.

**Penting:** ubah kode kiosk-app tidak langsung tampil di TV. Tutup aplikasi
Kiosk, jalankan `cd kiosk-app` lalu `npm run pack`, kemudian Mulai lagi.
`npm run build` saja tidak memperbarui exe yang dijalankan shortcut.

## Penggunaan admin

- **Mulai Sudut Pandang**: memulai API, Studio Kiosk, nginx, lalu Kiosk.
- **Hentikan Sudut Pandang**: menghentikan semua layanan.
- **Status Sudut Pandang**: menampilkan status ringkas.

Terminal tidak perlu dibuka. `start-all.cmd` dan `stop-all.cmd` tetap tersedia
sebagai launcher kompatibilitas.

Log launcher tersimpan di:

`C:\ProgramData\SudutPandang\logs\launcher.log`

Log aplikasi Electron tersimpan di folder data aplikasi Electron pengguna.

## Menjalankan otomatis setelah login

Jalankan perintah berikut satu kali dari PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows\Install-Shortcuts.ps1 -EnableAutoStart
```

Electron harus dimulai setelah user Windows login karena aplikasinya membutuhkan
desktop interaktif dan monitor. API dan Studio Kiosk dikelola PM2 serta disimpan
dengan `pm2 save`.

## Konfigurasi komputer

Salin `deploy\windows\config.example.json` menjadi:

`C:\ProgramData\SudutPandang\config.json`

Contoh:

```json
{
  "apiBase": "http://localhost:4000",
  "monitorIndex": 1,
  "fullscreen": true
}
```

`monitorIndex` bernilai `0` untuk monitor utama dan `1` untuk monitor kedua.
Jika hanya ada satu monitor, aplikasi otomatis memakai monitor yang tersedia.

Lokasi nginx dapat diganti melalui environment variable
`SUDUTPANDANG_NGINX`. Lokasi konfigurasi Kiosk dapat diganti melalui
`KIOSK_CONFIG_PATH`.

## Mode development

Programmer tetap dapat menjalankan:

```powershell
cd kiosk-app
npm run dev
```

Mode ini hanya untuk pengembangan. Admin harus menggunakan shortcut produksi.
