# Django Server Startup Script
# This script ensures the server uses the virtual environment with all dependencies

Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Django Server Startup - Incident Management Platform  ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Verify virtual environment exists
if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
    Write-Host "❌ ERROR: Virtual environment not found!" -ForegroundColor Red
    Write-Host "   Expected: .venv\Scripts\python.exe" -ForegroundColor Yellow
    Write-Host "   Please create virtual environment first." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✓ Virtual environment found" -ForegroundColor Green

# Verify geopy is installed in venv
Write-Host "Checking dependencies..." -ForegroundColor Cyan
$geopyCheck = & .\.venv\Scripts\python.exe -c "import geopy; print('OK')" 2>&1

if ($geopyCheck -notlike "*OK*") {
    Write-Host "❌ ERROR: geopy not installed in virtual environment!" -ForegroundColor Red
    Write-Host "   Installing geopy now..." -ForegroundColor Yellow
    & .\.venv\Scripts\pip.exe install geopy
    Write-Host "✓ geopy installed successfully" -ForegroundColor Green
} else {
    Write-Host "✓ geopy is installed" -ForegroundColor Green
}

Write-Host ""

# Kill any existing Django processes on port 8000
$existingProcesses = netstat -ano | Select-String "8000" | ForEach-Object {
    $_ -match '\s+(\d+)\s*$' | Out-Null
    $matches[1]
} | Select-Object -Unique

if ($existingProcesses) {
    Write-Host "⚠ Stopping existing Django server processes..." -ForegroundColor Yellow
    foreach ($pid in $existingProcesses) {
        try {
            $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "  Stopping process $pid ($($process.Name))" -ForegroundColor Yellow
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            }
        } catch {
            # Process might have already stopped
        }
    }
    Start-Sleep -Seconds 1
    Write-Host "✓ Old servers stopped" -ForegroundColor Green
}

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Starting Django Server with Virtual Environment          ║" -ForegroundColor Green
Write-Host "╠═══════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Server: http://0.0.0.0:8000                              ║" -ForegroundColor White
Write-Host "║  Access from any device on same WiFi network              ║" -ForegroundColor White
Write-Host "║  Press Ctrl+C to stop the server                          ║" -ForegroundColor White
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

& .\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
