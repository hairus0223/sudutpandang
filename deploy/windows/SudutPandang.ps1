param(
  [ValidateSet("start", "stop", "restart", "status")]
  [string]$Action = "start"
)

$ErrorActionPreference = "Stop"
$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$DataDir = Join-Path $env:ProgramData "SudutPandang"
$LogDir = Join-Path $DataDir "logs"
$LogFile = Join-Path $LogDir "launcher.log"
$Ecosystem = Join-Path $PSScriptRoot "ecosystem.config.cjs"
$env:PM2_HOME = Join-Path $env:USERPROFILE ".pm2"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Write-LauncherLog {
  param([string]$Message)
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Show-AdminMessage {
  param(
    [string]$Title,
    [string]$Message,
    [ValidateSet("Information", "Warning", "Error")]
    [string]$Kind = "Information"
  )
  Add-Type -AssemblyName PresentationFramework
  $messageKind = [System.Enum]::Parse(
    [System.Windows.MessageBoxImage],
    $Kind
  )
  [System.Windows.MessageBox]::Show(
    $Message,
    $Title,
    [System.Windows.MessageBoxButton]::OK,
    $messageKind
  ) | Out-Null
}

function Get-RequiredCommand {
  param([string]$Name)
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "Program '$Name' tidak ditemukan. Jalankan instalasi produksi terlebih dahulu."
  }
  return $command.Source
}

function Invoke-Pm2 {
  param([string[]]$Arguments)
  $pm2 = Get-RequiredCommand "pm2.cmd"
  Write-LauncherLog "pm2 $($Arguments -join ' ')"
  $output = & $pm2 @Arguments 2>&1
  $output | ForEach-Object { Write-LauncherLog "$_" }
  if ($LASTEXITCODE -ne 0) {
    throw "PM2 gagal menjalankan perintah '$($Arguments -join ' ')'."
  }
}

function Wait-ForUrl {
  param(
    [string]$Url,
    [string]$ServiceName,
    [int]$TimeoutSeconds = 45
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        Write-LauncherLog "$ServiceName siap: $Url"
        return
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  } while ((Get-Date) -lt $deadline)

  throw "$ServiceName tidak merespons di $Url setelah $TimeoutSeconds detik."
}

function Start-Nginx {
  $nginx = if ($env:SUDUTPANDANG_NGINX) {
    $env:SUDUTPANDANG_NGINX
  } else {
    "C:\nginx\nginx.exe"
  }

  if (-not (Test-Path $nginx)) {
    Write-LauncherLog "Nginx tidak ditemukan di $nginx; dilewati."
    return
  }

  $nginxDirectory = Split-Path $nginx
  $test = Start-Process -FilePath $nginx -ArgumentList "-t" `
    -WorkingDirectory $nginxDirectory -Wait -PassThru -WindowStyle Hidden
  if ($test.ExitCode -ne 0) {
    throw "Konfigurasi nginx tidak valid. Jalankan 'C:\nginx\nginx.exe -t' untuk detail."
  }

  if (-not (Get-Process -Name "nginx" -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $nginx -WorkingDirectory $nginxDirectory `
      -WindowStyle Hidden
    Write-LauncherLog "Nginx dimulai."
  }
}

function Find-KioskExecutable {
  # Prefer the repo build so production shortcuts pick up `npm run pack` /
  # build-production.cmd without reinstalling the NSIS copy.
  $candidates = @(
    (Join-Path $Root "kiosk-app\release\win-unpacked\Sudut Pandang Kiosk.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\Sudut Pandang Kiosk\Sudut Pandang Kiosk.exe")
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return $candidate }
  }

  $portable = Get-ChildItem (Join-Path $Root "kiosk-app\release") `
    -Filter "Sudut-Pandang-Kiosk-Portable-*.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($portable) { return $portable.FullName }

  throw "Aplikasi Kiosk belum dibuild atau diinstal. Jalankan build-production.cmd."
}

function Start-SudutPandang {
  if (-not (Test-Path (Join-Path $Root "studio-kiosk\.next\BUILD_ID"))) {
    throw "Build studio-kiosk belum tersedia. Jalankan build-production.cmd."
  }

  Write-LauncherLog "Memulai layanan dari $Root"
  Invoke-Pm2 -Arguments @("startOrReload", $Ecosystem, "--update-env")
  Invoke-Pm2 -Arguments @("save")
  Start-Nginx
  Wait-ForUrl "http://localhost:4000/api/health" "API"
  Wait-ForUrl "http://localhost:5173" "Studio Kiosk"

  $kioskExe = Find-KioskExecutable
  if (-not (Get-Process -Name "Sudut Pandang Kiosk" -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $kioskExe
    Write-LauncherLog "Kiosk dimulai: $kioskExe"
  }
}

function Stop-SudutPandang {
  Write-LauncherLog "Menghentikan layanan."
  Get-Process -Name "Sudut Pandang Kiosk" -ErrorAction SilentlyContinue |
    Stop-Process -Force

  $pm2 = Get-Command "pm2.cmd" -ErrorAction SilentlyContinue
  if ($pm2) {
    Invoke-Pm2 -Arguments @("stop", "sudutpandang-api", "sudutpandang")
    Invoke-Pm2 -Arguments @("save")
  }

  $nginx = if ($env:SUDUTPANDANG_NGINX) {
    $env:SUDUTPANDANG_NGINX
  } else {
    "C:\nginx\nginx.exe"
  }
  if ((Test-Path $nginx) -and (Get-Process -Name "nginx" -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $nginx -ArgumentList "-s", "quit" `
      -WorkingDirectory (Split-Path $nginx) -Wait -WindowStyle Hidden
  }
}

function Show-Status {
  $api = Get-Process -Name "node" -ErrorAction SilentlyContinue
  $kiosk = Get-Process -Name "Sudut Pandang Kiosk" -ErrorAction SilentlyContinue
  $nginx = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
  $message = @(
    "Node/PM2: $(if ($api) { 'berjalan' } else { 'tidak berjalan' })",
    "Kiosk: $(if ($kiosk) { 'berjalan' } else { 'tidak berjalan' })",
    "Nginx: $(if ($nginx) { 'berjalan' } else { 'tidak berjalan' })",
    "",
    "Log: $LogFile"
  ) -join [Environment]::NewLine
  Show-AdminMessage "Status Sudut Pandang" $message "Information"
}

try {
  switch ($Action) {
    "start" {
      Start-SudutPandang
    }
    "stop" {
      Stop-SudutPandang
      Show-AdminMessage "Sudut Pandang" "Semua aplikasi berhasil dihentikan."
    }
    "restart" {
      Stop-SudutPandang
      Start-SudutPandang
    }
    "status" {
      Show-Status
    }
  }
} catch {
  Write-LauncherLog "ERROR: $($_.Exception.Message)"
  Show-AdminMessage "Sudut Pandang gagal" (
    "$($_.Exception.Message)`n`nDetail teknis tersimpan di:`n$LogFile"
  ) "Error"
  exit 1
}
