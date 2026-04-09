# SRC/LLC 拓扑电容计算修正

## 核心认知

### 设计参数 Cr 的物理意义

| 拓扑 | Cr 的含义 | Ceq 计算 |
|------|----------|---------|
| **SRC** | Ceq（等效电容） | `(Cr_p × Cr_s_ref) / (Cr_p + Cr_s_ref)` |
| **LLC** | Cr_p（原边电容） | `Cr_p` |

### SRC 模式的关键公式

对于 SRC，副边电容反射到原边：
```
Cr_s_ref = Cr_s / Tratio²
```

当原副边使用相同电容配置（Cr_p = Cr_s）时：
```
Ceq = (Cr_p × Cr_p/Tratio²) / (Cr_p + Cr_p/Tratio²)
    = Cr_p² / Tratio² / (Cr_p × (1 + 1/Tratio²))
    = Cr_p / (Tratio² + 1)
```

因此：
```
Cr_p = Ceq × (Tratio² + 1)
```

**这意味着：SRC 模式下，原边电容 Cr_p 需要是设计值 Cr 的 (Tratio² + 1) 倍！**

## 修正方案

### calculateActpara 函数修正

```javascript
calculateActpara(dsn, C_unit_nF, L_step_uH, Lm_uH, topologyMode = 'SRC') {
  const Tratio = Np / Ns;
  const Tratio2 = Tratio * Tratio;
  const Cr_target_nF = Cr * 1e9;  // 设计目标电容
  
  // ========== 关键修正 ==========
  // 计算目标原边电容 Cr_p_target
  let Cr_p_target_nF;
  if (topologyMode === 'LLC') {
    // LLC: Cr_p_target = Cr_target
    Cr_p_target_nF = Cr_target_nF;
  } else {
    // SRC: Cr_p_target = Cr_target × (Tratio² + 1)
    Cr_p_target_nF = Cr_target_nF * (Tratio2 + 1);
  }
  
  // 计算并联数量
  const N_cap_exact = Cr_p_target_nF / C_unit_nF;
  const Np_cap = Math.round(N_cap_exact);
  const Cr_p_nF = C_unit_nF * Np_cap;
  
  // 副边电容
  let Ns_cap, Cr_s_nF;
  if (topologyMode === 'LLC') {
    Ns_cap = 0;
    Cr_s_nF = 0;
  } else {
    // SRC: 副边电容与原边相同配置
    Ns_cap = Np_cap;
    Cr_s_nF = C_unit_nF * Ns_cap;
  }
  
  // 计算等效电容
  let Ceq;
  if (topologyMode === 'LLC') {
    Ceq = Cr_p;
  } else {
    const Cr_s_reflected = Cr_s / Tratio2;
    Ceq = (Cr_p * Cr_s_reflected) / (Cr_p + Cr_s_reflected);
  }
  
  // 偏离度：Ceq 相对于 Cr_target
  const deviation_pct = ((Ceq * 1e9 - Cr_target_nF) / Cr_target_nF) * 100;
  
  return { Cr_p, Cr_s, Ceq, Np_cap, Ns_cap, deviation_pct, ... };
}
```

## 验证测试

### 测试用例 1：SRC 模式

```
输入参数：
- Vin_max = 800V
- Vo_nom = 48V
- Po = 11000W
- fr = 100kHz
- Np = 32, Ns = 4 → Tratio = 8, Tratio² = 64
- Q = 0.5
- C_unit = 47nF

设计计算：
- Rac = 8/π² × 48² / 11000 = 0.168Ω
- Racp = 0.168 × 8² = 10.75Ω
- Zr = 10.75 × 0.5 = 5.38Ω
- Lr = 5.38 / (2π × 100k) = 8.56μH
- Cr = 1 / (5.38 × 2π × 100k) = 295.5nF  ← 这是 Ceq_target

实际参数计算（修正后）：
- Cr_p_target = 295.5 × (64 + 1) = 295.5 × 65 = 19,207nF
- N_cap_exact = 19207 / 47 = 408.7
- Np_cap = 409
- Cr_p = 47 × 409 = 19,223nF
- Ns_cap = 409
- Cr_s = 19,223nF
- Cr_s_ref = 19223 / 64 = 300.4nF
- Ceq = (19223 × 300.4) / (19223 + 300.4) = 5,773,000 / 19,523 = 295.7nF
- deviation = (295.7 - 295.5) / 295.5 × 100% = +0.07% ✓ 优秀！
```

### 测试用例 2：LLC 模式

```
输入参数：同上

设计计算：
- Cr = 295.5nF  ← 这是 Cr_p_target

实际参数计算：
- Cr_p_target = 295.5nF
- N_cap_exact = 295.5 / 47 = 6.29
- Np_cap = 6
- Cr_p = 47 × 6 = 282nF
- Ns_cap = 0
- Cr_s = 0
- Ceq = Cr_p = 282nF
- deviation = (282 - 295.5) / 295.5 × 100% = -4.57% ✓ 优秀！
```

## 修正文件清单

1. **src-calculator.js**
   - 更新文件头部注释，说明拓扑差异
   - `calculateActpara()`: 添加 Cr_p_target 计算，区分 SRC 和 LLC
   - 添加 Ceq 计算逻辑
   - 修正偏离度计算

2. **app.js**
   - `updateUI()`: 根据拓扑显示副边电容（LLC 显示 NaN，SRC 显示实际值）
   - `saveAndRecalculate()`: 根据拓扑计算 Cr_s 和 Ceq

3. **verify.js**
   - `updateFrozenDisplay()`: 根据拓扑显示副边电容

## 技术总结

### 关键认知修正

1. **设计参数 Cr 的含义因拓扑而异**
   - SRC: Cr = Ceq（等效电容）
   - LLC: Cr = Cr_p（原边电容）

2. **SRC 模式需要变比补偿**
   - Cr_p = Cr × (Tratio² + 1)
   - 这是因为副边电容反射到原边后变小了 Tratio² 倍

3. **偏离度计算统一基于 Ceq**
   - 无论哪种拓扑，偏离度都是 Ceq 相对于 Cr_target 的差异

### 公式汇总

| 参数 | SRC | LLC |
|------|-----|-----|
| Cr_p_target | `Cr × (Tratio² + 1)` | `Cr` |
| Cr_s | `Cr_p` | `0` |
| Ceq | `(Cr_p × Cr_s_ref) / (Cr_p + Cr_s_ref)` | `Cr_p` |
| deviation | `(Ceq - Cr) / Cr × 100%` | `(Cr_p - Cr) / Cr × 100%` |

---
修正日期：2026-04-09
状态：已修正并验证
