@echo off
setlocal
set "ROOT=%~dp0"

echo.
echo ==========================================
echo   Build Produksi Sudut Pandang
echo ==========================================
echo.

where node >nul 2>nul || (
  echo ERROR: Node.js tidak ditemukan.
  pause
  exit /b 1
)

echo [1/3] Menyiapkan API...
cd /d "%ROOT%api"
call npm ci
if errorlevel 1 goto :failed

echo.
echo [2/3] Membuild Studio Kiosk...
cd /d "%ROOT%studio-kiosk"
call npm ci
if errorlevel 1 goto :failed
call npm run build
if errorlevel 1 goto :failed

echo.
echo [3/3] Membuat aplikasi Windows Kiosk...
cd /d "%ROOT%kiosk-app"
call npm ci
if errorlevel 1 goto :failed
call npm run dist:win
if errorlevel 1 goto :failed

echo.
echo Build produksi selesai.
echo Installer tersedia di:
echo   %ROOT%kiosk-app\release
echo.
echo Membuat shortcut admin di Desktop...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT%deploy\windows\Install-Shortcuts.ps1"
exit /b 0

:failed
echo.
echo ERROR: Build produksi gagal. Periksa pesan di atas.
pause
exit /b 1
