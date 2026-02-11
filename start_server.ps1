# Django Server Startup Script
# This script ensures the server uses the virtual environment with all dependencies

Write-Host "Starting Django Development Server..." -ForegroundColor Green
Write-Host "Using virtual environment: .venv" -ForegroundColor Cyan

# Kill any existing Django processes on port 8000
$existingProcesses = netstat -ano | Select-String "8000" | ForEach-Object {
    $_ -match '\s+(\d+)\s*$' | Out-Null
    $matches[1]
} | Select-Object -Unique

if ($existingProcesses) {
    Write-Host "Stopping existing Django server processes..." -ForegroundColor Yellow
    foreach ($pid in $existingProcesses) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "  Stopped process $pid" -ForegroundColor Yellow
        } catch {
            # Process might have already stopped
        }
    }
    Start-Sleep -Seconds 1
}

# Start Django server using virtual environment Python
Write-Host "`nStarting server on http://192.168.31.164:8000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server`n" -ForegroundColor Cyan

& .\.venv\Scripts\python.exe manage.py runserver 192.168.31.164:8000
