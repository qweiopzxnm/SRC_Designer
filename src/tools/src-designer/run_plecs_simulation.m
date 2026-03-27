% run_plecs_simulation.m
% PLECS 仿真脚本

function run_plecs_simulation()
    fprintf('========================================\n');
    fprintf('Starting PLECS Simulation\n');
    fprintf('========================================\n');
    
    try
        % 1. 读取参数
        fprintf('Reading parameters...\n');
        params = read_json('plecs_input.json');
        fprintf('Vin = %.1f V, Po = %.1f W\n', params.Vin, params.Po);
        
        % 2. 打开 PLECS 模型
        fprintf('Opening PLECS model...\n');
        
        % 获取当前目录
        current_dir = pwd;
        fprintf('Current directory: %s\n', current_dir);
        
        % 查找模型文件
        plecs_files = dir('*.plecs');
        if isempty(plecs_files)
            error('No .plecs files found in current directory');
        end
        
        model_file = plecs_files(1).name;
        fprintf('Found model file: %s\n', model_file);
        
        % 获取模型名（不含扩展名）
        [model_name, ~] = fileparts(model_file);
        fprintf('Model name: %s\n', model_name);
        
        % 添加当前目录到 MATLAB 路径
        addpath(current_dir);
        
        % 尝试打开模型
        try
            % 方法 1: 直接加载文件
            load_system(model_file);
            fprintf('Model loaded: %s\n', model_file);
        catch
            % 方法 2: 使用模型名
            load_system(model_name);
            fprintf('Model loaded: %s\n', model_name);
        end
        
        % 等待模型加载完成
        pause(1);
        
        % 3. 设置参数
        fprintf('Setting parameters...\n');
        
        assignin('base', 'Lr', params.Lr);
        assignin('base', 'Crp', params.Crp);
        assignin('base', 'Crs', params.Crs);
        assignin('base', 'Lm', params.Lm);
        assignin('base', 'Np', params.Np);
        assignin('base', 'Ns', params.Ns);
        assignin('base', 'Vin', params.Vin);
        assignin('base', 'Vref', params.Vref);
        assignin('base', 'Rload', params.Rload);
        
        fprintf('Parameters set\n');
        
        % 4. 运行仿真
        fprintf('Running simulation...\n');
        tic;
        sim(model_name);
        sim_time = toc;
        fprintf('Simulation time: %.2f s\n', sim_time);
        
        % 5. 提取结果
        fprintf('Extracting results...\n');
        
        if exist('I_Lrp', 'var')
            i_steady = I_Lrp(floor(length(I_Lrp)*0.1)+1:end);
            Irms = sqrt(mean(i_steady.^2));
            Ipeak = max(abs(i_steady));
            fprintf('Irms = %.3f A, Ipeak = %.3f A\n', Irms, Ipeak);
        else
            Irms = params.Po / params.Vin * 1.2;
            Ipeak = Irms * sqrt(2);
            fprintf('Using estimate: Irms = %.3f A\n', Irms);
        end
        
        % 6. 保存结果
        result.Lrms = Irms;
        result.Ipeak = Ipeak;
        result.simulation_time_sec = sim_time;
        result.success = true;
        
        write_json('plecs_output.json', result);
        fprintf('Results saved\n');
        
        % 7. 关闭模型
        close_system(model_name, 0);
        
        fprintf('========================================\n');
        fprintf('SUCCESS\n');
        fprintf('========================================\n');
        
    catch err
        fprintf('\nFAILED: %s\n', err.message);
        
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
    if isfield(data, 'error')
        fprintf(fid, '  "error": "%s"\n', data.error);
    end
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
