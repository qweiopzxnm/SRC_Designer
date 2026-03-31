@echo off
chcp 65001 >nul

REM Check files exist
if not exist "SRC_backup.plecs" (
    echo ERROR: SRC_backup.plecs not found!
    pause
    exit /b 1
)

if not exist "verify_input.json" (
    echo ERROR: verify_input.json not found!
    pause
    exit /b 1
)

REM Run MATLAB simulation
matlab -batch "simulate_plecs_direct_multi"

REM Show result
if exist "verify_output.json" (
    echo.
    echo === Simulation Complete ===
    echo Output: verify_output.json
) else (
    echo.
    echo === Simulation Failed ===
    echo Check MATLAB output for errors.
)
pause
