@echo off
chcp 65001 >nul
echo ========================================
echo PLECS Model Analysis
echo ========================================
echo.

if not exist "SRC.plecs" (
    echo ERROR: SRC.plecs not found!
    pause
    exit /b 1
)

echo Analyzing model structure...
echo.

matlab -batch "analyze_plecs_model"

echo.
echo ========================================
echo Analysis complete!
echo ========================================
echo.
echo Please send the output to the assistant.
pause
