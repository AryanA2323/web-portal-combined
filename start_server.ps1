# Django Server Startup Script
# This script ensures the server uses the virtual environment with all dependencies

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Django Server Startup" -ForegroundColor Cyan
Write-Host "Incident Management Platform" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verify virtual environment exists
if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
    Write-Host "ERROR: Virtual environment not found!" -ForegroundColor Red
    Write-Host "Expected: .venv\Scripts\python.exe" -ForegroundColor Yellow
    Write-Host "Please create virtual environment first." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[OK] Virtual environment found" -ForegroundColor Green

# Verify geopy is installed in venv
Write-Host "Checking dependencies..." -ForegroundColor Cyan
$geopyCheck = & .\.venv\Scripts\python.exe -c "import geopy; print('OK')" 2>&1

if ($geopyCheck -notlike "*OK*") {
    Write-Host "ERROR: geopy not installed in virtual environment!" -ForegroundColor Red
    Write-Host "Installing geopy now..." -ForegroundColor Yellow
    & .\.venv\Scripts\pip.exe install geopy
    Write-Host "[OK] geopy installed successfully" -ForegroundColor Green
} else {
    Write-Host "[OK] geopy is installed" -ForegroundColor Green
}

Write-Host ""

# Kill any existing Django processes on port 8000
Write-Host "Checking for existing Django servers..." -ForegroundColor Cyan
$portsInUse = netstat -ano | Select-String "8000"
if ($portsInUse) {
    Write-Host "Stopping existing Django server processes..." -ForegroundColor Yellow
    $portsInUse | ForEach-Object {
        $line = $_.ToString()
        if ($line -match '\s+(\d+)\s*$') {
            $pid = $matches[1]
            $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "  Stopping process $pid ($($proc.Name))" -ForegroundColor Yellow
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            }
        }
    }
    Start-Sleep -Seconds 1
    Write-Host "[OK] Old servers stopped" -ForegroundColor Green
} else {
    Write-Host "[OK] No existing servers found" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Starting Django Server" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Server: http://0.0.0.0:8000" -ForegroundColor White
Write-Host "Access from any device on same WiFi" -ForegroundColor White
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

& .\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
