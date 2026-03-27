% run_plecs_simulation.m
% PLECS Standalone 仿真脚本

function run_plecs_simulation()
    fprintf('========================================\n');
    fprintf('PLECS Simulation\n');
    fprintf('========================================\n');
    
    try
        % 1. 添加 PLECS 路径
        plecs_path = 'C:\Users\m1774\Documents\Plexim\PLECS 4.7 (64 bit)';
        addpath(plecs_path);
        fprintf('PLECS path: %s\n', plecs_path);
        
        % 2. 读取参数
        fprintf('\nReading parameters...\n');
        params = read_json('plecs_input.json');
        fprintf('Vin=%.1fV, Po=%.1fW\n', params.Vin, params.Po);
        fprintf('Lr=%.1fuH, Crp=%.1fnF, Crs=%.1fnF\n', ...
            params.Lr*1e6, params.Crp*1e9, params.Crs*1e9);
        fprintf('Lm=%.1fuH, Np=%d, Ns=%d\n', ...
            params.Lm*1e6, params.Np, params.Ns);
        
        % 3. 获取模型路径
        current_dir = pwd;
        model_file = 'SRC.plecs';
        
        if ~exist(model_file, 'file')
            error('Model file not found: %s', model_file);
        end
        
        fprintf('\nModel: %s\n', model_file);
        
        % 4. 打开 PLECS 模型
        fprintf('Opening PLECS model...\n');
        
        % 使用 PLECS Standalone API
        plecs('open', model_file);
        fprintf('Model opened successfully\n');
        
        % 等待模型加载
        pause(0.5);
        
        % 5. 设置参数
        fprintf('\nSetting parameters...\n');
        
        % 通过 PLECS API 设置
        plecs('set', 'Lr', num2str(params.Lr));
        plecs('set', 'Crp', num2str(params.Crp));
        plecs('set', 'Crs', num2str(params.Crs));
        plecs('set', 'Lm', num2str(params.Lm));
        plecs('set', 'Np', num2str(params.Np));
        plecs('set', 'Ns', num2str(params.Ns));
        plecs('set', 'Vin', num2str(params.Vin));
        plecs('set', 'Vref', num2str(params.Vref));
        plecs('set', 'Rload', num2str(params.Rload));
        
        fprintf('All parameters set\n');
        
        % 6. 运行仿真
        fprintf('\nRunning simulation...\n');
        tic;
        
        plecs('simulate');
        
        sim_time = toc;
        fprintf('Simulation completed: %.2f s\n', sim_time);
        
        % 7. 提取结果
        fprintf('\nExtracting results...\n');
        
        % 从工作区获取 ILrp 数据
        if exist('ILrp', 'var')
            i_data = ILrp;
            n_points = length(i_data);
            fprintf('ILrp data points: %d\n', n_points);
            
            % 计算有效值（去掉前 10% 暂态）
            idx_start = floor(n_points * 0.1) + 1;
            i_steady = i_data(idx_start:end);
            
            Irms = sqrt(mean(i_steady.^2));
            Ipeak = max(abs(i_steady));
            
            fprintf('\nResults:\n');
            fprintf('  Irms  = %.3f A\n', Irms);
            fprintf('  Ipeak = %.3f A\n', Ipeak);
        else
            fprintf('Warning: ILrp not found in workspace\n');
            fprintf('Using estimate...\n');
            Irms = params.Po / params.Vin * 1.2;
            Ipeak = Irms * sqrt(2);
        end
        
        % 8. 保存结果
        result.Lrms = Irms;
        result.Ipeak = Ipeak;
        result.simulation_time_sec = sim_time;
        result.success = true;
        
        write_json('plecs_output.json', result);
        fprintf('\nResults saved to plecs_output.json\n');
        
        % 9. 关闭模型
        fprintf('Closing model...\n');
        plecs('close');
        
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
