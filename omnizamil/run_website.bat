@echo off
title ShiftZero Website Server
echo Starting ShiftZero Website Backend and Frontend...
cd /d "%~dp0website"
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
start "ShiftZero API Server" cmd /k "npm run server"
start "ShiftZero Frontend Dev" cmd /k "npm run dev"
echo Website running at http://localhost:3000
