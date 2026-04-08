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
    const { Vin_max, Vo_nom, Po, fr, Np, Ns, Q, fs_ratio, Lm_uH, topologyMode } = params;

    // 基本参数
    const fr_Hz = fr * 1000; // 转 Hz
    const M = Vo_nom / Vin_max; // 电压增益
    const Tratio = Np / Ns; // 匝比
    const Gain = M * Tratio; // 总增益

    // LC 谐振频率 fr_LC = 1 / (2 * π * √(Lr * Cr)) - 先计算 Lr 和 Cr
    const Rac = (8 / Math.PI ** 2) * (Vo_nom ** 2) / Po;
    const Racp = Rac * (Tratio ** 2);
    const Zr = Racp * Q;
    const Lr = Zr / (2 * Math.PI * fr_Hz);
    const Cr = 1 / (Zr * 2 * Math.PI * fr_Hz);
    
    const frLC = 1 / (2 * Math.PI * Math.sqrt(Lr * Cr));
    
    // LLC 谐振频率 fr_LLC = 1 / (2 * π * √((Lr + Lm) * Cr))
    const Lm = Lm_uH * 1e-6;
    const frLLC = 1 / (2 * Math.PI * Math.sqrt((Lr + Lm) * Cr));
    
    // 最小开关频率：SRC 用 fr_LC，LLC 用 fr_LLC
    const baseFreq = (topologyMode === 'LLC') ? frLLC : frLC;
    const fs_min = fs_ratio * baseFreq;

    // 最小开关频率下的等效阻抗
    const Zeq = Math.sqrt(
      Racp ** 2 + 
      ((2 * Math.PI * fs_min) * Lr - 1 / (2 * Math.PI * fs_min * Cr)) ** 2
    );

    // 谐振腔电压和电流
    const Vintank = (4 / Math.PI) * Vin_max;
    const Irpk = Vintank / Zeq;

    // 电感比 k = Lm / Lr
    const k = Lm / Lr;
    
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
      Irpk,
      k,           // 电感比
      frLC,        // LC 谐振频率 (Hz)
      frLLC,       // LLC 谐振频率 (Hz)
      Lm,          // 励磁电感 (H)
      Lm_uH        // 励磁电感 (μH)
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
    
    // LLC 模式：Ceq = Cr_p，不需要计算副边电容
    // SRC 模式：Ceq = (Cr_p * Cr_s_ref) / (Cr_p + Cr_s_ref)
    
    // 计算理论并联数量（可能不是整数）
    const N_cap_exact = Cr_target_nF / C_unit_nF;
    
    // 尝试向下取整和向上取整，选偏离最小的
    const N_floor = Math.floor(N_cap_exact);
    const N_ceil = Math.ceil(N_cap_exact);
    
    // 计算两种方案的偏离度
    const C_floor = C_unit_nF * N_floor;
    const C_ceil = C_unit_nF * N_ceil;
    
    const dev_floor = Math.abs((C_floor - Cr_target_nF) / Cr_target_nF);
    const dev_ceil = Math.abs((C_ceil - Cr_target_nF) / Cr_target_nF);
    
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

    // 计算实际等效电容
    // LLC 模式：Ceq = Cr_p（只有原边电容参与谐振）
    // SRC 模式：Ceq = (Cr_p × Cr_s_ref) / (Cr_p + Cr_s_ref)（串联等效）
    let Ceq;
    if (dsn.topologyMode === 'LLC') {
      Ceq = Cr_p;  // LLC 模式 Ceq = Cr_p
    } else {
      const Cr_s_reflected = Cr_s / Tratio2;  // 副边电容反射到原边
      Ceq = (Cr_p * Cr_s_reflected) / (Cr_p + Cr_s_reflected);  // 串联等效
    }

    // 实际 Q 值
    const Q_actual = Math.sqrt(Lr_p / Ceq) / Racp;

    // 实际 LC 谐振频率 fr_LC = 1 / (2 * π * √(Lr_p * Ceq))
    const frLC_actual = 1 / (2 * Math.PI * Math.sqrt(Lr_p * Ceq));
    
    // 实际 LLC 谐振频率 fr_LLC = 1 / (2 * π * √((Lr_p + Lm) * Ceq))
    const Lm = Lm_uH * 1e-6; // 转换为 H
    const frLLC_actual = 1 / (2 * Math.PI * Math.sqrt((Lr_p + Lm) * Ceq));

    // 计算推荐的单颗电容值（使偏离度<5%）
    // 理想情况：N_cap 为整数，即 Cr_p 能被 C_unit 整除
    // 推荐 C_unit = Cr_p / 5 (约 5 颗并联，容差范围内)
    const recommended_C_unit = Cr_p_nF / 5;
    
    // 计算电感比 k = Lm / Lr
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
      fr: frLC_actual,        // LC 谐振频率 (Hz)
      frLC: frLC_actual,      // LC 谐振频率 (Hz)
      frLLC: frLLC_actual,    // LLC 谐振频率 (Hz)
      // 新增：并联数量和分辨率信息
      C_unit_nF,
      L_step_uH,
      Np_cap,
      Ns_cap,
      Lr_p_uH,
      // 用于显示偏离度
      Cr_target_nF,
      Ceq_nF: Ceq * 1e9,
      deviation_pct: ((Ceq * 1e9 - Cr_target_nF) / Cr_target_nF) * 100,
      // 推荐单颗电容值
      recommended_C_unit: recommended_C_unit,
      // 电感比
      k: k,
      // 新增：Lm (统一使用 Lm_uH)
      Lm_uH: Lm_uH
    };
  },

};

// 导出供模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LLCCalculator;
}
