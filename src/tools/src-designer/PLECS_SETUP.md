# PLECS 仿真集成配置指南

## 📋 文件清单

确保以下文件都在同一目录：
```
src-designer/
├── index.html              # LLC 设计工具主页面
├── app.js                  # 应用逻辑（已更新）
├── plecs-server.js         # ⭐ 新增：Node.js 后端服务
├── run_plecs_simulation.m  # ⭐ 新增：MATLAB 仿真脚本
├── SRC.plecs               # 你的 PLECS 模型（需要确认）
└── PLECS_SETUP.md          # 本文件
```

---

## 🚀 快速启动（3 步）

### 步骤 1：准备 PLECS 模型

1. **将 `SRC.plecs` 文件复制到 LLC 工具目录**：
   ```
   源位置：你的 PLECS 模型位置
   目标位置：/home/admin/.openclaw/workspace/src/tools/src-designer/SRC.plecs
   ```

2. **确认模型参数名称**（与截图一致）：
   - `Lr` = 28e-6
   - `Crp` = 110e-9
   - `Crs` = 110e-9
   - `Lm` = 400e-6
   - `Np` = 24
   - `Ns` = 23
   - `Vin` = 810
   - `Vref` = 850
   - `Po` = 11000

3. **确认测量信号**：
   - 谐振电流信号名：`I_Lrp`
   - 确保仿真后该变量保存在 MATLAB workspace

### 步骤 2：启动后端服务

打开终端，运行：

```bash
cd /home/admin/.openclaw/workspace/src/tools/src-designer
node plecs-server.js
```

看到以下输出表示成功：
```
========================================
🔌 PLECS 仿真服务器已启动
📡 监听端口：http://localhost:3000
📂 工作目录：/home/admin/.openclaw/workspace/src/tools/src-designer
========================================
```

**保持此终端运行！**

### 步骤 3：运行仿真

1. 打开浏览器访问 LLC 设计工具
2. 设置参数并点击"🔧 自动优化计算"
3. 点击"▶️ 运行 PLECS 仿真"
4. 等待仿真完成，查看结果

---

## 🔧 详细配置

### Node.js 环境检查

```bash
# 检查 Node.js 是否安装
node --version

# 应显示 v14.x 或更高版本
```

### MATLAB 环境检查

```bash
# 检查 MATLAB 是否可执行
matlab --version

# 或在 MATLAB 中检查 PLECS 工具箱
which plecs_open_model
```

### PLECS 模型要求

模型文件 `SRC.plecs` 需要满足：

1. **参数在 Workspace 中定义**：
   - 打开 PLECS → Simulation → Parameters → Workspace
   - 确认 Lr, Crp, Crs, Lm, Np, Ns, Vin, Vref, Po 等参数存在

2. **信号输出到 Workspace**：
   - 使用 `To Workspace` 块将 `I_Lrp` 输出
   - 或使用 Scope 后保存数据

3. **仿真时间设置**：
   - 建议 0.01-0.1 秒（根据开关频率调整）
   - 确保包含足够多的稳态周期

---

##  故障排查

### 问题 1：服务器无法启动

**错误**：`Error: listen EADDRINUSE`

**解决**：
```bash
# 检查端口占用
lsof -i :3000

# 或更换端口（编辑 plecs-server.js）
const PORT = 3001;  // 改为其他端口
```

### 问题 2：MATLAB 无法执行

**错误**：`matlab: command not found`

**解决（Linux）**：
```bash
# 添加 MATLAB 到 PATH
export PATH=$PATH:/usr/local/MATLAB/R2024a/bin

# 或在 plecs-server.js 中指定完整路径
const matlabCmd = '/usr/local/MATLAB/R2024a/bin/matlab -batch ...';
```

**解决（Windows）**：
```batch
REM 在 plecs-server.js 中修改
const matlabCmd = 'matlab -batch ...';
REM MATLAB 应该已在 PATH 中
```

### 问题 3：模型文件找不到

**错误**：`找不到模型文件：SRC.plecs`

**解决**：
```bash
# 确认文件存在
ls -la /home/admin/.openclaw/workspace/src/tools/src-designer/SRC.*

# 如果文件名不同，修改 run_plecs_simulation.m
model_name = '你的模型文件名';  # 不带扩展名
```

### 问题 4：I_Lrp 信号未找到

**警告**：`未找到 I_Lrp 数据，使用估算值`

**解决**：
1. 在 PLECS 模型中添加 `To Workspace` 块
2. 连接到谐振电感电流测量点
3. 变量名设置为 `I_Lrp`
4. 保存格式选择 `Array` 或 `Timeseries`

---

## 📊 多工况评估（后续功能）

准备好后，可以实现：

### 1. 参数扫描
```javascript
// 扫描不同负载
const loadPoints = [0.2, 0.4, 0.6, 0.8, 1.0]; // 20%-100%
for (const load of loadPoints) {
  const Po = ratedPower * load;
  await runSimulation(Po);
}
```

### 2. 效率曲线
- 自动扫描多个负载点
- 绘制效率 vs 负载曲线
- 找出峰值效率点

### 3. 蒙特卡洛分析
- 考虑元件容差
- 统计性能分布

---

## 📥 下载命令

从服务器下载整个工具目录到本地：

### Windows (PowerShell)
```powershell
scp -r root@8.222.140.165:/home/admin/.openclaw/workspace/src/tools/src-designer %USERPROFILE%\Desktop\src-designer
```

### Windows (CMD)
```cmd
scp -r root@8.222.140.165:/home/admin/.openclaw/workspace/src/tools/src-designer C:\Users\%USERNAME%\Desktop\src-designer
```

### Linux / macOS
```bash
scp -r root@8.222.140.165:/home/admin/.openclaw/workspace/src/tools/src-designer ~/Desktop/src-designer
```

---

## 🎯 测试清单

启动前确认：

- [ ] `SRC.plecs` 文件在正确位置
- [ ] Node.js 已安装（`node --version`）
- [ ] MATLAB 已安装（`matlab --version`）
- [ ] PLECS 工具箱可用
- [ ] 后端服务已启动（`node plecs-server.js`）
- [ ] 浏览器可以访问 LLC 工具

测试步骤：

1. [ ] 打开 LLC 设计工具
2. [ ] 设置参数
3. [ ] 点击"自动优化计算"
4. [ ] 点击"运行 PLECS 仿真"
5. [ ] 等待仿真完成
6. [ ] 查看 Irms 结果
7. [ ] 点击"对比设计值"

---

## 📞 支持

遇到问题？检查以下文件：

- `README.md` - 工具使用说明
- `QUICKSTART.md` - 快速开始指南
- `PLECS_INTEGRATION.md` - 详细集成方案
- `CHANGELOG.md` - 版本更新日志

---

*小艺 ⚡ LLC 设计工具 v1.1.0*
