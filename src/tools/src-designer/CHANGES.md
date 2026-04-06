# 更新日志 - LLC 设计/验证工具

## 2026-04-03 功能更新

### 1. 设计页简化 (index.html, app.js)

**删除的功能：**
- ❌ 删除"导出 PLECS 参数"按钮 (`btn-plecs`)
- ❌ 删除"运行 PLECS 仿真"按钮 (`btn-simulate`)
- ❌ 删除 `exportPlecsParams()` 函数
- ❌ 删除 `runPlecsSimulation()` 函数
- ❌ 删除 `showPlecsResults()` 函数
- ❌ 删除 PLECS 仿真结果显示面板

**保留的功能：**
- ✅ 计算功能
- ✅ 重置功能
- ✅ 切换到验证页按钮

---

### 2. 验证页新增功能 (verify.html, verify.js)

#### 2.1 MOSFET 模型导入

**新增 UI 元素：**
- 🔌 "导入原边 MOSFET 模型"按钮 (`btn-import-mos-pri`)
- 🔌 "导入副边 MOSFET 模型"按钮 (`btn-import-mos-sec`)

**功能说明：**
- 用户点击按钮后可浏览本地目录选择模型文件
- 支持 `.plecs`, `.xml`, `.json` 格式
- 文件路径自动保存到 localStorage
- 导入成功后显示提示信息

**数据存储：**
```javascript
mosfetModels: {
  pri: null,  // 原边 MOSFET 模型路径
  sec: null   // 副边 MOSFET 模型路径
}
```

---

#### 2.2 热仿真功能

**新增 UI 元素：**
- 🔥 热仿真开关 (`thermal-sim-enable`)
- 🌡️ Tvj 输入框 (`tvj-input`)，单位℃，默认值 130

**功能说明：**
- 开关开启：调用 `SRC_backup_thermal` 模型进行热仿真
- 开关关闭：调用 `SRC_backup` 模型进行标准仿真
- Tvj 参数可自定义，默认 130℃
- 设置自动保存到 localStorage

**数据存储：**
```javascript
thermalSettings: {
  enabled: false,  // 热仿真开关
  Tvj: 130         // 结温 (℃)
}
```

---

#### 2.3 verify_input.json 结构更新

**新增字段：**
```json
{
  "frozenParams": {
    "Cr_p": ...,
    "Cr_s": ...,
    "Lr": ...,
    "Lm": ...,
    "Np": ...,
    "Ns": ...,
    "Np_cap": ...,  // 原边电容并联颗数
    "Ns_cap": ...   // 副边电容并联颗数
  },
  "mosfetModels": {
    "pri": "path/to/pri/model.plecs",
    "sec": "path/to/sec/model.plecs"
  },
  "thermalSettings": {
    "enabled": true,
    "Tvj": 130
  },
  ...
}
```

---

### 3. MATLAB 仿真脚本更新 (simulate_plecs_direct_multi.m)

**新增功能：**
1. 读取 `mosfetModels` 和 `thermalSettings` 字段
2. 根据热仿真开关选择模型：
   - `SRC_backup` (标准仿真)
   - `SRC_backup_thermal` (热仿真)
3. 设置 Thermal Description Search Path：
   - 原边 MOSFET 模型路径 → FETD-FETD3
   - 副边 MOSFET 模型路径 → FETD4-FETD7
4. 热仿真模式下传递 Tvj 参数到 PLECS 模型

**代码示例：**
```matlab
% 根据热仿真开关选择模型
if thermalSettings.enabled
    model_name = 'SRC_backup_thermal';
    fprintf('🔥 Thermal Simulation Enabled (Tvj = %.1f°C)\n', thermalSettings.Tvj);
else
    model_name = 'SRC_backup';
    fprintf('ℹ️ Standard Simulation (Thermal disabled)\n');
end

% 设置 MOSFET 模型路径
if ~isempty(mosfetModels.pri)
    [priDir, ~, ~] = fileparts(mosfetModels.pri);
    plecs('set', [model_name '/Electrical'], 'ThermalDescriptionSearchPath', priDir);
end

% 设置 Tvj 参数
if thermalSettings.enabled
    plecs('set', [model_name '/Parameters'], 'Tvj', thermalSettings.Tvj);
end
```

---

### 4. 文件清单

| 文件 | 修改内容 |
|------|----------|
| `index.html` | 删除仿真相关按钮和面板 |
| `app.js` | 删除仿真相关函数 |
| `verify.html` | 新增 MOSFET 导入按钮、热仿真开关、Tvj 输入框 |
| `verify.js` | 新增模型导入、热仿真设置、数据持久化 |
| `simulate_plecs_direct_multi.m` | 支持模型路径和热仿真参数 |

---

### 5. 使用说明

#### 导入 MOSFET 模型
1. 点击"导入原边 MOSFET 模型"或"导入副边 MOSFET 模型"按钮
2. 选择本地模型文件（.plecs/.xml/.json）
3. 导入成功后显示文件路径
4. 路径自动保存，下次打开页面时恢复

#### 启用热仿真
1. 勾选"热仿真"开关
2. 设置 Tvj 值（默认 130℃）
3. 点击"开始仿真"
4. 脚本自动调用 `SRC_backup_thermal` 模型并传递 Tvj 参数

#### 模型映射
- **FETD-FETD3**: 原边 MOSFET（4 个开关管）
- **FETD4-FETD7**: 副边 MOSFET（4 个开关管）

---

### 6. 注意事项

1. **浏览器安全限制**：由于浏览器安全限制，只能获取文件名而非完整路径。如需完整路径，请在 PLECS 中手动配置。

2. **模型文件位置**：模型文件应放置在 PLECS 可访问的目录中。

3. **热仿真模型**：确保 `SRC_backup_thermal` 模型已正确配置 Tvj 参数接口。

4. **数据持久化**：MOSFET 模型路径和热仿真设置保存在 localStorage 中，清除浏览器缓存会丢失这些数据。

5. **兼容性**：旧的 verify_input.json 文件不包含 `mosfetModels` 和 `thermalSettings` 字段，仿真时将使用默认值（模型路径为空，热仿真禁用）。
