% simulate_plecs_direct_multi.m
% PLECS 多工况直接仿真 - 使用 plecs('init') 和 plecs('simulate') API
% 输出完整数据：ZVS 状态、开关管参数、谐振腔参数
% 前提：手动开启 PLECS（RPC 通信需要）
% 输入：verify_input.json (包含 frozenParams 和 conditions)
% 输出：verify_output.json

function simulate_plecs_direct_multi()
    fprintf('========================================\n');
    fprintf('PLECS Multi-Condition Simulation\n');
    fprintf('========================================\n');
    
    try
        % 1. 读取输入
        simData = read_verify_json('verify_input.json');
        frozenParams = simData.frozenParams;
        conditions = simData.conditions;
        numConditions = length(conditions);
        
        % 2. 环境准备
        plecs_toolbox_path = 'C:\Users\m1774\Documents\Plexim\PLECS 4.7 (64 bit)\wbstoolbox';
        if exist(plecs_toolbox_path, 'dir'), addpath(plecs_toolbox_path); end
        
        model_name = 'SRC_backup';
        plecs('init', model_name);
        
        % 3. 循环仿真
        allResults = cell(numConditions, 1);
        
        for idx = 1:numConditions
            cond = conditions{idx};
            fprintf('\nCondition #%d: Vin=%.1fV, Vref=%.1fV, Po=%.1fW\n', idx, cond.Vin, cond.Vref, cond.Po);
            
            opts.ModelVars = struct(...
                'Vin', cond.Vin, 'Vref', cond.Vref, 'Po', cond.Po, ...
                'Lr', frozenParams.Lr * 1e-6, 'Crp', frozenParams.Cr_p * 1e-9, ...
                'Crs', frozenParams.Cr_s * 1e-9, 'Lm', frozenParams.Lm * 1e-6, ...
                'Np', frozenParams.Np, 'Ns', frozenParams.Ns, 'Rload', cond.Rload ...
            );
            
            tic;
            data = plecs('simulate', opts);
            sim_time = toc;
            
            % 稳态数据截取
            numPoints = length(data.Time);
            startIdx = floor(numPoints * 2/3);
            allValues = data.Values(:, startIdx:end);
            
            % --- 新增：FreCheck 信号提取 (假设在第 18 行) ---
            if size(allValues, 1) >= 18
                raw_fre_hz = allValues(18, :); 
                fre_khz = mean(raw_fre_hz) / 1000; % 换算为 kHz
            else
                fre_khz = 0; % 防止信号未定义导致报错
            end
            
            % 4. ZVS 分析 (1-12行)
            zvsStatus = cell(4, 1);
            zvsAllOk = true; 
            swData = allValues(1:12, :); 
            
            for k = 1:4
                baseIdx = (k-1)*3;
                dri = swData(baseIdx + 1, :);
                vds = swData(baseIdx + 2, :);
                risingEdges = find(diff(dri > 0.5) == 1);
                
                if isempty(risingEdges)
                    zvsStatus{k} = struct('status', 'No Switching');
                else
                    vds_at_turnon = max(vds(risingEdges));
                    if vds_at_turnon < 20
                        zvsStatus{k} = struct('status', 'ZVS OK');
                    else
                        zvsAllOk = false;
                        zvsStatus{k} = struct('status', sprintf('ZVS LOST (%.1fV)', vds_at_turnon));
                    end
                end
            end
            
            % 5. 开关管参数
            switchDetails = cell(4, 1);
            for k = 1:4
                i_sw = swData((k-1)*3 + 3, :);
                switchDetails{k} = struct('I_off', mean(i_sw), 'I_rms', sqrt(mean(i_sw.^2)));
            end
            
            % 6. 谐振腔参数 (13-17行)
            resonantCheck = cell(5, 1);
            resData = allValues(13:17, :);
            for k = 1:5
                sig = resData(k, :);
                resonantCheck{k} = struct('rms', sqrt(mean(sig.^2)), 'max', max(sig), 'min', min(sig));
            end
            
            % 封装结果
            allResults{idx} = struct(...
                'id', idx, ...
                'Vin', double(cond.Vin(1)), ...
                'Vref', double(cond.Vref(1)), ...
                'Po', double(cond.Po(1)), ...
                'Rload', double(cond.Rload(1)), ...
                'fre_khz', double(fre_khz(1)), ... % 新增字段
                'zvsStatus', {zvsStatus}, ... 
                'zvsAllOk', logical(zvsAllOk), ...
                'switchDetails', {switchDetails}, ... 
                'resonantCheck', {resonantCheck}, ... 
                'sim_time', double(sim_time(1)));
        end
        
        % 7. 保存
        result.success = true;
        result.timestamp = char(datetime('now'));
        result.numConditions = numConditions;
        result.frozenParams = frozenParams;
        result.conditions = allResults;
        
        write_verify_json('verify_output.json', result);
        fprintf('\nSUCCESS - Results saved to verify_output.json\n');
        
        % --- 新增：保存到 Excel ---
        excel_name = 'Simulation_Report.xlsx';
        save_results_to_excel(excel_name, result);
        fprintf('\nSUCCESS - All processes completed\n');
        
    catch err
        fprintf('\nFAILED: %s\n', err.message);
        error_result.success = false;
        error_result.error = err.message;
        error_result.timestamp = char(datetime('now'));
        write_verify_json('verify_output.json', error_result);
        rethrow(err);
    end
end

% 读取多工况 JSON
function simData = read_verify_json(filename)
    content = fileread(filename);
    
    % 解析 frozenParams
    simData.frozenParams.Cr_p = extract_num(content, 'Cr_p');
    simData.frozenParams.Cr_s = extract_num(content, 'Cr_s');
    simData.frozenParams.Lr = extract_num(content, 'Lr');
    simData.frozenParams.Lm = extract_num(content, 'Lm');
    simData.frozenParams.Np = extract_int(content, 'Np');
    simData.frozenParams.Ns = extract_int(content, 'Ns');
    
    % 解析 conditions 数组 (简化解析)
    simData.conditions = {};
    cond_pattern = '"Vin":\s*([\d.]+).*?"Vref":\s*([\d.]+).*?"Po":\s*([\d.]+).*?"Rload":\s*([\d.]+)';
    
    % 使用更简单的方法 - 逐行解析
    lines = strsplit(content, '\n');
    inCondition = false;
    currentCond = struct();
    
    for i = 1:length(lines)
        line = lines{i};
        
        if contains(line, '"Vin":')
            currentCond.Vin = extract_num_simple(line, 'Vin');
        elseif contains(line, '"Vref":')
            currentCond.Vref = extract_num_simple(line, 'Vref');
        elseif contains(line, '"Po":')
            currentCond.Po = extract_num_simple(line, 'Po');
        elseif contains(line, '"Rload":')
            currentCond.Rload = extract_num_simple(line, 'Rload');
            % 一个工况结束
            if isfield(currentCond, 'Vin') && isfield(currentCond, 'Vref')
                simData.conditions{end+1} = currentCond;
            end
            currentCond = struct();
        end
    end
end

% ---------------------------------------------------------
% 修正后的 JSON 写入函数 (增加 fre_khz 输出)
% ---------------------------------------------------------
function write_verify_json(filename, data)
    fid = fopen(filename, 'w');
    if fid == -1, error('Cannot open file %s', filename); end
    
    successStr = 'false';
    if isfield(data, 'success') && data.success(1), successStr = 'true'; end
    
    fprintf(fid, '{\n');
    fprintf(fid, '  "success": %s,\n', successStr);
    
    if isfield(data, 'error'), fprintf(fid, '  "error": "%s",\n', strrep(data.error, '"', '\"')); end
    if isfield(data, 'timestamp'), fprintf(fid, '  "timestamp": "%s",\n', data.timestamp); end
    if isfield(data, 'numConditions'), fprintf(fid, '  "numConditions": %d,\n', data.numConditions(1)); end
    
    if isfield(data, 'frozenParams')
        fp = data.frozenParams;
        fprintf(fid, '  "frozenParams": {\n');
        fprintf(fid, '    "Cr_p": %.6f, "Cr_s": %.6f, "Lr": %.6f, "Lm": %.6f, "Np": %d, "Ns": %d\n', ...
            fp.Cr_p(1), fp.Cr_s(1), fp.Lr(1), fp.Lm(1), fp.Np(1), fp.Ns(1));
        fprintf(fid, '  },\n');
    end
    
    if isfield(data, 'conditions')
        fprintf(fid, '  "conditions": [\n');
        conds = data.conditions;
        for i = 1:length(conds)
            c = conds{i}(1); 
            
            zvsOkStr = 'false';
            if isfield(c, 'zvsAllOk') && c.zvsAllOk(1), zvsOkStr = 'true'; end
            
            fprintf(fid, '    {\n');
            % 重点修改行：增加 fre_khz 字段，使用 %.2f 格式化
            fprintf(fid, '      "id": %d, "Vin": %.1f, "Vref": %.1f, "Po": %.1f, "Rload": %.2f, "fre_khz": %.2f,\n', ...
                c.id(1), c.Vin(1), c.Vref(1), c.Po(1), c.Rload(1), c.fre_khz(1));
            
            fprintf(fid, '      "zvsAllOk": %s, "sim_time": %.2f,\n', zvsOkStr, c.sim_time(1));
            
            % ZVS Status
            fprintf(fid, '      "zvsStatus": [\n');
            for j = 1:length(c.zvsStatus)
                fprintf(fid, '        {"status": "%s"}%s\n', c.zvsStatus{j}(1).status, char(ifelse(j<length(c.zvsStatus),',','')));
            end
            fprintf(fid, '      ],\n');
            
            % Switch Details
            fprintf(fid, '      "switchDetails": [\n');
            for j = 1:length(c.switchDetails)
                fprintf(fid, '        {"I_off": %.6f, "I_rms": %.6f}%s\n', c.switchDetails{j}(1).I_off, c.switchDetails{j}(1).I_rms, char(ifelse(j<length(c.switchDetails),',','')));
            end
            fprintf(fid, '      ],\n');
            
            % Resonant Check
            fprintf(fid, '      "resonantCheck": [\n');
            for j = 1:length(c.resonantCheck)
                fprintf(fid, '        {"rms": %.6f, "max": %.6f, "min": %.6f}%s\n', c.resonantCheck{j}(1).rms, c.resonantCheck{j}(1).max, c.resonantCheck{j}(1).min, char(ifelse(j<length(c.resonantCheck),',','')));
            end
            fprintf(fid, '      ]\n');
            
            fprintf(fid, '    }%s\n', char(ifelse(i<length(conds),',','')));
        end
        fprintf(fid, '  ]\n');
    end
    
    fprintf(fid, '}\n');
    fclose(fid);
    
end
% 提取数字 (通用)
function val = extract_num(str, key)
    pattern = sprintf('"%s":\\s*([\\d.eE+-]+)', key);
    tokens = regexp(str, pattern, 'tokens');
    if isempty(tokens)
        error('Key not found: %s', key);
    end
    val = str2double(tokens{1}{1});
end

% 提取整数
function val = extract_int(str, key)
    pattern = sprintf('"%s":\\s*(\\d+)', key);
    tokens = regexp(str, pattern, 'tokens');
    if isempty(tokens)
        error('Key not found: %s', key);
    end
    val = str2double(tokens{1}{1});
end


% 辅助函数：模拟三元运算
function out = ifelse(cond, a, b)
    if cond, out = a; else, out = b; end
end

% 辅助解析函数（保持原样或微调）
function val = extract_num_simple(line, key)
    res = regexp(line, [key '":\s*([\d.-]+)'], 'tokens');
    if ~isempty(res), val = str2double(res{1}{1}); else, val = 0; end
end

function save_results_to_excel(filename, data)
    try
        % --- 1. 准备并排序数据 ---
        conds_cell = data.conditions;
        numCond = length(conds_cell);
        
        % 提取基础数据用于排序
        vref_list = zeros(numCond, 1);
        for i = 1:numCond
            vref_list(i) = conds_cell{i}(1).Vref(1);
        end
        [~, sortIdx] = sort(vref_list); % 按 Vref 升序排列
        conds_sorted = conds_cell(sortIdx);

        % --- 2. 构造表头与数据矩阵 ---
        fp = data.frozenParams;
        paramData = {
            'Cr_p (nF)', fp.Cr_p(1); 'Cr_s (nF)', fp.Cr_s(1);
            'Lr (uH)', fp.Lr(1); 'Lm (uH)', fp.Lm(1);
            'Np', fp.Np(1); 'Ns', fp.Ns(1)
        };

        headers = {'ID', 'Vin_V', 'Vref_V', 'Po_W', 'Rload_Ohm', 'Frequency_kHz', 'ZVS_All_OK', 'SimTime_s'};
        for k = 1:4, headers = [headers, {sprintf('H%d_Status',k), sprintf('H%d_Ioff',k), sprintf('H%d_Irms',k)}]; end
        resNames = {'VCrp', 'ILrp', 'ILm', 'VCrs', 'ILrs'};
        for k = 1:5, headers = [headers, {sprintf('%s_RMS',resNames{k}), sprintf('%s_Max',resNames{k}), sprintf('%s_Min',resNames{k})}]; end

        tableData = cell(numCond, length(headers));
        for i = 1:numCond
            c = conds_sorted{i}(1);
            row = {c.id(1), c.Vin(1), c.Vref(1), c.Po(1), c.Rload(1), c.fre_khz(1), c.zvsAllOk(1), c.sim_time(1)};
            for k = 1:4
                row = [row, {c.zvsStatus{k}(1).status, c.switchDetails{k}(1).I_off, c.switchDetails{k}(1).I_rms}];
            end
            for k = 1:5
                row = [row, {c.resonantCheck{k}(1).rms, c.resonantCheck{k}(1).max, c.resonantCheck{k}(1).min}];
            end
            tableData(i, :) = row;
        end

        % --- 3. 写入基础数据 (使用快捷方式) ---
        fullPath = fullfile(pwd, filename);
        if exist(fullPath, 'file'), delete(fullPath); end % 删除旧文件防止冲突
        
        writecell({'Design Parameters'}, filename, 'Range', 'A1');
        writecell(paramData, filename, 'Range', 'A2');
        resultStartLine = 10;
        writecell(headers, filename, 'Range', ['A' num2str(resultStartLine)]);
        writecell(tableData, filename, 'Range', ['A' num2str(resultStartLine+1)]);

        % --- 4. 使用 ActiveX 绘制图表 ---
        Excel = actxserver('Excel.Application');
        Workbook = Excel.Workbooks.Open(fullPath);
        Sheet = Workbook.Sheets.Item(1);
        
        % 定义数据范围 (Vref 在 C 列，即第 3 列)
        xRange = sprintf('C%d:C%d', resultStartLine+1, resultStartLine + numCond);
        
        % 图表配置列表: {标题, Y轴数据列索引(数字或数组)}
        % 列索引参考: C=3, F=6, J=10, K=11, M=13, N=14, P=16, Q=17, S=19, T=20
        % VCrp=21-23, ILrp=24-26, ILm=27-29, VCrs=30-32, ILrs=33-35
        chartConfigs = {
            'Switch Ioff (A)', [10, 13, 16, 19];       % 图表 1
            'Switch Irms (A)', [11, 14, 17, 20];       % 图表 2
            'VCrp Metrics',    [21, 22, 23];           % 图表 3
            'ILrp Metrics',    [24, 25, 26];           % 图表 4
            'ILm Metrics',     [27, 28, 29];           % 图表 5
            'VCrs Metrics',    [30, 31, 32];           % 图表 6
            'ILrs Metrics',    [33, 34, 35];           % 图表 7
            'Frequency (kHz)', 6                       % 图表 8
        };

        chartTop = (resultStartLine + numCond + 5) * 15; % 起始高度位置
        for i = 1:length(chartConfigs)
            % 创建图表对象 [Left, Top, Width, Height]
            leftPos = mod(i-1, 2) * 350 + 50;
            topPos = chartTop + floor((i-1)/2) * 220;
            ChartObj = Sheet.ChartObjects.Add(leftPos, topPos, 330, 200);
            Chart = ChartObj.Chart;
            Chart.ChartType = 'xlLineMarkers'; % 带数据标记的折线图
            
            % 清除默认系列
            for k = Chart.SeriesCollection.Count:-1:1, Chart.SeriesCollection.Item(k).Delete; end
            
            % 添加数据系列
            yCols = chartConfigs{i, 2};
            for j = 1:length(yCols)
                Series = Chart.SeriesCollection.NewSeries;
                yRange = sprintf('%s%d:%s%d', char(64 + yCols(j)), resultStartLine+1, ...
                                             char(64 + yCols(j)), resultStartLine + numCond);
                % 处理超过 Z 列的情况 (简单转换，假设不超过 AI 列)
                if yCols(j) > 26
                    yRange = sprintf('A%s%d:A%s%d', char(64 + yCols(j) - 26), resultStartLine+1, ...
                                                   char(64 + yCols(j) - 26), resultStartLine + numCond);
                end
                
                Series.XValues = Sheet.Range(xRange);
                Series.Values = Sheet.Range(yRange);
                Series.Name = headers{yCols(j)};
            end
            
            Chart.HasTitle = true;
            Chart.ChartTitle.Text = chartConfigs{i, 1};
            Chart.Axes(1).HasTitle = true;
            Chart.Axes(1).AxisTitle.Text = 'Vref (V)';
        end

        Workbook.Save;
        Workbook.Close;
        Excel.Quit;
        delete(Excel);
        fprintf('[SUCCESS] Excel report with 8 charts generated: %s\n', filename);

    catch ME
        if exist('Excel', 'var'), Excel.Quit; delete(Excel); end
        fprintf('[ERROR] Excel creation failed: %s\n', ME.message);
    end
end