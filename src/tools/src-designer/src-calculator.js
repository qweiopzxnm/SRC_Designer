/**
 * SRC (Series Resonant Converter) Core Calculator
 * 串联谐振变换器核心计算模块
 */

const SRCCalculator = {
  /**
   * 计算谐振参数
   * @param {Object} params - 输入参数
   * @returns {Object} 计算结果
   */
  calculateResonantParams(params) {
    const {
      Vin_min, Vin_max, Vo, Io, Po,
      fs_min, fs_max, fr, Q_max
    } = params;

    // 输出电压电流 (如果只给了功率)
    const outputCurrent = Io || (Po / Vo);
    const outputPower = Po || (Vo * Io);

    // 变压器匝比估算 (考虑整流压降)
    const Vd = 0.7; // 二极管压降
    const n_estimated = (Vin_min * 0.9) / (Vo + Vd);
    const n = Math.round(n_estimated * 2) / 2; // 取整到 0.5

    // 反射到原边的负载电阻
    const Ro = (8 / Math.PI ** 2) * (n * n) * (Vo + Vd) / outputCurrent;

    // 特征阻抗 (基于最大 Q 值)
    const Q = Q_max || 1.0;
    const Zo = Ro / Q;

    // 谐振频率
    const fr_actual = fr || fs_min * 1.1; // 默认谐振频率略高于最小开关频率
    const wr = 2 * Math.PI * fr_actual;

    // 谐振电感和电容
    const Lr = Zo / wr;
    const Cr = 1 / (Zo * wr);

    // 归一化频率范围
    const fn_min = fs_min / fr_actual;
    const fn_max = fs_max / fr_actual;

    return {
      n,
      Lr,
      Cr,
      fr: fr_actual,
      Zo,
      Q,
      Ro,
      fn_min,
      fn_max,
      Vo_rect: Vo + Vd
    };
  },

  /**
   * 计算增益曲线
   * @param {Object} params - 谐振参数
   * @param {Array} fn_values - 归一化频率点
   * @returns {Array} 增益数据
   */
  calculateGainCurve(params, fn_values) {
    const { Lr, Cr, n, Q } = params;
    const Ln = 1; // 假设无并联电感 (纯 SRC)

    return fn_values.map(fn => {
      // SRC 增益公式 (简化 FHA 模型)
      const Q_eff = Q;
      const denominator = Math.sqrt(
        Math.pow(1 - 1 / (fn * fn), 2) + 
        Math.pow(1 / (fn * Q_eff), 2)
      );
      const M = 1 / denominator;
      
      return {
        fn,
        M,
        Vo_actual: M * Vin_to_Vo(M, params)
      };
    });

    function Vin_to_Vo(M, p) {
      return p.Vin_nom * M / p.n;
    }
  },

  /**
   * 器件应力分析
   * @param {Object} params - 完整参数
   * @returns {Object} 应力结果
   */
  calculateStress(params, resonantParams) {
    const { Vin_max, Vin_min, Vo, Io, n } = resonantParams;
    const { Lr, Cr, fr } = resonantParams;

    // 原边开关管应力
    const Vds_max = Vin_max * 1.1; // 考虑关断尖峰
    const I_pri_rms = Io * n / Math.sqrt(2);
    const I_pri_peak = Io * n;

    // 副边二极管应力
    const Vd_max = 2 * Vo; // 全波整流
    const Id_rms = Io / Math.sqrt(2);

    // 谐振电容电压应力
    const Vcr_peak = Io / (2 * Math.PI * fr * Cr);

    // 谐振电感电流应力
    const Ilr_peak = I_pri_peak;

    return {
      primary: {
        Vds_max: Vds_max,
        I_pri_rms: I_pri_rms,
        I_pri_peak: I_pri_peak,
        P_conduction: I_pri_rms * I_pri_rms * 0.01 // 估算导通损耗
      },
      secondary: {
        Vd_max: Vd_max,
        Id_rms: Id_rms,
        P_diode: Vo * 0.7 * Io // 二极管损耗
      },
      resonant: {
        Vcr_peak: Vcr_peak,
        Ilr_peak: Ilr_peak
      }
    };
  },

  /**
   * ZVS 边界判断
   * @param {Object} params - 运行参数
   * @returns {Object} ZVS 分析结果
   */
  analyzeZVS(params, resonantParams) {
    const { Vin, fs } = params;
    const { Lr, Cr, fr, n } = resonantParams;

    const fn = fs / fr;
    const wr = 2 * Math.PI * fr;
    const Zo = Math.sqrt(Lr / Cr);

    // 死区时间要求 (简化模型)
    const Coss = 100e-12; // 假设 MOSFET 输出电容
    const t_dead_required = 2 * Coss * Vin / (Io * n);

    // ZVS 条件判断
    const isZVS = fn > 1.0; // 感性区域实现 ZVS
    const margin = fn - 1.0;

    return {
      isZVS,
      fn,
      margin,
      t_dead_required: t_dead_required * 1e9, // ns
      region: fn > 1.0 ? 'ZVS (感性)' : (fn < 1.0 ? 'ZCS (容性)' : '谐振点')
    };
  },

  /**
   * 效率估算
   * @param {Object} params - 完整参数
   * @returns {Object} 效率分析
   */
  estimateEfficiency(params, resonantParams, stress) {
    const { Vin_nom, Vo, Io } = params;
    const Po = Vo * Io;

    // 损耗组成
    const P_cond_pri = stress.primary.P_conduction;
    const P_diode = stress.secondary.P_diode;
    const P_core = Po * 0.005; // 磁芯损耗估算 (0.5%)
    const P_switching = Po * 0.003; // 开关损耗 (ZVS 下很小)

    const P_loss_total = P_cond_pri + P_diode + P_core + P_switching;
    const efficiency = Po / (Po + P_loss_total) * 100;

    return {
      Po,
      P_loss: {
        conduction: P_cond_pri,
        diode: P_diode,
        core: P_core,
        switching: P_switching,
        total: P_loss_total
      },
      efficiency: efficiency,
      Pin: Po + P_loss_total
    };
  },

  /**
   * 生成设计报告
   * @param {Object} allResults - 所有计算结果
   * @returns {String} Markdown 格式报告
   */
  generateReport(allResults) {
    const { input, resonant, stress, zvs, efficiency } = allResults;

    return `
# SRC 设计报告

## 输入规格
| 参数 | 值 |
|------|-----|
| 输入电压 | ${input.Vin_min} - ${input.Vin_max} V |
| 输出电压 | ${input.Vo} V |
| 输出电流 | ${input.Io} A |
| 输出功率 | ${input.Po} W |
| 开关频率 | ${input.fs_min} - ${input.fs_max} kHz |

## 谐振参数
| 参数 | 值 |
|------|-----|
| 变压器匝比 (n:1:1) | ${resonant.n} |
| 谐振电感 Lr | ${(resonant.Lr * 1e6).toFixed(2)} μH |
| 谐振电容 Cr | ${(resonant.Cr * 1e9).toFixed(2)} nF |
| 谐振频率 fr | ${(resonant.fr / 1000).toFixed(2)} kHz |
| 特征阻抗 Zo | ${resonant.Zo.toFixed(2)} Ω |
| 品质因数 Q | ${resonant.Q.toFixed(2)} |

## 器件应力
### 原边开关管
- Vds_max: ${stress.primary.Vds_max.toFixed(1)} V
- I_pri_rms: ${stress.primary.I_pri_rms.toFixed(2)} A
- I_pri_peak: ${stress.primary.I_pri_peak.toFixed(2)} A

### 副边整流管
- Vd_max: ${stress.secondary.Vd_max.toFixed(1)} V
- Id_rms: ${stress.secondary.Id_rms.toFixed(2)} A

### 谐振元件
- Vcr_peak: ${stress.resonant.Vcr_peak.toFixed(1)} V
- Ilr_peak: ${stress.resonant.Ilr_peak.toFixed(2)} A

## 工作特性
- ZVS 状态：${zvs.region}
- ZVS 裕量：${(zvs.margin * 100).toFixed(1)}%
- 死区时间要求：${zvs.t_dead_required.toFixed(1)} ns

## 效率估算
- 输出功率：${efficiency.Po.toFixed(1)} W
- 总损耗：${efficiency.P_loss.total.toFixed(2)} W
- **估算效率：${efficiency.efficiency.toFixed(2)}%**
`.trim();
  }
};

// 导出供模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SRCCalculator;
}
