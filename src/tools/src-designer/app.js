/**
 * LLC 设计工具 - 主应用逻辑
 * 基于 MATLAB LLC 设计算法
 */

const LLCDesigner = {
  // 当前计算结果
  currentResults: null,

  // 实际选定参数编辑状态
  actParamsEditing: false,
  
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
    document.getElementById('btn-reset').addEventListener('click', () => this.reset());
    
    // 保存/导入配置按钮
    const btnSaveConfig = document.getElementById('btn-save-config');
    const btnLoadConfig = document.getElementById('btn-load-config');
    if (btnSaveConfig) btnSaveConfig.addEventListener('click', () => this.saveConfigToFile());
    if (btnLoadConfig) btnLoadConfig.addEventListener('click', () => this.loadConfigFromFile());
    
    // 实际选定参数编辑按钮
    const btnEditAct = document.getElementById('btn-edit-act');
    if (btnEditAct) {
      btnEditAct.addEventListener('click', () => this.toggleActParamsEdit());
    }

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

      // 保存结果
      this.currentResults = {
        input,
        dsn,
        act: {
          ...act,
          Np: dsn.Np,  // 初始时使用设计页的 Np/Ns
          Ns: dsn.Ns,
          Tratio: dsn.Tratio
        }
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
    // 变压器变比
    document.getElementById('act-Np').textContent = act.Np || dsn.Np;
    document.getElementById('act-Ns').textContent = act.Ns || dsn.Ns;
    document.getElementById('act-Tratio').textContent = ((act.Np || dsn.Np) / (act.Ns || dsn.Ns)).toFixed(4);
    
    // 电容分辨率
    document.getElementById('act-C_unit').textContent = (act.C_unit_nF || 47).toFixed(1);
    
    // 并联数量
    document.getElementById('act-Np_cap').textContent = act.Np_cap || 1;
    document.getElementById('act-Ns_cap').textContent = act.Ns_cap || 1;
    
    // 谐振电容（由 C_unit × N_cap 计算）
    const Cr_p_nF = (act.C_unit_nF || 47) * (act.Np_cap || 1);
    const Cr_s_nF = (act.C_unit_nF || 47) * (act.Ns_cap || 1);
    document.getElementById('act-Cr_p').textContent = Cr_p_nF.toFixed(1);
    document.getElementById('act-Cr_s').textContent = Cr_s_nF.toFixed(1);
    
    // 电感
    document.getElementById('act-Lr_p').textContent = ((act.Lr_p_uH || act.Lr_p * 1e6) || 0).toFixed(1);
    
    // 等效电容
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
    document.getElementById('act-fr').textContent = (act.fr / 1000).toFixed(1);  // 转换为 kHz
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
    
    // 隐藏对比面板（重新计算后）
    const comparePanel = document.getElementById('act-compare-panel');
    if (comparePanel) comparePanel.style.display = 'none';
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
   * 重置表单（全部归 0）
   */
  reset() {
    document.getElementById('Vin_max').value = '';
    document.getElementById('Vo_nom').value = '';
    document.getElementById('Po').value = '';
    document.getElementById('fr').value = '';
    document.getElementById('Np').value = '';
    document.getElementById('Ns').value = '';
    document.getElementById('Q').value = '';
    document.getElementById('fs_ratio').value = '';
    document.getElementById('C_unit').value = '';
    document.getElementById('L_step').value = '';
    document.getElementById('Lm').value = '';

    document.getElementById('results-panel').classList.remove('active');
    this.currentResults = null;

    localStorage.removeItem('llc-designer-params');
  },

  /**
   * 保存配置到文件
   */
  saveConfigToFile() {
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
    
    const jsonStr = JSON.stringify(params, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `llc_design_config_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showInfo('✅ 配置已保存到文件');
  },

  /**
   * 从文件导入配置
   */
  loadConfigFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const params = JSON.parse(event.target.result);
          
          document.getElementById('Vin_max').value = params.Vin_max || '';
          document.getElementById('Vo_nom').value = params.Vo_nom || '';
          document.getElementById('Po').value = params.Po || '';
          document.getElementById('fr').value = params.fr || '';
          document.getElementById('Np').value = params.Np || '';
          document.getElementById('Ns').value = params.Ns || '';
          document.getElementById('Q').value = params.Q || '';
          document.getElementById('fs_ratio').value = params.fs_ratio || '';
          document.getElementById('C_unit').value = params.C_unit || '';
          document.getElementById('L_step').value = params.L_step || '';
          document.getElementById('Lm').value = params.Lm || '';
          
          this.showInfo('✅ 配置已从文件导入');
        } catch (error) {
          this.showError('导入失败：' + error.message);
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  },

  /**
   * 保存参数到本地存储（仅会话期间有效，关闭页面后清除）
   */
  saveParams() {
    // 不保存到 localStorage，保护用户隐私
    // 用户如需保存，请使用"💾 保存配置"按钮导出 JSON 文件
    
    // 仅在当前会话中保存结果，供验证页使用（sessionStorage 页面关闭后清除）
    if (this.currentResults) {
      const { dsn, act } = this.currentResults;
      const results = {
        Cr_p: act.Cr_p,
        Cr_s: act.Cr_s,
        Lr: act.Lr_p,
        Lm: act.Lm,
        Lm_uH: act.Lm_uH,
        Np: act.Np || dsn.Np,
        Ns: act.Ns || dsn.Ns,
        Tratio: act.Tratio || (act.Np || dsn.Np) / (act.Ns || dsn.Ns),
        Np_cap: act.Np_cap,
        Ns_cap: act.Ns_cap,
        C_unit_nF: act.C_unit_nF,
        fr: act.fr,
        Q: act.Q,
        k: act.k,
        Ceq: act.Ceq,
        deviation_pct: act.deviation_pct
      };
      // 使用 sessionStorage 而不是 localStorage，页面关闭后自动清除
      sessionStorage.setItem('llc-designer-results', JSON.stringify(results));
    }
  },

  /**
   * 从本地存储加载参数（打开时全部归 0，保护隐私）
   */
  loadLastParams() {
    // 清除 localStorage 中的旧数据，保护用户隐私
    localStorage.removeItem('llc-designer-params');
    localStorage.removeItem('llc-designer-results');
    
    // 清空所有输入框
    document.getElementById('Vin_max').value = '';
    document.getElementById('Vo_nom').value = '';
    document.getElementById('Po').value = '';
    document.getElementById('fr').value = '';
    document.getElementById('Np').value = '';
    document.getElementById('Ns').value = '';
    document.getElementById('Q').value = '';
    document.getElementById('fs_ratio').value = '';
    document.getElementById('C_unit').value = '';
    document.getElementById('L_step').value = '';
    document.getElementById('Lm').value = '';
  },

  /**
   * 切换实际选定参数编辑模式
   */
  toggleActParamsEdit() {
    this.actParamsEditing = !this.actParamsEditing;
    
    const btnEdit = document.getElementById('btn-edit-act');
    // 可编辑字段：变压器变比、电容分辨率、并联数量、电感
    const actFields = ['act-Np', 'act-Ns', 'act-C_unit', 'act-Np_cap', 'act-Ns_cap', 'act-Lr_p'];
    
    if (this.actParamsEditing) {
      // 进入编辑模式
      btnEdit.textContent = '💾 保存';
      btnEdit.classList.remove('btn-outline');
      btnEdit.classList.add('btn-primary');
      
      // 隐藏对比面板
      const comparePanel = document.getElementById('act-compare-panel');
      if (comparePanel) comparePanel.style.display = 'none';
      
      // 使字段可编辑
      actFields.forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
          elem.dataset.original = elem.textContent;
          elem.contentEditable = 'true';
          elem.style.cssText = 'border-bottom: 2px dashed #4f46e5; cursor: pointer;';
          elem.title = '点击修改';
          
          elem.addEventListener('blur', () => this.onActParamChange(id));
          elem.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              elem.blur();
            }
          });
        }
      });
      
      this.showInfo('✏️ 点击数值进行修改，完成后点击"保存"\n💡 Cr_p = C_unit × Np_cap, Cr_s = C_unit × Ns_cap');
    } else {
      // 保存并回推
      this.saveAndRecalculate();
      
      btnEdit.textContent = '✏️ 编辑';
      btnEdit.classList.add('btn-outline');
      btnEdit.classList.remove('btn-primary');
      
      // 禁用编辑
      actFields.forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
          elem.contentEditable = 'false';
          elem.style.cssText = '';
          elem.title = '';
        }
      });
    }
  },
  
  /**
   * 实际选定参数变更处理
   */
  onActParamChange(id) {
    const elem = document.getElementById(id);
    if (!elem) return;
    
    const newValue = parseFloat(elem.textContent);
    if (isNaN(newValue)) {
      elem.textContent = elem.dataset.original || '0';
      this.showError('无效数值');
    }
  },
  
  /**
   * 保存实际选定参数并回推计算
   */
  saveAndRecalculate() {
    // 获取用户编辑的参数
    const Np = parseInt(document.getElementById('act-Np').textContent);
    const Ns = parseInt(document.getElementById('act-Ns').textContent);
    const C_unit_nF = parseFloat(document.getElementById('act-C_unit').textContent);
    const Np_cap = parseInt(document.getElementById('act-Np_cap').textContent);
    const Ns_cap = parseInt(document.getElementById('act-Ns_cap').textContent);
    const Lr_p_uH = parseFloat(document.getElementById('act-Lr_p').textContent);
    
    // 验证
    if (!Np || !Ns || !C_unit_nF || !Np_cap || !Ns_cap || !Lr_p_uH) {
      this.showError('参数必须为正数');
      return;
    }
    
    // 保存修改前的值（用于对比）
    const oldAct = this.currentResults?.act || {};
    const oldCeq = oldAct.Ceq || 0;
    const oldFr_kHz = (oldAct.fr || 0) / 1000;  // Hz 转 kHz
    const oldQ = oldAct.Q || 0;
    
    // 计算变压器变比
    const Tratio = Np / Ns;
    const Tratio2 = Tratio * Tratio;
    
    // 计算谐振电容：Cr_p = C_unit × Np_cap, Cr_s = C_unit × Ns_cap
    const Cr_p_nF = C_unit_nF * Np_cap;
    const Cr_s_nF = C_unit_nF * Ns_cap;
    const Cr_p = Cr_p_nF * 1e-9;  // 转换为 F
    const Cr_s = Cr_s_nF * 1e-9;  // 转换为 F
    
    // 计算电感值
    const Lr_p = Lr_p_uH * 1e-6;  // 转换为 H
    const Lm_uH = parseFloat(document.getElementById('Lm').value);
    const Lm = Lm_uH * 1e-6;  // 转换为 H
    
    // 计算等效电容（副边电容反射到原边后与原边电容串联）
    const Cr_s_reflected = Cr_s / Tratio2;  // 副边电容反射到原边
    const Ceq = (Cr_p * Cr_s_reflected) / (Cr_p + Cr_s_reflected);  // 串联等效
    
    // 计算偏离度（相对于设计电容 Cr）
    const Cr_target = (this.currentResults?.dsn?.Cr || 0);
    const deviation_pct = ((Ceq - Cr_target) / Cr_target) * 100;
    
    // 计算实际 Q 值和谐振频率
    const Racp = this.currentResults?.dsn?.Racp || 1;
    const Zr = Math.sqrt(Lr_p / Ceq);  // 特征阻抗
    const Q_actual = Zr / Racp;
    
    // 谐振频率 fr = 1 / (2 * π * √(Lr * Ceq))
    const fr_actual = 1 / (2 * Math.PI * Math.sqrt(Lr_p * Ceq));  // Hz
    
    // 计算电感比 k
    const k = Lm / Lr_p;
    
    // 更新 UI 显示
    document.getElementById('act-Tratio').textContent = Tratio.toFixed(4);
    document.getElementById('act-Cr_p').textContent = Cr_p_nF.toFixed(1);
    document.getElementById('act-Cr_s').textContent = Cr_s_nF.toFixed(1);
    document.getElementById('act-Ceq').textContent = (Ceq * 1e9).toFixed(2);
    document.getElementById('act-Cr_target').textContent = (Cr_target * 1e9).toFixed(2);
    
    // 偏离度显示
    const deviationElem = document.getElementById('act-deviation');
    deviationElem.textContent = deviation_pct > 0 ? '+' + deviation_pct.toFixed(2) : deviation_pct.toFixed(2);
    if (Math.abs(deviation_pct) < 5) {
      deviationElem.style.color = '#16a34a';
    } else if (Math.abs(deviation_pct) < 10) {
      deviationElem.style.color = '#ca8a04';
    } else {
      deviationElem.style.color = '#dc2626';
    }
    
    document.getElementById('act-Q').textContent = Q_actual.toFixed(3);
    document.getElementById('act-fr').textContent = (fr_actual / 1000).toFixed(1);  // kHz
    document.getElementById('act-k').textContent = k.toFixed(3);
    
    // 显示改动前后对比
    const newFr_kHz = fr_actual / 1000;  // Hz 转 kHz
    this.showComparePanel(oldCeq, Ceq, oldFr_kHz, newFr_kHz, oldQ, Q_actual);
    
    // 保存结果
    if (this.currentResults) {
      this.currentResults.act.Np = Np;
      this.currentResults.act.Ns = Ns;
      this.currentResults.act.Tratio = Tratio;
      this.currentResults.act.C_unit_nF = C_unit_nF;
      this.currentResults.act.Np_cap = Np_cap;
      this.currentResults.act.Ns_cap = Ns_cap;
      this.currentResults.act.Cr_p = Cr_p;
      this.currentResults.act.Cr_s = Cr_s;
      this.currentResults.act.Lr_p = Lr_p;
      this.currentResults.act.Lr_p_uH = Lr_p_uH;
      this.currentResults.act.Ceq = Ceq;
      this.currentResults.act.deviation_pct = deviation_pct;
      this.currentResults.act.Q = Q_actual;
      this.currentResults.act.fr = fr_actual;  // Hz
      this.currentResults.act.k = k;
      
      this.saveParams();
    }
    
    this.showInfo('✅ 参数已保存并重新计算');
  },
  
  /**
   * 显示改动前后对比面板
   */
  showComparePanel(oldCeq, newCeq, oldFr, newFr, oldQ, newQ) {
    const panel = document.getElementById('act-compare-panel');
    if (!panel) return;
    
    // 获取变压器变比
    const oldTratio = this.currentResults?.act?.Tratio || (this.currentResults?.dsn?.Np / this.currentResults?.dsn?.Ns) || 1;
    const newTratio = parseFloat(document.getElementById('act-Np').textContent) / parseFloat(document.getElementById('act-Ns').textContent);
    
    // 计算变化量
    const ceqDelta = oldCeq > 0 ? ((newCeq - oldCeq) / oldCeq) * 100 : 0;
    const frDelta = oldFr > 0 ? ((newFr - oldFr) / oldFr) * 100 : 0;
    const qDelta = oldQ > 0 ? ((newQ - oldQ) / oldQ) * 100 : 0;
    const tratioDelta = oldTratio > 0 ? ((newTratio - oldTratio) / oldTratio) * 100 : 0;
    
    // 格式化 delta 显示
    const formatDelta = (delta) => {
      const sign = delta >= 0 ? '+' : '';
      const color = Math.abs(delta) < 5 ? '#16a34a' : (Math.abs(delta) < 10 ? '#ca8a04' : '#dc2626');
      return `<span style="color: ${color}">${sign}${delta.toFixed(2)}%</span>`;
    };
    
    // 变压器变比
    document.getElementById('compare-tratio-before').textContent = oldTratio.toFixed(4);
    document.getElementById('compare-tratio-after').textContent = newTratio.toFixed(4);
    
    // 等效电容
    document.getElementById('compare-ceq-before').textContent = (oldCeq * 1e9).toFixed(2) + ' nF';
    document.getElementById('compare-ceq-after').textContent = (newCeq * 1e9).toFixed(2) + ' nF';
    document.getElementById('compare-ceq-delta').innerHTML = formatDelta(ceqDelta);
    
    // 谐振频率 (oldFr 和 newFr 都是 kHz)
    document.getElementById('compare-fr-before').textContent = oldFr.toFixed(1) + ' kHz';
    document.getElementById('compare-fr-after').textContent = newFr.toFixed(1) + ' kHz';
    document.getElementById('compare-fr-delta').innerHTML = formatDelta(frDelta);
    
    // Q 值
    document.getElementById('compare-q-before').textContent = oldQ.toFixed(3);
    document.getElementById('compare-q-after').textContent = newQ.toFixed(3);
    document.getElementById('compare-q-delta').innerHTML = formatDelta(qDelta);
    
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
