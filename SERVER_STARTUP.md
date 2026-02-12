# Server Startup Guide

## Quick Start

### Starting the Django Backend Server

**⭐ RECOMMENDED METHODS (Use one of these):**

**Option 1 - PowerShell Script:**
```powershell
.\start_server.ps1
```

**Option 2 - Batch File (Double-click):**
```
START_SERVER.bat
```

These scripts automatically:
- Verify virtual environment exists
- Check and install geopy if needed
- Stop any existing Django server processes
- Start the server using the virtual environment (`.venv`)
- Ensure all dependencies (including geopy) are available

---

### ⚠️ CRITICAL - Avoid Common Errors

**❌ NEVER RUN THESE COMMANDS DIRECTLY:**
```powershell
python manage.py runserver          # ❌ Uses system Python (no geopy!)
py manage.py runserver              # ❌ Uses system Python (no geopy!)
python manage.py runserver 0.0.0.0:8000  # ❌ Wrong Python
```

**Why?** These commands use your system Python installation, which doesn't have `geopy` installed. This causes the **"No module named 'geopy'"** error when uploading photos.

**✅ ALWAYS USE:**
- `.\start_server.ps1` (PowerShell)
- `START_SERVER.bat` (Windows)
- These ensure the correct Python environment is used

---

**Manual start (ONLY if scripts fail):**

```powershell
.\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

⚠️ **IMPORTANT:** Always use `.venv\Scripts\python.exe` to ensure the server has access to all installed packages, especially `geopy` which is required for photo location validation.

### First Time Setup

1. **Install dependencies:**
   ```powershell
   .\.venv\Scripts\pip.exe install -r requirements.txt
   ```

2. **Verify geopy installation:**
   ```powershell
   .\.venv\Scripts\python.exe -c "import geopy; print('geopy version:', geopy.__version__)"
   ```
   Expected output: `geopy version: 2.4.1`

3. **Start the server:**
   ```powershell
   .\start_server.ps1
   ```

### Troubleshooting

**Error: "No module named 'geopy'"**

This error occurs when the server is started with the wrong Python interpreter.

✅ **Solution:**
1. Stop any running Django processes
2. Use the startup script: `.\start_server.ps1`
3. Or manually start with: `.\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000`

**Finding running Django processes:**

```powershell
netstat -ano | Select-String "8000"
```

**Stopping a specific process:**

```powershell
Stop-Process -Id <PID> -Force
```

### Server Ports

- **Django Backend:** http://0.0.0.0:8000 (accessible from any device on same network)
- **Frontend (Vite):** http://localhost:3000
- **Vendor Portal (Expo):** Access using your laptop's current IP (changes per network)

### Finding Your Current IP Address

**To access backend from mobile device (Expo app), you need your laptop's current IP:**

**Windows (PowerShell):**
```powershell
ipconfig | Select-String -Pattern "IPv4"
```

**Linux/macOS:**
```bash
hostname -I
```

**Example:** If your laptop's IP is `192.168.1.105`, access:
- Backend API from mobile: `http://192.168.1.105:8000`
- Expo dev server: `exp://192.168.1.105:8081`

⚠️ **Important:** IP changes when you switch WiFi networks. Re-check IP on new networks.

### Dependencies

Key Python packages required:
- Django 6.0.1
- Pillow (for image processing)
- geopy 2.4.1 (for GPS location validation)
- psycopg2 (for PostgreSQL)
- django-ninja (for API)

See `requirements.txt` for complete list.
