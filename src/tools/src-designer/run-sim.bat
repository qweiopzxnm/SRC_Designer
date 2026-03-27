@echo off
chcp 65001 >nul
echo ========================================
echo PLECS Auto Simulation
echo ========================================
echo.

if not exist "SRC.plecs" (
    echo ERROR: SRC.plecs not found!
    pause
    exit /b 1
)

if not exist "plecs_input.json" (
    echo ERROR: plecs_input.json not found!
    echo Please export parameters from LLC tool first.
    pause
    exit /b 1
)

echo Starting MATLAB...
echo.

matlab -batch "run_plecs_auto"

echo.
echo ========================================
if exist "plecs_output.json" (
    echo Results: plecs_output.json
    type plecs_output.json
) else (
    echo No results file
)
echo ========================================
pause
