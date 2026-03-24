/**
 * SRC 设计工具 - 主应用逻辑
 */

const SRCDesigner = {
  // 当前计算结果
  currentResults: null,

  /**
   * 初始化
   */
  init() {
    this.bindEvents();
    this.loadLastParams();
  },

  /**
   * 绑定事件
   */
  bindEvents() {
    document.getElementById('btn-calculate').addEventListener('click', () => this.calculate());
    document.getElementById('btn-export').addEventListener('click', () => this.exportReport());
    document.getElementById('btn-reset').addEventListener('click', () => this.reset());

    // 回车触发计算
    document.querySelectorAll('.form-group input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.calculate();
      });
    });
  },

  /**
   * 获取输入参数
   */
  getInputParams() {
    const Vin_min = parseFloat(document.getElementById('Vin_min').value);
    const Vin_max = parseFloat(document.getElementById('Vin_max').value);
    const Vo = parseFloat(document.getElementById('Vo').value);
    const Io = parseFloat(document.getElementById('Io').value);
    const fs_min = parseFloat(document.getElementById('fs_min').value) * 1000; // 转 Hz
    const fs_max = parseFloat(document.getElementById('fs_max').value) * 1000;
    const fr = parseFloat(document.getElementById('fr').value) * 1000;
    const Q_max = parseFloat(document.getElementById('Q_max').value);

    // 验证
    if (Vin_min >= Vin_max) {
      this.showError('Vin_min 必须小于 Vin_max');
      return null;
    }
    if (fs_min >= fs_max) {
      this.showError('fs_min 必须小于 fs_max');
      return null;
    }
    if (fr < fs_min) {
      this.showError('谐振频率应高于最小开关频率');
      return null;
    }

    return {
      Vin_min,
      Vin_max,
      Vin_nom: (Vin_min + Vin_max) / 2,
      Vo,
      Io,
      Po: Vo * Io,
      fs_min,
      fs_max,
      fr,
      Q_max
    };
  },

  /**
   * 执行计算
   */
  calculate() {
    const input = this.getInputParams();
    if (!input) return;

    try {
      // 1. 计算谐振参数
      const resonant = SRCCalculator.calculateResonantParams(input);

      // 2. 计算器件应力
      const stress = SRCCalculator.calculateStress(input, resonant);

      // 3. ZVS 分析 (在额定输入下)
      const zvs = SRCCalculator.analyzeZVS(
        { Vin: input.Vin_nom, fs: input.fs_min },
        resonant
      );

      // 4. 效率估算
      const efficiency = SRCCalculator.estimateEfficiency(input, resonant, stress);

      // 5. 增益曲线
      const fn_values = [];
      for (let fn = 0.5; fn <= 2.0; fn += 0.05) {
        fn_values.push(fn);
      }
      const gainData = SRCCalculator.calculateGainCurve(resonant, fn_values);

      // 6. 生成报告
      const report = SRCCalculator.generateReport({
        input,
        resonant,
        stress,
        zvs,
        efficiency
      });

      // 保存结果
      this.currentResults = {
        input,
        resonant,
        stress,
        zvs,
        efficiency,
        gainData,
        report
      };

      // 更新 UI
      this.updateUI();
      this.drawGainCurve();
      this.saveParams();

      // 显示结果面板
      document.getElementById('results-panel').classList.add('active');
      document.getElementById('results-panel').scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
      console.error(error);
      this.showError('计算出错：' + error.message);
    }
  },

  /**
   * 更新 UI 显示
   */
  updateUI() {
    const { resonant, stress, zvs, efficiency } = this.currentResults;

    // 谐振参数
    document.getElementById('res-n').textContent = resonant.n.toFixed(1);
    document.getElementById('res-Lr').textContent = (resonant.Lr * 1e6).toFixed(2);
    document.getElementById('res-Cr').textContent = (resonant.Cr * 1e9).toFixed(2);
    document.getElementById('res-fr').textContent = (resonant.fr / 1000).toFixed(1);
    document.getElementById('res-Zo').textContent = resonant.Zo.toFixed(2);
    document.getElementById('res-Q').textContent = resonant.Q.toFixed(2);

    // 器件应力
    document.getElementById('stress-Vds').textContent = stress.primary.Vds_max.toFixed(1) + ' V';
    document.getElementById('stress-Irms').textContent = stress.primary.I_pri_rms.toFixed(2) + ' A';
    document.getElementById('stress-Ipeak').textContent = stress.primary.I_pri_peak.toFixed(2) + ' A';
    document.getElementById('stress-Vd').textContent = stress.secondary.Vd_max.toFixed(1) + ' V';
    document.getElementById('stress-Id').textContent = stress.secondary.Id_rms.toFixed(2) + ' A';
    document.getElementById('stress-Vcr').textContent = stress.resonant.Vcr_peak.toFixed(1) + ' V';
    document.getElementById('stress-Ilr').textContent = stress.resonant.Ilr_peak.toFixed(2) + ' A';

    // 工作特性
    document.getElementById('zvs-status').textContent = zvs.region;
    document.getElementById('zvs-margin').textContent = (zvs.margin * 100).toFixed(1);
    document.getElementById('zvs-tdead').textContent = zvs.t_dead_required.toFixed(1);
    document.getElementById('eff-efficiency').textContent = efficiency.efficiency.toFixed(2);

    // 设计报告
    document.getElementById('design-report').textContent = this.currentResults.report;
  },

  /**
   * 绘制增益曲线
   */
  drawGainCurve() {
    const canvas = document.getElementById('gain-curve');
    const ctx = canvas.getContext('2d');
    const { gainData } = this.currentResults;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 设置边距
    const margin = { top: 30, right: 30, bottom: 50, left: 60 };
    const width = canvas.width - margin.left - margin.right;
    const height = canvas.height - margin.top - margin.bottom;

    // 计算数据范围
    const fn_min = Math.min(...gainData.map(d => d.fn));
    const fn_max = Math.max(...gainData.map(d => d.fn));
    const M_max = Math.max(...gainData.map(d => d.M)) * 1.1;

    // 坐标转换函数
    const xScale = (fn) => margin.left + (fn - fn_min) / (fn_max - fn_min) * width;
    const yScale = (M) => margin.top + height - (M / M_max) * height;

    // 绘制网格
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    // 水平网格线
    for (let M = 0; M <= M_max; M += 0.5) {
      const y = yScale(M);
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + width, y);
      ctx.stroke();
    }

    // 垂直网格线
    for (let fn = fn_min; fn <= fn_max; fn += 0.2) {
      const x = xScale(fn);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + height);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // 绘制坐标轴
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + height);
    ctx.lineTo(margin.left + width, margin.top + height);
    ctx.stroke();

    // 绘制增益曲线
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.beginPath();

    gainData.forEach((point, index) => {
      const x = xScale(point.fn);
      const y = yScale(point.M);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // 绘制谐振点标记 (fn=1)
    if (fn_min <= 1.0 && fn_max >= 1.0) {
      const x = xScale(1.0);
      const y = yScale(1.0);

      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + height);
      ctx.stroke();
      ctx.setLineDash([]);

      // 标记文字
      ctx.fillStyle = '#dc2626';
      ctx.font = '12px sans-serif';
      ctx.fillText('fr', x + 5, margin.top + 20);
    }

    // 坐标轴标签
    ctx.fillStyle = '#1e293b';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('归一化频率 fn (= fs/fr)', margin.left + width / 2, canvas.height - 10);

    ctx.save();
    ctx.translate(20, margin.top + height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('增益 M', 0, 0);
    ctx.restore();

    // 刻度值
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#64748b';

    // X 轴刻度
    for (let fn = fn_min; fn <= fn_max; fn += 0.2) {
      const x = xScale(fn);
      ctx.fillText(fn.toFixed(1), x, canvas.height - 30);
    }

    // Y 轴刻度
    ctx.textAlign = 'right';
    for (let M = 0; M <= M_max; M += 0.5) {
      const y = yScale(M);
      ctx.fillText(M.toFixed(1), margin.left - 10, y + 4);
    }

    // 标题
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';
    ctx.fillText('SRC 增益曲线 (FHA 模型)', canvas.width / 2, 20);
  },

  /**
   * 导出报告
   */
  exportReport() {
    if (!this.currentResults) {
      this.showError('请先执行计算');
      return;
    }

    const blob = new Blob([this.currentResults.report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SRC_Design_Report_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * 重置表单
   */
  reset() {
    document.getElementById('Vin_min').value = 300;
    document.getElementById('Vin_max').value = 400;
    document.getElementById('Vo').value = 48;
    document.getElementById('Io').value = 10;
    document.getElementById('fs_min').value = 100;
    document.getElementById('fs_max').value = 200;
    document.getElementById('fr').value = 110;
    document.getElementById('Q_max').value = 1.0;

    document.getElementById('results-panel').classList.remove('active');
    this.currentResults = null;

    localStorage.removeItem('src-designer-params');
  },

  /**
   * 保存参数到本地存储
   */
  saveParams() {
    const params = {
      Vin_min: document.getElementById('Vin_min').value,
      Vin_max: document.getElementById('Vin_max').value,
      Vo: document.getElementById('Vo').value,
      Io: document.getElementById('Io').value,
      fs_min: document.getElementById('fs_min').value,
      fs_max: document.getElementById('fs_max').value,
      fr: document.getElementById('fr').value,
      Q_max: document.getElementById('Q_max').value
    };
    localStorage.setItem('src-designer-params', JSON.stringify(params));
  },

  /**
   * 从本地存储加载参数
   */
  loadLastParams() {
    const saved = localStorage.getItem('src-designer-params');
    if (saved) {
      try {
        const params = JSON.parse(saved);
        document.getElementById('Vin_min').value = params.Vin_min || 300;
        document.getElementById('Vin_max').value = params.Vin_max || 400;
        document.getElementById('Vo').value = params.Vo || 48;
        document.getElementById('Io').value = params.Io || 10;
        document.getElementById('fs_min').value = params.fs_min || 100;
        document.getElementById('fs_max').value = params.fs_max || 200;
        document.getElementById('fr').value = params.fr || 110;
        document.getElementById('Q_max').value = params.Q_max || 1.0;
      } catch (e) {
        console.error('加载保存参数失败', e);
      }
    }
  },

  /**
   * 显示错误信息
   */
  showError(message) {
    // 移除旧错误
    const oldError = document.querySelector('.error-message');
    if (oldError) oldError.remove();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = '⚠️ ' + message;

    const inputPanel = document.querySelector('.input-panel');
    inputPanel.insertBefore(errorDiv, inputPanel.querySelector('h2').nextSibling);

    // 3 秒后自动移除
    setTimeout(() => errorDiv.remove(), 3000);
  }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  SRCDesigner.init();
});
