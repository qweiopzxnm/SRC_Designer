# SRC/LLC 拓扑计算逻辑修正

## 问题背景

2026-04-09 发现切换到 SRC 模式时电容计算错误。经分析，是我**错误理解了 SRC 和 LLC 的拓扑差异**。

## 正确的拓扑差异

### SRC (Series Resonant Converter) - 串联谐振变换器

```
原边：Vin --- Lr --- Cr_p --- 变压器原边 --- GND
                          |
副边：变压器副边 --- Cr_s --- 整流桥 --- Co(滤波) --- Rload
```

**关键特性：**
- **原边和副边电容都参与谐振**
- 副边电容 Cr_s 反射到原边：`Cr_s_ref = Cr_s / Tratio²`
- 等效电容（串联）：`Ceq = (Cr_p × Cr_s_ref) / (Cr_p + Cr_s_ref)`
- 谐振频率：`fr_LC = 1 / (2π√(Lr × Ceq))`

### LLC (LLC Resonant Converter) - LLC 谐振变换器

```
原边：Vin --- Lr --- 变压器原边 --- GND
              |           |
             Cr_p        Lm(励磁)
             
副边：变压器副边 --- 整流桥 --- Co(滤波) --- Rload
       (无谐振电容)
```

**关键特性：**
- **只有原边电容 Cr_p 参与谐振**
- 副边**无谐振电容**（只有输出滤波电容）
- 等效电容：`Ceq = Cr_p`
- 串联谐振频率：`fr_LC = 1 / (2π√(Lr × Cr_p))`
- 并联谐振频率：`fr_LLC = 1 / (2π√((Lr + Lm) × Cr_p))`

## 核心区别

| 特性 | SRC | LLC |
|------|-----|-----|
| 原边电容 Cr_p | ✓ 参与谐振 | ✓ 参与谐振 |
| 副边电容 Cr_s | ✓ **参与谐振** | ✗ **无** |
| Ceq 计算 | `(Cr_p × Cr_s_ref) / (Cr_p + Cr_s_ref)` | `Cr_p` |
| 励磁电感 Lm | 不参与谐振 | ✓ 与 Cr_p 并联谐振 |

## 修正方案

### 1. src-calculator.js 修正

```javascript
calculateActpara(dsn, C_unit_nF, L_step_uH, Lm_uH, topologyMode = 'SRC') {
  const Tratio = Np / Ns;
  const Tratio2 = Tratio * Tratio;
  const Cr_target_nF = Cr * 1e9;
  
  // 计算原边电容并联数量
  const Np_cap = Math.round(Cr_target_nF / C_unit_nF);
  const Cr_p_nF = C_unit_nF * Np_cap;
  const Cr_p = Cr_p_nF * 1e-9;
  
  // 副边电容：
  // - LLC: 副边无谐振电容
  // - SRC: 副边电容参与谐振
  let Ns_cap, Cr_s_nF, Cr_s;
  if (topologyMode === 'LLC') {
    Ns_cap = 0;
    Cr_s_nF = 0;
    Cr_s = 0;
  } else {
    // SRC 模式：副边电容参与谐振
    Ns_cap = Np_cap;
    Cr_s_nF = C_unit_nF * Ns_cap;
    Cr_s = Cr_s_nF * 1e-9;
  }
  
  // 计算等效电容
  let Ceq;
  if (topologyMode === 'LLC') {
    Ceq = Cr_p;  // LLC: Ceq = Cr_p
  } else {
    // SRC: Ceq = (Cr_p × Cr_s_ref) / (Cr_p + Cr_s_ref)
    const Cr_s_reflected = Cr_s / Tratio2;
    Ceq = (Cr_p * Cr_s_reflected) / (Cr_p + Cr_s_reflected);
  }
  
  // 偏离度计算
  const deviation_pct = ((Ceq * 1e9 - Cr_target_nF) / Cr_target_nF) * 100;
  
  return { Cr_p, Cr_s, Ceq, Np_cap, Ns_cap, deviation_pct, ... };
}
```

### 2. app.js UI 显示修正

```javascript
updateUI() {
  const isLLC = this.topologyMode === 'LLC';
  
  // 副边电容显示
  if (isLLC) {
    // LLC: 副边无电容
    document.getElementById('act-Ns_cap').textContent = 'NaN';
    document.getElementById('act-Cr_s').textContent = 'NaN';
  } else {
    // SRC: 副边电容参与谐振
    document.getElementById('act-Ns_cap').textContent = act.Ns_cap || 1;
    const Cr_s_nF = (act.C_unit_nF || 47) * (act.Ns_cap || 1);
    document.getElementById('act-Cr_s').textContent = Cr_s_nF.toFixed(1);
  }
}
```

### 3. saveAndRecalculate 修正

```javascript
saveAndRecalculate() {
  // 获取参数
  const Np_cap = parseInt(document.getElementById('act-Np_cap').textContent);
  
  // 副边电容
  let Cr_s, Cr_s_nF, Ns_cap;
  if (this.topologyMode === 'LLC') {
    Cr_s = 0;
    Cr_s_nF = 0;
    Ns_cap = 0;
  } else {
    // SRC: 副边电容参与谐振
    Ns_cap = Np_cap;
    Cr_s_nF = C_unit_nF * Ns_cap;
    Cr_s = Cr_s_nF * 1e-9;
  }
  
  // 等效电容
  let Ceq;
  if (this.topologyMode === 'LLC') {
    Ceq = Cr_p;
  } else {
    const Cr_s_reflected = Cr_s / Tratio2;
    Ceq = (Cr_p * Cr_s_reflected) / (Cr_p + Cr_s_reflected);
  }
}
```

### 4. verify.js 显示修正

```javascript
updateFrozenDisplay() {
  const isLLC = this.topologyMode === 'LLC';
  
  // 副边电容显示
  if (isLLC) {
    document.getElementById('frozen-Crs').textContent = 'NaN';
    document.getElementById('frozen-Ns-cap').textContent = 'NaN';
  } else {
    document.getElementById('frozen-Crs').textContent = fp.Cr_s ? fp.Cr_s.toFixed(1) : '-';
    document.getElementById('frozen-Ns-cap').textContent = fp.Ns_cap || '-';
  }
}
```

## 验证测试

### 测试用例：SRC 模式

```
输入：Vin_max=800V, Vo_nom=48V, Po=11000W, fr=100kHz
      Np=32, Ns=4, Q=0.5, C_unit=47nF, L_step=10μH, Lm=500μH
      Tratio = 32/4 = 8

设计参数：
- Cr = 98.5nF
- Lr = 25.7μH

实际参数（修正后）：
- Np_cap = 2 → Cr_p = 94nF
- Ns_cap = 2 → Cr_s = 94nF
- Cr_s_reflected = 94 / 8² = 94 / 64 = 1.47nF
- Ceq = (94 × 1.47) / (94 + 1.47) = 138.2 / 95.47 ≈ 1.45nF
- deviation = (1.45 - 98.5) / 98.5 × 100% ≈ -98.5%  ← 仍然有问题！
```

**发现问题：** SRC 模式的 Ceq 计算仍然有误。问题在于**设计参数 Cr 的计算假设**。

## 根本问题分析

SRC 模式的设计参数 Cr 是基于**原边电容**计算的，但实际等效电容 Ceq 是原副边电容的串联值。这导致：

1. 设计时：Cr = 98.5nF（目标原边电容）
2. 实际：Cr_p = 94nF, Cr_s_ref = 1.47nF
3. Ceq = 1.45nF << Cr（偏离极大）

**正确理解：**
- SRC 的设计 Cr 应该是指**等效电容 Ceq**，而不是原边电容 Cr_p
- 或者，设计时应该考虑变比反射，直接计算需要的 Cr_p 和 Cr_s

## 进一步修正方向

需要确认设计算法中 Cr 的定义：
- 如果 Cr 是 Ceq（等效电容），则需要反推 Cr_p 和 Cr_s
- 如果 Cr 是 Cr_p（原边电容），则偏离度计算需要调整

**建议：** 检查原始 MATLAB 算法或设计规范，确认 Cr 的物理意义。

---
修正日期：2026-04-09
状态：待进一步验证设计参数定义
