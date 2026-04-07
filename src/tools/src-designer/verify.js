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
  
  // 参数锁定状态
  paramsLocked: false,
  
  // MOSFET 模型文件路径
  mosfetModels: {
    pri: null,  // 原边 MOSFET 模型路径
    sec: null   // 副边 MOSFET 模型路径
  },
  
  // PLECS 工具箱路径
  plecsToolboxPath: null,
  
  // 热仿真设置
  thermalSettings: {
    enabled: false,  // 热仿真开关
    Tvj: 130         // 结温 (℃)
  },
  
  // 热模型变量结构体 (从 XML 解析)
  thermalVarsStruct: {},
  
  // 解析出的热模型变量列表 (带默认值) - 原边
  thermalVarsListPri: [],
  // 解析出的热模型变量列表 (带默认值) - 副边
  thermalVarsListSec: [],
  
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
    this.loadFrozenParams();  // 初始化为空，清除旧数据
    this.syncFrozenParams();  // 检查设计页是否有数据，无则保持为空
    this.initAllCurves();
    this.addCondition();
    this.loadThermalVars();
    this.loadMosfetPaths();
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
    document.getElementById('btn-import-all').addEventListener('click', () => this.importAllConfig());
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
        this.showStatus(thermalEnableCheckbox.checked ? '✅ 热仿真已启用 | Thermal simulation enabled' : '⚠️ 热仿真已禁用 | Thermal simulation disabled', thermalEnableCheckbox.checked ? 'success' : 'warning');
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
    
    // 热模型变量清空按钮
    const btnClearThermalVars = document.getElementById('btn-clear-thermal-vars');
    if (btnClearThermalVars) {
      btnClearThermalVars.addEventListener('click', () => this.clearThermalVars());
    }
    
    // PLECS 工具箱路径设置
    const btnSetPlecsPath = document.getElementById('btn-set-plecs-path');
    if (btnSetPlecsPath) {
      btnSetPlecsPath.addEventListener('click', () => this.setPlecsToolboxPath());
    }
    
    // 加载 PLECS 路径
    this.loadPlecsToolboxPath();
  },
  
  /**
   * 加载保存的 MOSFET 路径
   */
  loadMosfetPaths() {
    const savedMosPri = localStorage.getItem('llc-verifier-mos-pri');
    const savedMosSec = localStorage.getItem('llc-verifier-mos-sec');
    
    if (savedMosPri) {
      this.mosfetModels.pri = savedMosPri;
      const priInput = document.getElementById('mos-pri-path-input');
      if (priInput) priInput.value = savedMosPri;
    }
    
    if (savedMosSec) {
      this.mosfetModels.sec = savedMosSec;
      const secInput = document.getElementById('mos-sec-path-input');
      if (secInput) secInput.value = savedMosSec;
    }
  },
  
  /**
   * 设置 PLECS 工具箱路径
   */
  setPlecsToolboxPath() {
    const currentPath = this.plecsToolboxPath || '';
    
    const newPath = prompt(
      '⚙️ 设置 PLECS 工具箱路径 | Set PLECS Toolbox Path\n\n' +
      '请输入正确路径（包含 jsonrpc.m 和 plecs.m），否则会报错\n' +
      'Please enter correct path (must contain jsonrpc.m and plecs.m), or errors will occur\n\n' +
      '💡 示例 | Example:\n' +
      'Windows: C:/Users/m1774/Documents/Plexim/PLECS 4.7 (64 bit)/wbstoolbox\n' +
      'Linux: /home/user/plecs/toolbox\n\n' +
      '💡 提示 | Tips:\n' +
      '- 路径应包含 plecs.m 和 jsonrpc.m 文件 | Path must contain plecs.m and jsonrpc.m\n' +
      '- 反斜杠将自动转换为正斜杠 | Backslashes auto-converted to forward slashes\n' +
      '- 留空可清除路径 | Leave empty to clear',
      currentPath
    );
    
    if (newPath !== null) {
      if (newPath.trim()) {
        // 统一路径格式：反斜杠转正斜杠
        const finalPath = newPath.trim().replace(/\\/g, '/');
        this.plecsToolboxPath = finalPath;
        this.savePlecsToolboxPath();
        this.updatePlecsPathDisplay();
        this.showStatus('✅ PLECS 工具箱路径已设置 | PLECS toolbox path set', 'success');
      } else {
        // 清除路径
        this.plecsToolboxPath = null;
        localStorage.removeItem('llc-verifier-plecs-path');
        this.updatePlecsPathDisplay();
        this.showStatus('🗑️ PLECS 路径已清除 | PLECS path cleared', 'warning');
      }
    }
  },
  
  /**
   * 保存 PLECS 工具箱路径
   */
  savePlecsToolboxPath() {
    localStorage.setItem('llc-verifier-plecs-path', this.plecsToolboxPath || '');
  },
  
  /**
   * 加载 PLECS 工具箱路径
   */
  loadPlecsToolboxPath() {
    const savedPath = localStorage.getItem('llc-verifier-plecs-path');
    if (savedPath) {
      this.plecsToolboxPath = savedPath;
    }
    this.updatePlecsPathDisplay();
  },
  
  /**
   * 更新 PLECS 路径显示
   */
  updatePlecsPathDisplay() {
    const display = document.getElementById('plecs-path-display');
    if (display) {
      if (this.plecsToolboxPath) {
        display.textContent = '📁 ' + this.plecsToolboxPath;
        display.style.color = '#16a34a';
      } else {
        display.textContent = '⚠️ 未设置 PLECS 路径，存在错误 | PLECS path not set, error';
        display.style.color = '#ca8a04';
      }
    }
  },
  
  /**
   * 手动更新 MOSFET 路径（自动转换反斜杠为正斜杠）
   */
  updateMosfetPath(side, path) {
    if (!path || !path.trim()) return;
    
    // 自动转换反斜杠为正斜杠
    const finalPath = path.trim().replace(/\\/g, '/');
    
    if (side === 'pri') {
      this.mosfetModels.pri = finalPath;
      localStorage.setItem('llc-verifier-mos-pri', finalPath);
      this.showStatus(`✅ 原边模型路径已更新 | Primary model path updated`, 'success');
    } else {
      this.mosfetModels.sec = finalPath;
      localStorage.setItem('llc-verifier-mos-sec', finalPath);
      this.showStatus(`✅ 副边模型路径已更新 | Secondary model path updated`, 'success');
    }
  },

  /**
   * 从设计页同步冻结参数
   */
  syncFrozenParams(force = false) {
    // 如果参数已锁定且不是强制同步，则跳过
    if (this.paramsLocked && !force) {
      this.showStatus('🔒 参数已锁定，跳过自动同步 | Parameters locked, skipping auto-sync', 'warning');
      return;
    }
    
    try {
      // 从 sessionStorage 读取（页面关闭后自动清除，保护隐私）
      const savedResults = sessionStorage.getItem('llc-designer-results');
      
      if (savedResults) {
        const results = JSON.parse(savedResults);
        
        // 检查是否有有效的计算结果（用户是否点击了设计页的计算）
        if (!results.Cr_p || !results.Lr || !results.Lm) {
          // 设计页未计算，全部归 0
          this.frozenParams = {
            Cr_p: null,
            Cr_s: null,
            Lr: null,
            Lm: null,
            Np: null,
            Ns: null,
            Np_cap: null,
            Ns_cap: null
          };
          this.updateFrozenDisplay();
          this.showStatus('⚠️ 设计页未计算，参数已归零 | Design page not calculated, parameters reset', 'warning');
          return;
        }
        
        const newParams = {
          Cr_p: results.Cr_p * 1e9,
          Cr_s: results.Cr_s * 1e9,
          Lr: results.Lr * 1e6,
          Lm: results.Lm_uH,
          Np: results.Np,
          Ns: results.Ns,
          Np_cap: results.Np_cap || 1,
          Ns_cap: results.Ns_cap || 1
        };
        
        if (newParams.Lm && typeof newParams.Lm === 'number' && isFinite(newParams.Lm)) {
          // 检查参数是否发生变化
          const hasChanged = this.frozenParams.Cr_p !== newParams.Cr_p || 
                            this.frozenParams.Cr_s !== newParams.Cr_s ||
                            this.frozenParams.Lr !== newParams.Lr;
          
          this.frozenParams = newParams;
          this.updateFrozenDisplay();
          
          if (hasChanged && !this.paramsLocked) {
            this.showStatus('✅ 冻结参数已从设计页同步 | Frozen params synced from design page', 'success');
          } else if (this.paramsLocked) {
            this.showStatus('🔓 参数已解锁并同步 | Parameters unlocked and synced', 'success');
          }
          return;
        }
      } else {
        // 没有保存的结果，全部归 0
        this.frozenParams = {
          Cr_p: null,
          Cr_s: null,
          Lr: null,
          Lm: null,
          Np: null,
          Ns: null,
          Np_cap: null,
          Ns_cap: null
        };
        this.updateFrozenDisplay();
        this.showStatus('⚠️ 设计页无数据，参数已归零 | No design data, parameters reset', 'warning');
        return;
      }
      
    } catch (error) {
      console.error('同步参数失败:', error);
      this.showStatus('❌ 同步参数失败 | Sync failed: ' + error.message, 'error');
    }
  },

  /**
   * 更新冻结参数显示
   */
  updateFrozenDisplay() {
    const fp = this.frozenParams;
    document.getElementById('frozen-Crp').textContent = fp.Cr_p ? fp.Cr_p.toFixed(1) : '-';
    document.getElementById('frozen-Crs').textContent = fp.Cr_s ? fp.Cr_s.toFixed(1) : '-';
    document.getElementById('frozen-Lr').textContent = fp.Lr ? fp.Lr.toFixed(1) : '-';
    document.getElementById('frozen-Lm').textContent = fp.Lm ? fp.Lm.toFixed(1) : '-';
    document.getElementById('frozen-Np').textContent = fp.Np || '-';
    document.getElementById('frozen-Ns').textContent = fp.Ns || '-';
    document.getElementById('frozen-Np-cap').textContent = fp.Np_cap || '-';
    document.getElementById('frozen-Ns-cap').textContent = fp.Ns_cap || '-';
  },

  /**
   * 锁定参数
   */
  lockParams() {
    this.paramsLocked = true;
    document.getElementById('btn-sync-frozen').disabled = true;
    document.getElementById('btn-lock-params').textContent = '🔓 解锁参数';
    document.getElementById('btn-lock-params').onclick = () => this.unlockParams();
    
    // 禁用冻结参数编辑
    this.disableFrozenParamsEdit();
    
    localStorage.setItem('llc-verifier-params-locked', 'true');
    this.showStatus('🔒 参数已锁定，现在可以手动修改 | Parameters locked, manual edit enabled', 'success');
  },

  /**
   * 解锁参数
   */
  unlockParams() {
    this.paramsLocked = false;
    document.getElementById('btn-sync-frozen').disabled = false;
    document.getElementById('btn-lock-params').textContent = '🔒 锁定参数';
    document.getElementById('btn-lock-params').onclick = () => this.lockParams();
    
    // 使冻结参数可编辑
    this.enableFrozenParamsEdit();
    
    localStorage.removeItem('llc-verifier-params-locked');
    this.showStatus('🔓 参数已解锁，将自动从设计页同步 | Parameters unlocked, will auto-sync from design page', 'success');
  },
  
  /**
   * 启用冻结参数编辑
   */
  enableFrozenParamsEdit() {
    const frozenItems = document.querySelectorAll('.frozen-item .value');
    frozenItems.forEach(item => {
      if (!item.dataset.editable) {
        const currentValue = item.textContent;
        item.dataset.editable = 'true';
        item.dataset.original = currentValue;
        item.contentEditable = 'true';
        item.style.cssText = 'border-bottom: 2px dashed #10b981; cursor: pointer;';
        item.title = '点击修改';
        
        item.addEventListener('blur', () => this.onFrozenParamChange(item));
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            item.blur();
          }
        });
      }
    });
  },
  
  /**
   * 禁用冻结参数编辑
   */
  disableFrozenParamsEdit() {
    const frozenItems = document.querySelectorAll('.frozen-item .value');
    frozenItems.forEach(item => {
      if (item.dataset.editable) {
        delete item.dataset.editable;
        item.contentEditable = 'false';
        item.style.cssText = '';
        item.title = '';
        item.removeEventListener('blur', () => this.onFrozenParamChange(item));
      }
    });
  },
  
  /**
   * 冻结参数变更处理
   */
  onFrozenParamChange(item) {
    const label = item.parentElement.querySelector('.label')?.textContent || '';
    const newValue = parseFloat(item.textContent);
    
    if (isNaN(newValue)) {
      item.textContent = item.dataset.original || '0';
      this.showStatus('⚠️ 无效数值 | Invalid value', 'error');
      return;
    }
    
    // 更新 frozenParams
    if (label.includes('Cr_p')) {
      this.frozenParams.Cr_p = newValue;
    } else if (label.includes('Cr_s')) {
      this.frozenParams.Cr_s = newValue;
    } else if (label.includes('Lr')) {
      this.frozenParams.Lr = newValue;
    } else if (label.includes('Lm')) {
      this.frozenParams.Lm = newValue;
    } else if (label.includes('Np')) {
      this.frozenParams.Np = newValue;
    } else if (label.includes('Ns')) {
      this.frozenParams.Ns = newValue;
    } else if (label.includes('原边电容并联')) {
      this.frozenParams.Np_cap = newValue;
    } else if (label.includes('副边电容并联')) {
      this.frozenParams.Ns_cap = newValue;
    }
    
    this.saveFrozenParams();
    this.showStatus('✅ 参数已更新 | Parameter updated', 'success');
  },
  
  /**
   * 保存冻结参数
   */
  saveFrozenParams() {
    localStorage.setItem('llc-verifier-frozen-params', JSON.stringify(this.frozenParams));
  },
  
  /**
   * 加载保存的冻结参数
   */
  loadFrozenParams() {
    const savedParams = localStorage.getItem('llc-verifier-frozen-params');
    const savedLocked = localStorage.getItem('llc-verifier-params-locked');
    
    if (savedParams) {
      try {
        this.frozenParams = JSON.parse(savedParams);
      } catch (e) {
        this.frozenParams = { Cr_p: null, Cr_s: null, Lr: null, Lm: null, Np: null, Ns: null, Np_cap: null, Ns_cap: null };
      }
    } else {
      this.frozenParams = { Cr_p: null, Cr_s: null, Lr: null, Lm: null, Np: null, Ns: null, Np_cap: null, Ns_cap: null };
    }
    
    this.paramsLocked = savedLocked === 'true';
    this.updateFrozenDisplay();
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
    this.showStatus(`✅ 已添加 ${curve.name} 数据点 | ${curve.name} data point added`, 'success');
  },

  /**
   * 删除曲线数据点
   */
  removePoint(key, index) {
    if (this.curveDefinitions[key].data.length <= 1) {
      this.showStatus('⚠️ 至少需要保留一个数据点 | At least one data point required', 'warning');
      return;
    }
    this.curveDefinitions[key].data.splice(index, 1);
    this.renderPoints(key);
    this.renderChart(key);
    this.updateConditionInputs();
    this.showStatus('🗑️ 已删除数据点 | Data point deleted', 'success');
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
      this.showStatus(`✅ ${curve.name} 曲线已使能 | ${curve.name} curve enabled`, 'success');
    } else {
      this.showStatus(`⚠️ ${curve.name} 曲线已禁用 (使用默认值：${curve.default}${curve.unit}) | ${curve.name} disabled (default: ${curve.default}${curve.unit})`, 'warning');
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
      this.showStatus('🗑️ 已删除工况 | Condition deleted', 'success');
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
        this.showStatus(`⚠️ 工况 #${condition.id} 参数无效 | Condition #${condition.id} invalid parameters`, 'error');
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
      this.showStatus('⚠️ 请至少添加一个有效工况 | Please add at least one valid condition', 'error');
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
        thermalVarsStruct: this.thermalVarsStruct,
        thermalVarsListPri: this.thermalVarsListPri,
        thermalVarsListSec: this.thermalVarsListSec,
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
      
      this.showStatus(`✅ 配置已保存 (${this.conditions.length} 个工况) | Config saved (${this.conditions.length} conditions)`, 'success');
    } catch (error) {
      this.showStatus('❌ 保存失败 | Save failed: ' + error.message, 'error');
    }
  },

  /**
   * 导入配置（仅工况，不导入曲线）
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
            throw new Error('无效的配置文件格式 | Invalid config file format');
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
          
          // 加载热模型变量
          if (config.thermalVarsStruct) {
            this.thermalVarsStruct = config.thermalVarsStruct;
          }
          if (config.thermalVarsListPri) {
            this.thermalVarsListPri = config.thermalVarsListPri;
          }
          if (config.thermalVarsListSec) {
            this.thermalVarsListSec = config.thermalVarsListSec;
          }
          this.renderThermalVarsPanel();
          
          // 加载 PLECS 路径
          if (config.plecsToolboxPath) {
            this.plecsToolboxPath = config.plecsToolboxPath;
            this.savePlecsToolboxPath();
            this.updatePlecsPathDisplay();
          }
          
          // 注意：loadConfig 不导入曲线数据，只导入工况配置
          // 曲线数据通过 loadCurvesConfig 单独导入
          
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
          this.showStatus(`✅ 已导入 ${config.conditions.length} 个工况（曲线保持不变）| Imported ${config.conditions.length} conditions (curves unchanged)`, 'success');
          
        } catch (error) {
          this.showStatus('❌ 导入失败 | Import failed: ' + error.message, 'error');
        }
      };
      
      reader.onerror = () => this.showStatus('❌ 读取文件失败 | Failed to read file', 'error');
      reader.readAsText(file);
    };
    
    input.click();
  },

  /**
   * 一键导入全部（工况 + 曲线）
   */
  importAllConfig() {
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
            throw new Error('无效的配置文件格式 | Invalid config file format');
          }
          
          // 清空现有工况
          document.getElementById('conditions-container').innerHTML = '';
          this.conditionCounter = 0;
          
          // 加载冻结参数
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
          
          // 加载热模型变量
          if (config.thermalVarsStruct) {
            this.thermalVarsStruct = config.thermalVarsStruct;
          }
          if (config.thermalVarsListPri) {
            this.thermalVarsListPri = config.thermalVarsListPri;
          }
          if (config.thermalVarsListSec) {
            this.thermalVarsListSec = config.thermalVarsListSec;
          }
          this.renderThermalVarsPanel();
          
          // 加载 PLECS 路径
          if (config.plecsToolboxPath) {
            this.plecsToolboxPath = config.plecsToolboxPath;
            this.savePlecsToolboxPath();
            this.updatePlecsPathDisplay();
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
          
          // 加载工况
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
          this.showStatus(`✅ 已导入全部配置（${config.conditions.length} 个工况 + 曲线）| Imported all config (${config.conditions.length} conditions + curves)`, 'success');
          
        } catch (error) {
          this.showStatus('❌ 导入失败 | Import failed: ' + error.message, 'error');
        }
      };
      
      reader.onerror = () => this.showStatus('❌ 读取文件失败 | Failed to read file', 'error');
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
      
      this.showStatus('✅ 曲线配置已保存 | Curve config saved', 'success');
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
            throw new Error('无效的曲线配置文件 | Invalid curve config file');
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
          this.showStatus('✅ 曲线配置已导入 | Curve config imported', 'success');
          
        } catch (error) {
          this.showStatus('❌ 导入曲线失败：' + error.message, 'error');
        }
      };
      
      reader.onerror = () => this.showStatus('❌ 读取文件失败 | Failed to read file', 'error');
      reader.readAsText(file);
    };
    
    input.click();
  },

  /**
   * 运行仿真（手动模式）
   */
  runSimulation() {
    if (!this.collectConditions()) {
      this.showStatus('⚠️ 请至少添加一个有效工况 | Please add at least one valid condition', 'error');
      return;
    }
    
    if (!this.frozenParams.Cr_p || !this.frozenParams.Lr || !this.frozenParams.Lm) {
      const confirmed = confirm('⚠️ 冻结参数可能未设置，是否继续？\n\n建议先点击"更新冻结参数"从设计页同步。\n\n⚠️ Frozen parameters may not be set. Continue?\n\nRecommended to click "Update Frozen Parameters" first.');
      if (!confirmed) return;
    }
    
    // 生成 verify_input.json（包含所有曲线参数、MOSFET 模型、热仿真设置、热模型变量和 PLECS 路径）
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
      thermalVarsStruct: this.thermalVarsStruct,  // 热模型变量结构体
      plecsToolboxPath: this.plecsToolboxPath || null,  // PLECS 工具箱路径
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
      '✅ verify_input.json 已生成并下载 | verify_input.json generated and downloaded\n\n' +
      '请按以下步骤操作 | Please follow these steps:\n' +
      '1. 将 verify_input.json 移动到 src-designer 目录 | Move verify_input.json to src-designer folder\n' +
      '2. 双击运行 verify-sim.bat | Double-click verify-sim.bat\n' +
      '3. 等待仿真完成，Excel 文件将自动保存 | Wait for simulation to complete, Excel will auto-save\n\n' +
      '工作目录 | Working directory: /home/admin/.openclaw/workspace/src/tools/src-designer'
    );
  },

  /**
   * 导入 MOSFET 模型
   */
  importMosfetModel(side) {
    // 用户选择文件进行解析
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml,.plecs';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const xmlContent = event.target.result;
          const vars = this.parseMOSFETXML(xmlContent);
          
          // 浏览器安全限制：无法获取真实绝对路径，需要用户手动补充
          const fileName = file.name;
          const savedPath = side === 'pri' ? this.mosfetModels.pri : this.mosfetModels.sec;
          
          const fullPath = prompt(
            `📁 ${side === 'pri' ? '原边' : '副边'} MOSFET 模型文件已解析\n\n` +
            `✅ 成功解析 ${vars.length} 个变量\n\n` +
            `⚠️ 由于浏览器安全限制，需要您手动填写文件的完整绝对路径：\n\n` +
            `例如：C:/Users/m1774/Desktop/src-designer/${fileName}\n` +
            `或：/home/user/projects/src-designer/${fileName}\n\n` +
            `💡 提示：请使用正斜杠 / 或双反斜杠 \\\\`,
            savedPath && savedPath !== fileName ? savedPath : fileName
          );
          
          if (fullPath && fullPath.trim()) {
            // 统一路径格式：将反斜杠转为正斜杠
            const finalPath = fullPath.trim().replace(/\\/g, '/');
            
            if (side === 'pri') {
              this.mosfetModels.pri = finalPath;
              localStorage.setItem('llc-verifier-mos-pri', finalPath);
              const priInput = document.getElementById('mos-pri-path-input');
              if (priInput) priInput.value = finalPath;
            } else {
              this.mosfetModels.sec = finalPath;
              localStorage.setItem('llc-verifier-mos-sec', finalPath);
              const secInput = document.getElementById('mos-sec-path-input');
              if (secInput) secInput.value = finalPath;
            }
            
            // 存储变量列表（原副边分开）
            if (side === 'pri') {
              this.thermalVarsListPri = vars;
              vars.forEach(v => {
                if (this.thermalVarsStruct[v.name] === undefined) {
                  this.thermalVarsStruct[v.name] = parseFloat(v.defaultValue) || 0;
                }
              });
            } else {
              this.thermalVarsListSec = vars;
              vars.forEach(v => {
                if (this.thermalVarsStruct[v.name] === undefined) {
                  this.thermalVarsStruct[v.name] = parseFloat(v.defaultValue) || 0;
                }
              });
            }
            
            // 渲染变量输入面板（原副边分开显示）
            this.renderThermalVarsPanel();
            this.saveThermalVars();
            
            this.showStatus(`✅ ${side === 'pri' ? '原边' : '副边'}模型已导入 | ${side === 'pri' ? 'Primary' : 'Secondary'} model imported: ${finalPath}`, 'success');
          }
        } catch (error) {
          this.showStatus('❌ 解析 XML 失败 | XML parse failed: ' + error.message, 'error');
        }
      };
      reader.onerror = () => this.showStatus('❌ 读取文件失败 | Failed to read file', 'error');
      reader.readAsText(file);
    };
    
    input.click();
  },
  
  /**
   * 解析 MOSFET XML 文件，提取 Variable 节点
   */
  parseMOSFETXML(xmlContent) {
    const vars = [];
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    
    // 检查解析错误
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('XML 解析失败：' + parseError.textContent);
    }
    
    // 查找所有 Variable 节点
    const varNodes = xmlDoc.getElementsByTagName('Variable');
    
    for (let i = 0; i < varNodes.length; i++) {
      const varNode = varNodes[i];
      
      // 提取 Name
      const nameNodes = varNode.getElementsByTagName('Name');
      if (nameNodes.length === 0) continue;
      
      const varName = nameNodes[0].textContent.trim();
      
      // 提取 DefaultValue（可选）
      let defaultValue = '';
      const defaultNodes = varNode.getElementsByTagName('DefaultValue');
      if (defaultNodes.length > 0 && defaultNodes[0].firstChild) {
        defaultValue = defaultNodes[0].textContent.trim();
      }
      
      vars.push({
        name: varName,
        defaultValue: defaultValue || '0'
      });
    }
    
    return vars;
  },

  
  /**
   * 渲染热模型变量输入面板（原副边分开显示）
   */
  renderThermalVarsPanel() {
    const panel = document.getElementById('thermal-vars-panel');
    const container = document.getElementById('thermal-vars-container');
    
    if (!panel || !container) return;
    
    const hasPri = this.thermalVarsListPri && this.thermalVarsListPri.length > 0;
    const hasSec = this.thermalVarsListSec && this.thermalVarsListSec.length > 0;
    
    if (!hasPri && !hasSec) {
      panel.style.display = 'none';
      return;
    }
    
    panel.style.display = 'block';
    container.innerHTML = '';
    
    // 原边变量区域
    if (hasPri) {
      const priHeader = document.createElement('div');
      priHeader.style.cssText = 'grid-column: 1 / -1; font-size: 12px; font-weight: 700; color: #dc2626; margin: 8px 0 4px 0; padding: 4px 8px; background: #fee2e2; border-radius: 4px;';
      priHeader.textContent = '🔌 原边 MOSFET 变量';
      container.appendChild(priHeader);
      
      this.thermalVarsListPri.forEach(v => {
        const div = document.createElement('div');
        div.className = 'thermal-var-input';
        div.innerHTML = `
          <div class="var-name" title="${v.name}">${v.name}</div>
          <input type="number" class="var-value" 
                 value="${this.thermalVarsStruct[v.name] !== undefined ? this.thermalVarsStruct[v.name] : (parseFloat(v.defaultValue) || 0)}" 
                 step="0.01" 
                 placeholder="值"
                 onchange="LLCVerifier.updateThermalVar('${v.name}', parseFloat(this.value) || 0)">
        `;
        container.appendChild(div);
      });
    }
    
    // 副边变量区域
    if (hasSec) {
      const secHeader = document.createElement('div');
      secHeader.style.cssText = 'grid-column: 1 / -1; font-size: 12px; font-weight: 700; color: #16a34a; margin: 12px 0 4px 0; padding: 4px 8px; background: #dcfce7; border-radius: 4px;';
      secHeader.textContent = '🔌 副边 MOSFET 变量';
      container.appendChild(secHeader);
      
      this.thermalVarsListSec.forEach(v => {
        const div = document.createElement('div');
        div.className = 'thermal-var-input';
        div.innerHTML = `
          <div class="var-name" title="${v.name}">${v.name}</div>
          <input type="number" class="var-value" 
                 value="${this.thermalVarsStruct[v.name] !== undefined ? this.thermalVarsStruct[v.name] : (parseFloat(v.defaultValue) || 0)}" 
                 step="0.01" 
                 placeholder="值"
                 onchange="LLCVerifier.updateThermalVar('${v.name}', parseFloat(this.value) || 0)">
        `;
        container.appendChild(div);
      });
    }
  },
  
  /**
   * 更新热模型变量值
   */
  updateThermalVar(name, value) {
    this.thermalVarsStruct[name] = value;
    this.saveThermalVars();
  },
  
  /**
   * 保存热模型变量
   */
  saveThermalVars() {
    localStorage.setItem('llc-verifier-thermal-vars', JSON.stringify({
      varsListPri: this.thermalVarsListPri,
      varsListSec: this.thermalVarsListSec,
      varsStruct: this.thermalVarsStruct
    }));
  },
  
  /**
   * 加载热模型变量
   */
  loadThermalVars() {
    const savedVars = localStorage.getItem('llc-verifier-thermal-vars');
    if (savedVars) {
      try {
        const data = JSON.parse(savedVars);
        this.thermalVarsListPri = data.varsListPri || [];
        this.thermalVarsListSec = data.varsListSec || [];
        this.thermalVarsStruct = data.varsStruct || {};
      } catch (e) {
        this.thermalVarsListPri = [];
        this.thermalVarsListSec = [];
        this.thermalVarsStruct = {};
      }
    } else {
      this.thermalVarsListPri = [];
      this.thermalVarsListSec = [];
      this.thermalVarsStruct = {};
    }
    
    this.renderThermalVarsPanel();
  },
  
  /**
   * 清空热模型变量
   */
  clearThermalVars() {
    if (confirm('确定要清空所有热模型变量吗？')) {
      this.thermalVarsListPri = [];
      this.thermalVarsListSec = [];
      this.thermalVarsStruct = {};
      this.saveThermalVars();
      this.renderThermalVarsPanel();
      this.showStatus('🗑️ 已清空热模型变量 | Thermal variables cleared', 'success');
    }
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
      const savedThermal = localStorage.getItem('llc-verifier-thermal');
      if (savedThermal) {
        const settings = JSON.parse(savedThermal);
        this.thermalSettings.enabled = settings.enabled || false;
        this.thermalSettings.Tvj = settings.Tvj || 130;
        
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
    alert('📄 导入规格书 | Import Datasheet\n\n' +
          '请将名为 CapVoltage 和名为 CapCurrent 的文件存入当前文件夹。\n' +
          'Please place files named CapVoltage and CapCurrent in the current folder.\n\n' +
          '若没有该文件，则使用 WebPlotDigitizer 绘制。\n' +
          'If not available, use WebPlotDigitizer to extract data.');
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
      this.showStatus('🗑️ 已清空 | Cleared', 'success');
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
