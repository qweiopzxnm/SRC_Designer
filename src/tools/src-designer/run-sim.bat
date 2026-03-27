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

REM 检查参数文件
if exist "plecs_input.json" (
    echo Found: plecs_input.json
) else if exist "PLECS_Params_*.json" (
    echo Found: PLECS_Params_*.json
    copy PLECS_Params_*.json plecs_input.json >nul
    echo Copied to: plecs_input.json
) else (
    echo ERROR: No PLECS parameter file found!
    echo Please export parameters from LLC tool first.
    pause
    exit /b 1
)

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
