@echo off
chcp 65001 >nul
echo ========================================
echo Find PLECS Installation
echo ========================================
echo.

matlab -batch "find_plecs"

echo.
pause
