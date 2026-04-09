# 工况 Charge/Discharge 模式功能

## 需求描述

**日期：** 2026-04-09

**需求：** 为验证页的每个仿真工况添加 Charge/Discharge 开关，构建仿真参数时为每个工况新增 `ChargeMode` 参数。

**参数定义：**
- `ChargeMode = 1`: Charge（充电）模式
- `ChargeMode = 0`: Discharge（放电）模式

## 实现方案

### 1. UI 修改 (verify.html)

#### 表头更新

```html
<div class="condition-row header">
  <div class="row-label">工况 # | Condition</div>
  <div class="row-label">Vin (V)</div>
  <div class="row-label">Vref (V)</div>
  <div class="row-label">Po (W)</div>
  <div class="row-label">Rload (Ω)</div>
  <div class="row-label">Mode | 模式</div>  <!-- 新增 -->
  <div class="row-label">操作 | Action</div>
</div>
```

#### CSS 样式更新

```css
.condition-row {
  display: grid;
  grid-template-columns: 70px 1fr 1fr 1fr 1fr 110px 50px;  /* 新增 Mode 列 */
  gap: 10px;
  /* ... */
}
```

### 2. JavaScript 逻辑 (verify.js)

#### 添加工况时添加下拉选择框

```javascript
addCondition() {
  const defaults = { Vin: 810, Vref: 680, Po: 11000, Rload: 42, ChargeMode: 1 };
  
  row.innerHTML = `
    <div class="row-label">工况 #${conditionId}</div>
    <div><input type="number" id="vin-${conditionId}" value="${defaults.Vin}"></div>
    <div><input type="number" id="vref-${conditionId}" value="${defaults.Vref}"></div>
    <div><input type="number" id="po-${conditionId}" value="${defaults.Po}"></div>
    <div><input type="number" id="rload-${conditionId}" value="${defaults.Rload}"></div>
    <div>
      <select id="charge-mode-${conditionId}">
        <option value="1" ${defaults.ChargeMode === 1 ? 'selected' : ''}>⚡ Charge</option>
        <option value="0" ${defaults.ChargeMode === 0 ? 'selected' : ''}>🔋 Discharge</option>
      </select>
    </div>
    <div><button class="btn-remove">删除</button></div>
  `;
}
```

#### 收集工况数据时读取 ChargeMode

```javascript
collectConditions() {
  rows.forEach((row, index) => {
    const id = row.dataset.conditionId;
    
    // 读取 Charge/Discharge 模式
    const chargeModeSelect = document.getElementById(`charge-mode-${id}`);
    const chargeMode = chargeModeSelect ? parseInt(chargeModeSelect.value) : 1;
    
    const condition = {
      id: index + 1,
      Vref: vref,
      Vin: vin,
      Po: po,
      Rload: rload,
      ChargeMode: chargeMode,  // 1 = Charge, 0 = Discharge
      // ... 其他参数
    };
    
    this.conditions.push(condition);
  });
}
```

#### 导入配置时恢复 ChargeMode

```javascript
loadConfig() {
  config.conditions.forEach((cond) => {
    this.addCondition();
    const row = document.querySelector(`[data-condition-id="${this.conditionCounter}"]`);
    if (row) {
      // ... 加载其他参数
      // 加载 ChargeMode
      const chargeModeSelect = document.getElementById(`charge-mode-${this.conditionCounter}`);
      if (chargeModeSelect && cond.ChargeMode !== undefined) {
        chargeModeSelect.value = cond.ChargeMode.toString();
      }
    }
  });
}
```

### 3. 构建仿真参数 (verify_input.json)

```javascript
buildParams() {
  const simulationData = {
    TopologyChange: topologyChange,
    conditions: this.conditions,  // 包含 ChargeMode
    // ... 其他参数
  };
  
  // 生成 verify_input.json
  const jsonStr = JSON.stringify(simulationData, null, 2);
  // ... 下载文件
}
```

## 数据结构

### 工况对象

```javascript
{
  id: 1,                    // 工况编号
  Vref: 680,                // 输出电压 (V)
  Vin: 810,                 // 输入电压 (V)
  Po: 11000,                // 输出功率 (W)
  Rload: 42,                // 负载电阻 (Ω)
  ChargeMode: 1,            // 1=Charge, 0=Discharge
  PriDB1: 200,              // 原边非移相死区 (ns)
  PriDB2: 200,              // 原边移相死区 (ns)
  PriPS2: 0,                // 原边移相 (ns)
  SecDB_NonPS: 200,         // 副边非移相死区 (ns)
  SecDB_PS: 200,            // 副边移相死区 (ns)
  SecPS: 0                  // 副边移相 (ns)
}
```

## 用户界面

### 工况列表

```
┌─────────┬────────┬────────┬────────┬─────────┬─────────────┬────────┐
│ 工况 #  │ Vin(V) │ Vref(V)│ Po(W)  │ Rload(Ω)│ Mode | 模式 │ 操作   │
├─────────┼────────┼────────┼────────┼─────────┼─────────────┼────────┤
│ 工况 #1 │  810   │  680   │ 11000  │   42    │ ⚡ Charge ▼ │ [删除] │
│ 工况 #2 │  400   │  680   │ 11000  │   42    │ 🔋 Disch. ▼ │ [删除] │
│ 工况 #3 │  800   │  680   │ 11000  │   42    │ ⚡ Charge ▼ │ [删除] │
└─────────┴────────┴────────┴────────┴─────────┴─────────────┴────────┘
```

### Charge/Discharge 下拉框

```
┌─────────────────┐
│ ⚡ Charge      ▼│  ← ChargeMode = 1
└─────────────────┘

┌─────────────────┐
│ 🔋 Discharge  ▼│  ← ChargeMode = 0
└─────────────────┘
```

## verify_input.json 示例

```json
{
  "TopologyChange": 0,
  "conditions": [
    {
      "id": 1,
      "Vref": 680,
      "Vin": 810,
      "Po": 11000,
      "Rload": 42,
      "ChargeMode": 1,
      "PriDB1": 200,
      "PriDB2": 200,
      "PriPS2": 0,
      "SecDB_NonPS": 200,
      "SecDB_PS": 200,
      "SecPS": 0
    },
    {
      "id": 2,
      "Vref": 680,
      "Vin": 400,
      "Po": 11000,
      "Rload": 42,
      "ChargeMode": 0,
      "PriDB1": 200,
      "PriDB2": 200,
      "PriPS2": 0,
      "SecDB_NonPS": 200,
      "SecDB_PS": 200,
      "SecPS": 0
    }
  ],
  "timestamp": "2026-04-09T06:40:00.000Z"
}
```

## 修改文件清单

1. **verify.html**
   - 表头：新增 "Mode | 模式" 列
   - CSS：更新 `grid-template-columns` 为 `70px 1fr 1fr 1fr 1fr 110px 50px`

2. **verify.js**
   - `addCondition()`: 添加 Charge/Discharge 下拉框
   - `collectConditions()`: 读取 ChargeMode 值
   - `loadConfig()`: 导入时恢复 ChargeMode
   - `importAllConfig()`: 导入时恢复 ChargeMode

## 技术总结

### 核心功能

- ✅ 为每个工况添加独立的 Charge/Discharge 开关
- ✅ 构建仿真参数时包含 `ChargeMode` 参数
- ✅ 保存/导入配置时保持 ChargeMode 状态
- ✅ 默认值为 Charge 模式（ChargeMode = 1）

### 参数映射

| UI 显示 | ChargeMode 值 | 说明 |
|--------|--------------|------|
| ⚡ Charge | 1 | 充电模式 |
| 🔋 Discharge | 0 | 放电模式 |

---
实施日期：2026-04-09
状态：已完成
