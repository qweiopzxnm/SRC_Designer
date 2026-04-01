/**
 * LLC 验证工具 - 多工况仿真验证
 */

const LLCVerifier = {
  // 冻结的谐振参数
  frozenParams: {
    Cr_p: null,
    Cr_s: null,
    Lr: null,
    Lm: null,
    Np: null,
    Ns: null
  },
  
  // 工况列表
  conditions: [],
  
  // 工况计数器
  conditionCounter: 0,

  /**
   * 初始化
   */
  init() {
    this.bindEvents();
    this.syncFrozenParams();
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
          Ns: results.Ns
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
          Ns: dsn.Ns
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
        Ns: 23
      };
      
      this.updateFrozenDisplay();
      this.showStatus('⚠️ 未找到设计页参数，使用默认值', 'error');
      
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
      <div><input type="number" id="vin-${conditionId}" value="${defaults.Vin}" step="10"></div>
      <div><input type="number" id="vref-${conditionId}" value="${defaults.Vref}" step="1"></div>
      <div><input type="number" id="po-${conditionId}" value="${defaults.Po}" step="100"></div>
      <div><input type="number" id="rload-${conditionId}" value="${defaults.Rload}" step="1"></div>
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
    };
    
    vrefInput.addEventListener('input', calcRload);
    poInput.addEventListener('input', calcRload);
  },

  /**
   * 删除工况
   */
  removeCondition(id) {
    const row = document.querySelector(`[data-condition-id="${id}"]`);
    if (row) {
      row.remove();
      this.renumberConditions();
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
   * 收集当前工况数据
   */
  collectConditions() {
    this.conditions = [];
    const rows = document.querySelectorAll('.condition-row[data-condition-id]');
    
    if (rows.length === 0) return false;
    
    rows.forEach((row, index) => {
      const id = row.dataset.conditionId;
      const condition = {
        id: index + 1,
        Vin: parseFloat(document.getElementById(`vin-${id}`).value) || 0,
        Vref: parseFloat(document.getElementById(`vref-${id}`).value) || 0,
        Po: parseFloat(document.getElementById(`po-${id}`).value) || 0,
        Rload: parseFloat(document.getElementById(`rload-${id}`).value) || 0
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
   * 保存配置
   */
  saveConfig() {
    if (!this.collectConditions()) {
      this.showStatus('⚠️ 请至少添加一个有效工况', 'error');
      return;
    }
    
    try {
      const configData = {
        frozenParams: this.frozenParams,
        conditions: this.conditions,
        timestamp: new Date().toISOString()
      };
      
      const jsonStr = JSON.stringify(configData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'llc_verify_config.json';
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
            this.frozenParams = config.frozenParams;
            this.updateFrozenDisplay();
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
    
    // 生成 verify_input.json
    const simulationData = {
      frozenParams: this.frozenParams,
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
    const oldStatus = document.querySelector('.verify-status-message');
    if (oldStatus) oldStatus.remove();
    
    const statusDiv = document.createElement('div');
    statusDiv.className = `verify-status-message simulation-status ${type}`;
    statusDiv.style.cssText = type === 'success' 
      ? 'background: #f0fdf4; border: 1px solid #16a34a; color: #166534;'
      : type === 'error'
      ? 'background: #fef2f2; border: 1px solid #dc2626; color: #991b1b;'
      : 'background: #eff6ff; border: 1px solid #2563eb; color: #1e40af;';
    statusDiv.textContent = message;
    
    const inputPanel = document.querySelector('.input-panel');
    inputPanel.insertBefore(statusDiv, inputPanel.querySelector('h2').nextSibling);
    
    setTimeout(() => statusDiv.remove(), 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  LLCVerifier.init();
});
