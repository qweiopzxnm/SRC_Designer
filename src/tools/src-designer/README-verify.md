# LLC 验证工具使用说明

## 快速开始

### 1. 设计参数（设计页）

1. 打开 `index.html`（设计页）
2. 输入设计参数并点击"计算"
3. 计算结果自动保存，包含：
   - 励磁电感 Lm
   - 谐振电感 Lr
   - 变压器匝数 Np:Ns
   - 谐振电容 Cr_p, Cr_s

### 2. 设置工况（验证页）

1. 打开 `verify.html`（验证页）
2. 点击"🔄 更新冻结参数"同步设计页的参数
3. 设置仿真工况（可添加多个）：
   - 输入电压 Vin (V)
   - 输出电压 Vref (V)
   - 输出功率 Po (W)
   - 负载 Rload (Ω) - 自动计算

### 3. 导出仿真输入

点击"💾 保存工况"按钮，自动下载 `verify_input.json` 文件。

### 4. 运行仿真

**方式一：双击批处理文件**
```
双击 verify-sim.bat
```

**方式二：命令行执行**
```bash
cd src-designer
verify-sim.bat
```

**前提条件：**
- MATLAB 已添加到系统 PATH
- PLECS 工具箱已安装
- `verify_input.json` 在 `src-designer` 目录下

### 5. 导入仿真结果

1. 仿真完成后生成 `verify_output.json`
2. 在验证页点击"▶️ 开始仿真"
3. 选择 `verify_output.json` 文件
4. 查看仿真结果表格

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `index.html` | 设计页 - 参数计算 |
| `verify.html` | 验证页 - 多工况仿真 |
| `verify-sim.bat` | 仿真批处理脚本 |
| `simulate_plecs_direct_multi.m` | MATLAB 仿真脚本 |
| `verify_input.json` | 仿真输入文件（从验证页导出） |
| `verify_output.json` | 仿真输出文件（MATLAB 生成） |

---

## 常见问题

### Q: 双击 verify-sim.bat 闪退
**A:** 检查以下几点：
1. MATLAB 是否已添加到系统 PATH
2. `verify_input.json` 是否存在于同一目录
3. 右键 → 以管理员身份运行

### Q: 验证页显示"未找到设计页参数"
**A:** 
1. 先在设计页 (`index.html`) 输入参数并点击"计算"
2. 确保使用同一浏览器打开设计页和验证页
3. 点击"🔄 更新冻结参数"重新同步

### Q: MATLAB 报错 "PLECS not found"
**A:** 
1. 确认 PLECS 工具箱已安装
2. 检查 `simulate_plecs_direct_multi.m` 中的路径配置
3. 确保 PLECS 模型 `SRC_backup.plecs` 存在

---

## 仿真输出说明

### verify_output.json 包含：

- **success**: 仿真是否成功
- **numConditions**: 工况数量
- **frozenParams**: 冻结的谐振参数
- **conditions**: 各工况结果数组
  - `Vo_avg`: 平均输出电压
  - `Irms`: 谐振电流有效值
  - `Ipeak`: 谐振电流峰值
  - `zvsAllOk`: ZVS 状态（true/false）
  - `zvsStatus`: 各开关管 ZVS 详情
  - `switchDetails`: 开关管电流参数
  - `resonantCheck`: 谐振腔参数（RMS/Max/Min）

---

*最后更新：2026-03-31*
