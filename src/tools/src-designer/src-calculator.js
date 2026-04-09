/**
 * LLC/SRC Resonant Converter Core Calculator
 * 基于 MATLAB LLC/SRC 设计算法
 * 
 * 拓扑差异说明：
 * - SRC (串联谐振): 原边和副边电容都参与谐振
 *        Cr_s 反射到原边：Cr_s_ref = Cr_s / Tratio²
 *        Ceq = (Cr_p × Cr_s_ref) / (Cr_p + Cr_s_ref)
 *        设计参数 Cr 是 Ceq（等效电容）
 *        电容比例：Cr_s / Cr_p = Tratio（与匝比成正比）
 *        优化目标：在满足电容比例的前提下，使 fr_actual 最接近 fr_target
 * - LLC (串并联谐振): 只有原边电容参与谐振，副边无电容
 *        Ceq = Cr_p
 *        设计参数 Cr 是 Cr_p（原边电容）
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

    // 负载电阻（副边）
    const Rac = (8 / Math.PI ** 2) * (Vo_nom ** 2) / Po;
    // 反射到原边的负载电阻
    const Racp = Rac * (Tratio ** 2);
    // 特征阻抗 Zr = Racp * Q
    const Zr = Racp * Q;
    // 根据谐振频率和特征阻抗计算 Lr 和 Cr
    // Zr = √(Lr/Cr) 且 fr = 1/(2π√(Lr*Cr))
    // 推导：Lr = Zr / (2π*fr), Cr = 1/(Zr * 2π*fr)
    const Lr = Zr / (2 * Math.PI * fr_Hz);
    const Cr = 1 / (Zr * 2 * Math.PI * fr_Hz);
    
    // LC 谐振频率 fr_LC = 1 / (2 * π * √(Lr * Cr))
    const frLC = 1 / (2 * Math.PI * Math.sqrt(Lr * Cr));
    
    // LLC 谐振频率 fr_LLC = 1 / (2 * π * √((Lr + Lm) * Cr))
    const Lm = Lm_uH * 1e-6;
    const frLLC = 1 / (2 * Math.PI * Math.sqrt((Lr + Lm) * Cr));
    
    // 最小开关频率：
    // - SRC 模式：fs_min 基于 fr_LC（串联谐振频率）
    // - LLC 模式：fs_min 基于 fr_LLC（并联谐振频率，确保 ZVS）
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
      Lm_uH,       // 励磁电感 (μH)
      topologyMode // 拓扑模式
    };
  },

  /**
   * 计算实际选定参数 (Actpara)
   * 基于单颗电容容量并联和电感分辨率进行优化
   * 目标：使 Ceq 尽量接近设计的 Cr 值
   * 
   * 拓扑差异：
   * - SRC: 原边和副边电容都参与谐振（串联等效）
   *        Cr_s 反射到原边：Cr_s_ref = Cr_s / Tratio²
   *        Ceq = (Cr_p × Cr_s_ref) / (Cr_p + Cr_s_ref)
   * - LLC: 只有原边电容参与谐振，副边无电容
   *        Ceq = Cr_p
   * 
   * @param {Object} dsn - Dsnpara 计算结果
   * @param {number} C_unit_nF - 单颗电容容量 (nF)
   * @param {number} L_step_uH - 电感分辨率 (μH)
   * @param {number} Lm_uH - 励磁电感 (μH)
   * @param {string} topologyMode - 拓扑模式 'SRC' 或 'LLC'
   * @returns {Object} Actpara 结构体
   */
  calculateActpara(dsn, C_unit_nF, L_step_uH, Lm_uH, topologyMode = 'SRC') {
    const { Vin_max, Vo_nom, Po, Np, Ns, Racp, Cr } = dsn;

    const Tratio = Np / Ns;
    const Tratio2 = Tratio * Tratio;

    // 目标电容值 (nF) - 这是设计计算出的谐振电容 Cr
    const Cr_target_nF = Cr * 1e9;
    
    // ==================== 拓扑差异 ====================
    // SRC: Cr 是 Ceq（等效电容），需要 Cr_p = Cr × (Tratio² + 1)
    //      推导：Ceq = Cr_p / (Tratio² + 1) → Cr_p = Ceq × (Tratio² + 1)
    // LLC: Cr 就是 Cr_p
    // ================================================
    
    // 计算目标原边电容 Cr_p_target
    let Cr_p_target_nF;
    if (topologyMode === 'LLC') {
      // LLC: Cr_p_target = Cr_target
      Cr_p_target_nF = Cr_target_nF;
    } else {
      // SRC: Cr_p_target = Cr_target × (Tratio² + 1)
      Cr_p_target_nF = Cr_target_nF * (Tratio2 + 1);
    }
    
    // ==================== 关键优化 ====================
    // 在满足电容比例的前提下，寻找最接近目标谐振频率的组合
    // 目标频率：fr_target = dsn.fr (Hz)
    // ==================================================
    
    const fr_target = dsn.fr;  // 目标谐振频率 (Hz)
    let bestNp_cap = 1;
    let bestNs_cap = topologyMode === 'LLC' ? 0 : Math.round(1 * Tratio);
    let bestFreqError = Infinity;
    
    // 遍历可能的 Np_cap 值（1 到 100，覆盖合理范围）
    for (let Np_cap_test = 1; Np_cap_test <= 100; Np_cap_test++) {
      // 计算对应的 Ns_cap（满足电容比例）
      let Ns_cap_test;
      if (topologyMode === 'LLC') {
        Ns_cap_test = 0;
      } else {
        // SRC: Ns_cap = round(Np_cap × Tratio)
        Ns_cap_test = Math.round(Np_cap_test * Tratio);
        if (Ns_cap_test < 1) Ns_cap_test = 1;  // 至少为 1
      }
      
      // 计算电容值
      const Cr_p_test = C_unit_nF * Np_cap_test * 1e-9;  // F
      const Cr_s_test = C_unit_nF * Ns_cap_test * 1e-9;  // F
      
      // 计算等效电容 Ceq
      let Ceq_test;
      if (topologyMode === 'LLC') {
        Ceq_test = Cr_p_test;
      } else {
        const Cr_s_reflected = Cr_s_test / Tratio2;
        Ceq_test = (Cr_p_test * Cr_s_reflected) / (Cr_p_test + Cr_s_reflected);
      }
      
      // 计算实际谐振频率
      const Lr_test = dsn.Lr;  // 使用设计的 Lr 值
      const fr_actual = 1 / (2 * Math.PI * Math.sqrt(Lr_test * Ceq_test));
      
      // 计算频率误差（相对误差）
      const freqError = Math.abs((fr_actual - fr_target) / fr_target);
      
      // 更新最优解
      if (freqError < bestFreqError) {
        bestFreqError = freqError;
        bestNp_cap = Np_cap_test;
        bestNs_cap = Ns_cap_test;
      }
    }
    
    // 使用最优的 Np_cap 和 Ns_cap
    const Np_cap = bestNp_cap;
    const Ns_cap = bestNs_cap;
    const Cr_p_nF = C_unit_nF * Np_cap;
    const Cr_s_nF = C_unit_nF * Ns_cap;

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
    if (topologyMode === 'LLC') {
      Ceq = Cr_p;  // LLC 模式 Ceq = Cr_p
    } else {
      const Cr_s_reflected = Cr_s / Tratio2;  // 副边电容反射到原边
      Ceq = (Cr_p * Cr_s_reflected) / (Cr_p + Cr_s_reflected);  // 串联等效
    }

    // 实际 Q 值：Q = √(Lr/Ceq) / Racp
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
    
    // 计算偏离度：Ceq 相对于设计值 Cr_target 的偏离
    // LLC: Ceq = Cr_p，偏离度反映 Cr_p 与 Cr_target 的差异
    // SRC: Ceq = (Cr_p × Cr_s_ref) / (Cr_p + Cr_s_ref)，偏离度反映 Ceq 与 Cr_target 的差异
    const Ceq_nF = Ceq * 1e9;
    const deviation_pct = ((Ceq_nF - Cr_target_nF) / Cr_target_nF) * 100;
    
    // 频率匹配误差（百分比）
    const freqError_pct = bestFreqError * 100;

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
      deviation_pct: deviation_pct,
      // 频率匹配误差（百分比）
      freqError_pct: freqError_pct,
      // 推荐单颗电容值
      recommended_C_unit: recommended_C_unit,
      // 电感比
      k: k,
      // 新增：Lm (统一使用 Lm_uH)
      Lm_uH: Lm_uH,
      // 拓扑模式
      topologyMode
    };
  },

};

// 导出供模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LLCCalculator;
}
