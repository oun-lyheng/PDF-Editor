@echo off
setlocal
title PDF Editor Launcher
cd /d "%~dp0"

echo ======================================================
echo           Starting PDF Editor (All-in-One)
echo ======================================================

REM 1. Start Backend in a separate window
echo [1/2] Starting Python FastAPI Backend...
start "PDF Editor Backend" cmd /c "cd Backend && run.bat"

REM 2. Start Frontend in this window (or separate)
echo [2/2] Starting Frontend Vite Server...
cd UI-Frontend
if not exist "node_modules\" (
    echo [!] Installing frontend dependencies...
    npm install
)

echo Starting frontend at http://localhost:5173 ...
npm run dev
