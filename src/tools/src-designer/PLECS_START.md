# 🚀 PLECS 仿真集成 - 从这里开始！

## ⚡ 3 分钟快速启动

### 第一步：下载工具到本地

**Windows 用户**（PowerShell）：
```powershell
scp -r root@8.222.140.165:/home/admin/.openclaw/workspace/src/tools/src-designer %USERPROFILE%\Desktop\src-designer
```

**Windows 用户**（CMD）：
```cmd
scp -r root@8.222.140.165:/home/admin/.openclaw/workspace/src/tools/src-designer C:\Users\%USERNAME%\Desktop\src-designer
```

下载完成后，在桌面找到 `src-designer` 文件夹。

---

### 第二步：准备 PLECS 模型

1. **复制你的 `SRC.plecs` 文件**到下载的文件夹中

2. **确认模型参数**（应该与你的截图一致）：
   ```matlab
   Lr  = 28e-6;      % 谐振电感 28μH
   Crp = 110e-9;     % 原边电容 110nF
   Crs = 110e-9;     % 副边电容 110nF
   Lm  = 400e-6;     % 励磁电感 400μH
   Np  = 24;         % 原边匝数
   Ns  = 23;         % 副边匝数
   Vin = 810;        % 输入电压 810V
   Vref = 850;       % 输出电压 850V
   Po  = 11000;      % 输出功率 11kW
   ```

3. **确认电流测量**：
   - 信号名：`I_Lrp`
   - 确保仿真后该数据可访问

---

### 第三步：启动仿真服务器

打开 **命令提示符** 或 **PowerShell**，进入下载的文件夹：

```cmd
cd %USERPROFILE%\Desktop\src-designer
```

运行启动命令：

**方式 1：使用启动脚本（推荐）**
```cmd
start-plecs-server.bat
```

**方式 2：直接运行 Node.js**
```cmd
node plecs-server.js
```

看到以下输出表示成功：
```
========================================
🔌 PLECS 仿真服务器已启动
📡 监听端口：http://localhost:3000
========================================
```

**⚠️ 保持此窗口打开，不要关闭！**

---

### 第四步：运行仿真

1. **打开 LLC 设计工具**：
   - 双击 `index.html` 文件
   - 或在浏览器中访问：`http://localhost:3000`（如果启动了 Web 服务器）

2. **设置参数**：
   - 输入你的设计规格
   - 点击 "🔧 自动优化计算"

3. **运行仿真**：
   - 点击 "▶️ 运行 PLECS 仿真"
   - 等待 MATLAB 启动并运行
   - 查看结果：谐振电流有效值 Irms

---

## 📋 完整文件清单

确保你的文件夹中有这些文件：

```
src-designer/
├── index.html              ✅ LLC 工具界面
├── app.js                  ✅ 应用逻辑
├── src-calculator.js       ✅ 计算核心
├── styles.css              ✅ 样式
├── plecs-server.js         ⭐ 新增：后端服务
├── run_plecs_simulation.m  ⭐ 新增：MATLAB 脚本
├── start-plecs-server.bat  ⭐ 新增：Windows 启动脚本
├── start-plecs-server.sh   ⭐ 新增：Linux 启动脚本
├── SRC.plecs               ⭐ 你的模型（需要复制）
├── PLECS_START.md          ⭐ 本文件
├── PLECS_SETUP.md          📖 详细配置指南
├── README.md               📖 工具说明
└── QUICKSTART.md           📖 快速开始
```

---

##  常见问题

### Q1: "找不到 Node.js"

**解决**：安装 Node.js
- 下载地址：https://nodejs.org/
- 选择 LTS 版本（v20.x）
- 安装后重启命令行

### Q2: "MATLAB 无法执行"

**解决**：检查 MATLAB 安装
```cmd
matlab --version
```

如果提示找不到命令，需要添加 MATLAB 到系统 PATH：
- MATLAB 典型路径：`C:\Program Files\MATLAB\R2024a\bin`

### Q3: "端口已被占用"

**解决**：编辑 `plecs-server.js`，修改端口：
```javascript
const PORT = 3001;  // 改为 3001 或其他端口
```

### Q4: "找不到 SRC.plecs"

**解决**：确认文件名和位置
```cmd
dir SRC.plecs
```

如果文件名不同（如 `SRC.slx`），请修改 `run_plecs_simulation.m`：
```matlab
model_name = 'SRC';  % 改为你的文件名（不含扩展名）
```

---

## 🎯 测试流程

启动后，按顺序测试：

1. **健康检查**：
   - 浏览器访问：`http://localhost:3000/api/health`
   - 应显示：`{"status":"ok","message":"PLECS Server is running"}`

2. **手动仿真**：
   - 打开 LLC 工具
   - 点击"自动优化计算"
   - 点击"运行 PLECS 仿真"
   - 等待结果

3. **查看结果**：
   - Irms（谐振电流有效值）
   - Ipeak（谐振电流峰值）
   - 仿真耗时

4. **对比设计值**：
   - 点击"📊 对比设计值"
   - 查看偏差百分比

---

## 📊 下一步功能

当前版本已实现：
- ✅ 一键触发仿真
- ✅ 读取 Irms 结果
- ✅ 设计值 vs 仿真值对比

后续可以添加：
- 📈 多工况自动扫描（负载变化）
- 📈 效率曲线绘制
- 📈 参数优化建议
- 📈 批量仿真报告

---

## 📞 获取帮助

遇到问题？查看这些文件：

1. **PLECS_SETUP.md** - 详细配置指南
2. **README.md** - 工具使用说明
3. **QUICKSTART.md** - 快速开始指南

或检查服务器日志输出，错误信息会显示在命令行窗口。

---

## 🔄 更新工具

当服务器端工具更新时，重新下载：

```powershell
# 删除旧版本
rmdir /s %USERPROFILE%\Desktop\src-designer

# 下载新版本
scp -r root@8.222.140.165:/home/admin/.openclaw/workspace/src/tools/src-designer %USERPROFILE%\Desktop\src-designer
```

---

**准备好后，开始第一步：下载工具到本地！**

```powershell
scp -r root@8.222.140.165:/home/admin/.openclaw/workspace/src/tools/src-designer %USERPROFILE%\Desktop\src-designer
```

---

*小艺 ⚡ LLC 设计工具 v1.1.0*
