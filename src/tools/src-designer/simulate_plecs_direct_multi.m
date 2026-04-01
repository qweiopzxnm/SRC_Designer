% simulate_plecs_direct_multi.m
% PLECS 多工况直接仿真 - 使用 plecs('init') 和 plecs('simulate') API
% 输出完整数据：ZVS 状态、开关管参数、谐振腔参数
% 前提：手动开启 PLECS（RPC 通信需要）
% 输入：verify_input.json (包含 frozenParams 和 conditions)
% 输出：verify_output.json

function simulate_plecs_direct_multi()
    fprintf('========================================\n');
    fprintf('PLECS Multi-Condition Simulation (Updated)\n');
    fprintf('========================================\n');
    
    try
        % 1. 读取输入 (包含新变量)
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
            fprintf('\nCondition #%d: Vin=%.1fV, Vref=%.1fV, PS=%.1f\n', idx, cond.Vin, cond.Vref, cond.PS);
            
            % --- 集成新参数到 ModelVars ---
            opts.ModelVars = struct(...
                'Vin', cond.Vin, 'Vref', cond.Vref, 'Po', cond.Po, ...
                'Lr', frozenParams.Lr * 1e-6, 'Crp', frozenParams.Cr_p * 1e-9, ...
                'Crs', frozenParams.Cr_s * 1e-9, 'Lm', frozenParams.Lm * 1e-6, ...
                'Np', frozenParams.Np, 'Ns', frozenParams.Ns, 'Rload', cond.Rload, ...
                'PriDB1', cond.PriDB1 * 1e-9, 'PriDB2', cond.PriDB2 * 1e-9, 'PriPS2', cond.PriPS2 * 1e-9, ...
                'SecDB_NonPS', cond.SecDB_NonPS * 1e-9, 'SecDB_PS', cond.SecDB_PS * 1e-9, 'PS', cond.PS * 1e-9 ...
            );
            
            tic;
            data = plecs('simulate', opts);
            sim_time = toc;
            
            % 数据处理
            numPoints = length(data.Time);
            startIdx = floor(numPoints * 2/3);
            allValues = data.Values(:, startIdx:end);
            
            % 频率提取 (第18行)
            fre_khz = mean(allValues(18, :)) / 1000;
            
            % ZVS & 开关管分析 (1-12行)
            zvsStatus = cell(4, 1);
            switchDetails = cell(4, 1);
            zvsAllOk = true; 
            swData = allValues(1:12, :); 
            
            for k = 1:4
                baseIdx = (k-1)*3;
                dri = swData(baseIdx+1, :); vds = swData(baseIdx+2, :); isw = swData(baseIdx+3, :);
                risingEdges = find(diff(dri > 0.5) == 1);
                
                % ZVS判断
                if isempty(risingEdges)
                    zvsStatus{k} = struct('status', 'No Switching');
                else
                    v_turnon = max(vds(risingEdges));
                    if v_turnon < 20, zvsStatus{k} = struct('status', 'ZVS OK');
                    else, zvsAllOk = false; zvsStatus{k} = struct('status', sprintf('ZVS LOST(%.1fV)', v_turnon)); end
                end
                % 电流提取
                switchDetails{k} = struct('I_off', mean(isw), 'I_rms', sqrt(mean(isw.^2)));
            end
            
            % 谐振腔参数 (13-17行)
            resonantCheck = cell(5, 1);
            for k = 1:5
                sig = allValues(12+k, :);
                resonantCheck{k} = struct('rms', sqrt(mean(sig.^2)), 'max', max(sig), 'min', min(sig));
            end
            
            % 封装结果 (加入新变量以便Excel调用)
            allResults{idx} = struct(...
                'id', idx, 'Vin', cond.Vin, 'Vref', cond.Vref, 'Po', cond.Po, 'Rload', cond.Rload, ...
                'PriDB1', cond.PriDB1, 'PriDB2', cond.PriDB2, 'PriPS2', cond.PriPS2, ...
                'SecDB_NonPS', cond.SecDB_NonPS, 'SecDB_PS', cond.SecDB_PS, 'PS', cond.PS, ...
                'fre_khz', fre_khz, 'zvsAllOk', zvsAllOk, 'zvsStatus', {zvsStatus}, ... 
                'switchDetails', {switchDetails}, 'resonantCheck', {resonantCheck}, 'sim_time', sim_time);
        end
        
        % 保存结果
        result.frozenParams = frozenParams;
        result.conditions = allResults;
        save_results_to_excel('Simulation_Report.xlsx', result);
        fprintf('\nSUCCESS - Simulation and Excel generation finished.\n');
        
    catch err
        fprintf('\nFAILED: %s\n', err.message);
        rethrow(err);
    end
end

% --- 修改 JSON 解析以支持新变量 ---
function simData = read_verify_json(filename)
    content = fileread(filename);
    % 解析 frozenParams (略，保持你之前的逻辑)
    simData.frozenParams.Cr_p = extract_val(content, 'Cr_p');
    simData.frozenParams.Cr_s = extract_val(content, 'Cr_s');
    simData.frozenParams.Lr = extract_val(content, 'Lr');
    simData.frozenParams.Lm = extract_val(content, 'Lm');
    simData.frozenParams.Np = extract_val(content, 'Np');
    simData.frozenParams.Ns = extract_val(content, 'Ns');

    % 逐行解析 Conditions
    simData.conditions = {};
    lines = strsplit(content, '\n');
    cur = struct();
    for i = 1:length(lines)
        l = lines{i};
        if contains(l, '"Vin":'), cur.Vin = extract_num(l, 'Vin');
        elseif contains(l, '"Vref":'), cur.Vref = extract_num(l, 'Vref');
        elseif contains(l, '"Po":'), cur.Po = extract_num(l, 'Po');
        elseif contains(l, '"Rload":'), cur.Rload = extract_num(l, 'Rload');
        % 新增解析行
        elseif contains(l, '"PriDB1":'), cur.PriDB1 = extract_num(l, 'PriDB1');
        elseif contains(l, '"PriDB2":'), cur.PriDB2 = extract_num(l, 'PriDB2');
        elseif contains(l, '"PriPS2":'), cur.PriPS2 = extract_num(l, 'PriPS2');
        elseif contains(l, '"SecDB_NonPS":'), cur.SecDB_NonPS = extract_num(l, 'SecDB_NonPS');
        elseif contains(l, '"SecDB_PS":'), cur.SecDB_PS = extract_num(l, 'SecDB_PS');
        elseif contains(l, '"PS":'), cur.PS = extract_num(l, 'PS');
            % 以 PS 为工况结束标志存入
            simData.conditions{end+1} = cur; cur = struct();
        end
    end
end

function v = extract_num(l, k), r = regexp(l, [k '":\s*([\d.-]+)'], 'tokens'); if ~isempty(r), v = str2double(r{1}{1}); else, v=0; end; end
function v = extract_val(c, k), r = regexp(c, [k '":\s*([\d.-]+)'], 'tokens'); if ~isempty(r), v = str2double(r{1}{1}); else, v=0; end; end

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
% % 提取数字 (通用)
% function val = extract_num(str, key)
%     pattern = sprintf('"%s":\\s*([\\d.eE+-]+)', key);
%     tokens = regexp(str, pattern, 'tokens');
%     if isempty(tokens)
%         error('Key not found: %s', key);
%     end
%     val = str2double(tokens{1}{1});
% end

% % 提取整数
% function val = extract_int(str, key)
%     pattern = sprintf('"%s":\\s*(\\d+)', key);
%     tokens = regexp(str, pattern, 'tokens');
%     if isempty(tokens)
%         error('Key not found: %s', key);
%     end
%     val = str2double(tokens{1}{1});
% end


% 辅助函数：模拟三元运算
function out = ifelse(cond, a, b)
    if cond, out = a; else, out = b; end
end

% % 辅助解析函数（保持原样或微调）
% function val = extract_num_simple(line, key)
%     res = regexp(line, [key '":\s*([\d.-]+)'], 'tokens');
%     if ~isempty(res), val = str2double(res{1}{1}); else, val = 0; end
% end

% --- 增强版 Excel 导出函数 (带绘图功能) ---
function save_results_to_excel(filename, data)
    try
        conds_cell = data.conditions;
        numCond = length(conds_cell);
        
        % 按 Vref 排序
        vrefs = cellfun(@(x) x.Vref, conds_cell);
        [~, sIdx] = sort(vrefs);
        conds = conds_cell(sIdx);

        % 表头定义 (增加了新变量)
        headers = {'ID', 'Vin', 'Vref', 'Po', 'Rload', 'PriDB1', 'PriDB2', 'PriPS2', 'SecDB_NonPS', 'SecDB_PS', 'PS', ...
                   'Frequency_kHz', 'ZVS_All_OK', 'SimTime_s'};
        for k = 1:4, headers = [headers, {sprintf('H%d_Status',k), sprintf('H%d_Ioff',k), sprintf('H%d_Irms',k)}]; end
        resNames = {'VCrp', 'ILrp', 'ILm', 'VCrs', 'ILrs'};
        for k = 1:5, headers = [headers, {sprintf('%s_RMS',resNames{k}), sprintf('%s_Max',resNames{k}), sprintf('%s_Min',resNames{k})}]; end

        % 填入数据
        tableData = cell(numCond, length(headers));
        for i = 1:numCond
            c = conds{i};
            row = {c.id, c.Vin, c.Vref, c.Po, c.Rload, c.PriDB1, c.PriDB2, c.PriPS2, c.SecDB_NonPS, c.SecDB_PS, c.PS, ...
                   c.fre_khz, c.zvsAllOk, c.sim_time};
            for k = 1:4, row = [row, {c.zvsStatus{k}.status, c.switchDetails{k}.I_off, c.switchDetails{k}.I_rms}]; end
            for k = 1:5, row = [row, {c.resonantCheck{k}.rms, c.resonantCheck{k}.max, c.resonantCheck{k}.min}]; end
            tableData(i, :) = row;
        end

        % 写入 Excel
        if exist(filename, 'file'), delete(filename); end
        writecell(headers, filename, 'Range', 'A1');
        writecell(tableData, filename, 'Range', 'A2');

        % --- ActiveX 绘图逻辑 (重新计算列索引) ---
        % 注意：因为插入了6个变量，Vref 现在是第3列 (C)，
        % 频率列变为第12列，开关管数据从第15列开始...
        Excel = actxserver('Excel.Application');
        WB = Excel.Workbooks.Open(fullfile(pwd, filename));
        Sheet = WB.Sheets.Item(1);
        xRange = sprintf('C2:C%d', numCond+1); % X轴始终是 Vref (C列)
        
        % {标题, Y轴列索引}
        % Ioff: 16, 19, 22, 25 | Irms: 17, 20, 23, 26
        % VCrp: 27-29, ILrp: 30-32, ILm: 33-35, VCrs: 36-38, ILrs: 39-41
        configs = {
            'Switch Ioff (A)', [16, 19, 22, 25];
            'Switch Irms (A)', [17, 20, 23, 26];
            'VCrp Metrics',    [27, 28, 29];
            'ILrp Metrics',    [30, 31, 32];
            'ILm Metrics',     [33, 34, 35];
            'VCrs Metrics',    [36, 37, 38];
            'ILrs Metrics',    [39, 40, 41];
            'Frequency (kHz)', 12
        };

        chartTop = (numCond + 5) * 15;
        for i = 1:length(configs)
            CO = Sheet.ChartObjects.Add(mod(i-1,2)*350+50, chartTop+floor((i-1)/2)*220, 330, 200);
            C = CO.Chart; C.ChartType = 'xlLineMarkers';
            for k=C.SeriesCollection.Count:-1:1, C.SeriesCollection.Item(k).Delete; end
            
            yCols = configs{i, 2};
            for j = 1:length(yCols)
                S = C.SeriesCollection.NewSeries;
                col = yCols(j);
                % 处理 Excel 列标 (A-Z, AA-AZ)
                if col <= 26, colName = char(64+col); else, colName = ['A' char(64+col-26)]; end
                S.XValues = Sheet.Range(xRange);
                S.Values = Sheet.Range(sprintf('%s2:%s%d', colName, colName, numCond+1));
                S.Name = headers{col};
            end
            C.HasTitle = true; C.ChartTitle.Text = configs{i, 1};
        end
        WB.Save; WB.Close; Excel.Quit; delete(Excel);
    catch ME
        if exist('Excel','var'), Excel.Quit; end
        rethrow(ME);
    end
end