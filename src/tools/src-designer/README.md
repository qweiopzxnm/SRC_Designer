# LLC 设计工具 - 简化版

## 文件结构

```
src-designer/
├── index.html              # 设计页 - 单点设计计算
├── verify.html             # 验证页 - 多工况仿真验证（新增）
├── app.js                  # 设计页交互逻辑
├── verify.js               # 验证页交互逻辑（新增）
├── src-calculator.js       # LLC 计算算法
├── styles.css              # 样式
├── simulate-direct.bat     # 单工况仿真（双击）
├── verify-sim.bat          # 多工况仿真（新增）
├── simulate_plecs_direct.m # 单工况 MATLAB 脚本
├── simulate_plecs_direct_multi.m  # 多工况 MATLAB 脚本（新增）
├── SRC_backup.plecs        # PLECS 模型（需自备）
├── plecs_input.json        # 单工况输入（自动生成）
├── plecs_output.json       # 单工况输出（自动生成）
├── verify_input.json       # 多工况输入（从验证页导出）
└── verify_output.json      # 多工况输出（自动生成）
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

### 6. verify.html (新增)
- 冻结参数显示区（从设计页同步的谐振参数）
- 工况列表（动态添加/删除）
- 仿真结果表格（多工况汇总）
- 按钮：更新冻结参数、加工况、保存、开始仿真、导出 JSON/CSV

### 7. verify.js (新增)
- `syncFrozenParams()` - 从 localStorage 同步设计页参数
- `addCondition()` / `removeCondition()` - 管理工况列表
- `runSimulation()` - 导出 verify_input.json 并引导用户仿真
- `loadSimulationResults()` - 读取 verify_output.json
- `displayResults()` - 显示多工况结果表格
- `exportJSON()` / `exportCSV()` - 导出结果

### 8. simulate_plecs_direct_multi.m (新增)
- 读取 verify_input.json（包含 frozenParams 和 conditions 数组）
- 循环执行多工况仿真
- 汇总所有工况结果到 verify_output.json
- 支持 ZVS 状态判定、开关管参数、谐振腔参数提取

## 使用流程

### 设计页 (index.html) - 单点设计

1. **计算** → 填写参数 → 点击"🔧 计算"
2. **导出** → 点击"🔌 导出 PLECS 参数" → 保存 plecs_input.json
3. **仿真** → 双击 simulate-direct.bat → 等待完成
4. **查看** → 点击"▶️ 运行 PLECS 仿真" → 选择 plecs_output.json

### 验证页 (verify.html) - 多工况验证

1. **同步参数** → 点击"🔄 更新冻结参数"（从设计页同步 Cr_p, Cr_s, Lr, Lm, Np, Ns）
2. **添加工况** → 点击"➕ 加工况"添加多个仿真工况（Vin, Vref, Po, Rload）
3. **保存工况** → 点击"💾 保存工况"
4. **导出输入** → 点击"▶️ 开始仿真" → 保存 verify_input.json 到 src-designer 目录
5. **运行仿真** → 双击 verify-sim.bat → 等待 MATLAB 完成所有工况
6. **导入结果** → 选择 verify_output.json → 查看汇总表格
7. **导出结果** → 可导出 JSON 或 CSV 格式

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
