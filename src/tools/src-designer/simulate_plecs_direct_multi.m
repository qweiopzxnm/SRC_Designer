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
            fprintf('\nCondition #%d: Vin=%.1fV, Po=%.1fW\n', idx, cond.Vin, cond.Po);
            
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
        % 1. 准备设计参数数据 (frozenParams)
        fp = data.frozenParams;
        paramHeader = {'Design Parameters', 'Value', 'Unit'};
        paramData = {
            'Cr_p (Primary Resonant Cap)', fp.Cr_p(1), 'nF';
            'Cr_s (Secondary Resonant Cap)', fp.Cr_s(1), 'nF';
            'Lr (Resonant Inductor)', fp.Lr(1), 'uH';
            'Lm (Magnetizing Inductor)', fp.Lm(1), 'uH';
            'Np (Primary Turns)', fp.Np(1), 'turns';
            'Ns (Secondary Turns)', fp.Ns(1), 'turns'
        };

        % 2. 准备详细仿真结果 (打平嵌套结构)
        conds = data.conditions;
        numCond = length(conds);
        
        % 预定义表头
        headers = {'ID', 'Vin_V', 'Vref_V', 'Po_W', 'Rload_Ohm', 'Frequency_kHz', 'ZVS_All_OK', 'SimTime_s'};
        % 动态添加开关管表头 (H1-H4)
        for k = 1:4
            headers = [headers, {sprintf('H%d_Status',k), sprintf('H%d_Ioff_A',k), sprintf('H%d_Irms_A',k)}];
        end
        % 动态添加谐振腔表头 (5个信号)
        resNames = {'VCrp', 'ILrp', 'ILm', 'VCrs', 'ILrs'};
        for k = 1:5
            headers = [headers, {sprintf('%s_RMS',resNames{k}), sprintf('%s_Max',resNames{k}), sprintf('%s_Min',resNames{k})}];
        end

        % 初始化数据矩阵 (Cell 格式)
        tableData = cell(numCond, length(headers));

        for i = 1:numCond
            c = conds{i}(1); % 强制标量引用
            
            % 基础数据
            row = {c.id(1), c.Vin(1), c.Vref(1), c.Po(1), c.Rload(1), c.fre_khz(1), c.zvsAllOk(1), c.sim_time(1)};
            
            % 展开开关管数据 (ZVS + Details)
            for k = 1:4
                zvs = c.zvsStatus{k}(1);
                sw = c.switchDetails{k}(1);
                row = [row, {zvs.status, sw.I_off, sw.I_rms}];
            end
            
            % 展开谐振腔数据
            for k = 1:5
                res = c.resonantCheck{k}(1);
                row = [row, {res.rms, res.max, res.min}];
            end
            
            tableData(i, :) = row;
        end

        % 3. 写入 Excel
        % 写入参数区
        writecell(paramHeader, filename, 'Range', 'A1');
        writecell(paramData, filename, 'Range', 'A2');

        % 间隔两行写入结果区
        resultStartLine = size(paramData, 1) + 4;
        writecell({'Simulation Detailed Results'}, filename, 'Range', ['A' num2str(resultStartLine-1)]);
        
        % 写入表头
        writecell(headers, filename, 'Range', ['A' num2str(resultStartLine)]);
        
        % 写入数据内容
        writecell(tableData, filename, 'Range', ['A' num2str(resultStartLine+1)]);

        fprintf('[SUCCESS] Detailed Excel report generated: %s\n', filename);
        
    catch ME
        fprintf('[WARNING] Excel report failed: %s\n', ME.message);
        fprintf('请检查是否未关闭 Excel 文件或变量名不匹配。\n');
    end
end