# SRC 模式原副边电容比例规则

## 需求变更

**日期：** 2026-04-09

**变更前：**
- SRC 模式：原副边电容相等（Cr_p = Cr_s）
- 即：Ns_cap = Np_cap

**变更后：**
- SRC 模式：原副边电容比例与变压器匝比成正比
- 即：`Cr_s / Cr_p ≈ Tratio = Np / Ns`
- 推导：`Ns_cap ≈ Np_cap × Tratio`

## 技术原理

### 为什么需要这个比例？

在 SRC 串联谐振变换器中，原副边电容都参与谐振。为了使原副边的**容抗比例与匝比匹配**，需要满足：

```
Cr_s / Cr_p = Tratio = Np / Ns
```

**物理意义：**
- 副边电容反射到原边：`Cr_s_ref = Cr_s / Tratio²`
- 当 `Cr_s = Cr_p × Tratio` 时：`Cr_s_ref = (Cr_p × Tratio) / Tratio² = Cr_p / Tratio`
- 这使得原副边电容的**阻抗变换**与变压器匝比一致

### 电容比例推导

```
目标：Cr_s / Cr_p = Tratio

由于：Cr_p = C_unit × Np_cap
      Cr_s = C_unit × Ns_cap

因此：(C_unit × Ns_cap) / (C_unit × Np_cap) = Tratio
      Ns_cap / Np_cap = Tratio
      Ns_cap = Np_cap × Tratio
```

## 实现方案

### 1. src-calculator.js 修正

```javascript
calculateActpara(dsn, C_unit_nF, L_step_uH, Lm_uH, topologyMode = 'SRC') {
  const Tratio = Np / Ns;
  
  // ... 计算 Np_cap ...
  
  // 副边电容并联数量：
  if (topologyMode === 'LLC') {
    Ns_cap = 0;  // LLC 副边无电容
  } else {
    // SRC 模式：原副边电容比例与匝比成正比
    const Ns_cap_exact = Np_cap * Tratio;
    Ns_cap = Math.round(Ns_cap_exact);  // 取最接近的整数
    Cr_s_nF = C_unit_nF * Ns_cap;
  }
  
  // ... 后续计算 ...
}
```

### 2. app.js 修正

```javascript
saveAndRecalculate() {
  // ... 获取参数 ...
  
  if (this.topologyMode === 'LLC') {
    Ns_cap = 0;
  } else {
    // SRC 模式：默认 Ns_cap = round(Np_cap × Tratio)
    const Ns_cap_exact = Np_cap * Tratio;
    Ns_cap = Math.round(Ns_cap_exact);
    
    // 允许用户手动修改
    const Ns_cap_user = parseInt(document.getElementById('act-Ns_cap').textContent);
    if (!isNaN(Ns_cap_user) && Ns_cap_user > 0) {
      Ns_cap = Ns_cap_user;
    }
    
    Cr_s_nF = C_unit_nF * Ns_cap;
  }
}
```

## 验证示例

### 示例 1：Tratio = 8

```
输入：
- Np = 32, Ns = 4 → Tratio = 8
- C_unit = 47nF
- 计算得 Np_cap = 10

原副边电容计算：
- Ns_cap = round(10 × 8) = 80
- Cr_p = 47 × 10 = 470nF
- Cr_s = 47 × 80 = 3760nF
- Cr_s / Cr_p = 3760 / 470 = 8.0 = Tratio ✓

等效电容：
- Cr_s_ref = 3760 / 64 = 58.75nF
- Ceq = (470 × 58.75) / (470 + 58.75) = 27,612 / 528.75 = 52.2nF
```

### 示例 2：Tratio = 10

```
输入：
- Np = 40, Ns = 4 → Tratio = 10
- C_unit = 47nF
- 计算得 Np_cap = 6

原副边电容计算：
- Ns_cap = round(6 × 10) = 60
- Cr_p = 47 × 6 = 282nF
- Cr_s = 47 × 60 = 2820nF
- Cr_s / Cr_p = 2820 / 282 = 10.0 = Tratio ✓

等效电容：
- Cr_s_ref = 2820 / 100 = 28.2nF
- Ceq = (282 × 28.2) / (282 + 28.2) = 7,952 / 310.2 = 25.6nF
```

## 用户界面提示

编辑模式下显示提示：
```
✏️ 点击数值进行修改，完成后点击"保存"
💡 Cr_p = C_unit × Np_cap, Cr_s = C_unit × Ns_cap
💡 SRC: Ns_cap ≈ Np_cap × Tratio（原副边电容比例与匝比成正比）
```

## 与 LLC 模式的对比

| 特性 | SRC | LLC |
|------|-----|-----|
| 原边电容 Cr_p | ✓ 参与谐振 | ✓ 参与谐振 |
| 副边电容 Cr_s | ✓ **Cr_s = Cr_p × Tratio** | ✗ 无 (0) |
| Ns_cap 计算 | `round(Np_cap × Tratio)` | `0` |
| Ceq 计算 | `(Cr_p × Cr_s_ref) / (Cr_p + Cr_s_ref)` | `Cr_p` |

## 修改文件

1. **src-calculator.js**
   - `calculateActpara()`: 修改 Ns_cap 计算逻辑

2. **app.js**
   - `saveAndRecalculate()`: 修改 Ns_cap 计算逻辑
   - `toggleActParamsEdit()`: 更新提示信息

## 技术总结

**核心公式：**
```
SRC 模式：Ns_cap = round(Np_cap × Tratio)
         Cr_s = C_unit × Ns_cap
         Cr_s / Cr_p = Tratio
```

**物理意义：**
- 原副边电容比例与变压器匝比成正比
- 使得原副边的容抗变换与变压器匝比一致
- 优化谐振特性，提高变换器性能

---
实施日期：2026-04-09
状态：已完成
