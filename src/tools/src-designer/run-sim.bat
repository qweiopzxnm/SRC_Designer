@echo off
chcp 65001 >nul
echo ========================================
echo PLECS Simulation
echo ========================================
echo.

if not exist "SRC.plecs" (
    echo ERROR: SRC.plecs not found!
    echo Please copy your PLECS model to this folder.
    pause
    exit /b 1
)

if not exist "plecs_input.json" (
    echo ERROR: plecs_input.json not found!
    echo Please export parameters from LLC tool first.
    pause
    exit /b 1
)

echo Starting MATLAB simulation...
echo.

matlab -batch "run_plecs_simulation"

echo.
echo ========================================
if exist "plecs_output.json" (
    echo SUCCESS! Results saved to plecs_output.json
) else (
    echo FAILED! Check error above.
)
echo ========================================
pause
