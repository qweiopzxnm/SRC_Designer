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
        
        % 设置 MOSFET 模型路径 (Thermal Description Search Path)
        if isfield(mosfetModels, 'pri') && ~isempty(mosfetModels.pri)
            priPath = mosfetModels.pri;
            % 提取目录路径
            [priDir, ~, ~] = fileparts(priPath);
            plecs('set', [model_name '/Electrical'], 'ThermalDescriptionSearchPath', priDir);
            fprintf('📁 Primary MOSFET model path: %s\n', priPath);
        end
        if isfield(mosfetModels, 'sec') && ~isempty(mosfetModels.sec)
            secPath = mosfetModels.sec;
            [secDir, ~, ~] = fileparts(secPath);
            plecs('set', [model_name '/Electrical'], 'ThermalDescriptionSearchPath', ...
                [plecs('get', [model_name '/Electrical'], 'ThermalDescriptionSearchPath') ';' secDir]);
            fprintf('📁 Secondary MOSFET model path: %s\n', secPath);
        end
        
        % 如果启用热仿真，设置 Tvj 参数
        if isfield(thermalSettings, 'enabled') && thermalSettings.enabled && isfield(thermalSettings, 'Tvj')
            plecs('set', [model_name '/Parameters'], 'Tvj', thermalSettings.Tvj);
            fprintf('🌡️ Tvj set to %.1f°C\n', thermalSettings.Tvj);
        end
        
        % 3. 循环仿真
        allResults = cell(numConditions, 1);
        for idx = 1:numConditions
            cond = conditions{idx};
            fprintf('\nSimulating Condition #%d: Vref=%.1fV, SecPS=%.1f\n', idx, cond.Vref, cond.SecPS);
            
            % 参数映射 (含 ns 换算)
            opts.ModelVars = struct(...
                'Vin', cond.Vin, 'Vref', cond.Vref, 'Po', cond.Po, ...
                'Lr', frozenParams.Lr * 1e-6, 'Crp', frozenParams.Cr_p * 1e-9, ...
                'Crs', frozenParams.Cr_s * 1e-9, 'Lm', frozenParams.Lm * 1e-6, ...
                'Np', frozenParams.Np, 'Ns', frozenParams.Ns, 'Rload', cond.Rload, ...
                'PriDB1', cond.PriDB1 * 1e-9, 'PriDB2', cond.PriDB2 * 1e-9, 'PriPS2', cond.PriPS2 * 1e-9, ...
                'SecDB_NonPS', cond.SecDB_NonPS * 1e-9, 'SecDB_PS', cond.SecDB_PS * 1e-9, 'SecPS', cond.SecPS * 1e-9 ...
            );
            
            data = plecs('simulate', opts);
            numPoints = length(data.Time);
            startIdx = floor(numPoints * 2/3);
            allValues = data.Values(:, startIdx:end);
            
            % 提取频率 (Hz -> kHz)
            fre_khz = mean(allValues(18, :)) / 1000;
            
            % 开关管分析 (1-12行) --- 【核心修改位置】 ---
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
                switchDetails{k} = struct('I_off', curr_I_off, 'I_rms', sqrt(mean(isw.^2)));
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
        
        % --- 逻辑 1：主表排序 (按 Vref 升序) ---
        vrefs = cellfun(@(x) x.Vref, conds_cell);
        [~, vIdx] = sort(vrefs);
        conds_v = conds_cell(vIdx);

        % --- 逻辑 2：Spec图辅助排序 (按 Frequency 升序) ---
        fres = cellfun(@(x) x.fre_khz, conds_cell);
        [~, fIdx] = sort(fres);
        conds_f = conds_cell(fIdx);

        % 1. 顶部固定参数
        fpData = {'--- DESIGN PARAMETERS ---', ''; 'Cr_p(nF)', fp.Cr_p; 'Cr_s(nF)', fp.Cr_s; ...
                  'Lr(uH)', fp.Lr; 'Lm(uH)', fp.Lm; 'Np', fp.Np; 'Ns', fp.Ns; ...
                  'Np_cap', fp.Np_cap; 'Ns_cap', fp.Ns_cap; '', ''};

        % 2. 表头
        headers = {'ID', 'Vin', 'Vref', 'Po', 'Rload', 'PriDB1', 'PriDB2', 'PriPS2', 'SecDB_NonPS', 'SecDB_PS', 'SecPS', ...
                   'Frequency_kHz', 'ZVS_All_OK', 'SimTime_s'};
        for k = 1:4, headers = [headers, {sprintf('H%d_Status',k), sprintf('H%d_Ioff',k), sprintf('H%d_Irms',k)}]; end
        resNames = {'VCrp', 'ILrp', 'ILm', 'VCrs', 'ILrs'};
        for k = 1:5, headers = [headers, {sprintf('%s_RMS',resNames{k}), sprintf('%s_Max',resNames{k}), sprintf('%s_Min',resNames{k})}]; end
        headers = [headers, {'V_Crp_pp', 'V_Crs_pp', 'I_Crp_single', 'I_Crs_single'}];

        % 3. 数据行填充 (主表：Vref排序)
        tableData = cell(numCond, length(headers));
        for i = 1:numCond
            c = conds_v{i};
            row = {c.id, c.Vin, c.Vref, c.Po, c.Rload, c.PriDB1, c.PriDB2, c.PriPS2, c.SecDB_NonPS, c.SecDB_PS, c.SecPS, ...
                   c.fre_khz, c.zvsAllOk, c.sim_time};
            for k = 1:4, row = [row, {c.zvsStatus{k}.status, c.switchDetails{k}.I_off, c.switchDetails{k}.I_rms}]; end
            for k = 1:5, row = [row, {c.resonantCheck{k}.rms, c.resonantCheck{k}.max, c.resonantCheck{k}.min}]; end
            vcrp_pp = c.resonantCheck{1}.max - c.resonantCheck{1}.min;
            vcrs_pp = c.resonantCheck{4}.max - c.resonantCheck{4}.min;
            row = [row, {vcrp_pp, vcrs_pp, c.resonantCheck{2}.rms/fp.Np_cap, c.resonantCheck{5}.rms/fp.Ns_cap}];
            tableData(i, :) = row;
        end

        % 4. 辅助绘图数据填充 (辅助区：Frequency排序)
        % 列定义: [Sorted_Freq, Vpp_P, Vpp_S, I_P, I_S]
        helperTable = cell(numCond, 5);
        for i = 1:numCond
            c = conds_f{i};
            helperTable(i, :) = {c.fre_khz, ...
                                 c.resonantCheck{1}.max - c.resonantCheck{1}.min, ...
                                 c.resonantCheck{4}.max - c.resonantCheck{4}.min, ...
                                 c.resonantCheck{2}.rms/fp.Np_cap, ...
                                 c.resonantCheck{5}.rms/fp.Ns_cap};
        end

        % 5. 写入文件
        if exist(filename, 'file'), delete(filename); end
        writecell(fpData, filename, 'Sheet', 'Main', 'Range', 'A1');
        resStartRow = size(fpData, 1) + 1;
        writecell(headers, filename, 'Sheet', 'Main', 'Range', ['A' num2str(resStartRow)]);
        writecell(tableData, filename, 'Sheet', 'Main', 'Range', ['A' num2str(resStartRow + 1)]);
        
        % 写入辅助数据到 AZ 列（第 52 列），平时阅读不会干扰
        writecell({'Helper_Freq', 'Helper_VppP', 'Helper_VppS', 'Helper_IP', 'Helper_IS'}, filename, 'Sheet', 'Main', 'Range', 'AZ1');
        writecell(helperTable, filename, 'Sheet', 'Main', 'Range', 'AZ2');

        hasISpec = isfile('CapCurrent.csv'); if hasISpec, writetable(readtable('CapCurrent.csv'), filename, 'Sheet', 'CapCurrentSpec'); end
        hasVSpec = isfile('CapVoltage.csv'); if hasVSpec, writetable(readtable('CapVoltage.csv'), filename, 'Sheet', 'CapVoltageSpec'); end

        % 6. ActiveX 绘图
        Excel = actxserver('Excel.Application');
        WB = Excel.Workbooks.Open(fullfile(pwd, filename));
        Sheet = WB.Sheets.Item('Main');
        
        Sheet.UsedRange.Columns.ColumnWidth = 10;
        Sheet.UsedRange.NumberFormat = "0.0";
        dataRange = Sheet.Range(sprintf('A%d:AS%d', resStartRow, resStartRow + numCond));
        dataRange.Borders.LineStyle = 1;

        % --- A. 传统图表 (保持不变，X轴为 Vref) ---
        xVrefRange = Sheet.Range(sprintf('C%d:C%d', resStartRow+1, resStartRow+numCond));
        configs = {'Switch Ioff', [16,19,22,25]; 'Switch Irms', [17,20,23,26]; 'VCrp Metrics', [27,28,29]; 'ILrp Metrics', [30,31,32]; ...
                   'ILm Metrics', [33,34,35]; 'VCrs Metrics', [36,37,38]; 'ILrs Metrics', [39,40,41]; 'Frequency(kHz)', 12};
        chartTop = (resStartRow + numCond + 5) * 15;
        for i = 1:length(configs)
            CO = Sheet.ChartObjects.Add(mod(i-1,2)*350+50, chartTop+floor((i-1)/2)*220, 330, 200);
            C = CO.Chart; C.ChartType = 'xlLineMarkers';
            try for k=C.SeriesCollection.Count:-1:1, C.SeriesCollection.Item(k).Delete; end; catch; end
            yCols = configs{i, 2};
            for j = 1:length(yCols)
                colIdx = yCols(j);
                if colIdx <= 26, cn = char(64+colIdx); else, cn = ['A' char(64+colIdx-26)]; end
                S = C.SeriesCollection.NewSeries; S.XValues = xVrefRange;
                S.Values = Sheet.Range(sprintf('%s%d:%s%d', cn, resStartRow+1, cn, resStartRow+numCond));
                S.Name = headers{colIdx};
            end
            C.HasTitle = true; C.ChartTitle.Text = configs{i, 1};
            C.Axes(1).TickLabels.Orientation = 45;
        end
        
        % --- B. Spec 对比图 (关键修复：指向 AZ 列以后的有序辅助数据) ---
        chartTop = chartTop + 1000;
        xFreqSorted = Sheet.Range(sprintf('AZ2:AZ%d', numCond + 1));
        
        % 电流对比 (Helper_IP 是 BC 列, Helper_IS 是 BD 列)
        if hasISpec
            COI = Sheet.ChartObjects.Add(50, chartTop, 480, 300);
            CI = COI.Chart; CI.ChartType = 'xlXYScatterLines'; 
            try for k=CI.SeriesCollection.Count:-1:1, CI.SeriesCollection.Item(k).Delete; end; catch; end
            
            % 仿真系列 - 改为引用辅助区
            S1 = CI.SeriesCollection.NewSeries; S1.XValues = xFreqSorted;
            S1.Values = Sheet.Range(sprintf('BC2:BC%d', numCond + 1)); S1.Name = 'Sim_Pri_Cap_I';
            S2 = CI.SeriesCollection.NewSeries; S2.XValues = xFreqSorted;
            S2.Values = Sheet.Range(sprintf('BD2:BD%d', numCond + 1)); S2.Name = 'Sim_Sec_Cap_I';
            
            % Spec 系列
            SpecSheet = WB.Sheets.Item('CapCurrentSpec'); lastR = SpecSheet.UsedRange.Rows.Count;
            S3 = CI.SeriesCollection.NewSeries; 
            S3.XValues = SpecSheet.Range(sprintf('A2:A%d', lastR));
            S3.Values = SpecSheet.Range(sprintf('B2:B%d', lastR)); 
            S3.Name = 'Spec_Limit'; S3.Format.Line.ForeColor.RGB = 255;
            
            CI.HasTitle = true; CI.ChartTitle.Text = 'Cap Current Stress vs Freq (Smooth)';
            CI.Axes(1).HasTitle = true; CI.Axes(1).AxisTitle.Text = 'Frequency (kHz)';
            CI.Axes(1).TickLabels.Orientation = 45;
            CI.Axes(1).HasMajorGridlines = true;
            chartTop = chartTop + 320;
        end

        % 电压对比 (Helper_VppP 是 BA 列, Helper_VppS 是 BB 列)
        if hasVSpec
            COV = Sheet.ChartObjects.Add(50, chartTop, 480, 300);
            CV = COV.Chart; CV.ChartType = 'xlXYScatterLines';
            try for k=CV.SeriesCollection.Count:-1:1, CV.SeriesCollection.Item(k).Delete; end; catch; end
            
            SV1 = CV.SeriesCollection.NewSeries; SV1.XValues = xFreqSorted;
            SV1.Values = Sheet.Range(sprintf('BA2:BA%d', numCond + 1)); SV1.Name = 'Sim_Pri_Cap_Vpp';
            SV2 = CV.SeriesCollection.NewSeries; SV2.XValues = xFreqSorted;
            SV2.Values = Sheet.Range(sprintf('BB2:BB%d', numCond + 1)); SV2.Name = 'Sim_Sec_Cap_Vpp';
            
            SpecVSheet = WB.Sheets.Item('CapVoltageSpec'); lastR = SpecVSheet.UsedRange.Rows.Count;
            SV3 = CV.SeriesCollection.NewSeries; 
            SV3.XValues = SpecVSheet.Range(sprintf('A2:A%d', lastR));
            SV3.Values = SpecVSheet.Range(sprintf('B2:B%d', lastR));
            SV3.Name = 'Spec_Vpp_Limit'; SV3.Format.Line.ForeColor.RGB = 255;
            
            CV.HasTitle = true; CV.ChartTitle.Text = 'Cap Voltage P-P vs Freq (Smooth)';
            CV.Axes(1).HasTitle = true; CV.Axes(1).AxisTitle.Text = 'Frequency (kHz)';
            CV.Axes(1).TickLabels.Orientation = 45;
            CV.Axes(1).HasMajorGridlines = true;
        end

        WB.Save; WB.Close; Excel.Quit; delete(Excel);
    catch ME
        if exist('Excel','var'), WB.Close(false); Excel.Quit; end
        rethrow(ME);
    end
end

function simData = read_verify_json(filename)
    raw = fileread(filename);
    decoded = jsondecode(raw);
    simData.frozenParams = decoded.frozenParams;
    simData.conditions = cell(length(decoded.conditions), 1);
    for i = 1:length(decoded.conditions), simData.conditions{i} = decoded.conditions(i); end
end