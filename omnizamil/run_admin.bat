@echo off
title OmniZamil Admin Dashboard
echo ===================================================
echo           OmniZamil Admin Dashboard Launcher
echo ===================================================
echo.

cd /d "%~dp0admin"

if not exist node_modules (
    echo [!] Node modules missing. Installing admin dependencies...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [X] ERROR: Failed to install npm packages for Admin app.
        pause
        exit /b 1
    )
)

echo [✓] Launching OmniZamil Admin Portal on http://localhost:5174 ...
echo.
call npm run dev

pause
