@echo off
setlocal
title PDF Editor Launcher
cd /d "%~dp0"

echo ======================================================
echo           Starting PDF Editor
echo ======================================================

cd Backend
call run.bat
