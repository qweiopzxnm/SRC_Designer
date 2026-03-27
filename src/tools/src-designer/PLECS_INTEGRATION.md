# PLECS 仿真集成指南

## 概述

本文档说明如何将 PLECS 仿真与 LLC 设计工具集成，实现仿真参数的写入和结果的读取。

## 集成方案

### 方案一：JSON 文件交换（推荐）

**原理**：通过 JSON 文件作为中间数据格式，LLC 设计工具输出参数，PLECS 读取并仿真，然后输出结果。

#### 1. 数据结构定义

**输入参数文件** (`plecs_input.json`)：
```json
{
  " Vin_max": 810,
  "Vo_nom": 680,
  "Po": 11000,
  "fr": 130000,
  "Np": 24,
  "Ns": 23,
  "Lr": 42.5e-6,
  "Cr": 35.2e-9,
  "Lm": 400e-6,
  "Q": 0.62,
  "fs_min": 156000
}
```

**输出结果文件** (`plecs_output.json`)：
```json
{
  "timestamp": "2026-03-27T12:00:00Z",
  "efficiency": 96.5,
  "peak_efficiency": 97.2,
  "max_temp": 65.3,
  "voltage_ripple": 2.1,
  "current_ripple": 0.8,
  "waveforms": {
    "vds": [/* 数组数据 */],
    "ids": [/* 数组数据 */],
    "vout": [/* 数组数据 */]
  }
}
```

#### 2. PLECS 模型设置

在 PLECS 模型中添加 MATLAB Script 块或使用 PlecsCommand 接口：

```matlab
% 读取输入参数
inputData = jsonread('plecs_input.json');

% 设置模型参数
set_param(gcs, 'Lr', num2str(inputData.Lr));
set_param(gcs, 'Cr', num2str(inputData.Cr));
set_param(gcs, 'Lm', num2str(inputData.Lm));
% ... 其他参数

% 运行仿真
sim('llc_model');

% 提取结果
results = struct(
    'efficiency', calculate_efficiency(),
    'peak_efficiency', max(efficiency_curve),
    'waveforms', struct(
        'vds', vds_data,
        'ids', ids_data,
        'vout', vout_data
    )
);

% 写入输出文件
jsonwrite('plecs_output.json', results);
```

#### 3. LLC 设计工具集成

在 `app.js` 中添加仿真接口：

```javascript
async runPlecsSimulation() {
  const params = this.getInputParams();
  const dsn = LLCCalculator.calculateDsnpara(params);
  const act = LLCCalculator.calculateActpara(dsn, params.C_unit_nF, params.L_step_uH, params.Lm_uH);
  
  // 准备输入数据
  const plecsInput = {
    Vin_max: dsn.Vin_max,
    Vo_nom: dsn.Vo_nom,
    Po: dsn.Po,
    fr: dsn.fr,
    Lr: act.Lr_p,
    Cr: act.Ceq,
    Lm: act.Lm,
    Np: dsn.Np,
    Ns: dsn.Ns
  };
  
  // 写入输入文件（需要后端支持）
  await fetch('/api/plecs/write-input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plecsInput)
  });
  
  // 触发仿真
  await fetch('/api/plecs/run', { method: 'POST' });
  
  // 读取结果
  const response = await fetch('/api/plecs/read-output');
  const results = await response.json();
  
  return results;
}
```

---

### 方案二：PLECS Standalone 命令行

**原理**：使用 PLECS Standalone 的命令行接口进行批处理仿真。

#### 1. 创建仿真脚本

创建 `run_simulation.m`：
```matlab
function run_simulation(input_file, output_file)
    % 读取输入
    inputData = jsonread(input_file);
    
    % 打开模型
    plecs_open_model('llc_converter.plecs');
    
    % 设置参数
    plecs_set_param('Lr', num2str(inputData.Lr));
    plecs_set_param('Cr', num2str(inputData.Cr));
    plecs_set_param('Lm', num2str(inputData.Lm));
    
    % 运行仿真
    plecs_simulate();
    
    % 获取结果
    [time, signals] = plecs_get_signals({'efficiency', 'vout', 'iout'});
    
    % 保存结果
    results = struct(
        'time', time,
        'efficiency', signals.efficiency,
        'vout', signals.vout,
        'iout', signals.iout
    );
    jsonwrite(output_file, results);
    
    % 关闭模型
    plecs_close_model();
end
```

#### 2. 命令行调用

```bash
# 从 LLC 设计工具调用
plecs --script run_simulation.m plecs_input.json plecs_output.json
```

---

### 方案三：PLECS Coder + 实时仿真

**原理**：使用 PLECS Coder 生成 C 代码，集成到实时仿真系统中。

#### 1. 生成 C 代码

在 PLECS Coder 中配置：
- 目标平台：Generic C Code
- 接口：定义输入/输出端口

#### 2. 集成到 LLC 工具

```javascript
// 使用 WebAssembly 运行生成的代码
const Module = await PlecsModel();
Module.setValue('Lr', act.Lr_p);
Module.setValue('Cr', act.Ceq);
Module.setValue('Lm', act.Lm);
Module.simulate();
const efficiency = Module.getValue('efficiency');
```

---

## 推荐实施步骤

### 阶段一：文件交换（1-2 天）

1. ✅ 在 LLC 设计工具中增加"导出 PLECS 参数"按钮
2. ✅ 创建标准 JSON 格式定义
3. ✅ 在 PLECS 模型中添加参数读取脚本
4. ✅ 测试参数传递准确性

### 阶段二：自动化仿真（3-5 天）

1. 搭建后端服务（Node.js/Python）
2. 实现 PLECS 命令行调用接口
3. 在 LLC 工具中添加"运行仿真"按钮
4. 实现结果自动读取和显示

### 阶段三：深度集成（1-2 周）

1. 波形数据可视化（示波器视图）
2. 参数扫描优化（自动寻找最优参数）
3. 仿真结果对比（设计值 vs 仿真值）
4. 生成综合报告

---

## 你需要做的准备

### 1. PLECS 模型准备

- [ ] 确保模型参数可通过外部脚本设置
- [ ] 在模型中添加必要的测量点（效率、电压、电流等）
- [ ] 测试手动参数修改是否生效

### 2. 数据接口定义

告诉我你希望传递哪些参数，例如：
- 输入：Lr, Cr, Lm, Np, Ns, Vin, Vout, Po, fs...
- 输出：效率、波形数据、应力值、温度...

### 3. 运行环境

- [ ] PLECS Standalone 许可证
- [ ] MATLAB（如果使用脚本接口）
- [ ] 确定运行平台（Windows/Linux/Mac）

---

## 下一步

**请告诉我**：

1. 你的 PLECS 模型当前如何设置参数？（手动/脚本/MATLAB 接口）
2. 你希望从仿真中获取哪些具体结果？（效率曲线？波形数据？应力分析？）
3. 你希望如何触发仿真？（手动点击？自动批量？）
4. PLECS 模型文件在哪里？我可以帮你分析并编写集成代码。

提供这些信息后，我可以为你编写具体的集成代码和配置脚本。
