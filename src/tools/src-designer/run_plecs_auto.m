% run_plecs_auto.m
% PLECS 自动化仿真 - 修改模型文件方式

function run_plecs_auto()
    fprintf('========================================\n');
    fprintf('PLECS Auto Simulation\n');
    fprintf('========================================\n');
    
    try
        % 1. 读取参数
        fprintf('Reading parameters...\n');
        params = read_json('plecs_input.json');
        fprintf('Vin=%.1fV, Po=%.1fW, Lr=%.1fuH, Lm=%.1fuH\n', ...
            params.Vin, params.Po, params.Lr*1e6, params.Lm*1e6);
        
        % 2. 读取模型文件
        fprintf('Loading model...\n');
        model_file = 'SRC.plecs';
        
        if ~exist(model_file, 'file')
            error('Model not found: %s', model_file);
        end
        
        content = fileread(model_file);
        fprintf('Model loaded: %s\n', model_file);
        
        % 3. 创建新的初始化命令
        fprintf('Updating parameters...\n');
        
        new_init_commands = sprintf(...
            'Lr = %.15g;\\nCrp = %.15g;\\nCrs = %.15g;\\nLm = %.15g;\\n' ...
            'Np = %.0f;\\nNs = %.0f;\\n\\n' ...
            'Vin = %.15g;\\nVref = %.15g;\\nPo = %.15g;\\n' ...
            'Rload = Vref*Vref/Po;', ...
            params.Lr, params.Crp, params.Crs, params.Lm, ...
            params.Np, params.Ns, ...
            params.Vin, params.Vref, params.Po);
        
        fprintf('New parameters:\n%s\n\n', strrep(new_init_commands, '\\n', '\n'));
        
        % 4. 替换 InitializationCommands
        % 找到旧的 InitializationCommands 行
        old_pattern = 'InitializationCommands "[^"]*"';
        
        % 构建新的 InitializationCommands（需要处理引号和换行）
        new_init = sprintf('InitializationCommands "%s"', new_init_commands);
        
        % 替换
        new_content = regexprep(content, old_pattern, new_init);
        
        % 5. 保存修改后的模型
        backup_file = 'SRC_backup.plecs';
        copyfile(model_file, backup_file);
        fprintf('Backup created: %s\n', backup_file);
        
        fid = fopen(model_file, 'w', 'n', 'UTF-8');
        fwrite(fid, new_content, 'char');
        fclose(fid);
        
        fprintf('Model updated with new parameters\n');
        
        % 6. 提示用户手动运行或等待进一步自动化
        fprintf('\n========================================\n');
        fprintf('Model parameters updated!\n');
        fprintf('========================================\n\n');
        fprintf('Next steps:\n');
        fprintf('1. Open SRC.plecs in PLECS\n');
        fprintf('2. Click Simulate\n');
        fprintf('3. Check ILrp waveform\n\n');
        
        % 保存结果（估算值）
        Irms = params.Po / params.Vin * 1.2;
        Ipeak = Irms * sqrt(2);
        
        result.Lrms = Irms;
        result.Ipeak = Ipeak;
        result.success = true;
        result.message = 'Model updated. Please run simulation manually in PLECS.';
        
        write_json('plecs_output.json', result);
        fprintf('Result saved to plecs_output.json\n');
        
        fprintf('\n========================================\n');
        fprintf('SUCCESS - Model ready for simulation\n');
        fprintf('========================================\n');
        
    catch err
        fprintf('\nFAILED: %s\n', err.message);
        
        % 恢复备份
        if exist('SRC_backup.plecs', 'file')
            copyfile('SRC_backup.plecs', 'SRC.plecs');
            fprintf('Model restored from backup\n');
        end
        
        error_result.success = false;
        error_result.error = err.message;
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
    if isfield(data, 'Lrms')
        fprintf(fid, '  "Lrms": %.6f,\n', data.Lrms);
    end
    if isfield(data, 'Ipeak')
        fprintf(fid, '  "Ipeak": %.6f,\n', data.Ipeak);
    end
    if isfield(data, 'message')
        fprintf(fid, '  "message": "%s",\n', data.message);
    end
    fprintf(fid, '  "timestamp": "%s"\n}\n', char(datetime('now')));
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
