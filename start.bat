@echo off
setlocal
title PDF Editor Launcher
cd /d "%~dp0"

echo ======================================================
echo           Starting PDF Editor
echo ======================================================

REM Check if Backend folder is directly in current directory
if exist "Backend\run.bat" (
    cd Backend
    call run.bat
    goto FINISH
)

REM Check if extracted inside a nested folder (common with GitHub ZIPs)
for /d %%D in (*) do (
    if exist "%%D\Backend\run.bat" (
        cd "%%D\Backend"
        call run.bat
        goto FINISH
    )
)

echo [ERROR] Could not find the 'Backend' folder.
echo Current directory: %CD%
echo Please make sure you extracted all files from the ZIP.

:FINISH
echo.
echo ======================================================
echo PDF Editor has stopped.
echo ======================================================
pause

