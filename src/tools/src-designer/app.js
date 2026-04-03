/**
 * LLC 设计工具 - 主应用逻辑
 * 基于 MATLAB LLC 设计算法
 */

const LLCDesigner = {
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
    document.getElementById('btn-plecs').addEventListener('click', () => this.exportPlecsParams());
    document.getElementById('btn-simulate').addEventListener('click', () => this.runPlecsSimulation());
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
    const Vin_max = parseFloat(document.getElementById('Vin_max').value);
    const Vo_nom = parseFloat(document.getElementById('Vo_nom').value);
    const Po = parseFloat(document.getElementById('Po').value);
    const fr = parseFloat(document.getElementById('fr').value);
    const Np = parseInt(document.getElementById('Np').value);
    const Ns = parseInt(document.getElementById('Ns').value);
    const Q = parseFloat(document.getElementById('Q').value);
    const fs_ratio = parseFloat(document.getElementById('fs_ratio').value);
    const C_unit_nF = parseFloat(document.getElementById('C_unit').value);
    const L_step_uH = parseFloat(document.getElementById('L_step').value);
    const Lm_uH = parseFloat(document.getElementById('Lm').value);

    // 验证
    if (Vin_max <= 0 || Vo_nom <= 0 || Po <= 0) {
      this.showError('电压和功率必须为正数');
      return null;
    }
    if (Np <= 0 || Ns <= 0) {
      this.showError('匝数必须为正整数');
      return null;
    }
    if (Q <= 0 || Q > 2) {
      this.showError('Q 值应在 0.1-2.0 范围内');
      return null;
    }
    if (fs_ratio < 1.0 || fs_ratio > 2.0) {
      this.showError('fs_min/fr 比值应在 1.0-2.0 范围内');
      return null;
    }
    if (C_unit_nF <= 0) {
      this.showError('单颗电容容量必须为正数');
      return null;
    }
    if (L_step_uH <= 0) {
      this.showError('电感分辨率必须为正数');
      return null;
    }
    if (Lm_uH <= 0) {
      this.showError('Lm 必须为正数');
      return null;
    }

    return {
      Vin_max,
      Vo_nom,
      Po,
      fr,
      Np,
      Ns,
      Q,
      fs_ratio,
      C_unit_nF,
      L_step_uH,
      Lm_uH
    };
  },

  /**
   * 执行计算
   */
  calculate() {
    const input = this.getInputParams();
    if (!input) return;

    try {
      // 1. 计算设计参数 (Dsnpara)
      const dsn = LLCCalculator.calculateDsnpara(input);

      // 2. 计算实际选定参数 (Actpara) - 基于用户指定电容容量、电感分辨率和 Lm
      const act = LLCCalculator.calculateActpara(dsn, input.C_unit_nF, input.L_step_uH, input.Lm_uH);

      // 3. 效率估算
      const efficiency = LLCCalculator.estimateEfficiency(dsn, act);

      // 4. 生成报告
      const report = LLCCalculator.generateReport({
        dsn,
        act,
        efficiency
      });

      // 保存结果
      this.currentResults = {
        input,
        dsn,
        act,
        efficiency,
        report
      };

      // 更新 UI
      this.updateUI();
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
    const { dsn, act, efficiency } = this.currentResults;

    // 设计参数 (Dsnpara)
    document.getElementById('dsn-M').textContent = dsn.M.toFixed(4);
    document.getElementById('dsn-Tratio').textContent = `${dsn.Np}:${dsn.Ns} (${dsn.Tratio.toFixed(3)})`;
    document.getElementById('dsn-Gain').textContent = dsn.Gain.toFixed(4);
    document.getElementById('dsn-Rac').textContent = dsn.Rac.toFixed(2);
    document.getElementById('dsn-Racp').textContent = dsn.Racp.toFixed(2);
    document.getElementById('dsn-Zr').textContent = dsn.Zr.toFixed(2);
    document.getElementById('dsn-Lr').textContent = (dsn.Lr * 1e6).toFixed(2);
    document.getElementById('dsn-Cr').textContent = (dsn.Cr * 1e9).toFixed(2);
    document.getElementById('dsn-fs_min').textContent = (dsn.fs_min / 1000).toFixed(1);
    document.getElementById('dsn-Vintank').textContent = dsn.Vintank.toFixed(1);
    document.getElementById('dsn-Irpk').textContent = dsn.Irpk.toFixed(2);

    // 实际选定参数 (Actpara)
    document.getElementById('act-Cr_p').textContent = (act.Cr_p * 1e9).toFixed(1);
    document.getElementById('act-Np_cap').textContent = act.Np_cap;
    document.getElementById('act-Cr_s').textContent = (act.Cr_s * 1e9).toFixed(1);
    document.getElementById('act-Ns_cap').textContent = act.Ns_cap;
    document.getElementById('act-Lr_p').textContent = (act.Lr_p * 1e6).toFixed(1);
    document.getElementById('act-Ceq').textContent = (act.Ceq * 1e9).toFixed(2);
    document.getElementById('act-Cr_target').textContent = act.Cr_target_nF.toFixed(2);
    
    // 偏离度显示（带颜色）
    const deviationElem = document.getElementById('act-deviation');
    const deviationVal = act.deviation_pct;
    deviationElem.textContent = deviationVal > 0 ? '+' + deviationVal.toFixed(2) : deviationVal.toFixed(2);
    if (Math.abs(deviationVal) < 5) {
      deviationElem.style.color = '#16a34a'; // 绿色：优秀
    } else if (Math.abs(deviationVal) < 10) {
      deviationElem.style.color = '#ca8a04'; // 黄色：可接受
    } else {
      deviationElem.style.color = '#dc2626'; // 红色：需调整
    }
    
    document.getElementById('act-Q').textContent = act.Q.toFixed(3);
    document.getElementById('act-fr').textContent = (act.fr / 1000).toFixed(1);
    
    // 电感比 k = Lm/Lr
    document.getElementById('act-k').textContent = act.k.toFixed(3);
    
    // 更新推荐电容值提示
    const hintElem = document.getElementById('c_unit_hint');
    const recVal = act.recommended_C_unit.toFixed(1);
    if (Math.abs(act.deviation_pct) > 5) {
      hintElem.innerHTML = `建议改用 <strong>${recVal} nF</strong> 电容（偏离度可降至 5% 以内）`;
      hintElem.style.color = '#ca8a04';
    } else {
      hintElem.textContent = '用于计算并联数量（当前配置优秀）';
      hintElem.style.color = '#16a34a';
    }
  },



  /**
   * 导出 PLECS 参数
   */
  exportPlecsParams() {
    const input = this.getInputParams();
    if (!input) return;

    const dsn = LLCCalculator.calculateDsnpara(input);
    const act = LLCCalculator.calculateActpara(dsn, input.C_unit_nF, input.L_step_uH, input.Lm_uH);

    const plecsData = {
      Lr: act.Lr_p,
      Crp: act.Cr_p,
      Crs: act.Cr_s,
      Lm: act.Lm,
      Np: dsn.Np,
      Ns: dsn.Ns,
      Vin: dsn.Vin_max,
      Vref: dsn.Vo_nom,
      Po: dsn.Po,
      Rload: (dsn.Vo_nom ** 2) / dsn.Po
    };

    const jsonStr = JSON.stringify(plecsData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plecs_input.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showInfo('PLECS 参数已导出：plecs_input.json');
  },

  /**
   * 运行 PLECS 仿真
   */
  runPlecsSimulation() {
    const btn = document.getElementById('btn-simulate');
    
    // 先确认用户是否已完成仿真
    const confirmed = confirm(
      '📋 PLECS 仿真\n\n' +
      '请确认：\n' +
      '✓ 已导出 plecs_input.json\n' +
      '✓ 已运行 simulate-direct.bat\n' +
      '✓ 已获得 plecs_output.json\n\n' +
      '点击"确定"后请选择 plecs_output.json 文件'
    );
    
    if (!confirmed) return;

    // 创建文件选择器
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      btn.disabled = true;
      btn.textContent = '⏳ 读取中...';
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const result = JSON.parse(event.target.result);
          
          if (!result.success) {
            throw new Error(result.error || '仿真失败');
          }
          
          // 显示结果
          this.showPlecsResults(result);
          this.showInfo('✅ 仿真完成！');
          
        } catch (error) {
          console.error('仿真错误:', error);
          this.showError('仿真失败：' + error.message);
        } finally {
          btn.disabled = false;
          btn.textContent = '▶️ 运行 PLECS 仿真';
        }
      };
      
      reader.onerror = () => {
        this.showError('读取文件失败');
        btn.disabled = false;
        btn.textContent = '▶️ 运行 PLECS 仿真';
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  },

  /**
   * 显示 PLECS 仿真结果
   */
  showPlecsResults(data) {
    this.plecsResults = data;

    // ZVS 状态分析
    if (data.zvsStatus) {
      const hNames = ['H1', 'H2', 'H3', 'H4'];
      hNames.forEach((h, idx) => {
        const elem = document.getElementById(`zvs-${h}`);
        if (elem && data.zvsStatus[idx]) {
          elem.textContent = data.zvsStatus[idx].status || '-';
          if (data.zvsStatus[idx].status.includes('OK')) {
            elem.style.color = '#16a34a';
          } else if (data.zvsStatus[idx].status.includes('WARNING')) {
            elem.style.color = '#ca8a04';
          } else if (data.zvsStatus[idx].status.includes('No Switching')) {
            elem.style.color = '#6b7280';
          } else {
            elem.style.color = '#dc2626';
          }
        }
      });
    }

    // 开关管详细参数 (I_off 和 I_RMS)
    if (data.switchDetails) {
      const hNames = ['H1', 'H2', 'H3', 'H4'];
      hNames.forEach((h, idx) => {
        const sw = data.switchDetails[idx];
        if (!sw) return;

        const ioffElem = document.getElementById(`sw-${h}-Ioff`);
        if (ioffElem && sw.I_off !== undefined) {
          ioffElem.textContent = sw.I_off.toFixed(4);
        }

        const irmsElem = document.getElementById(`sw-${h}-Irms`);
        if (irmsElem && sw.I_rms !== undefined) {
          irmsElem.textContent = sw.I_rms.toFixed(4);
        }
      });
    }

    // 谐振腔参数 - 按照 MATLAB 代码格式显示 "RMS / Max / Min"
    if (data.resonantCheck) {
      // 注意：HTML ID 使用 ILrp 而不是 I_Lrp（无下划线）
      const resonantIds = ['VCrp', 'ILrp', 'ILm', 'VCrs', 'ILrs'];
      resonantIds.forEach((id, idx) => {
        const res = data.resonantCheck[idx];
        if (!res) return;

        const elem = document.getElementById(`res-${id}`);
        if (elem) {
          const rms = (res.rms != null) ? Number(res.rms).toFixed(4) : '-';
          const max = (res.max != null) ? Number(res.max).toFixed(4) : '-';
          const min = (res.min != null) ? Number(res.min).toFixed(4) : '-';
          elem.textContent = `${rms} / ${max} / ${min}`;
        }
      });
    }

    // 显示结果面板
    document.getElementById('plecs-results').style.display = 'block';
    document.getElementById('plecs-results').scrollIntoView({ behavior: 'smooth' });
  },



  /**
   * 显示信息提示
   */
  showInfo(message) {
    // 移除旧提示
    const oldInfo = document.querySelector('.info-message');
    if (oldInfo) oldInfo.remove();

    const infoDiv = document.createElement('div');
    infoDiv.className = 'info-message';
    infoDiv.textContent = 'ℹ️ ' + message;
    infoDiv.style.cssText = `
      background: #eff6ff;
      border: 1px solid #2563eb;
      color: #1e40af;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    `;

    const inputPanel = document.querySelector('.input-panel');
    inputPanel.insertBefore(infoDiv, inputPanel.querySelector('h2').nextSibling);

    // 3 秒后自动移除
    setTimeout(() => infoDiv.remove(), 3000);
  },

  /**
   * 重置表单
   */
  reset() {
    document.getElementById('Vin_max').value = 810;
    document.getElementById('Vo_nom').value = 680;
    document.getElementById('Po').value = 11000;
    document.getElementById('fr').value = 130;
    document.getElementById('Np').value = 24;
    document.getElementById('Ns').value = 23;
    document.getElementById('Q').value = 0.62;
    document.getElementById('fs_ratio').value = 1.2;
    document.getElementById('C_unit').value = 47;
    document.getElementById('L_step').value = 1;
    document.getElementById('Lm').value = 400;

    document.getElementById('results-panel').classList.remove('active');
    this.currentResults = null;

    localStorage.removeItem('llc-designer-params');
  },

  /**
   * 保存参数到本地存储
   */
  saveParams() {
    const params = {
      Vin_max: document.getElementById('Vin_max').value,
      Vo_nom: document.getElementById('Vo_nom').value,
      Po: document.getElementById('Po').value,
      fr: document.getElementById('fr').value,
      Np: document.getElementById('Np').value,
      Ns: document.getElementById('Ns').value,
      Q: document.getElementById('Q').value,
      fs_ratio: document.getElementById('fs_ratio').value,
      C_unit: document.getElementById('C_unit').value,
      L_step: document.getElementById('L_step').value,
      Lm: document.getElementById('Lm').value
    };
    localStorage.setItem('llc-designer-params', JSON.stringify(params));
    
    // 同时保存计算结果，供验证页使用
    if (this.currentResults) {
      const { dsn, act } = this.currentResults;
      const results = {
        Cr_p: act.Cr_p,
        Cr_s: act.Cr_s,
        Lr: act.Lr_p,
        Lm: act.Lm,
        Lm_uH: act.Lm_uH,
        Np: dsn.Np,
        Ns: dsn.Ns,
        Np_cap: act.Np_cap,
        Ns_cap: act.Ns_cap,
        fr: act.fr,
        Q: act.Q,
        k: act.k
      };
      localStorage.setItem('llc-designer-results', JSON.stringify(results));
    }
  },

  /**
   * 从本地存储加载参数
   */
  loadLastParams() {
    const saved = localStorage.getItem('llc-designer-params');
    if (saved) {
      try {
        const params = JSON.parse(saved);
        document.getElementById('Vin_max').value = params.Vin_max || 810;
        document.getElementById('Vo_nom').value = params.Vo_nom || 680;
        document.getElementById('Po').value = params.Po || 11000;
        document.getElementById('fr').value = params.fr || 130;
        document.getElementById('Np').value = params.Np || 24;
        document.getElementById('Ns').value = params.Ns || 23;
        document.getElementById('Q').value = params.Q || 0.62;
        document.getElementById('fs_ratio').value = params.fs_ratio || 1.2;
        document.getElementById('C_unit').value = params.C_unit || 47;
        document.getElementById('L_step').value = params.L_step || 1;
        document.getElementById('Lm').value = params.Lm || 400;
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
  LLCDesigner.init();
});
