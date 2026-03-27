# 故障排查指南

## 🔴 批处理文件报错（中文乱码）

### 问题描述
运行 `start-plecs-server.bat` 时出现：
```
'XXX' 不是内部或外部命令
```

### 原因
Windows 批处理文件使用了 UTF-8 编码，但中文系统默认使用 GBK 编码。

### 解决方案

#### 方案 1：使用 PowerShell 脚本（推荐）
```powershell
.\start-plecs-server.ps1
```

#### 方案 2：使用简化版批处理
双击 `run.bat`

#### 方案 3：直接运行
```cmd
node plecs-server.js
```

#### 方案 4：转换编码（如果必须使用原批处理）
1. 用记事本打开 `start-plecs-server.bat`
2. 点击"文件" → "另存为"
3. 编码选择 **"ANSI"**
4. 保存覆盖原文件

---

## 🔴 Node.js 未找到

### 错误信息
```
Error: Node.js not found
```

### 解决方案

1. **安装 Node.js**：
   - 访问：https://nodejs.org/
   - 下载 LTS 版本（v20.x）
   - 安装时勾选"Add to PATH"

2. **验证安装**：
   ```cmd
   node --version
   npm --version
   ```

3. **重启命令行**：
   安装后需要关闭并重新打开命令行窗口

---

## 🔴 MATLAB 未找到

### 错误信息
```
Warning: MATLAB not found in PATH
```

### 解决方案

#### 临时方案（当前窗口有效）
```cmd
set PATH=%PATH%;C:\Program Files\MATLAB\R2024a\bin
```

#### 永久方案（添加到系统环境变量）

1. 右键"此电脑" → "属性"
2. "高级系统设置" → "环境变量"
3. 在"系统变量"中找到 `Path`
4. 点击"编辑" → "新建"
5. 添加：`C:\Program Files\MATLAB\R2024a\bin`
6. 确定保存
7. **重启命令行**

#### 验证
```cmd
where matlab
```
应显示 MATLAB 路径

---

## 🔴 模型文件未找到

### 错误信息
```
Error: SRC.plecs not found
```

### 解决方案

1. **确认文件位置**：
   ```cmd
   dir SRC.plecs
   dir *.plecs
   ```

2. **复制模型文件**：
   - 找到你的 `SRC.plecs` 文件
   - 复制到：`%USERPROFILE%\Desktop\src-designer\`

3. **检查文件名**：
   - 确认文件名确实是 `SRC.plecs`
   - 如果是 `SRC.slx` 或其他名称，需要修改脚本

---

## 🔴 端口已被占用

### 错误信息
```
Error: listen EADDRINUSE: address already in use :::3000
```

### 解决方案

#### 方案 1：关闭占用进程
```cmd
netstat -ano | findstr :3000
taskkill /PID <进程 ID> /F
```

#### 方案 2：修改端口
编辑 `plecs-server.js`，找到：
```javascript
const PORT = 3000;
```
改为：
```javascript
const PORT = 3001;
```

---

## 🔴 仿真超时

### 错误信息
```
仿真执行失败：Timeout
```

### 解决方案

1. **检查 PLECS 模型**：
   - 模型是否能手动运行
   - 仿真时间是否过长（建议<10 秒）

2. **增加超时时间**：
   编辑 `plecs-server.js`，找到：
   ```javascript
   exec(matlabCmd, { timeout: 120000 }, ...
   ```
   改为更大的值（毫秒）：
   ```javascript
   exec(matlabCmd, { timeout: 300000 }, ...
   ```

---

## 🔴 I_Lrp 信号未找到

### 错误信息
```
Warning: I_Lrp data not found
```

### 解决方案

1. **检查 PLECS 模型**：
   - 确认有电流测量块
   - 确认连接到 `To Workspace` 块
   - 变量名设置为 `I_Lrp`

2. **检查仿真设置**：
   - 打开 PLECS → Simulation → Parameters
   - 确认"Save to workspace"已勾选
   - 确认输出格式为"Array"或"Timeseries"

---

## 🔴 健康检查失败

### 测试方法
浏览器访问：`http://localhost:3000/api/health`

### 期望结果
```json
{"status":"ok","message":"PLECS Server is running"}
```

### 如果失败

1. **检查服务器是否运行**：
   ```cmd
   netstat -ano | findstr :3000
   ```

2. **检查防火墙**：
   - Windows 防火墙可能阻止
   - 允许 Node.js 通过防火墙

3. **重启服务器**：
   ```cmd
   Ctrl+C 停止
   node plecs-server.js 重新启动
   ```

---

## 📞 其他问题

### 查看日志
服务器运行时的输出会显示在命令行窗口，错误信息通常包含：
- MATLAB 错误堆栈
- 文件路径信息
- 参数设置详情

### 手动测试 MATLAB 脚本
```matlab
cd C:\Users\...\Desktop\src-designer
run_plecs_simulation
```

### 联系支持
提供以下信息：
1. 完整的错误信息（截图）
2. 服务器日志输出
3. MATLAB 版本
4. PLECS 版本
5. Node.js 版本

---

*小艺 ⚡ LLC 设计工具*
