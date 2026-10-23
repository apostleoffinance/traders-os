$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
py -3.12 -m venv .venv
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
& .\.venv\Scripts\python.exe -m PyInstaller --noconfirm --clean --onefile --windowed --name TraderOSCompanion --collect-all MetaTrader5 --collect-all keyring traderos_mt5_app.py
if ($LASTEXITCODE -ne 0) { throw "PyInstaller build failed" }
$compiler = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if (-not $compiler) { throw "Install Inno Setup 6 and ensure ISCC.exe is on PATH" }
& $compiler.Source "installer\TraderOSCompanion.iss"
if ($LASTEXITCODE -ne 0) { throw "Inno Setup build failed" }
Write-Host "Installer created at dist\TraderOS-MT5-Companion-Setup.exe"
