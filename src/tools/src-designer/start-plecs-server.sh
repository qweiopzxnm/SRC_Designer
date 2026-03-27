#!/bin/bash
# PLECS 仿真服务器启动脚本
# 
# 使用方法：
# ./start-plecs-server.sh

echo "=========================================="
echo "🔌 PLECS 仿真服务器启动脚本"
echo "=========================================="

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误：未找到 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 版本：$(node --version)"

# 检查 MATLAB
if ! command -v matlab &> /dev/null; then
    echo "⚠️  警告：未找到 MATLAB 命令"
    echo "请确保 MATLAB 已安装并添加到 PATH"
    echo ""
fi

# 检查模型文件
if [ ! -f "SRC.plecs" ]; then
    echo "❌ 错误：未找到 SRC.plecs 模型文件"
    echo "请将 PLECS 模型文件复制到此目录"
    echo ""
    exit 1
fi

echo "✅ 模型文件：SRC.plecs"
echo ""
echo "📂 工作目录：$(pwd)"
echo "📡 服务端口：http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止服务"
echo "=========================================="
echo ""

# 启动服务器
node plecs-server.js
