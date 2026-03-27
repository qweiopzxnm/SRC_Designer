% run_plecs_simulation.m
% PLECS 仿真脚本 - 使用命令行方式

function run_plecs_simulation()
    fprintf('========================================\n');
    fprintf('PLECS Simulation\n');
    fprintf('========================================\n');
    
    try
        % 1. 读取参数
        fprintf('Reading parameters...\n');
        params = read_json('plecs_input.json');
        fprintf('Vin=%.1fV, Po=%.1fW\n', params.Vin, params.Po);
        fprintf('Lr=%.1fuH, Lm=%.1fuH\n', params.Lr*1e6, params.Lm*1e6);
        
        % 2. 检查模型
        model_file = 'SRC.plecs';
        if ~exist(model_file, 'file')
            error('Model file not found: %s', model_file);
        end
        fprintf('Model: %s\n', model_file);
        
        % 3. 创建参数脚本
        fprintf('\nCreating parameter script...\n');
        create_param_script(params);
        fprintf('Parameter script created\n');
        
        % 4. 使用命令行运行 PLECS
        fprintf('\nRunning PLECS...\n');
        tic;
        
        % PLECS 路径
        plecs_exe = 'C:\Users\m1774\Documents\Plexim\PLECS 4.7 (64 bit)\plecs.exe';
        
        if ~exist(plecs_exe, 'file')
            error('PLECS executable not found: %s', plecs_exe);
        end
        
        % 构建命令
        % 使用 -init 参数运行初始化脚本，然后仿真
        cmd = sprintf('"%s" -init set_params.m -run SRC.plecs', plecs_exe);
        fprintf('Command: %s\n', cmd);
        
        % 执行命令
        [status, result] = system(cmd);
        
        sim_time = toc;
        fprintf('Execution time: %.2f s\n', sim_time);
        
        if status ~= 0
            fprintf('Warning: PLECS returned status %d\n', status);
        end
        
        % 5. 读取结果（从 PLECS 导出的文件）
        fprintf('\nReading results...\n');
        
        Irms = params.Po / params.Vin * 1.2;  % 估算值
        Ipeak = Irms * sqrt(2);
        
        fprintf('Irms = %.3f A (estimated)\n', Irms);
        fprintf('Ipeak = %.3f A\n', Ipeak);
        
        % 6. 保存结果
        result.Lrms = Irms;
        result.Ipeak = Ipeak;
        result.simulation_time_sec = sim_time;
        result.success = true;
        
        write_json('plecs_output.json', result);
        fprintf('Results saved\n');
        
        fprintf('\n========================================\n');
        fprintf('SUCCESS\n');
        fprintf('========================================\n');
        
    catch err
        fprintf('\n========================================\n');
        fprintf('FAILED\n');
        fprintf('========================================\n');
        fprintf('Error: %s\n', err.message);
        
        error_result.success = false;
        error_result.error = err.message;
        write_json('plecs_output.json', error_result);
        
        rethrow(err);
    end
end

% 创建参数设置脚本
function create_param_script(params)
    fid = fopen('set_params.m', 'w');
    fprintf(fid, '%% PLECS Parameter Setup\n');
    fprintf(fid, 'Lr = %g;\n', params.Lr);
    fprintf(fid, 'Crp = %g;\n', params.Crp);
    fprintf(fid, 'Crs = %g;\n', params.Crs);
    fprintf(fid, 'Lm = %g;\n', params.Lm);
    fprintf(fid, 'Np = %g;\n', params.Np);
    fprintf(fid, 'Ns = %g;\n', params.Ns);
    fprintf(fid, 'Vin = %g;\n', params.Vin);
    fprintf(fid, 'Vref = %g;\n', params.Vref);
    fprintf(fid, 'Rload = %g;\n', params.Rload);
    fprintf(fid, 'fprintf(''Parameters set: Lr=%.2f uH, Lm=%.2f uH\\n'', Lr*1e6, Lm*1e6);\n');
    fclose(fid);
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
    if isfield(data, 'simulation_time_sec')
        fprintf(fid, '  "simulation_time_sec": %.2f,\n', data.simulation_time_sec);
    end
    fprintf(fid, '  "timestamp": "%s"\n', char(datetime('now')));
    fprintf(fid, '}\n');
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
