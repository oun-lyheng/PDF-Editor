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

REM 2. If no venv found, auto-create it (first time setup)
echo [!] Virtual environment not found. Creating venv automatically...
python -m venv venv
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.10+ from python.org and check "Add Python to PATH".
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

