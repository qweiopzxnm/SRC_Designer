% simulate_plecs_direct.m
% PLECS 直接仿真 - 使用 plecs('init') 和 plecs('simulate') API
% 输出完整数据：ZVS 状态、开关管参数、谐振腔参数
% 前提：手动开启 PLECS（RPC 通信需要）

function simulate_plecs_direct()
    fprintf('========================================\n');
    fprintf('PLECS Direct Simulation (RPC API)\n');
    fprintf('========================================\n');
    
    try
        % 1. 读取参数
        fprintf('Reading parameters...\n');
        params = read_json('plecs_input.json');
        fprintf('Vin=%.1fV, Po=%.1fW\n', params.Vin, params.Po);
        fprintf('Lr=%.1fuH, Lm=%.1fuH\n', params.Lr*1e6, params.Lm*1e6);
        
        % 2. 添加 PLECS 工具箱路径
        fprintf('\nAdding PLECS toolbox to path...\n');
        plecs_toolbox_path = 'C:\Users\m1774\Documents\Plexim\PLECS 4.7 (64 bit)\wbstoolbox';
        addpath(plecs_toolbox_path);
        savepath;  % 永久保存路径
        fprintf('PLECS toolbox path added and saved\n');
        
        % 3. 初始化 PLECS 模型
        fprintf('\nInitializing PLECS model...\n');
        model_name = 'SRC_backup';
        modelPath = 'C:\Users\m1774\Desktop\src-designer\src-designer\SRC_backup.plecs';
        
        % 使用 plecs('init') 初始化模型
        plecs('init', model_name);
        fprintf('Model initialized: %s\n', model_name);
        
        % 4. 运行仿真
        fprintf('\nRunning simulation...\n');
        opts.ModelVars = struct(...
            'Vin',   params.Vin, ...
            'Vref',  params.Vref, ...
            'Po',    params.Po, ...
            'Lr',    params.Lr, ...
            'Crp',   params.Crp, ...
            'Crs',   params.Crs, ...
            'Lm',    params.Lm, ...
            'Np',    params.Np, ...
            'Ns',    params.Ns, ...
            'Rload', params.Rload ...
        );
        tic;
        data = plecs('simulate', opts);
        sim_time = toc;
        fprintf('Simulation completed in %.2f seconds\n', sim_time);
        
        % 5. 数据处理 - 截取最后 1/3 稳态部分
        fprintf('\nProcessing data (extracting steady-state: last 1/3)...\n');
        numPoints = length(data.Time);
        startIdx = floor(numPoints * 2/3);
        fprintf('Total points: %d, Steady-state start index: %d\n', numPoints, startIdx);
        
        % 截取后的时间轴
        steadyState.Time = data.Time(startIdx:end);
        
        % 6. 按照端口信号数量分类提取
        % PLECS 的 Values 矩阵通常为 [信号行 x 时间列]
        allValues = data.Values(:, startIdx:end);
        
        % 根据 Mux 节点的信号输入数量进行切片：
        % 端口 1 (ZVSCheck1): 3+3 = 6 个信号
        steadyState.ZVSCheck1 = allValues(1:6, :);
        
        % 端口 2 (ZVSCheck2): 3+3 = 6 个信号
        steadyState.ZVSCheck2 = allValues(7:12, :);
        
        % 端口 3 (ResonantCheck): 5 个信号
        steadyState.ResonantCheck = allValues(13:17, :);
        
        fprintf('Signal extraction:\n');
        fprintf('  ZVSCheck1: %d signals x %d points\n', size(steadyState.ZVSCheck1, 1), size(steadyState.ZVSCheck1, 2));
        fprintf('  ZVSCheck2: %d signals x %d points\n', size(steadyState.ZVSCheck2, 1), size(steadyState.ZVSCheck2, 2));
        fprintf('  ResonantCheck: %d signals x %d points\n', size(steadyState.ResonantCheck, 1), size(steadyState.ResonantCheck, 2));
        fprintf('  Total signals in model: %d\n', size(allValues, 1));
        
        % 7. 计算关键指标
        fprintf('\nCalculating key metrics...\n');
        
        % 从 ZVSCheck1 提取谐振电流（假设第 1 个信号是 ILr）
        ILr = steadyState.ZVSCheck1(1, :);
        Irms = sqrt(mean(ILr.^2));  % 计算 RMS
        Ipeak = max(abs(ILr));       % 计算峰值
        
        % 从 LogicCheck 提取输出电压（假设第 1 个信号是 Vo）
        Vo = steadyState.ResonantCheck(1, :);
        Vo_avg = mean(Vo);
        
        fprintf('Key metrics:\n');
        fprintf('  Irms = %.3f A\n', Irms);
        fprintf('  Ipeak = %.3f A\n', Ipeak);
        fprintf('  Vo_avg = %.1f V\n', Vo_avg);

        
        % 8. ResonantCheck 参数计算 (5 个信号)
        fprintf('\n================== Resonant Check (稳态) ==================\n');
        resonantNames = {'VCrp', 'I_Lrp', 'I_Lm', 'VCrs', 'I_Lrs'};
        resonantCheck = cell(5, 1);
        
        % 直接使用 5 次循环，确保每个信号都被处理
        for i = 1:5
            if i <= size(steadyState.ResonantCheck, 1)
                sig = steadyState.ResonantCheck(i, :);
                rms_val = sqrt(mean(sig.^2));
                max_val = max(sig);
                min_val = min(sig);
                resonantCheck{i} = struct('rms', rms_val, 'max', max_val, 'min', min_val);
                fprintf('%-10s | RMS: %-8.4f | Max: %-8.4f | Min: %-8.4f\n', ...
                    resonantNames{i}, rms_val, max_val, min_val);
            else
                fprintf('WARNING: Signal %d not available\n', i);
                resonantCheck{i} = struct('rms', 0, 'max', 0, 'min', 0);
            end
        end
        
        % 9. ZVS & 开关特性分析
        fprintf('\n================== Switch Characteristics ==================\n');
        swData = [steadyState.ZVSCheck1; steadyState.ZVSCheck2]; 
        hNames = {'H1', 'H2', 'H3', 'H4'};
        zvsStatus = cell(4, 1);
        switchDetails = cell(4, 1);
        
        for k = 1:4
            baseIdx = (k-1)*3;
            dri = swData(baseIdx + 1, :);
            vds = swData(baseIdx + 2, :);
            i_sw = swData(baseIdx + 3, :);
            
            % --- a) ZVS 判定 (寻找上升沿) ---
            risingEdges = find(diff(dri > 0.5) == 1);
            
            if isempty(risingEdges)
                zvsStatus{k} = struct('status', 'No Switching', 'vds_at_turnon', NaN);
            else
                % 检查驱动信号跳变前 1 个采样点的 Vds
                checkIndices = risingEdges;
                vds_at_turnon = vds(checkIndices);
                
                if all(vds_at_turnon < 20)
                    zvsStatus{k} = struct('status', sprintf('Dri_%s ZVS [OK]', hNames{k}), ...
                        'vds_at_turnon', mean(vds_at_turnon));
                else
                    bad_vds = max(vds_at_turnon);
                    zvsStatus{k} = struct('status', sprintf('WARNING: Dri_%s ZVS LOST (Vds ≈ %.2fV)', hNames{k}, bad_vds), ...
                        'vds_at_turnon', bad_vds);
                end
            end
            
            % --- b) 关断电流分析 (取下降沿前一刻的电流) ---
            fallingEdges = find(diff(dri > 0.5) == -1);
            if ~isempty(fallingEdges)
                i_off_values = i_sw(max(1, fallingEdges));
                i_off_avg = mean(i_off_values);
            else
                i_off_avg = NaN;
            end
            
            % --- c) 电流有效值 ---
            i_rms = sqrt(mean(i_sw.^2));
            
            switchDetails{k} = struct(...
                'I_off', i_off_avg, ...
                'I_rms', i_rms);
            
            % --- 打印结果 ---
            fprintf('开关管 %s:\n', hNames{k});
            fprintf(' - %s\n', zvsStatus{k}.status);
            fprintf(' - I_%s Off (关断瞬间电流): %.4f A\n', hNames{k}, i_off_avg);
            fprintf(' - I_%s RMS (全周期有效值): %.4f A\n', hNames{k}, i_rms);
            fprintf('----------------------------------------------------------\n');
        end
        
        % 10. 保存结果
        result.success = true;
        result.simulation_time_sec = sim_time;
        result.Irms = Irms;
        result.Ipeak = Ipeak;
        result.Vo_avg = Vo_avg;
        result.steady_state_points = length(steadyState.Time);
        result.timestamp = char(datetime('now'));
        
        % ZVS 状态
        result.zvsStatus = zvsStatus;
        
        % 开关管详细参数
        result.switchDetails = switchDetails;
        
        % 谐振腔参数
        result.resonantCheck = resonantCheck;
        
        % 保存波形数据（可选，用于后续分析/绘图）
        save('steadyState.mat', 'steadyState');
        fprintf('\nWaveform data saved to: steadyState.mat\n');
        
        % 保存 JSON 结果
        write_json('plecs_output.json', result);
        fprintf('Results saved to: plecs_output.json\n');
        
        fprintf('\n========================================\n');
        fprintf('SUCCESS\n');
        fprintf('========================================\n');
        
    catch err
        fprintf('\n========================================\n');
        fprintf('FAILED\n');
        fprintf('========================================\n');
        fprintf('Error: %s\n', err.message);
        
        % 将 stack 转换为字符串
        if isfield(err, 'stack') && ~isempty(err.stack)
            stack_str = err.stack(1).name;
            if isfield(err.stack(1), 'line')
                stack_str = sprintf('%s (line %d)', stack_str, err.stack(1).line);
            end
            fprintf('Location: %s\n', stack_str);
        end
        
        error_result.success = false;
        error_result.error = err.message;
        error_result.timestamp = char(datetime('now'));
        write_json('plecs_output.json', error_result);
        
        rethrow(err);
    end
end

% JSON 读取
function data = read_json(filename)
    content = fileread(filename);
    data = struct();
    data.Lr = extract_num(content, 'Lr');
    data.Crp = extract_num(content, 'Crp');
    data.Crs = extract_num(content, 'Crs');
    data.Lm = extract_num(content, 'Lm');
    data.Np = extract_num(content, 'Np');
    data.Ns = extract_num(content, 'Ns');
    data.Vin = extract_num(content, 'Vin');
    data.Vref = extract_num(content, 'Vref');
    data.Rload = extract_num(content, 'Rload');
    data.Po = extract_num(content, 'Po');
end

% JSON 写入
function write_json(filename, data)
    fid = fopen(filename, 'w');
    fprintf(fid, '{\n');
    fprintf(fid, '  "success": %s,\n', lower(num2str(data.success)));
    
    if isfield(data, 'Irms')
        fprintf(fid, '  "Irms": %.6f,\n', data.Irms);
    end
    if isfield(data, 'Ipeak')
        fprintf(fid, '  "Ipeak": %.6f,\n', data.Ipeak);
    end
    if isfield(data, 'Vo_avg')
        fprintf(fid, '  "Vo_avg": %.2f,\n', data.Vo_avg);
    end
    if isfield(data, 'simulation_time_sec')
        fprintf(fid, '  "simulation_time_sec": %.2f,\n', data.simulation_time_sec);
    end
    if isfield(data, 'steady_state_points')
        fprintf(fid, '  "steady_state_points": %d,\n', data.steady_state_points);
    end
    if isfield(data, 'timestamp')
        fprintf(fid, '  "timestamp": "%s",\n', data.timestamp);
    end
    
    % ZVS 状态数组
    if isfield(data, 'zvsStatus') && ~isempty(data.zvsStatus)
        fprintf(fid, '  "zvsStatus": [\n');
        for i = 1:length(data.zvsStatus)
            zvs = data.zvsStatus{i};
            fprintf(fid, '    {"status": "%s"}', strrep(zvs.status, '"', '\"'));
            if i < length(data.zvsStatus)
                fprintf(fid, ',\n');
            else
                fprintf(fid, '\n');
            end
        end
        fprintf(fid, '  ],\n');
    end
    
    % 开关管详细参数数组
    if isfield(data, 'switchDetails') && ~isempty(data.switchDetails)
        fprintf(fid, '  "switchDetails": [\n');
        for i = 1:length(data.switchDetails)
            sw = data.switchDetails{i};
            fprintf(fid, '    {\n');
            fprintf(fid, '      "I_off": %.6f,\n', sw.I_off);
            fprintf(fid, '      "I_rms": %.6f,\n', sw.I_rms);
            fprintf(fid, '    }');
            if i < length(data.switchDetails)
                fprintf(fid, ',\n');
            else
                fprintf(fid, '\n');
            end
        end
        fprintf(fid, '  ],\n');
    end
    
    % 谐振腔参数数组
    if isfield(data, 'resonantCheck') && ~isempty(data.resonantCheck)
        fprintf(fid, '  "resonantCheck": [\n');
        for i = 1:length(data.resonantCheck)
            res = data.resonantCheck{i};
            % 处理 NaN 值
            rms_str = num2str(res.rms);
            max_str = num2str(res.max);
            min_str = num2str(res.min);
            if strcmp(rms_str, 'NaN'), rms_str = 'null'; else rms_str = sprintf('%.6f', res.rms); end
            if strcmp(max_str, 'NaN'), max_str = 'null'; else max_str = sprintf('%.6f', res.max); end
            if strcmp(min_str, 'NaN'), min_str = 'null'; else min_str = sprintf('%.6f', res.min); end
            
            fprintf(fid, '    {\n');
            fprintf(fid, '      "rms": %s,\n', rms_str);
            fprintf(fid, '      "max": %s,\n', max_str);
            fprintf(fid, '      "min": %s\n', min_str);
            fprintf(fid, '    }');
            if i < length(data.resonantCheck)
                fprintf(fid, ',\n');
            else
                fprintf(fid, '\n');
            end
        end
        fprintf(fid, '  ]\n');
    else
        fprintf(fid, '  "resonantCheck": []\n');
    end
    
    if isfield(data, 'error')
        fprintf(fid, ',\n  "error": "%s"', strrep(data.error, '"', '\"'));
    end
    
    fprintf(fid, '\n}\n');
    fclose(fid);
end

% 提取数字
function val = extract_num(str, key)
    pattern = sprintf('"%s":\\s*([\\d.eE+-]+)', key);
    tokens = regexp(str, pattern, 'tokens');
    if isempty(tokens)
        error('Key not found: %s', key);
    end
    val = str2double(tokens{1}{1});
end
