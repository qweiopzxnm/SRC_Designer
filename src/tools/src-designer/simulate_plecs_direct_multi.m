function simulate_plecs_direct_multi()
    fprintf('========================================\n');
    fprintf('PLECS Multi-Condition & Full Analysis (Integrated)\n');
    fprintf('========================================\n');
    
    try
        % 1. 读取 JSON 输入
        simData = read_verify_json('verify_input.json');
        frozenParams = simData.frozenParams;
        conditions = simData.conditions;
        numConditions = length(conditions);
        
        % 读取 MOSFET 模型和热仿真设置（可选字段）
        mosfetModels = [];
        thermalSettings = [];
        if isfield(simData, 'mosfetModels'), mosfetModels = simData.mosfetModels; end
        if isfield(simData, 'thermalSettings'), thermalSettings = simData.thermalSettings; end
        
        % 2. 环境准备
        plecs_toolbox_path = 'C:\Users\m1774\Documents\Plexim\PLECS 4.7 (64 bit)\wbstoolbox';
        if exist(plecs_toolbox_path, 'dir'), addpath(plecs_toolbox_path); end
        
        % 根据热仿真开关选择模型
        if isfield(thermalSettings, 'enabled') && thermalSettings.enabled
            model_name = 'SRC_backup_thermal';
            fprintf('🔥 Thermal Simulation Enabled (Tvj = %.1f°C)\n', thermalSettings.Tvj);
        else
            model_name = 'SRC_backup';
            fprintf('ℹ️ Standard Simulation (Thermal disabled)\n');
        end
        
        % 初始化 PLECS 模型
        plecs('init', model_name);
        
        % 确定热仿真温度
        if isfield(thermalSettings, 'enabled') && thermalSettings.enabled && isfield(thermalSettings, 'Tvj')
            current_tvj = thermalSettings.Tvj;
            fprintf('🌡️ Thermal simulation enabled. Tvj = %.1f°C\n', current_tvj);
        else
            current_tvj = 25; % 默认室温或一个占位符
            fprintf('ℹ️ Thermal settings disabled or missing, using default 25°C\n');
        end
        
        % --- 步骤 A: 从 JSON 中读取 thermal_vars_struct (前端已解析并让用户填写) ---
        thermal_vars_struct = struct();
        if isfield(simData, 'thermalVarsStruct') && ~isempty(simData.thermalVarsStruct)
            thermal_vars_struct = simData.thermalVarsStruct;
            % 打印变量名和值
            fn = fieldnames(thermal_vars_struct);
            for i = 1:length(fn)
                fprintf('   %s = %.4g\n', fn{i}, thermal_vars_struct.(fn{i}));
            end
        else
            % 如果没有 thermalVarsStruct，使用空结构体（不弹窗）
            fprintf('⚠️ 警告：verify_input.json 中未找到 thermalVarsStruct 字段\n');
            fprintf('   请在前端验证页面导入 MOSFET 模型并填写变量值后重新生成 JSON\n');
        end
        
        th_pri_ref = ['file:', mosfetModels.pri];
        th_sec_ref = ['file:', mosfetModels.sec];

        % 3. 循环仿真
        allResults = cell(numConditions, 1);
        for idx = 1:numConditions
            cond = conditions{idx};
            fprintf('\nSimulating Condition #%d: Vref=%.1fV, SecPS=%.1f\n', idx, cond.Vref, cond.SecPS);
            

            % 2. 准备 ModelVars（只放数值型参数）
            opts.ModelVars = struct(...
                'Vin', cond.Vin, ...
                'Vref', cond.Vref, ...
                'Po', cond.Po, ...
                'Lr', frozenParams.Lr * 1e-6, ...
                'Crp', frozenParams.Cr_p * 1e-9, ...
                'Crs', frozenParams.Cr_s * 1e-9, ...
                'Lm', frozenParams.Lm * 1e-6, ...
                'Np', frozenParams.Np, ...
                'Ns', frozenParams.Ns, ...
                'Rload', cond.Rload, ...
                'PriDB1', cond.PriDB1 * 1e-9, ...
                'PriDB2', cond.PriDB2 * 1e-9, ...
                'PriPS2', cond.PriPS2 * 1e-9, ...
                'SecDB_NonPS', cond.SecDB_NonPS * 1e-9, ...
                'SecDB_PS', cond.SecDB_PS * 1e-9, ...
                'SecPS', cond.SecPS * 1e-9, ...
                'th_pri', th_pri_ref, ...
                'th_sec', th_sec_ref, ...
                'Tvj', thermalSettings.Tvj, ...
                'thermal_vars_struct', thermal_vars_struct ...
            );

            data = plecs('simulate', opts);
            numPoints = length(data.Time);
            startIdx = floor(numPoints * 2/3);
            allValues = data.Values(:, startIdx:end);
            
            % 提取频率 (Hz -> kHz)
            fre_khz = mean(allValues(18, :)) / 1000;
            
            % 增加条件判断提取热损耗
            isThermal = isfield(thermalSettings, 'enabled') && thermalSettings.enabled;

            % 开关管分析 (1-12行) 
            zvsStatus = cell(4, 1); switchDetails = cell(4, 1);
            zvsAllOk = true; swData = allValues(1:12, :); 
            for k = 1:4
                baseIdx = (k-1)*3;
                dri = swData(baseIdx+1, :); vds = swData(baseIdx+2, :); isw = swData(baseIdx+3, :);
                
                % ZVS 检测 (上升沿)
                risingEdges = find(diff(dri > 0.5) == 1);
                if isempty(risingEdges), v_turnon = 999; else, v_turnon = max(vds(risingEdges)); end
                if v_turnon < 20, zvsStatus{k}.status = 'ZVS OK'; else, zvsAllOk = false; zvsStatus{k}.status = sprintf('LOST(%.1fV)', v_turnon); end
                
                % I_off 检测 (下降沿瞬时值)
                fallingEdges = find(diff(dri > 0.5) == -1);
                if isempty(fallingEdges)
                    curr_I_off = 0; 
                else
                    % 取最后一个周期的关断瞬时电流
                    curr_I_off = isw(fallingEdges(end)); 
                end
                
                % 封装：I_off 存储瞬时值，I_rms 存储有效值
                sIdx = struct('I_off', curr_I_off, 'I_rms', sqrt(mean(isw.^2)));
                
                % --- 仅在热模式下追加损耗数据 ---
                if isThermal
                    tBase = 18 + (k-1)*4;
                    sIdx.P_cond  = mean(allValues(tBase+1, :));
                    sIdx.P_swOn  = mean(allValues(tBase+2, :));
                    sIdx.P_swOff = mean(allValues(tBase+3, :));
                    sIdx.P_total = mean(allValues(tBase+4, :));
                end

                switchDetails{k} = sIdx;
            end
            % -----------------------------------------
            
            % 谐振腔参数 (13-17行)
            resonantCheck = cell(5, 1);
            for k = 1:5
                sig = allValues(12+k, :);
                resonantCheck{k} = struct('rms', sqrt(mean(sig.^2)), 'max', max(sig), 'min', min(sig));
            end
            
            % 封装结果
            allResults{idx} = struct(...
                'id', cond.id, 'Vin', cond.Vin, 'Vref', cond.Vref, 'Po', cond.Po, 'Rload', cond.Rload, ...
                'PriDB1', cond.PriDB1, 'PriDB2', cond.PriDB2, 'PriPS2', cond.PriPS2, ...
                'SecDB_NonPS', cond.SecDB_NonPS, 'SecDB_PS', cond.SecDB_PS, 'SecPS', cond.SecPS, ...
                'fre_khz', fre_khz, 'zvsAllOk', zvsAllOk, 'zvsStatus', {zvsStatus}, ... 
                'switchDetails', {switchDetails}, 'resonantCheck', {resonantCheck}, 'sim_time', toc);
        end
        
        finalReport.frozenParams = frozenParams;
        finalReport.conditions = allResults;
        save_results_to_excel('Simulation_Report.xlsx', finalReport);
        fprintf('\nDone! Report generated.\n');
        
    catch err
        rethrow(err);
    end
end


function save_results_to_excel(filename, data)
    try
        conds_cell = data.conditions;
        numCond = length(conds_cell);
        fp = data.frozenParams;
        
        % --- 1. 排序 ---
        vrefs = cellfun(@(x) x.Vref, conds_cell);
        [~, vIdx] = sort(vrefs);
        conds_v = conds_cell(vIdx);
        fres = cellfun(@(x) x.fre_khz, conds_cell);
        [~, fIdx] = sort(fres);
        conds_f = conds_cell(fIdx);

        % --- 2. 构建表头 ---
        isThermalData = isfield(conds_cell{1}.switchDetails{1}, 'P_total');
        headers = {'ID', 'Vin', 'Vref', 'Po', 'Rload', 'PriDB1', 'PriDB2', 'PriPS2', 'SecDB_NonPS', 'SecDB_PS', 'SecPS', ...
                   'Frequency_kHz', 'ZVS_All_OK', 'SimTime_s'};
        for k = 1:4
            headers = [headers, {sprintf('H%d_Status',k), sprintf('H%d_Ioff',k), sprintf('H%d_Irms',k)}];
            if isThermalData
                headers = [headers, {sprintf('H%d_P_cond',k), sprintf('H%d_P_on',k), sprintf('H%d_P_off',k), sprintf('H%d_P_total',k)}];
            end
        end
        resNames = {'VCrp', 'ILrp', 'ILm', 'VCrs', 'ILrs'};
        for k = 1:5, headers = [headers, {sprintf('%s_RMS',resNames{k}), sprintf('%s_Max',resNames{k}), sprintf('%s_Min',resNames{k})}]; end
        headers = [headers, {'V_Crp_pp', 'V_Crs_pp', 'I_Crp_single', 'I_Crs_single'}];

        % --- 3. 填充数据 ---
        tableData = cell(numCond, length(headers));
        for i = 1:numCond
            c = conds_v{i};
            row = {c.id, c.Vin, c.Vref, c.Po, c.Rload, c.PriDB1, c.PriDB2, c.PriPS2, c.SecDB_NonPS, c.SecDB_PS, c.SecPS, ...
                   c.fre_khz, c.zvsAllOk, c.sim_time};
            for k = 1:4
                sd = c.switchDetails{k};
                row = [row, {c.zvsStatus{k}.status, sd.I_off, sd.I_rms}];
                if isThermalData
                    row = [row, {sd.P_cond, sd.P_swOn, sd.P_swOff, sd.P_total}];
                end
            end
            for k = 1:5, row = [row, {c.resonantCheck{k}.rms, c.resonantCheck{k}.max, c.resonantCheck{k}.min}]; end
            row = [row, {c.resonantCheck{1}.max - c.resonantCheck{1}.min, ...
                         c.resonantCheck{4}.max - c.resonantCheck{4}.min, ...
                         c.resonantCheck{2}.rms/fp.Np_cap, ...
                         c.resonantCheck{5}.rms/fp.Ns_cap}];
            tableData(i, :) = row;
        end

        % --- 4. 辅助函数 (不包含赋值操作，是安全的) ---
        idx2letter = @(idx) [repmat(char(64+floor((idx-1)/26)), idx>26, 1), char(64+mod(idx-1,26)+1)]';
        getIdx = @(name) find(strcmp(headers, name));

        % --- 5. 写入文件 ---
        if exist(filename, 'file'), delete(filename); end
        fpData = {'--- DESIGN PARAMETERS ---', ''; 'Cr_p(nF)', fp.Cr_p; 'Cr_s(nF)', fp.Cr_s; ...
                  'Lr(uH)', fp.Lr; 'Lm(uH)', fp.Lm; 'Np', fp.Np; 'Ns', fp.Ns; ...
                  'Np_cap', fp.Np_cap; 'Ns_cap', fp.Ns_cap; '', ''};
        writecell(fpData, filename, 'Sheet', 'Main', 'Range', 'A1');
        resStartRow = size(fpData, 1) + 1;
        writecell(headers, filename, 'Sheet', 'Main', 'Range', ['A' num2str(resStartRow)]);
        writecell(tableData, filename, 'Sheet', 'Main', 'Range', ['A' num2str(resStartRow + 1)]);
        
        % 写入辅助数据 (用于 Spec 绘图)
        helperTable = cell(numCond, 5);
        for i = 1:numCond
            c = conds_f{i};
            helperTable(i, :) = {c.fre_khz, c.resonantCheck{1}.max-c.resonantCheck{1}.min, ...
                                 c.resonantCheck{4}.max-c.resonantCheck{4}.min, ...
                                 c.resonantCheck{2}.rms/fp.Np_cap, c.resonantCheck{5}.rms/fp.Ns_cap};
        end
        writecell({'Helper_Freq', 'Helper_VppP', 'Helper_VppS', 'Helper_IP', 'Helper_IS'}, filename, 'Sheet', 'Main', 'Range', 'AZ1');
        writecell(helperTable, filename, 'Sheet', 'Main', 'Range', 'AZ2');
        
        hasISpec = isfile('CapCurrent.csv'); if hasISpec, writetable(readtable('CapCurrent.csv'), filename, 'Sheet', 'CapCurrentSpec'); end
        hasVSpec = isfile('CapVoltage.csv'); if hasVSpec, writetable(readtable('CapVoltage.csv'), filename, 'Sheet', 'CapVoltageSpec'); end

        % --- 6. ActiveX 绘图与上色 ---
        Excel = actxserver('Excel.Application');
        WB = Excel.Workbooks.Open(fullfile(pwd, filename));
        Sheet = WB.Sheets.Item('Main');
        Sheet.UsedRange.Columns.ColumnWidth = 10;
        Sheet.UsedRange.NumberFormat = "0.0";

        % --- A. 色块区分逻辑 (修正赋值报错) ---
        colorGroups = {
            'ID', 'Po', 15773696;           % 浅蓝
            'Rload', 'SimTime_s', 14277081; % 浅灰
            'VCrp_RMS', 'ILrp_Min', 10079487; % 浅橙
            'ILm_RMS', 'ILm_Min', 13082334;   % 浅紫
            'VCrs_RMS', 'ILrs_Min', 16777164; % 浅青
            'V_Crp_pp', 'I_Crs_single', 12119039 % 浅粉
        };
        for g = 1:size(colorGroups, 1)
            cRng = Sheet.Range(sprintf('%s%d:%s%d', idx2letter(getIdx(colorGroups{g,1})), resStartRow, ...
                                                    idx2letter(getIdx(colorGroups{g,2})), resStartRow + numCond));
            cRng.Interior.Color = colorGroups{g,3};
        end
        % 开关管组单独处理 (绿黄交替)
        hColors = {13434828, 13434879};
        for k = 1:4
            sHead = sprintf('H%d_Status', k);
            if isThermalData, eHead = sprintf('H%d_P_total', k); else, eHead = sprintf('H%d_Irms', k); end
            hRng = Sheet.Range(sprintf('%s%d:%s%d', idx2letter(getIdx(sHead)), resStartRow, ...
                                                    idx2letter(getIdx(eHead)), resStartRow + numCond));
            hRng.Interior.Color = hColors{mod(k,2)+1};
        end

        % 统一边框
        Sheet.Range(sprintf('A%d:%s%d', resStartRow, idx2letter(length(headers)), resStartRow + numCond)).Borders.LineStyle = 1;

        % --- B. 基础折线图 ---
        xVrefRange = Sheet.Range(sprintf('C%d:C%d', resStartRow+1, resStartRow+numCond));
        configs = {
            'Switch Ioff', [getIdx('H1_Ioff'), getIdx('H2_Ioff'), getIdx('H3_Ioff'), getIdx('H4_Ioff')];
            'Switch Irms', [getIdx('H1_Irms'), getIdx('H2_Irms'), getIdx('H3_Irms'), getIdx('H4_Irms')];
            'VCrp Metrics', [getIdx('VCrp_RMS'), getIdx('VCrp_Max'), getIdx('VCrp_Min')];
            'ILrp Metrics', [getIdx('ILrp_RMS'), getIdx('ILrp_Max'), getIdx('ILrp_Min')];
            'ILm Metrics', [getIdx('ILm_RMS'), getIdx('ILm_Max'), getIdx('ILm_Min')];
            'VCrs Metrics', [getIdx('VCrs_RMS'), getIdx('VCrs_Max'), getIdx('VCrs_Min')];
            'ILrs Metrics', [getIdx('ILrs_RMS'), getIdx('ILrs_Max'), getIdx('ILrs_Min')];
            'Frequency(kHz)', getIdx('Frequency_kHz')
        };
        chartTop = (resStartRow + numCond + 5) * 15;
        for i = 1:size(configs, 1)
            CO = Sheet.ChartObjects.Add(mod(i-1,2)*350+50, chartTop+floor((i-1)/2)*220, 330, 200);
            C = CO.Chart; C.ChartType = 'xlLineMarkers';
            yCols = configs{i, 2};
            for j = 1:length(yCols)
                colStr = idx2letter(yCols(j));
                S = C.SeriesCollection.NewSeries; S.XValues = xVrefRange;
                S.Values = Sheet.Range(sprintf('%s%d:%s%d', colStr, resStartRow+1, colStr, resStartRow+numCond));
                S.Name = headers{yCols(j)};
            end
            C.HasTitle = true; C.ChartTitle.Text = configs{i, 1};
        end

        % --- C. Spec 对比图 ---
        chartTop = chartTop + 1000;
        xFreqSorted = Sheet.Range(sprintf('AZ2:AZ%d', numCond + 1));
        if hasISpec
            COI = Sheet.ChartObjects.Add(50, chartTop, 480, 300); CI = COI.Chart; CI.ChartType = 'xlXYScatterLines'; 
            S1 = CI.SeriesCollection.NewSeries; S1.XValues = xFreqSorted; S1.Values = Sheet.Range(sprintf('BC2:BC%d', numCond + 1)); S1.Name = 'Sim_Pri_Cap_I';
            S2 = CI.SeriesCollection.NewSeries; S2.XValues = xFreqSorted; S2.Values = Sheet.Range(sprintf('BD2:BD%d', numCond + 1)); S2.Name = 'Sim_Sec_Cap_I';
            SpecSheet = WB.Sheets.Item('CapCurrentSpec'); lastR = SpecSheet.UsedRange.Rows.Count;
            S3 = CI.SeriesCollection.NewSeries; S3.XValues = SpecSheet.Range(sprintf('A2:A%d', lastR)); S3.Values = SpecSheet.Range(sprintf('B2:B%d', lastR)); 
            S3.Name = 'Spec_Limit'; S3.Format.Line.ForeColor.RGB = 255;
            CI.HasTitle = true; CI.ChartTitle.Text = 'Cap Current Stress vs Freq'; chartTop = chartTop + 320;
        end
        if hasVSpec
            COV = Sheet.ChartObjects.Add(50, chartTop, 480, 300); CV = COV.Chart; CV.ChartType = 'xlXYScatterLines';
            SV1 = CV.SeriesCollection.NewSeries; SV1.XValues = xFreqSorted; SV1.Values = Sheet.Range(sprintf('BA2:BA%d', numCond + 1)); SV1.Name = 'Sim_Pri_Cap_Vpp';
            SV2 = CV.SeriesCollection.NewSeries; SV2.XValues = xFreqSorted; SV2.Values = Sheet.Range(sprintf('BB2:BB%d', numCond + 1)); SV2.Name = 'Sim_Sec_Cap_Vpp';
            SpecVSheet = WB.Sheets.Item('CapVoltageSpec'); lastR = SpecVSheet.UsedRange.Rows.Count;
            SV3 = CV.SeriesCollection.NewSeries; SV3.XValues = SpecVSheet.Range(sprintf('A2:A%d', lastR)); SV3.Values = SpecVSheet.Range(sprintf('B2:B%d', lastR));
            SV3.Name = 'Spec_Vpp_Limit'; SV3.Format.Line.ForeColor.RGB = 255;
            CV.HasTitle = true; CV.ChartTitle.Text = 'Cap Voltage P-P vs Freq'; chartTop = chartTop + 320;
        end

        % --- D. 热损耗图 ---
        if isThermalData
            lossChartTop = chartTop + 50; 
            for i = 1:4
                colStart = getIdx(sprintf('H%d_P_cond', i));
                CO = Sheet.ChartObjects.Add(mod(i-1,2)*450+50, lossChartTop+floor((i-1)/2)*250, 430, 230);
                C = CO.Chart; C.ChartType = 'xlLineMarkers';
                for j = 0:3
                    colIdx = colStart + j; colStr = idx2letter(colIdx);
                    S = C.SeriesCollection.NewSeries; S.XValues = xVrefRange;
                    S.Values = Sheet.Range(sprintf('%s%d:%s%d', colStr, resStartRow+1, colStr, resStartRow+numCond));
                    S.Name = headers{colIdx};
                end
                C.HasTitle = true; C.ChartTitle.Text = sprintf('H%d Thermal Loss (W)', i);
            end
        end

        WB.Save; WB.Close; Excel.Quit; delete(Excel);
    catch ME
        if exist('Excel','var'), try WB.Close(false); end; Excel.Quit; end
        rethrow(ME);
    end
end

function simData = read_verify_json(filename)
    % 读取并解析 JSON 文件
    raw = fileread(filename);
    decoded = jsondecode(raw);
    
    % 1. 提取原有的参数和工况数据
    simData.frozenParams = decoded.frozenParams;
    
    % 处理 conditions 数组
    simData.conditions = cell(length(decoded.conditions), 1);
    for i = 1:length(decoded.conditions)
        simData.conditions{i} = decoded.conditions(i);
    end
    
    % 2. 提取新增的 MOSFET 模型路径
    % 这样在 PLECS 中可以通过 simData.mosfetModels.pri 获取文件名
    simData.mosfetModels = decoded.mosfetModels;
    
    % 3. 提取热仿真设置
    % 包含 enabled (bool) 和 Tvj (数值)
    simData.thermalSettings = decoded.thermalSettings;
    simData.thermalVarsStruct = decoded.thermalVarsStruct;
end

%% 定义解析模型函数
function thermalVars = getThermalFileVariables(filePath)
    thermalVars = struct('Name', {}, 'DefaultValue', {});
    try
        xDoc = xmlread(filePath);
        % 寻找所有 Variable 节点
        allVars = xDoc.getElementsByTagName('Variable');
        for i = 0:allVars.getLength-1
            thisVar = allVars.item(i);
            
            % 提取变量名
            nameNode = thisVar.getElementsByTagName('Name').item(0);
            varName = char(nameNode.getFirstChild.getData);
            
            % 提取默认值 (如果有的话)
            defaultVal = '';
            defaultNode = thisVar.getElementsByTagName('DefaultValue').item(0);
            if ~isempty(defaultNode) && ~isempty(defaultNode.getFirstChild)
                defaultVal = char(defaultNode.getFirstChild.getData);
            end
            
            thermalVars(end+1).Name = varName;
            thermalVars(end).DefaultValue = defaultVal;
        end
    catch ME
        warning('无法读取热损耗文件: %s. 错误: %s', filePath, ME.message);
    end
end