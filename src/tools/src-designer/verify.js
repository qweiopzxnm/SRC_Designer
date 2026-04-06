/**
 * LLC 验证工具 - 多工况仿真验证
 * 支持 7 条曲线配置：Vin, PriDB1, PriDB2, PriPS2, SecDB_NonPS, SecDB_PS, SecPS
 * 美化版本 - 现代化 UI 设计
 */

const LLCVerifier = {
  // 冻结的谐振参数
  frozenParams: {
    Cr_p: null,
    Cr_s: null,
    Lr: null,
    Lm: null,
    Np: null,
    Ns: null,
    Np_cap: null,
    Ns_cap: null
  },
  
  // MOSFET 模型文件路径
  mosfetModels: {
    pri: null,  // 原边 MOSFET 模型路径
    sec: null   // 副边 MOSFET 模型路径
  },
  
  // 热仿真设置
  thermalSettings: {
    enabled: false,  // 热仿真开关
    Tvj: 130         // 结温 (℃)
  },
  
  // 工况列表
  conditions: [],
  
  // 工况计数器
  conditionCounter: 0,
  
  // 曲线配置定义
  curveDefinitions: {
    vin: { 
      name: 'Vin', 
      label: '输入电压', 
      unit: 'V', 
      default: 810,
      color: '#4f46e5',
      icon: '⚡',
      data: [{ vref: 400, value: 810 }, { vref: 680, value: 810 }, { vref: 800, value: 810 }]
    },
    pridb1: { 
      name: 'PriDB1', 
      label: '原边非移相死区', 
      unit: 'ns', 
      default: 200,
      color: '#ef4444',
      icon: '🔌',
      data: [{ vref: 400, value: 200 }, { vref: 680, value: 200 }, { vref: 800, value: 200 }]
    },
    pridb2: { 
      name: 'PriDB2', 
      label: '原边移相死区', 
      unit: 'ns', 
      default: 200,
      color: '#f97316',
      icon: '🔌',
      data: [{ vref: 400, value: 200 }, { vref: 680, value: 200 }, { vref: 800, value: 200 }]
    },
    prips2: { 
      name: 'PriPS2', 
      label: '原边移相', 
      unit: 'ns', 
      default: 0,
      color: '#f59e0b',
      icon: '📐',
      data: [{ vref: 400, value: 0 }, { vref: 680, value: 0 }, { vref: 800, value: 0 }]
    },
    secdb_nonps: { 
      name: 'SecDB_NonPS', 
      label: '副边非移相死区', 
      unit: 'ns', 
      default: 200,
      color: '#10b981',
      icon: '🔌',
      data: [{ vref: 400, value: 200 }, { vref: 680, value: 200 }, { vref: 800, value: 200 }]
    },
    secdb_ps: { 
      name: 'SecDB_PS', 
      label: '副边移相死区', 
      unit: 'ns', 
      default: 200,
      color: '#14b8a6',
      icon: '🔌',
      data: [{ vref: 400, value: 200 }, { vref: 680, value: 200 }, { vref: 800, value: 200 }]
    },
    secps: { 
      name: 'SecPS', 
      label: '副边移相', 
      unit: 'ns', 
      default: 0,
      color: '#6366f1',
      icon: '📐',
      data: [{ vref: 400, value: 0 }, { vref: 680, value: 0 }, { vref: 800, value: 0 }]
    }
  },
  
  // 曲线使能状态
  curveEnabled: {
    vin: false,
    pridb1: false,
    pridb2: false,
    prips2: false,
    secdb_nonps: false,
    secdb_ps: false,
    secps: false
  },
  
  // Chart.js 实例
  charts: {},

  /**
   * 初始化
   */
  init() {
    this.bindEvents();
    this.syncFrozenParams();
    this.initAllCurves();
    this.addCondition();
  },

  /**
   * 绑定事件
   */
  bindEvents() {
    document.getElementById('btn-sync-frozen').addEventListener('click', () => this.syncFrozenParams());
    document.getElementById('btn-lock-params').addEventListener('click', () => this.lockParams());
    document.getElementById('btn-add-condition').addEventListener('click', () => this.addCondition());
    document.getElementById('btn-save-config').addEventListener('click', () => this.saveConfig());
    document.getElementById('btn-load-config').addEventListener('click', () => this.loadConfig());
    document.getElementById('btn-run-simulation').addEventListener('click', () => this.runSimulation());
    document.getElementById('btn-clear-all').addEventListener('click', () => this.clearAll());
    document.getElementById('btn-save-curves').addEventListener('click', () => this.saveCurvesConfig());
    document.getElementById('btn-load-curves').addEventListener('click', () => this.loadCurvesConfig());
    document.getElementById('btn-import-datasheet').addEventListener('click', () => this.importDatasheet());
    
    // MOSFET 模型导入
    document.getElementById('btn-import-mos-pri').addEventListener('click', () => this.importMosfetModel('pri'));
    document.getElementById('btn-import-mos-sec').addEventListener('click', () => this.importMosfetModel('sec'));
    
    // 热仿真开关和 Tvj 输入
    const thermalEnableCheckbox = document.getElementById('thermal-sim-enable');
    if (thermalEnableCheckbox) {
      thermalEnableCheckbox.addEventListener('change', () => {
        this.thermalSettings.enabled = thermalEnableCheckbox.checked;
        this.saveThermalSettings();
        this.showStatus(thermalEnableCheckbox.checked ? '✅ 热仿真已启用' : '⚠️ 热仿真已禁用', thermalEnableCheckbox.checked ? 'success' : 'warning');
      });
    }
    
    const tvjInput = document.getElementById('tvj-input');
    if (tvjInput) {
      tvjInput.addEventListener('input', () => {
        this.thermalSettings.Tvj = parseFloat(tvjInput.value) || 130;
        this.saveThermalSettings();
      });
    }
    
    // 加载保存的热仿真设置
    this.loadThermalSettings();
  },

  /**
   * 从设计页同步冻结参数
   */
  syncFrozenParams() {
    try {
      const savedResults = localStorage.getItem('llc-designer-results');
      
      if (savedResults) {
        const results = JSON.parse(savedResults);
        this.frozenParams = {
          Cr_p: results.Cr_p * 1e9,
          Cr_s: results.Cr_s * 1e9,
          Lr: results.Lr * 1e6,
          Lm: results.Lm_uH,
          Np: results.Np,
          Ns: results.Ns,
          Np_cap: results.Np_cap || 1,
          Ns_cap: results.Ns_cap || 1
        };
        
        if (this.frozenParams.Lm && typeof this.frozenParams.Lm === 'number' && isFinite(this.frozenParams.Lm)) {
          this.updateFrozenDisplay();
          this.showStatus('✅ 冻结参数已从设计页同步', 'success');
          return;
        }
      }
      
      const savedParams = localStorage.getItem('llc-designer-params');
      if (savedParams && typeof LLCCalculator !== 'undefined') {
        const params = JSON.parse(savedParams);
        const C_unit = parseFloat(params.C_unit) || 47;
        const L_step = parseFloat(params.L_step) || 1;
        const Lm = parseFloat(params.Lm) || 400;
        
        const dsn = LLCCalculator.calculateDsnpara(params);
        const act = LLCCalculator.calculateActpara(dsn, C_unit, L_step, Lm);
        
        this.frozenParams = {
          Cr_p: act.Cr_p * 1e9,
          Cr_s: act.Cr_s * 1e9,
          Lr: act.Lr_p * 1e6,
          Lm: act.Lm_uH,
          Np: dsn.Np,
          Ns: dsn.Ns,
          Np_cap: act.Np_cap || 1,
          Ns_cap: act.Ns_cap || 1
        };
        
        this.updateFrozenDisplay();
        this.showStatus('✅ 冻结参数已重新计算并更新', 'success');
        return;
      }
      
      this.frozenParams = {
        Cr_p: 47.0,
        Cr_s: 47.0,
        Lr: 45.0,
        Lm: 400.0,
        Np: 24,
        Ns: 23,
        Np_cap: 1,
        Ns_cap: 1
      };
      
      this.updateFrozenDisplay();
      this.showStatus('⚠️ 未找到设计页参数，使用默认值', 'warning');
      
    } catch (error) {
      console.error('同步参数失败:', error);
      this.showStatus('❌ 同步参数失败：' + error.message, 'error');
    }
  },

  /**
   * 更新冻结参数显示
   */
  updateFrozenDisplay() {
    document.getElementById('frozen-Crp').textContent = this.frozenParams.Cr_p.toFixed(1);
    document.getElementById('frozen-Crs').textContent = this.frozenParams.Cr_s.toFixed(1);
    document.getElementById('frozen-Lr').textContent = this.frozenParams.Lr.toFixed(1);
    document.getElementById('frozen-Lm').textContent = this.frozenParams.Lm.toFixed(1);
    document.getElementById('frozen-Np').textContent = this.frozenParams.Np;
    document.getElementById('frozen-Ns').textContent = this.frozenParams.Ns;
    document.getElementById('frozen-Np-cap').textContent = this.frozenParams.Np_cap;
    document.getElementById('frozen-Ns-cap').textContent = this.frozenParams.Ns_cap;
  },

  /**
   * 锁定参数
   */
  lockParams() {
    const confirmed = confirm('确定要锁定谐振参数吗？');
    if (confirmed) {
      document.getElementById('btn-sync-frozen').disabled = true;
      document.getElementById('btn-lock-params').textContent = '🔓 解锁参数';
      document.getElementById('btn-lock-params').onclick = () => this.unlockParams();
      this.showStatus('🔒 参数已锁定', 'success');
    }
  },

  /**
   * 解锁参数
   */
  unlockParams() {
    document.getElementById('btn-sync-frozen').disabled = false;
    document.getElementById('btn-lock-params').textContent = '🔒 锁定参数';
    document.getElementById('btn-lock-params').onclick = () => this.lockParams();
    this.showStatus('🔓 参数已解锁', 'success');
  },

  // ==================== 曲线管理功能 ====================

  /**
   * 初始化所有曲线
   */
  initAllCurves() {
    Object.keys(this.curveDefinitions).forEach(key => {
      this.initCurve(key);
    });
  },

  /**
   * 初始化单条曲线
   */
  initCurve(key) {
    this.renderPoints(key);
    this.renderChart(key);
  },

  /**
   * 转换 key 为 HTML ID 格式（下划线转连字符）
   */
  keyToId(key) {
    return key.replace(/_/g, '-');
  },

  /**
   * 渲染曲线数据点输入
   */
  renderPoints(key) {
    const container = document.getElementById(`${this.keyToId(key)}-points`);
    if (!container) return;
    container.innerHTML = '';
    
    const curve = this.curveDefinitions[key];
    curve.data.forEach((point, index) => {
      const pointDiv = document.createElement('div');
      pointDiv.className = 'curve-point';
      pointDiv.innerHTML = `
        <span class="curve-point-label">Vref</span>
        <input type="number" value="${point.vref}" step="10" placeholder="Vref" onchange="LLCVerifier.updatePoint('${key}', ${index}, 'vref', parseFloat(this.value) || 0)">
        <span class="curve-point-label">${curve.unit}</span>
        <input type="number" value="${point.value}" step="${key === 'vin' ? '10' : '1'}" placeholder="${curve.unit}" onchange="LLCVerifier.updatePoint('${key}', ${index}, 'value', parseFloat(this.value) || 0)">
        <button class="btn-point-remove" onclick="LLCVerifier.removePoint('${key}', ${index})">×</button>
      `;
      container.appendChild(pointDiv);
    });
  },

  /**
   * 更新曲线数据点
   */
  updatePoint(key, index, field, value) {
    this.curveDefinitions[key].data[index][field] = value;
    this.renderChart(key);
    this.updateConditionInputs();
  },

  /**
   * 添加曲线数据点
   */
  addPoint(key) {
    const curve = this.curveDefinitions[key];
    const lastPoint = curve.data[curve.data.length - 1];
    const newVref = lastPoint ? lastPoint.vref + 100 : 400;
    const newValue = lastPoint ? lastPoint.value : curve.default;
    
    curve.data.push({ vref: newVref, value: newValue });
    this.renderPoints(key);
    this.renderChart(key);
    this.updateConditionInputs();
    this.showStatus(`✅ 已添加 ${curve.name} 数据点`, 'success');
  },

  /**
   * 删除曲线数据点
   */
  removePoint(key, index) {
    if (this.curveDefinitions[key].data.length <= 1) {
      this.showStatus('⚠️ 至少需要保留一个数据点', 'warning');
      return;
    }
    this.curveDefinitions[key].data.splice(index, 1);
    this.renderPoints(key);
    this.renderChart(key);
    this.updateConditionInputs();
    this.showStatus('🗑️ 已删除数据点', 'success');
  },

  /**
   * 渲染曲线图表
   */
  renderChart(key) {
    const canvas = document.getElementById(`${this.keyToId(key)}-chart`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const curve = this.curveDefinitions[key];
    const sortedData = [...curve.data].sort((a, b) => a.vref - b.vref);
    
    // 创建渐变色
    const gradient = ctx.createLinearGradient(0, 0, 0, 160);
    gradient.addColorStop(0, curve.color + '40'); // 25% opacity
    gradient.addColorStop(1, curve.color + '05'); // 5% opacity
    
    const data = {
      labels: sortedData.map(p => p.vref.toString()),
      datasets: [{
        label: `${curve.name} (${curve.unit})`,
        data: sortedData.map(p => p.value),
        borderColor: curve.color,
        backgroundColor: gradient,
        borderWidth: 2,
        tension: 0,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: curve.color,
        pointBorderWidth: 2,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: curve.color,
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 3
      }]
    };
    
    const config = {
      type: 'line',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: curve.color,
            borderWidth: 2,
            padding: 12,
            displayColors: false,
            cornerRadius: 8,
            callbacks: {
              title: (items) => `Vref: ${items[0].label} V`,
              label: (ctx) => `${curve.label}: ${ctx.parsed.y} ${curve.unit}`
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: true,
              color: '#e5e7eb',
              drawBorder: false
            },
            title: {
              display: true,
              text: 'Vref (V)',
              color: '#6b7280',
              font: { size: 11, weight: '500' }
            },
            ticks: {
              color: '#9ca3af',
              font: { size: 10 }
            }
          },
          y: {
            grid: {
              display: true,
              color: '#f3f4f6',
              drawBorder: false
            },
            title: {
              display: true,
              text: curve.unit,
              color: '#6b7280',
              font: { size: 11, weight: '500' }
            },
            ticks: {
              color: '#9ca3af',
              font: { size: 10 }
            }
          }
        }
      }
    };
    
    if (this.charts[key]) {
      this.charts[key].destroy();
    }
    
    this.charts[key] = new Chart(ctx, config);
  },

  /**
   * 切换曲线使能状态
   */
  toggleCurve(key) {
    this.curveEnabled[key] = document.getElementById(`${this.keyToId(key)}-enable`).checked;
    
    // 更新卡片视觉状态
    const card = document.getElementById(`card-${this.keyToId(key)}`);
    if (card) {
      if (this.curveEnabled[key]) {
        card.classList.add('enabled');
      } else {
        card.classList.remove('enabled');
      }
    }
    
    this.updateConditionInputs();
    
    const curve = this.curveDefinitions[key];
    if (this.curveEnabled[key]) {
      this.showStatus(`✅ ${curve.name} 曲线已使能`, 'success');
    } else {
      this.showStatus(`⚠️ ${curve.name} 曲线已禁用 (使用默认值：${curve.default}${curve.unit})`, 'warning');
    }
  },

  /**
   * 线性插值计算
   */
  interpolate(key, vref) {
    const points = [...this.curveDefinitions[key].data].sort((a, b) => a.vref - b.vref);
    
    if (points.length === 0) return this.curveDefinitions[key].default;
    if (points.length === 1) return points[0].value;
    
    // 超出范围使用端点值
    if (vref <= points[0].vref) return points[0].value;
    if (vref >= points[points.length - 1].vref) return points[points.length - 1].value;
    
    // 线性插值
    for (let i = 0; i < points.length - 1; i++) {
      if (vref >= points[i].vref && vref <= points[i + 1].vref) {
        const ratio = (vref - points[i].vref) / (points[i + 1].vref - points[i].vref);
        return points[i].value + ratio * (points[i + 1].value - points[i].value);
      }
    }
    
    return points[0].value;
  },

  /**
   * 更新工况输入框（根据曲线使能状态）
   */
  updateConditionInputs() {
    const rows = document.querySelectorAll('.condition-row[data-condition-id]');
    
    rows.forEach(row => {
      const id = row.dataset.conditionId;
      const vrefInput = document.getElementById(`vref-${id}`);
      if (!vrefInput) return;
      
      const vref = parseFloat(vrefInput.value) || 680;
      
      // 更新 Vin 输入框
      const vinInput = document.getElementById(`vin-${id}`);
      if (vinInput) {
        if (this.curveEnabled.vin) {
          const calculatedValue = Math.round(this.interpolate('vin', vref));
          vinInput.value = calculatedValue;
          vinInput.disabled = true;
          vinInput.title = `由曲线计算：${calculatedValue}V`;
        } else {
          vinInput.disabled = false;
          vinInput.title = '';
        }
      }
    });
  },

  // ==================== 工况管理功能 ====================

  /**
   * 添加工况
   */
  addCondition() {
    this.conditionCounter++;
    const conditionId = this.conditionCounter;
    
    const container = document.getElementById('conditions-container');
    const row = document.createElement('div');
    row.className = 'condition-row';
    row.dataset.conditionId = conditionId;
    
    const defaults = { Vin: 810, Vref: 680, Po: 11000, Rload: 42 };
    
    row.innerHTML = `
      <div class="row-label">工况 #${conditionId}</div>
      <div><input type="number" id="vin-${conditionId}" value="${defaults.Vin}" step="10" placeholder="Vin"></div>
      <div><input type="number" id="vref-${conditionId}" value="${defaults.Vref}" step="1" placeholder="Vref"></div>
      <div><input type="number" id="po-${conditionId}" value="${defaults.Po}" step="100" placeholder="Po"></div>
      <div><input type="number" id="rload-${conditionId}" value="${defaults.Rload}" step="1" placeholder="Rload"></div>
      <div><button class="btn-remove" onclick="LLCVerifier.removeCondition(${conditionId})">删除</button></div>
    `;
    
    container.appendChild(row);
    
    const vrefInput = document.getElementById(`vref-${conditionId}`);
    const poInput = document.getElementById(`po-${conditionId}`);
    const rloadInput = document.getElementById(`rload-${conditionId}`);
    
    const calcRload = () => {
      const vref = parseFloat(vrefInput.value) || defaults.Vref;
      const po = parseFloat(poInput.value) || defaults.Po;
      if (po > 0) rloadInput.value = (vref * vref / po).toFixed(2);
      
      // Vref 变化时，如果 Vin 曲线使能，更新 Vin
      if (this.curveEnabled.vin) {
        const vinInput = document.getElementById(`vin-${conditionId}`);
        const calculatedValue = Math.round(this.interpolate('vin', vref));
        vinInput.value = calculatedValue;
      }
    };
    
    vrefInput.addEventListener('input', calcRload);
    poInput.addEventListener('input', calcRload);
    
    // 初始化 Vin 状态
    this.updateConditionInputs();
  },

  /**
   * 删除工况
   */
  removeCondition(id) {
    const row = document.querySelector(`[data-condition-id="${id}"]`);
    if (row) {
      row.remove();
      this.renumberConditions();
      this.showStatus('🗑️ 已删除工况', 'success');
    }
  },

  /**
   * 重新编号工况
   */
  renumberConditions() {
    const rows = document.querySelectorAll('.condition-row[data-condition-id]');
    rows.forEach((row, index) => {
      const label = row.querySelector('.row-label');
      if (label) label.textContent = `工况 #${index + 1}`;
    });
  },

  /**
   * 收集当前工况数据（包含曲线计算的参数）
   */
  collectConditions() {
    this.conditions = [];
    const rows = document.querySelectorAll('.condition-row[data-condition-id]');
    
    if (rows.length === 0) return false;
    
    rows.forEach((row, index) => {
      const id = row.dataset.conditionId;
      const vref = parseFloat(document.getElementById(`vref-${id}`).value) || 0;
      
      // 根据曲线使能状态计算各参数值
      const condition = {
        id: index + 1,
        Vref: vref,
        Vin: this.curveEnabled.vin ? Math.round(this.interpolate('vin', vref)) : (parseFloat(document.getElementById(`vin-${id}`).value) || 0),
        Po: parseFloat(document.getElementById(`po-${id}`).value) || 0,
        Rload: parseFloat(document.getElementById(`rload-${id}`).value) || 0,
        // 时序参数
        PriDB1: this.curveEnabled.pridb1 ? this.interpolate('pridb1', vref) : this.curveDefinitions.pridb1.default,
        PriDB2: this.curveEnabled.pridb2 ? this.interpolate('pridb2', vref) : this.curveDefinitions.pridb2.default,
        PriPS2: this.curveEnabled.prips2 ? this.interpolate('prips2', vref) : this.curveDefinitions.prips2.default,
        SecDB_NonPS: this.curveEnabled.secdb_nonps ? this.interpolate('secdb_nonps', vref) : this.curveDefinitions.secdb_nonps.default,
        SecDB_PS: this.curveEnabled.secdb_ps ? this.interpolate('secdb_ps', vref) : this.curveDefinitions.secdb_ps.default,
        SecPS: this.curveEnabled.secps ? this.interpolate('secps', vref) : this.curveDefinitions.secps.default
      };
      
      if (condition.Vin <= 0 || condition.Vref <= 0 || condition.Po <= 0) {
        this.showStatus(`⚠️ 工况 #${condition.id} 参数无效`, 'error');
        return false;
      }
      
      this.conditions.push(condition);
    });
    
    return true;
  },

  /**
   * 保存配置（工况 + 曲线）
   */
  saveConfig() {
    if (!this.collectConditions()) {
      this.showStatus('⚠️ 请至少添加一个有效工况', 'error');
      return;
    }
    
    try {
      const configData = {
        frozenParams: {
          Cr_p: this.frozenParams.Cr_p,
          Cr_s: this.frozenParams.Cr_s,
          Lr: this.frozenParams.Lr,
          Lm: this.frozenParams.Lm,
          Np: this.frozenParams.Np,
          Ns: this.frozenParams.Ns,
          Np_cap: this.frozenParams.Np_cap || 1,
          Ns_cap: this.frozenParams.Ns_cap || 1
        },
        mosfetModels: {
          pri: this.mosfetModels.pri || null,
          sec: this.mosfetModels.sec || null
        },
        thermalSettings: {
          enabled: this.thermalSettings.enabled,
          Tvj: this.thermalSettings.Tvj || 130
        },
        curveDefinitions: this.curveDefinitions,
        curveEnabled: this.curveEnabled,
        conditions: this.conditions,
        timestamp: new Date().toISOString()
      };
      
      const jsonStr = JSON.stringify(configData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `llc_verify_config_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showStatus(`✅ 配置已保存 (${this.conditions.length} 个工况)`, 'success');
    } catch (error) {
      this.showStatus('❌ 保存失败：' + error.message, 'error');
    }
  },

  /**
   * 导入配置
   */
  loadConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const config = JSON.parse(event.target.result);
          
          if (!config.conditions || !Array.isArray(config.conditions)) {
            throw new Error('无效的配置文件格式');
          }
          
          document.getElementById('conditions-container').innerHTML = '';
          this.conditionCounter = 0;
          
          if (config.frozenParams) {
            this.frozenParams = {
              Cr_p: config.frozenParams.Cr_p,
              Cr_s: config.frozenParams.Cr_s,
              Lr: config.frozenParams.Lr,
              Lm: config.frozenParams.Lm,
              Np: config.frozenParams.Np,
              Ns: config.frozenParams.Ns,
              Np_cap: config.frozenParams.Np_cap || 1,
              Ns_cap: config.frozenParams.Ns_cap || 1
            };
            this.updateFrozenDisplay();
          }
          
          // 加载 MOSFET 模型
          if (config.mosfetModels) {
            this.mosfetModels.pri = config.mosfetModels.pri || null;
            this.mosfetModels.sec = config.mosfetModels.sec || null;
            localStorage.setItem('llc-verifier-mos-pri', this.mosfetModels.pri || '');
            localStorage.setItem('llc-verifier-mos-sec', this.mosfetModels.sec || '');
          }
          
          // 加载热仿真设置
          if (config.thermalSettings) {
            this.thermalSettings.enabled = config.thermalSettings.enabled || false;
            this.thermalSettings.Tvj = config.thermalSettings.Tvj || 130;
            
            const thermalCheckbox = document.getElementById('thermal-sim-enable');
            const tvjInput = document.getElementById('tvj-input');
            if (thermalCheckbox) thermalCheckbox.checked = this.thermalSettings.enabled;
            if (tvjInput) tvjInput.value = this.thermalSettings.Tvj;
            
            this.saveThermalSettings();
          }
          
          // 加载曲线数据
          if (config.curveDefinitions) {
            Object.keys(config.curveDefinitions).forEach(key => {
              if (this.curveDefinitions[key] && config.curveDefinitions[key].data) {
                this.curveDefinitions[key].data = config.curveDefinitions[key].data;
              }
            });
            Object.keys(this.curveDefinitions).forEach(key => {
              this.renderPoints(key);
              this.renderChart(key);
            });
          }
          
          // 加载曲线使能状态
          if (config.curveEnabled) {
            this.curveEnabled = config.curveEnabled;
            Object.keys(this.curveEnabled).forEach(key => {
              const checkbox = document.getElementById(`${this.keyToId(key)}-enable`);
              if (checkbox) {
                checkbox.checked = this.curveEnabled[key];
                // 更新卡片视觉状态
                const card = document.getElementById(`card-${this.keyToId(key)}`);
                if (card) {
                  if (this.curveEnabled[key]) {
                    card.classList.add('enabled');
                  } else {
                    card.classList.remove('enabled');
                  }
                }
              }
            });
          }
          
          config.conditions.forEach((cond) => {
            this.addCondition();
            const row = document.querySelector(`[data-condition-id="${this.conditionCounter}"]`);
            if (row) {
              document.getElementById(`vin-${this.conditionCounter}`).value = cond.Vin || 810;
              document.getElementById(`vref-${this.conditionCounter}`).value = cond.Vref || 680;
              document.getElementById(`po-${this.conditionCounter}`).value = cond.Po || 11000;
              document.getElementById(`rload-${this.conditionCounter}`).value = cond.Rload || 42;
            }
          });
          
          this.updateConditionInputs();
          this.showStatus(`✅ 已导入 ${config.conditions.length} 个工况`, 'success');
          
        } catch (error) {
          this.showStatus('❌ 导入失败：' + error.message, 'error');
        }
      };
      
      reader.onerror = () => this.showStatus('❌ 读取文件失败', 'error');
      reader.readAsText(file);
    };
    
    input.click();
  },

  /**
   * 保存曲线配置（单独保存曲线）
   */
  saveCurvesConfig() {
    try {
      const curveConfig = {
        curveDefinitions: this.curveDefinitions,
        curveEnabled: this.curveEnabled,
        timestamp: new Date().toISOString()
      };
      
      const jsonStr = JSON.stringify(curveConfig, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `llc_curves_config_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showStatus('✅ 曲线配置已保存', 'success');
    } catch (error) {
      this.showStatus('❌ 保存曲线失败：' + error.message, 'error');
    }
  },

  /**
   * 导入曲线配置（单独导入曲线）
   */
  loadCurvesConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const config = JSON.parse(event.target.result);
          
          if (!config.curveDefinitions) {
            throw new Error('无效的曲线配置文件');
          }
          
          // 加载曲线数据
          Object.keys(config.curveDefinitions).forEach(key => {
            if (this.curveDefinitions[key] && config.curveDefinitions[key].data) {
              this.curveDefinitions[key].data = config.curveDefinitions[key].data;
            }
          });
          
          // 加载曲线使能状态
          if (config.curveEnabled) {
            this.curveEnabled = config.curveEnabled;
            Object.keys(this.curveEnabled).forEach(key => {
              const checkbox = document.getElementById(`${this.keyToId(key)}-enable`);
              if (checkbox) {
                checkbox.checked = this.curveEnabled[key];
                // 更新卡片视觉状态
                const card = document.getElementById(`card-${this.keyToId(key)}`);
                if (card) {
                  if (this.curveEnabled[key]) {
                    card.classList.add('enabled');
                  } else {
                    card.classList.remove('enabled');
                  }
                }
              }
            });
          }
          
          // 重新渲染所有曲线
          Object.keys(this.curveDefinitions).forEach(key => {
            this.renderPoints(key);
            this.renderChart(key);
          });
          
          this.updateConditionInputs();
          this.showStatus('✅ 曲线配置已导入', 'success');
          
        } catch (error) {
          this.showStatus('❌ 导入曲线失败：' + error.message, 'error');
        }
      };
      
      reader.onerror = () => this.showStatus('❌ 读取文件失败', 'error');
      reader.readAsText(file);
    };
    
    input.click();
  },

  /**
   * 运行仿真（手动模式）
   */
  runSimulation() {
    if (!this.collectConditions()) {
      this.showStatus('⚠️ 请至少添加一个有效工况', 'error');
      return;
    }
    
    if (!this.frozenParams.Cr_p || !this.frozenParams.Lr || !this.frozenParams.Lm) {
      const confirmed = confirm('⚠️ 冻结参数可能未设置，是否继续？\n\n建议先点击"更新冻结参数"从设计页同步。');
      if (!confirmed) return;
    }
    
    // 生成 verify_input.json（包含所有曲线参数、MOSFET 模型和热仿真设置）
    const simulationData = {
      frozenParams: {
        Cr_p: this.frozenParams.Cr_p,
        Cr_s: this.frozenParams.Cr_s,
        Lr: this.frozenParams.Lr,
        Lm: this.frozenParams.Lm,
        Np: this.frozenParams.Np,
        Ns: this.frozenParams.Ns,
        Np_cap: this.frozenParams.Np_cap || 1,
        Ns_cap: this.frozenParams.Ns_cap || 1
      },
      mosfetModels: {
        pri: this.mosfetModels.pri || null,
        sec: this.mosfetModels.sec || null
      },
      thermalSettings: {
        enabled: this.thermalSettings.enabled,
        Tvj: this.thermalSettings.Tvj || 130
      },
      curveDefinitions: this.curveDefinitions,
      curveEnabled: this.curveEnabled,
      conditions: this.conditions,
      timestamp: new Date().toISOString()
    };
    
    const jsonStr = JSON.stringify(simulationData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'verify_input.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // 提示用户手动运行 bat
    alert(
      '✅ verify_input.json 已生成并下载\n\n' +
      '请按以下步骤操作：\n' +
      '1. 将 verify_input.json 移动到 src-designer 目录\n' +
      '2. 双击运行 verify-sim.bat\n' +
      '3. 等待仿真完成，Excel 文件将自动保存\n\n' +
      '工作目录：/home/admin/.openclaw/workspace/src/tools/src-designer'
    );
  },

  /**
   * 导入 MOSFET 模型
   */
  importMosfetModel(side) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.plecs,.xml,.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // 记录文件路径（浏览器安全限制下只能获取文件名）
      const filePath = file.webkitRelativePath || file.name;
      
      if (side === 'pri') {
        this.mosfetModels.pri = filePath;
        localStorage.setItem('llc-verifier-mos-pri', filePath);
        this.showStatus(`✅ 原边 MOSFET 模型已导入：${file.name}`, 'success');
      } else {
        this.mosfetModels.sec = filePath;
        localStorage.setItem('llc-verifier-mos-sec', filePath);
        this.showStatus(`✅ 副边 MOSFET 模型已导入：${file.name}`, 'success');
      }
    };
    
    input.click();
  },
  
  /**
   * 保存热仿真设置
   */
  saveThermalSettings() {
    const settings = {
      enabled: this.thermalSettings.enabled,
      Tvj: this.thermalSettings.Tvj
    };
    localStorage.setItem('llc-verifier-thermal', JSON.stringify(settings));
  },
  
  /**
   * 加载热仿真设置
   */
  loadThermalSettings() {
    try {
      // 加载 MOSFET 模型路径
      const savedMosPri = localStorage.getItem('llc-verifier-mos-pri');
      const savedMosSec = localStorage.getItem('llc-verifier-mos-sec');
      if (savedMosPri) this.mosfetModels.pri = savedMosPri;
      if (savedMosSec) this.mosfetModels.sec = savedMosSec;
      
      // 加载热仿真设置
      const savedThermal = localStorage.getItem('llc-verifier-thermal');
      if (savedThermal) {
        const settings = JSON.parse(savedThermal);
        this.thermalSettings.enabled = settings.enabled || false;
        this.thermalSettings.Tvj = settings.Tvj || 130;
        
        // 恢复 UI 状态
        const thermalCheckbox = document.getElementById('thermal-sim-enable');
        const tvjInput = document.getElementById('tvj-input');
        if (thermalCheckbox) thermalCheckbox.checked = this.thermalSettings.enabled;
        if (tvjInput) tvjInput.value = this.thermalSettings.Tvj;
      }
    } catch (e) {
      console.error('加载热仿真设置失败:', e);
    }
  },
  
  /**
   * 导入规格书
   */
  importDatasheet() {
    alert('📄 导入规格书\n\n请将名为 CapVoltage 和名为 CapCurrent 的文件存入当前文件夹。\n\n若没有该文件，则使用 WebPlotDigitizer 绘制。');
  },

  /**
   * 清空全部
   */
  clearAll() {
    const confirmed = confirm('确定要清空所有工况吗？');
    if (confirmed) {
      document.getElementById('conditions-container').innerHTML = '';
      this.conditionCounter = 0;
      this.conditions = [];
      this.addCondition();
      this.showStatus('🗑️ 已清空', 'success');
    }
  },

  /**
   * 显示状态消息
   */
  showStatus(message, type) {
    // 移除旧状态
    const oldStatus = document.querySelector('.status-message');
    if (oldStatus) oldStatus.remove();
    
    const statusDiv = document.createElement('div');
    statusDiv.className = `status-message status-${type}`;
    statusDiv.textContent = message;
    
    const inputPanel = document.querySelector('.input-panel');
    if (inputPanel) {
      inputPanel.insertBefore(statusDiv, inputPanel.querySelector('h2').nextSibling);
    }
    
    setTimeout(() => {
      statusDiv.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => statusDiv.remove(), 300);
    }, 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  LLCVerifier.init();
});
