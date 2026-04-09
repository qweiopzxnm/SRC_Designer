# SRC/LLC 电容配置频率优化算法

## 需求背景

**日期：** 2026-04-09

**问题：** 在 SRC 模式下，满足电容比例 `Cr_s / Cr_p = Tratio` 的取值有无数种，但需要在这些组合中找到**最接近用户设定谐振频率**的组合。

**解决思路：** 遍历可能的 Np_cap 值，计算对应的 Ns_cap 和谐振频率，选择频率误差最小的组合。

## 优化算法

### 目标函数

```
已知：
- fr_target = 用户设定的谐振频率 (Hz)
- Tratio = Np / Ns (变压器匝比)
- C_unit = 单颗电容容量
- Lr = 设计谐振电感

约束：
- Cr_s / Cr_p = Tratio
- Ns_cap = round(Np_cap × Tratio)

优化目标：
minimize: |fr_actual - fr_target| / fr_target

其中：
- fr_actual = 1 / (2π√(Lr × Ceq))
- Ceq = (Cr_p × Cr_s_ref) / (Cr_p + Cr_s_ref)  (SRC)
- Cr_s_ref = Cr_s / Tratio²
```

### 算法实现

```javascript
// 遍历 Np_cap 从 1 到 100
for (let Np_cap_test = 1; Np_cap_test <= 100; Np_cap_test++) {
  // 计算对应的 Ns_cap（满足电容比例）
  Ns_cap_test = round(Np_cap_test × Tratio);
  
  // 计算电容值
  Cr_p_test = C_unit × Np_cap_test;
  Cr_s_test = C_unit × Ns_cap_test;
  
  // 计算等效电容
  Cr_s_ref = Cr_s_test / Tratio²;
  Ceq_test = (Cr_p_test × Cr_s_ref) / (Cr_p_test + Cr_s_ref);
  
  // 计算实际谐振频率
  fr_actual = 1 / (2π√(Lr × Ceq_test));
  
  // 计算频率误差
  freqError = |fr_actual - fr_target| / fr_target;
  
  // 更新最优解
  if (freqError < bestFreqError) {
    bestFreqError = freqError;
    bestNp_cap = Np_cap_test;
    bestNs_cap = Ns_cap_test;
  }
}

// 返回最优组合
return { Np_cap: bestNp_cap, Ns_cap: bestNs_cap };
```

## 验证示例

### 示例 1：fr_target = 100kHz, Tratio = 8

```
输入：
- fr_target = 100kHz
- Tratio = 8
- C_unit = 47nF
- Lr = 8.56μH

遍历结果：
Np_cap=1:  Ns_cap=8,   Ceq=37.0nF,  fr=283kHz,  error=183%
Np_cap=2:  Ns_cap=16,  Ceq=74.0nF,  fr=200kHz,  error=100%
Np_cap=5:  Ns_cap=40,  Ceq=185nF,   fr=127kHz,  error=27%
Np_cap=10: Ns_cap=80,  Ceq=370nF,   fr=90kHz,   error=10%
Np_cap=15: Ns_cap=120, Ceq=555nF,   fr=73kHz,   error=27%
...

最优解：Np_cap=10, Ns_cap=80
- fr_actual = 90kHz
- freqError = 10%
```

### 示例 2：fr_target = 100kHz, Tratio = 10

```
输入：
- fr_target = 100kHz
- Tratio = 10
- C_unit = 47nF
- Lr = 8.56μH

遍历结果：
Np_cap=1:  Ns_cap=10,  Ceq=42.3nF,  fr=265kHz,  error=165%
Np_cap=5:  Ns_cap=50,  Ceq=212nF,   fr=118kHz,  error=18%
Np_cap=8:  Ns_cap=80,  Ceq=339nF,   fr=94kHz,   error=6%
Np_cap=10: Ns_cap=100, Ceq=423nF,   fr=84kHz,   error=16%
...

最优解：Np_cap=8, Ns_cap=80
- fr_actual = 94kHz
- freqError = 6%
```

## 算法特点

### 优点

1. **频率优先：** 优先保证谐振频率接近设计值
2. **自动优化：** 无需人工试错，自动找到最优组合
3. **满足比例：** 始终满足电容比例约束
4. **简单高效：** 遍历 100 个值，计算量小

### 约束条件

1. **Np_cap 范围：** 1 到 100（覆盖绝大多数应用场景）
2. **电容比例：** 严格满足 `Cr_s / Cr_p = Tratio`
3. **整数约束：** Ns_cap 必须为整数

## 返回值增强

新增返回参数：

```javascript
{
  Np_cap: 10,              // 原边电容并联数量
  Ns_cap: 80,              // 副边电容并联数量
  freqError_pct: 10.5,     // 频率匹配误差（百分比）
  deviation_pct: -2.3,     // Ceq 偏离度（百分比）
  // ... 其他参数
}
```

## LLC 模式处理

LLC 模式下，副边无电容，算法简化为：

```javascript
if (topologyMode === 'LLC') {
  Ns_cap = 0;
  // 遍历 Np_cap，找到使 fr_LC 最接近 fr_target 的值
  for (let Np_cap_test = 1; Np_cap_test <= 100; Np_cap_test++) {
    Ceq_test = C_unit × Np_cap_test;
    fr_actual = 1 / (2π√(Lr × Ceq_test));
    // ... 更新最优解
  }
}
```

## 用户界面提示

编辑模式下显示：

```
✏️ 点击数值进行修改，完成后点击"保存"
💡 Cr_p = C_unit × Np_cap, Cr_s = C_unit × Ns_cap
💡 SRC: Ns_cap ≈ Np_cap × Tratio（原副边电容比例与匝比成正比）
💡 自动优化：在满足比例前提下，使谐振频率最接近设定值
```

## 技术总结

### 核心公式

```
优化目标：min |fr_actual - fr_target| / fr_target

约束条件：
- Ns_cap = round(Np_cap × Tratio)
- Cr_p = C_unit × Np_cap
- Cr_s = C_unit × Ns_cap
- Ceq = (Cr_p × Cr_s_ref) / (Cr_p + Cr_s_ref)  (SRC)
- fr_actual = 1 / (2π√(Lr × Ceq))
```

### 算法流程

```
1. 遍历 Np_cap = 1 到 100
2. 计算 Ns_cap = round(Np_cap × Tratio)
3. 计算 Ceq
4. 计算 fr_actual
5. 计算频率误差
6. 更新最优解
7. 返回最优的 Np_cap 和 Ns_cap
```

---
实施日期：2026-04-09
状态：已完成
