@echo off
echo ========================================
echo  Starting Django Server
echo ========================================
echo.

REM Check if virtual environment exists
if not exist ".venv\Scripts\python.exe" (
    echo ERROR: Virtual environment not found!
    echo Please run: python -m venv .venv
    pause
    exit /b 1
)

REM Kill any existing servers on port 8000
echo Checking for running servers...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    echo Stopping process %%a
    taskkill /F /PID %%a 2>nul
)

echo.
echo ========================================
echo  Server starting on http://0.0.0.0:8000
echo  Press Ctrl+C to stop
echo ========================================
echo.

REM Start server with virtual environment Python
.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000

pause
