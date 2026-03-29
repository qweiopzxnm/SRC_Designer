# LLC 设计工具 - 简化版

## 文件结构

```
src-designer/
├── index.html              # 主界面（HTML）
├── app.js                  # 界面交互逻辑
├── src-calculator.js       # LLC 计算算法
├── styles.css              # 样式
├── simulate-direct.bat     # 运行仿真（双击）
├── simulate_plecs_direct.m # MATLAB 仿真脚本
├── SRC_backup.plecs        # PLECS 模型（需自备）
├── plecs_input.json        # 仿真输入（自动生成）
└── plecs_output.json       # 仿真输出（自动生成）
```

## 核心文件功能

### 1. index.html
- 输入参数表单（Vin、Vo、Po、fr、Np、Ns、Q、Lm 等）
- 结果显示区域（设计参数、实际参数、PLECS 仿真结果）
- 按钮：计算、导出 PLECS 参数、运行仿真、重置

### 2. app.js
- `calculate()` - 执行 LLC 计算
- `exportPlecsParams()` - 导出 plecs_input.json
- `runPlecsSimulation()` - 读取 plecs_output.json 并显示结果
- `showPlecsResults()` - 更新界面显示仿真数据

### 3. src-calculator.js
- `calculateDsnpara()` - 计算设计参数（Dsnpara）
- `calculateActpara()` - 计算实际选定参数（Actpara）
- 包含完整的 LLC 谐振变换器设计算法

### 4. simulate_plecs_direct.m
- 读取 plecs_input.json
- 初始化 PLECS 模型（SRC_backup）
- 运行仿真并提取数据（最后 1/3 稳态）
- 计算 ZVS 状态、开关管电流、谐振腔参数
- 输出 plecs_output.json

### 5. simulate-direct.bat
- 检查文件是否存在
- 调用 MATLAB 运行仿真
- 显示简单结果提示

## 使用流程

1. **计算** → 填写参数 → 点击"🔧 计算"
2. **导出** → 点击"🔌 导出 PLECS 参数" → 保存 plecs_input.json
3. **仿真** → 双击 simulate-direct.bat → 等待完成
4. **查看** → 点击"▶️ 运行 PLECS 仿真" → 选择 plecs_output.json

## 修改指南

### 修改显示内容
编辑 `index.html` 中的 `<div id="plecs-results">` 部分
- 添加/删除 `<div class="result-item">`
- 修改 `id="res-XXX"` 或 `id="zvs-XXX"` 等

### 修改数据解析
编辑 `app.js` 中的 `showPlecsResults()` 函数
- 确保 `data.xxx` 与 JSON 字段匹配
- 确保 `getElementById` 与 HTML ID 匹配

### 修改仿真逻辑
编辑 `simulate_plecs_direct.m`
- 信号提取：`steadyState.ZVSCheck1 = allValues(1:6, :)`
- 谐振腔：`steadyState.ResonantCheck = allValues(13:17, :)`
- JSON 输出：`write_json()` 函数

## 注意事项

1. PLECS 必须手动开启（RPC 通信需要）
2. SRC_backup.plecs 路径需与 MATLAB 脚本一致
3. 模型 Mux 信号顺序必须与脚本切片一致
