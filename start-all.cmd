@echo off
REM Start Sudut Pandang full stack: API, Next.js kiosk, nginx, and Electron kiosk-app

SET PM2_HOME=C:\Users\khairus\.pm2
REM Tambah PATH supaya pm2 dan node global kebaca (mirip pm2-startup.cmd)
SET PATH=%PATH%;C:\Users\khairus\AppData\Local\nvm;C:\Users\khairus\AppData\Roaming\npm

echo.
echo === Starting API (pm2) ===
cd /d D:\Dev\sudutPandangV1\api
call pm2 start server.js --name sudutpandang-api

echo.
echo === Starting Next.js kiosk (pm2) ===
cd /d D:\Dev\sudutPandangV1\studio-kiosk
call pm2 start node_modules/next/dist/bin/next --name sudutpandang -- start -p 5173 -H 0.0.0.0

echo.
echo === Testing and starting nginx ===
cd /d C:\nginx
nginx -t
IF ERRORLEVEL 1 (
  echo nginx.conf error. Fix nginx config before continuing.
  goto :eof
)

REM Jalankan nginx di proses terpisah supaya script lanjut
start "" nginx

echo.
echo === Building kiosk-app renderer ===
cd /d D:\Dev\sudutPandangV1\kiosk-app
npm run build:renderer

echo.
echo === Starting Electron kiosk-app ===
REM Buka jendela CMD baru khusus kiosk-app, biar kelihatan error kalau ada
start cmd /k "cd /d D:\Dev\sudutPandangV1\kiosk-app && npm run dev"

echo.
echo All services started: API, Next.js kiosk, nginx, and Electron kiosk-app.
echo.
cd /d D:\Dev\sudutPandangV1