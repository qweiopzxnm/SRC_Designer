# PLECS 仿真使用说明

## 当前方案：手动运行（最简单）

由于自动集成复杂且容易出错，我们采用**最简单的手动方案**。

---

## 文件清单

```
src-designer/
├── index.html              ← 双击打开 LLC 工具
├── run-sim.bat             ← 双击运行仿真
├── run_plecs_simulation.m  ← MATLAB 脚本
└── SRC.plecs               ← 你的 PLECS 模型
```

---

## 使用步骤

### 1️⃣ 下载文件
```powershell
scp -r root@8.222.140.165:/home/admin/.openclaw/workspace/src/tools/src-designer %USERPROFILE%\Desktop\src-designer
```

### 2️⃣ 复制模型
将你的 `SRC.plecs` 文件复制到：
```
C:\Users\m1774\Desktop\src-designer\
```

### 3️⃣ 导出参数
1. 双击 `index.html` 打开 LLC 工具
2. 设置参数，点击"自动优化计算"
3. 点击"🔌 导出 PLECS 参数"
4. 会生成 `plecs_input.json` 文件

### 4️⃣ 运行仿真
**双击** `run-sim.bat` 文件

MATLAB 会自动：
- 读取 `plecs_input.json`
- 设置模型参数
- 运行 PLECS 仿真
- 提取 `I_Lrp` 电流
- 保存结果到 `plecs_output.json`

### 5️⃣ 查看结果
打开 `plecs_output.json` 查看：
```json
{
  "success": true,
  "Lrms": 12.345,
  "Ipeak": 17.456,
  "simulation_time_sec": 2.34
}
```

---

## 常见问题

### Q: 提示找不到 SRC.plecs
**A:** 确保 `SRC.plecs` 文件和 `run-sim.bat` 在同一文件夹

### Q: 提示找不到 MATLAB
**A:** 运行：
```cmd
set PATH=%PATH%;C:\Program Files\MATLAB\R2024a\bin
```

### Q: 仿真报错
**A:** 检查：
1. PLECS 模型能否手动运行
2. 参数名是否匹配（Lr, Crp, Crs, Lm, Np, Ns, Vin, Vref）
3. 是否有 `I_Lrp` 信号输出

---

## 下一步

如果这个方案可行，后续可以：
1. 手动对比设计值和仿真值
2. 批量测试不同工况
3. 根据需要再考虑自动化

---

**当前版本：v1.3.0 - 手动仿真版**
