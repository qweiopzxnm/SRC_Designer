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
  
  // 仿真结果
  simulationResults: null,
  
  // 工况计数器
  conditionCounter: 0,

  /**
   * 初始化
   */
  init() {
    this.bindEvents();
    this.syncFrozenParams();
    this.addCondition(); // 默认添加一个工况
  },

  /**
   * 绑定事件
   */
  bindEvents() {
    document.getElementById('btn-sync-frozen').addEventListener('click', () => this.syncFrozenParams());
    document.getElementById('btn-lock-params').addEventListener('click', () => this.lockParams());
    document.getElementById('btn-add-condition').addEventListener('click', () => this.addCondition());
    document.getElementById('btn-save-conditions').addEventListener('click', () => this.saveConditions());
    document.getElementById('btn-run-simulation').addEventListener('click', () => this.runSimulation());
    document.getElementById('btn-clear-all').addEventListener('click', () => this.clearAll());
    document.getElementById('btn-export-json').addEventListener('click', () => this.exportJSON());
    document.getElementById('btn-export-csv').addEventListener('click', () => this.exportCSV());
    document.getElementById('btn-clear-results').addEventListener('click', () => this.clearResults());
  },

  /**
   * 从设计页同步冻结参数
   */
  syncFrozenParams() {
    try {
      // 优先尝试从 localStorage 获取设计页的计算结果（直接读取，无需重新计算）
      const savedResults = localStorage.getItem('llc-designer-results');
      
      if (savedResults) {
        const results = JSON.parse(savedResults);
        
        // 直接使用保存的计算结果
        this.frozenParams = {
          Cr_p: results.Cr_p * 1e9, // nF
          Cr_s: results.Cr_s * 1e9, // nF
          Lr: results.Lr * 1e6,     // μH
          Lm: results.Lm_uH,        // μH
          Np: results.Np,
          Ns: results.Ns
        };
        
        // 验证参数是否有效
        if (this.frozenParams.Lm && typeof this.frozenParams.Lm === 'number' && isFinite(this.frozenParams.Lm)) {
          this.updateFrozenDisplay();
          this.showStatus('✅ 冻结参数已从设计页同步', 'success');
          return;
        }
      }
      
      // 如果没有保存的计算结果，尝试从输入参数重新计算
      const savedParams = localStorage.getItem('llc-designer-params');
      if (savedParams && typeof LLCCalculator !== 'undefined') {
        const params = JSON.parse(savedParams);
        
        // 确保参数是数字类型
        const C_unit = parseFloat(params.C_unit) || 47;
        const L_step = parseFloat(params.L_step) || 1;
        const Lm = parseFloat(params.Lm) || 400;
        
        const dsn = LLCCalculator.calculateDsnpara(params);
        const act = LLCCalculator.calculateActpara(dsn, C_unit, L_step, Lm);
        
        this.frozenParams = {
          Cr_p: act.Cr_p * 1e9, // nF
          Cr_s: act.Cr_s * 1e9, // nF
          Lr: act.Lr_p * 1e6,   // μH
          Lm: act.Lm_uH,        // μH
          Np: dsn.Np,
          Ns: dsn.Ns
        };
        
        this.updateFrozenDisplay();
        this.showStatus('✅ 冻结参数已重新计算并更新', 'success');
        return;
      }
      
      // 如果都没有，使用默认值
      this.frozenParams = {
        Cr_p: 47.0,
        Cr_s: 47.0,
        Lr: 45.0,
        Lm: 400.0,
        Np: 24,
        Ns: 23
      };
      
      this.updateFrozenDisplay();
      this.showStatus('⚠️ 未找到设计页参数，使用默认值。请先在设计页计算并保存。', 'error');
      
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
   * 锁定参数（防止意外修改）
   */
  lockParams() {
    const confirmed = confirm('确定要锁定谐振参数吗？锁定后将无法更新，直到解锁。');
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
    
    // 默认值
    const defaults = {
      Vin: 810,
      Vref: 680,
      Po: 11000,
      Rload: 42
    };
    
    row.innerHTML = `
      <div class="row-label">工况 #${conditionId}</div>
      <div><input type="number" id="vin-${conditionId}" value="${defaults.Vin}" step="10" placeholder="输入电压"></div>
      <div><input type="number" id="vref-${conditionId}" value="${defaults.Vref}" step="1" placeholder="输出电压"></div>
      <div><input type="number" id="po-${conditionId}" value="${defaults.Po}" step="100" placeholder="输出功率"></div>
      <div><input type="number" id="rload-${conditionId}" value="${defaults.Rload}" step="1" placeholder="负载电阻"></div>
      <div><button class="btn-remove" onclick="LLCVerifier.removeCondition(${conditionId})">删除</button></div>
    `;
    
    container.appendChild(row);
    
    // 自动计算 Rload = Vref² / Po
    const vrefInput = document.getElementById(`vref-${conditionId}`);
    const poInput = document.getElementById(`po-${conditionId}`);
    const rloadInput = document.getElementById(`rload-${conditionId}`);
    
    const calcRload = () => {
      const vref = parseFloat(vrefInput.value) || defaults.Vref;
      const po = parseFloat(poInput.value) || defaults.Po;
      if (po > 0) {
        rloadInput.value = (vref * vref / po).toFixed(2);
      }
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
      if (label) {
        label.textContent = `工况 #${index + 1}`;
      }
    });
  },

  /**
   * 保存工况并下载 verify_input.json
   */
  saveConditions(downloadFile = true) {
    this.conditions = [];
    const rows = document.querySelectorAll('.condition-row[data-condition-id]');
    
    if (rows.length === 0) {
      this.showStatus('⚠️ 请至少添加一个工况', 'error');
      return false;
    }
    
    rows.forEach((row, index) => {
      const id = row.dataset.conditionId;
      const condition = {
        id: index + 1,
        Vin: parseFloat(document.getElementById(`vin-${id}`).value) || 0,
        Vref: parseFloat(document.getElementById(`vref-${id}`).value) || 0,
        Po: parseFloat(document.getElementById(`po-${id}`).value) || 0,
        Rload: parseFloat(document.getElementById(`rload-${id}`).value) || 0
      };
      
      // 验证
      if (condition.Vin <= 0 || condition.Vref <= 0 || condition.Po <= 0) {
        this.showStatus(`⚠️ 工况 #${condition.id} 参数无效`, 'error');
        return false;
      }
      
      this.conditions.push(condition);
    });
    
    // 保存到 localStorage
    localStorage.setItem('llc-verify-conditions', JSON.stringify(this.conditions));
    
    // 如果需要下载文件，生成 verify_input.json
    if (downloadFile) {
      this.downloadVerifyInput();
    } else {
      this.showStatus(`✅ 已保存 ${this.conditions.length} 个工况`, 'success');
    }
    
    return true;
  },

  /**
   * 下载 verify_input.json 文件
   */
  downloadVerifyInput() {
    try {
      // 构建仿真输入数据
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
      
      this.showStatus(`✅ 已导出 verify_input.json (${this.conditions.length} 个工况)`, 'success');
    } catch (error) {
      console.error('导出失败:', error);
      this.showStatus('❌ 导出失败：' + error.message, 'error');
    }
  },

  /**
   * 运行仿真
   */
  async runSimulation() {
    // 先保存工况（不下载文件，因为用户可能已经通过"保存工况"按钮下载了）
    if (!this.saveConditions(false)) {
      return;
    }
    
    // 确认冻结参数
    if (!this.frozenParams.Cr_p || !this.frozenParams.Lr || !this.frozenParams.Lm) {
      const confirmed = confirm('⚠️ 冻结参数可能未设置，是否继续？\n\n建议先点击"更新冻结参数"从设计页同步。');
      if (!confirmed) return;
    }
    
    const statusDiv = document.getElementById('simulation-status');
    const statusMessage = document.getElementById('status-message');
    const progressFill = document.getElementById('progress-fill');
    
    statusDiv.className = 'simulation-status running';
    statusMessage.textContent = '⏳ 正在准备仿真数据...';
    progressFill.style.width = '10%';
    
    try {
      progressFill.style.width = '30%';
      statusMessage.textContent = '📁 仿真数据已准备就绪';
      
      // 提示用户
      const savePrompt = confirm(
        '📋 仿真准备就绪\n\n' +
        `工况数量：${this.conditions.length}\n` +
        `冻结参数：Lm=${this.frozenParams.Lm.toFixed(1)}μH, Lr=${this.frozenParams.Lr.toFixed(1)}μH, Np:Ns=${this.frozenParams.Np}:${this.frozenParams.Ns}\n\n` +
        '请确认：\n' +
        '✓ 已点击"保存工况"按钮导出 verify_input.json\n' +
        '✓ 已将 verify_input.json 放到 src-designer 目录\n\n' +
        '点击"确定"后请选择 verify_output.json 文件导入结果'
      );
      
      if (!savePrompt) {
        statusDiv.className = 'simulation-status';
        return;
      }
      
      progressFill.style.width = '50%';
      statusMessage.textContent = '⏳ 请选择仿真结果文件...';
      
      // 加载仿真结果
      this.loadSimulationResults();
      
    } catch (error) {
      console.error('仿真错误:', error);
      statusDiv.className = 'simulation-status error';
      statusMessage.textContent = '❌ 仿真失败：' + error.message;
    }
  },

  /**
   * 加载仿真结果
   */
  loadSimulationResults() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const statusDiv = document.getElementById('simulation-status');
      const statusMessage = document.getElementById('status-message');
      const progressFill = document.getElementById('progress-fill');
      
      progressFill.style.width = '70%';
      statusMessage.textContent = '📖 读取仿真结果...';
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const result = JSON.parse(event.target.result);
          
          if (!result.success) {
            throw new Error(result.error || '仿真失败');
          }
          
          this.simulationResults = result;
          this.displayResults();
          
          progressFill.style.width = '100%';
          statusDiv.className = 'simulation-status success';
          statusMessage.textContent = '✅ 仿真完成！共 ' + (result.conditions || []).length + ' 个工况';
          
        } catch (error) {
          console.error('结果读取错误:', error);
          statusDiv.className = 'simulation-status error';
          statusMessage.textContent = '❌ 读取失败：' + error.message;
        }
      };
      
      reader.onerror = () => {
        statusDiv.className = 'simulation-status error';
        statusMessage.textContent = '❌ 读取文件失败';
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  },

  /**
   * 显示仿真结果
   */
  displayResults() {
    if (!this.simulationResults) return;
    
    const resultsPanel = document.getElementById('results-panel');
    const container = document.getElementById('results-table-container');
    
    resultsPanel.style.display = 'block';
    
    // 构建结果表格
    let html = '<h3>📊 多工况仿真结果汇总</h3>';
    html += '<table class="results-table">';
    
    // 表头
    html += '<thead><tr>';
    html += '<th>工况</th>';
    html += '<th>Vin (V)</th>';
    html += '<th>Vref (V)</th>';
    html += '<th>Po (W)</th>';
    html += '<th>Vo_avg (V)</th>';
    html += '<th>Irms (A)</th>';
    html += '<th>Ipeak (A)</th>';
    html += '<th>ZVS 状态</th>';
    html += '<th>仿真时间 (s)</th>';
    html += '</tr></thead>';
    
    // 数据行
    html += '<tbody>';
    
    const conditions = this.simulationResults.conditions || [];
    conditions.forEach((cond, idx) => {
      const zvsOk = cond.zvsAllOk ? true : false;
      const zvsClass = zvsOk ? 'zvs-ok' : 'zvs-warning';
      const zvsText = zvsOk ? '✓ ZVS OK' : '⚠ ZVS 警告';
      
      html += '<tr>';
      html += `<td>#${cond.id || idx + 1}</td>`;
      html += `<td>${cond.Vin || '-'}</td>`;
      html += `<td>${cond.Vref || '-'}</td>`;
      html += `<td>${cond.Po || '-'}</td>`;
      html += `<td>${cond.Vo_avg ? cond.Vo_avg.toFixed(1) : '-'}</td>`;
      html += `<td>${cond.Irms ? cond.Irms.toFixed(3) : '-'}</td>`;
      html += `<td>${cond.Ipeak ? cond.Ipeak.toFixed(3) : '-'}</td>`;
      html += `<td class="${zvsClass}">${zvsText}</td>`;
      html += `<td>${cond.sim_time ? cond.sim_time.toFixed(2) : '-'}</td>`;
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    
    // 详细结果
    html += '<h3 style="margin-top: 30px;">🔍 详细参数</h3>';
    html += '<div style="font-size: 12px; color: #6b7280;">';
    html += '<p>完整结果已保存至 verify_output.json，包含：</p>';
    html += '<ul>';
    html += '<li>各工况 ZVS 状态详情（H1-H4）</li>';
    html += '<li>开关管电流参数（I_off, I_rms）</li>';
    html += '<li>谐振腔参数（VCrp, I_Lrp, I_Lm, VCrs, I_Lrs）的 RMS/Max/Min</li>';
    html += '</ul>';
    html += '</div>';
    
    container.innerHTML = html;
    
    // 滚动到结果区
    resultsPanel.scrollIntoView({ behavior: 'smooth' });
  },

  /**
   * 导出 JSON
   */
  exportJSON() {
    if (!this.simulationResults) {
      this.showStatus('⚠️ 暂无仿真结果可导出', 'error');
      return;
    }
    
    const jsonStr = JSON.stringify(this.simulationResults, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'verify_output.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showStatus('✅ JSON 已导出：verify_output.json', 'success');
  },

  /**
   * 导出 CSV
   */
  exportCSV() {
    if (!this.simulationResults) {
      this.showStatus('⚠️ 暂无仿真结果可导出', 'error');
      return;
    }
    
    const conditions = this.simulationResults.conditions || [];
    if (conditions.length === 0) {
      this.showStatus('⚠️ 无工况数据', 'error');
      return;
    }
    
    // CSV 表头
    let csv = 'Condition,Vin,Vref,Po,Rload,Vo_avg,Irms,Ipeak,ZVS_Status,Sim_Time\n';
    
    // CSV 数据
    conditions.forEach((cond, idx) => {
      const zvsStatus = cond.zvsAllOk ? 'OK' : 'WARNING';
      csv += `${idx + 1},${cond.Vin || ''},${cond.Vref || ''},${cond.Po || ''},${cond.Rload || ''},`;
      csv += `${cond.Vo_avg || ''},${cond.Irms || ''},${cond.Ipeak || ''},${zvsStatus},${cond.sim_time || ''}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'verify_results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showStatus('✅ CSV 已导出：verify_results.csv', 'success');
  },

  /**
   * 清除结果
   */
  clearResults() {
    this.simulationResults = null;
    document.getElementById('results-panel').style.display = 'none';
    document.getElementById('results-table-container').innerHTML = '';
    document.getElementById('simulation-status').className = 'simulation-status';
    this.showStatus('🗑️ 结果已清除', 'success');
  },

  /**
   * 清空全部
   */
  clearAll() {
    const confirmed = confirm('确定要清空所有工况吗？此操作不可恢复。');
    if (confirmed) {
      document.getElementById('conditions-container').innerHTML = '';
      this.conditionCounter = 0;
      this.conditions = [];
      this.clearResults();
      this.addCondition();
    }
  },

  /**
   * 显示状态消息
   */
  showStatus(message, type) {
    // 移除旧消息
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
    
    // 3 秒后自动移除
    setTimeout(() => statusDiv.remove(), 3000);
  }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  LLCVerifier.init();
});
