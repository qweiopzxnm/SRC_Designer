@echo off
REM PLECS 仿真服务器启动脚本 (Windows)
REM 
REM 使用方法：
REM 双击此文件或运行：start-plecs-server.bat

echo ==========================================
echo 🔌 PLECS 仿真服务器启动脚本
echo ==========================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 错误：未找到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js 已安装
node --version
echo.

REM 检查 MATLAB
where matlab >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  警告：未找到 MATLAB 命令
    echo 请确保 MATLAB 已安装并添加到 PATH
    echo.
) else (
    echo ✅ MATLAB 已安装
)

REM 检查模型文件
if not exist "SRC.plecs" (
    echo ❌ 错误：未找到 SRC.plecs 模型文件
    echo 请将 PLECS 模型文件复制到此目录
    echo.
    pause
    exit /b 1
)

echo ✅ 模型文件：SRC.plecs
echo.
echo 📂 工作目录：%CD%
echo 📡 服务端口：http://localhost:3000
echo.
echo 按 Ctrl+C 停止服务
echo ==========================================
echo.

REM 启动服务器
node plecs-server.js

pause
