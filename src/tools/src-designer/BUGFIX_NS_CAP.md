# Bug 修复：副边电容计算错误

## 问题描述

用户修改实际选定参数时，**副边谐振电容值只会随着原边变化**，而不是按照公式 `Cr_s = C_unit × Ns_cap` 计算。

## Bug 根因

在 `saveAndRecalculate()` 函数中，副边电容并联数量 `Ns_cap` 被**强制等于原边并联数量 `Np_cap`**，没有从 UI 读取用户编辑的值：

```javascript
// ❌ 错误代码
if (this.topologyMode === 'LLC') {
  Cr_s = 0;
  Cr_s_nF = 0;
  Ns_cap = 0;
} else {
  Ns_cap = Np_cap;  // ← Bug：强制等于 Np_cap，忽略用户编辑的值
  Cr_s_nF = C_unit_nF * Ns_cap;
  Cr_s = Cr_s_nF * 1e-9;
}
```

## 修复方案

### 1. saveAndRecalculate() 函数修复

```javascript
// ✅ 修复后的代码
// 读取用户编辑的副边电容并联数量（SRC 模式）
// LLC 模式下副边无电容，Ns_cap = 0
let Ns_cap, Cr_s_nF, Cr_s;
if (this.topologyMode === 'LLC') {
  Ns_cap = 0;
  Cr_s_nF = 0;
  Cr_s = 0;
} else {
  // SRC 模式：从 UI 读取用户编辑的 Ns_cap
  const Ns_cap_text = document.getElementById('act-Ns_cap').textContent;
  Ns_cap = parseInt(Ns_cap_text) || Np_cap;  // 如果无效则使用 Np_cap
  Cr_s_nF = C_unit_nF * Ns_cap;  // 副边电容 = 电容分辨率 × 副边并联数量
  Cr_s = Cr_s_nF * 1e-9;
}
```

### 2. updateUI() 函数确认

确保 UI 显示也使用正确的计算公式：

```javascript
if (isLLC) {
  document.getElementById('act-Ns_cap').textContent = 'NaN';
  document.getElementById('act-Cr_s').textContent = 'NaN';
} else {
  document.getElementById('act-Ns_cap').textContent = act.Ns_cap || 1;
  // Cr_s = C_unit × Ns_cap
  const Cr_s_nF = (act.C_unit_nF || 47) * (act.Ns_cap || 1);
  document.getElementById('act-Cr_s').textContent = Cr_s_nF.toFixed(1);
}
```

## 修复验证

### 测试场景 1：SRC 模式，独立修改 Ns_cap

```
初始状态：
- C_unit = 47nF
- Np_cap = 10
- Ns_cap = 10
- Cr_p = 470nF
- Cr_s = 470nF

用户编辑 Ns_cap = 15：
- Np_cap 保持 = 10
- Ns_cap 更新 = 15  ← 修复后可以独立修改
- Cr_p = 47 × 10 = 470nF  ✓
- Cr_s = 47 × 15 = 705nF  ✓ 修复后正确计算
```

### 测试场景 2：SRC 模式，修改 C_unit

```
初始状态：
- C_unit = 47nF
- Np_cap = 10
- Ns_cap = 10
- Cr_p = 470nF
- Cr_s = 470nF

用户修改 C_unit = 56nF：
- C_unit 更新 = 56nF
- Np_cap 保持 = 10
- Ns_cap 保持 = 10
- Cr_p = 56 × 10 = 560nF  ✓
- Cr_s = 56 × 10 = 560nF  ✓ 正确计算
```

### 测试场景 3：LLC 模式

```
LLC 模式：
- Ns_cap = 0
- Cr_s = 0
- UI 显示：NaN  ✓
```

## 修改文件

- `app.js`:
  - `saveAndRecalculate()`: 从 UI 读取 `act-Ns_cap`，而不是强制等于 `Np_cap`
  - `updateUI()`: 确认使用 `Cr_s = C_unit × Ns_cap` 计算

## 技术说明

### 可编辑字段列表

```javascript
const actFields = ['act-Np', 'act-Ns', 'act-C_unit', 'act-Np_cap', 'act-Ns_cap', 'act-Lr_p'];
```

`act-Ns_cap` 在可编辑字段列表中，用户可以独立修改副边电容并联数量。

### 电容计算公式

| 参数 | 公式 | 说明 |
|------|------|------|
| Cr_p | `C_unit × Np_cap` | 原边谐振电容 |
| Cr_s | `C_unit × Ns_cap` | 副边谐振电容 |
| Cr_s_ref | `Cr_s / Tratio²` | 副边电容反射到原边 |
| Ceq (SRC) | `(Cr_p × Cr_s_ref) / (Cr_p + Cr_s_ref)` | 等效电容 |
| Ceq (LLC) | `Cr_p` | 等效电容 |

## 修复日期

2026-04-09
