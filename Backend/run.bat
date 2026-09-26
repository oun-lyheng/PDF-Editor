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
    goto START_SERVER
)

if exist ".venv\Scripts\activate.bat" (
    echo [OK] Activating virtual environment: .venv
    call ".venv\Scripts\activate.bat"
    goto START_SERVER
)

REM 2. If no venv found, auto-create it (first time setup on company computer)
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

echo [OK] Installing backend requirements...
python -m pip install --upgrade pip
pip install -r requirements.txt

:START_SERVER
echo ======================================================
echo Starting FastAPI Backend on http://localhost:5000
echo ======================================================
python -m uvicorn main:app --host 127.0.0.1 --port 5000 --reload
pause
