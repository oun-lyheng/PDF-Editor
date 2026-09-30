@echo off
setlocal
title PDF Editor Backend (FastAPI + PyMuPDF)
cd /d "%~dp0"

echo ======================================================
echo           PDF Editor Backend Launcher
echo ======================================================

REM 1. Auto-detect existing virtual environment
if exist "venv\Scripts\activate.bat" (
    echo [OK] Activating virtual environment: venv
    call "venv\Scripts\activate.bat"
    goto CHECK_DEPENDENCIES
)

if exist ".venv\Scripts\activate.bat" (
    echo [OK] Activating virtual environment: .venv
    call ".venv\Scripts\activate.bat"
    goto CHECK_DEPENDENCIES
)

REM 2. Detect Python executable (checks PATH, py launcher, and default Windows install paths)
set "PY_EXE="
where python >nul 2>&1 && set "PY_EXE=python"
if not defined PY_EXE (
    where py >nul 2>&1 && set "PY_EXE=py -3.13"
)
if not defined PY_EXE (
    where py >nul 2>&1 && set "PY_EXE=py"
)
if not defined PY_EXE if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" (
    set "PY_EXE=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
)
if not defined PY_EXE if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PY_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
)
if not defined PY_EXE if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set "PY_EXE=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
)
if not defined PY_EXE if exist "C:\Program Files\Python313\python.exe" (
    set "PY_EXE=C:\Program Files\Python313\python.exe"
)

if not defined PY_EXE (
    echo ======================================================
    echo [ERROR] Python was not found on this computer.
    echo.
    echo If you installed python-3.13.15-amd64.exe:
    echo Please run the installer again, select "Modify", and
    echo CHECK the box: [x] Add python.exe to PATH
    echo ======================================================
    pause
    exit /b 1
)

echo [OK] Using Python: %PY_EXE%

REM 3. If no venv found, auto-create it using the detected Python
echo [!] Creating local virtual environment (venv)...
"%PY_EXE%" -m venv venv
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create virtual environment with %PY_EXE%.
    pause
    exit /b 1
)

echo [OK] Activating new venv...
call "venv\Scripts\activate.bat"

:CHECK_DEPENDENCIES
REM 3. Check if core packages are already installed
python -c "import fastapi, pymupdf, uvicorn" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] All dependencies are already installed.
    goto START_SERVER
)

REM 4. Install dependencies (Offline wheels first, then online fallback)
echo [!] Installing required dependencies...
if exist "wheels" (
    echo [OFFLINE MODE] Installing packages from local 'wheels' folder (Zero internet required)...
    pip install --no-index --find-links=wheels -r requirements.txt
) else (
    echo [ONLINE MODE] Installing packages via pip...
    pip install -r requirements.txt
)

if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

:START_SERVER
echo ======================================================
echo Starting PDF Editor on http://localhost:5000
echo ======================================================
start "" http://localhost:5000
python -m uvicorn main:app --host 127.0.0.1 --port 5000
pause

