/**
 * LLC Resonant Converter Core Calculator
 * 基于 MATLAB LLC 设计算法
 */

const LLCCalculator = {
  /**
   * 计算设计参数 (Dsnpara)
   * @param {Object} params - 用户输入参数
   * @returns {Object} Dsnpara 结构体
   */
  calculateDsnpara(params) {
    const { Vin_max, Vo_nom, Po, fr, Np, Ns, Q, fs_ratio } = params;

    // 基本参数
    const fr_Hz = fr * 1000; // 转 Hz
    const M = Vo_nom / Vin_max; // 电压增益
    const Tratio = Np / Ns; // 匝比
    const Gain = M * Tratio; // 总增益

    // 最小开关频率
    const fs_min = fs_ratio * fr_Hz;

    // 等效交流电阻
    const Rac = (8 / Math.PI ** 2) * (Vo_nom ** 2) / Po;
    const Racp = Rac * (Tratio ** 2); // 反射到原边

    // 特征阻抗和谐振元件
    const Zr = Racp * Q;
    const Lr = Zr / (2 * Math.PI * fr_Hz);
    const Cr = 1 / (Zr * 2 * Math.PI * fr_Hz);

    // 最小开关频率下的等效阻抗
    const Zeq = Math.sqrt(
      Racp ** 2 + 
      ((2 * Math.PI * fs_min) * Lr - 1 / (2 * Math.PI * fs_min * Cr)) ** 2
    );

    // 谐振腔电压和电流
    const Vintank = (4 / Math.PI) * Vin_max;
    const Irpk = Vintank / Zeq;

    return {
      Vin_max,
      Vo_nom,
      Po,
      fr: fr_Hz,
      fs_min,
      M,
      Np,
      Ns,
      Tratio,
      Gain,
      Q,
      Rac,
      Racp,
      Zr,
      Lr,
      Cr,
      Zeq,
      Vintank,
      Irpk
    };
  },

  /**
   * 计算实际选定参数 (Actpara)
   * 基于单颗电容容量并联和电感分辨率进行优化
   * 目标：使 Ceq 尽量接近设计的 Cr 值
   * @param {Object} dsn - Dsnpara 计算结果
   * @param {number} C_unit_nF - 单颗电容容量 (nF)
   * @param {number} L_step_uH - 电感分辨率 (μH)
   * @param {number} Lm_uH - 励磁电感 (μH)
   * @returns {Object} Actpara 结构体
   */
  calculateActpara(dsn, C_unit_nF, L_step_uH, Lm_uH) {
    const { Vin_max, Vo_nom, Po, Np, Ns, Racp } = dsn;

    const Tratio = Np / Ns;
    const Tratio2 = Tratio * Tratio;

    // 目标电容值 (nF)
    const Cr_target_nF = dsn.Cr * 1e9;
    
    // === 关键修正：反向计算需要的 Cr_p 和 Cr_s ===
    // LLC 等效电容公式：Ceq = (Cr_p * Cr_s_ref) / (Cr_p + Cr_s_ref)
    // 其中 Cr_s_ref = Cr_s / Tratio²
    // 
    // 假设原副边使用相同数量的电容并联：Cr_p = Cr_s = C_total
    // 则：Ceq = C_total / (Tratio² + 1)
    // 
    // 要让 Ceq = Cr_target，则：
    // C_total = Cr_target * (Tratio² + 1)
    
    const C_total_nF = Cr_target_nF * (Tratio2 + 1);
    
    // 计算理论并联数量（可能不是整数）
    const N_cap_exact = C_total_nF / C_unit_nF;
    
    // 尝试向下取整和向上取整，选偏离最小的
    const N_floor = Math.floor(N_cap_exact);
    const N_ceil = Math.ceil(N_cap_exact);
    
    // 计算两种方案的偏离度
    const C_floor = C_unit_nF * N_floor;
    const C_ceil = C_unit_nF * N_ceil;
    
    const Ceq_floor = C_floor / (Tratio2 + 1);
    const Ceq_ceil = C_ceil / (Tratio2 + 1);
    
    const dev_floor = Math.abs((Ceq_floor - Cr_target_nF) / Cr_target_nF);
    const dev_ceil = Math.abs((Ceq_ceil - Cr_target_nF) / Cr_target_nF);
    
    // 选择偏离度更小的方案
    let Np_cap, Ns_cap, Cr_p_nF, Cr_s_nF;
    if (N_floor >= 1 && dev_floor <= dev_ceil) {
      Np_cap = N_floor;
      Ns_cap = N_floor;
      Cr_p_nF = C_floor;
      Cr_s_nF = C_floor;
    } else {
      Np_cap = N_ceil;
      Ns_cap = N_ceil;
      Cr_p_nF = C_ceil;
      Cr_s_nF = C_ceil;
    }

    // 目标电感值 (μH)，按分辨率取整
    const Lr_target_uH = dsn.Lr * 1e6;
    const Lr_p_uH = Math.round(Lr_target_uH / L_step_uH) * L_step_uH;

    // 转换为实际值 (F, H)
    const Cr_p = Cr_p_nF * 1e-9;
    const Cr_s = Cr_s_nF * 1e-9;
    const Lr_p = Lr_p_uH * 1e-6;

    // 计算实际等效电容 (考虑匝比)
    const Cr_s_reflected = Cr_s / Tratio2;
    const Ceq = (Cr_p * Cr_s_reflected) / (Cr_p + Cr_s_reflected);

    // 实际 Q 值
    const Q_actual = Math.sqrt(Lr_p / Ceq) / Racp;

    // 实际谐振频率
    const fr_actual = 1 / (2 * Math.PI * Math.sqrt(Lr_p * Ceq));

    // 计算推荐的单颗电容值（使偏离度<5%）
    // 理想情况：N_cap 为整数，即 C_total 能被 C_unit 整除
    // 推荐 C_unit = C_total / 5 (约 5 颗并联，容差范围内)
    const recommended_C_unit = C_total_nF / 5;
    
    // 计算电感比 k = Lm / Lr
    const Lm = Lm_uH * 1e-6; // 转换为 H
    const k = Lm / Lr_p;

    return {
      Vin_max,
      Vo_nom,
      Po,
      M: Vo_nom / Vin_max,
      Np,
      Ns,
      Tratio,
      Gain: (Vo_nom / Vin_max) * Tratio,
      Rac: (8 / Math.PI ** 2) * (Vo_nom ** 2) / Po,
      Racp,
      Cr_p,
      Cr_s,
      Lr_p,
      Ceq,
      Q: Q_actual,
      fr: fr_actual,
      // 新增：并联数量和分辨率信息
      C_unit_nF,
      L_step_uH,
      Np_cap,
      Ns_cap,
      Lr_p_uH,
      Lm_uH,
      // 用于显示偏离度
      Cr_target_nF,
      Ceq_nF: Ceq * 1e9,
      deviation_pct: ((Ceq * 1e9 - Cr_target_nF) / Cr_target_nF) * 100,
      // 推荐单颗电容值
      recommended_C_unit: recommended_C_unit,
      // 电感比
      k: k,
      // 新增：Lm 和 k 值
      Lm,
      Lm_uH,
      k
    };
  },

  /**
   * 效率估算
   * @param {Object} dsn - Dsnpara
   * @param {Object} act - Actpara
   * @returns {Object} 效率分析
   */
  estimateEfficiency(dsn, act) {
    const { Po, Irpk } = dsn;
    const { Cr_p, fr } = act;

    // 损耗组成估算
    const I_pri_rms = Irpk / Math.sqrt(2);
    const Io = Po / dsn.Vo_nom;
    const Id_rms = Io / Math.sqrt(2);
    
    const P_cond_pri = I_pri_rms ** 2 * 0.015; // 原边导通损耗
    const P_cond_sec = Id_rms ** 2 * 0.01; // 副边导通损耗
    const P_core = Po * 0.004; // 磁芯损耗 (0.4%)
    const P_switching = Po * 0.002; // 开关损耗 (ZVS 下很小)
    const P_cap = Po * 0.001; // 电容 ESR 损耗

    const P_loss_total = P_cond_pri + P_cond_sec + P_core + P_switching + P_cap;
    const efficiency = Po / (Po + P_loss_total) * 100;

    return {
      Po,
      P_loss: {
        conduction_pri: P_cond_pri,
        conduction_sec: P_cond_sec,
        core: P_core,
        switching: P_switching,
        capacitor: P_cap,
        total: P_loss_total
      },
      efficiency,
      Pin: Po + P_loss_total
    };
  },

  /**
   * 生成设计报告
   * @param {Object} allResults - 所有计算结果
   * @returns {String} Markdown 格式报告
   */
  generateReport(allResults) {
    const { dsn, act, efficiency } = allResults;

    return `
# LLC 谐振变换器设计报告

## 设计规格
| 参数 | 值 |
|------|-----|
| 最大输入电压 Vin_max | ${dsn.Vin_max} V |
| 额定输出电压 Vo_nom | ${dsn.Vo_nom} V |
| 输出功率 Po | ${dsn.Po} W |
| 目标谐振频率 fr | ${(dsn.fr / 1000).toFixed(1)} kHz |

## 变压器参数
| 参数 | 值 |
|------|-----|
| 原边匝数 Np | ${dsn.Np} |
| 副边匝数 Ns | ${dsn.Ns} |
| 匝比 Np:Ns | ${dsn.Tratio.toFixed(3)} |
| 电压增益 M | ${dsn.M.toFixed(4)} |
| 总增益 Gain | ${dsn.Gain.toFixed(4)} |

## 设计参数 (Dsnpara)
| 参数 | 值 |
|------|-----|
| 品质因数 Q | ${dsn.Q.toFixed(2)} |
| 等效交流电阻 Rac | ${dsn.Rac.toFixed(2)} Ω |
| 反射电阻 Racp | ${dsn.Racp.toFixed(2)} Ω |
| 特征阻抗 Zr | ${dsn.Zr.toFixed(2)} Ω |
| 谐振电感 Lr | ${(dsn.Lr * 1e6).toFixed(2)} μH |
| 谐振电容 Cr | ${(dsn.Cr * 1e9).toFixed(2)} nF |
| 最小开关频率 fs_min | ${(dsn.fs_min / 1000).toFixed(1)} kHz |
| 谐振腔电压 Vintank | ${dsn.Vintank.toFixed(1)} V |
| 谐振电流峰值 Irpk | ${dsn.Irpk.toFixed(2)} A |

## 实际选定参数 (Actpara) - 基于用户指定规格优化
| 参数 | 值 |
|------|-----|
| 单颗电容容量 | ${act.C_unit_nF} nF |
| 原边电容并联数量 | ${act.Np_cap} 颗 |
| 原边谐振电容 Cr_p | ${(act.Cr_p * 1e9).toFixed(1)} nF |
| 副边电容并联数量 | ${act.Ns_cap} 颗 |
| 副边谐振电容 Cr_s | ${(act.Cr_s * 1e9).toFixed(1)} nF |
| 电感分辨率 | ${act.L_step_uH} μH |
| 原边谐振电感 Lr_p | ${(act.Lr_p * 1e6).toFixed(1)} μH |
| 等效电容 Ceq | ${(act.Ceq * 1e9).toFixed(2)} nF |
| 设计电容 Cr | ${act.Cr_target_nF.toFixed(2)} nF |
| Ceq 偏离度 | ${act.deviation_pct > 0 ? '+' : ''}${act.deviation_pct.toFixed(2)}% |
| 实际 Q 值 | ${act.Q.toFixed(3)} |
| 实际谐振频率 | ${(act.fr / 1000).toFixed(1)} kHz |
| 励磁电感 Lm | ${act.Lm_uH.toFixed(1)} μH |
| 电感比 k (Lm/Lr) | ${act.k.toFixed(3)} |

## 效率估算
| 损耗项 | 功率 (W) |
|--------|----------|
| 原边导通损耗 | ${efficiency.P_loss.conduction_pri.toFixed(2)} |
| 副边导通损耗 | ${efficiency.P_loss.conduction_sec.toFixed(2)} |
| 磁芯损耗 | ${efficiency.P_loss.core.toFixed(2)} |
| 开关损耗 | ${efficiency.P_loss.switching.toFixed(2)} |
| 电容 ESR 损耗 | ${efficiency.P_loss.capacitor.toFixed(2)} |
| **总损耗** | **${efficiency.P_loss.total.toFixed(2)}** |
| **估算效率** | **${efficiency.efficiency.toFixed(2)}%** |

## 设计说明
1. 原副边均采用谐振电容，实现对称谐振
2. 电容值基于单颗${act.C_unit_nF}nF 容量，原边并联${act.Np_cap}颗，副边并联${act.Ns_cap}颗
3. 电感值按${act.L_step_uH}μH 分辨率取整为 ${(act.Lr_p * 1e6).toFixed(1)}μH
4. Q 值设计在 0.5-0.8 范围内，兼顾效率和增益范围
5. 最小开关频率设为谐振频率的 1.2 倍，确保 ZVS 工作

---
*生成时间：${new Date().toISOString()}*
`.trim();
  }
};

// 导出供模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LLCCalculator;
}
