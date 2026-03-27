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

if exist "plecs_input.json" goto run_matlab
if exist "PLECS_Params_*.json" goto copy_params

echo ERROR: No PLECS parameter file found!
echo Please export parameters from LLC tool first.
pause
exit /b 1

:copy_params
copy PLECS_Params_*.json plecs_input.json
echo Copied to: plecs_input.json

:run_matlab
echo.
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
