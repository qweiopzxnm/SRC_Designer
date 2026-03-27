@echo off
REM PLECS Simulation Server Startup Script (Windows)
REM Usage: Double-click this file or run: start-plecs-server.bat

echo ==========================================
echo PLECS Simulation Server Startup
echo ==========================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js not found
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js installed
node --version
echo.

REM Check MATLAB
where matlab >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Warning: MATLAB command not found
    echo Please ensure MATLAB is installed and added to PATH
    echo.
) else (
    echo MATLAB installed
)

REM Check model file
if not exist "SRC.plecs" (
    echo Error: SRC.plecs model file not found
    echo Please copy your PLECS model file to this directory
    echo.
    pause
    exit /b 1
)

echo Model file: SRC.plecs
echo.
echo Working directory: %CD%
echo Server port: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo ==========================================
echo.

REM Start server
node plecs-server.js

pause
