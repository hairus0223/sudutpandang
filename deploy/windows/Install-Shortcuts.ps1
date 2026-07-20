param(
  [switch]$EnableAutoStart,
  [switch]$Silent
)

$ErrorActionPreference = "Stop"
$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath("Desktop")
$startup = [Environment]::GetFolderPath("Startup")
$windowsScriptHost = Join-Path $env:WINDIR "System32\wscript.exe"

function New-LauncherShortcut {
  param(
    [string]$Name,
    [string]$ScriptName,
    [string]$Destination
  )

  $shortcutPath = Join-Path $Destination "$Name.lnk"
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $windowsScriptHost
  $shortcut.Arguments = "`"$(Join-Path $PSScriptRoot $ScriptName)`""
  $shortcut.WorkingDirectory = $PSScriptRoot
  $shortcut.IconLocation = "$env:SystemRoot\System32\SHELL32.dll,137"
  $shortcut.Save()
}

New-LauncherShortcut "Mulai Sudut Pandang" "Start-SudutPandang.vbs" $desktop
New-LauncherShortcut "Hentikan Sudut Pandang" "Stop-SudutPandang.vbs" $desktop
New-LauncherShortcut "Status Sudut Pandang" "Status-SudutPandang.vbs" $desktop

if ($EnableAutoStart) {
  New-LauncherShortcut "Sudut Pandang" "Start-SudutPandang.vbs" $startup
}

if (-not $Silent) {
  Add-Type -AssemblyName PresentationFramework
  $message = "Shortcut Sudut Pandang berhasil dibuat di Desktop."
  if ($EnableAutoStart) {
    $message += "`nAplikasi juga akan dimulai otomatis setelah login Windows."
  }
  [System.Windows.MessageBox]::Show(
    $message,
    "Instalasi Sudut Pandang",
    [System.Windows.MessageBoxButton]::OK,
    [System.Windows.MessageBoxImage]::Information
  ) | Out-Null
}
