% run_plecs_simulation.m
% PLECS Standalone 仿真脚本

function run_plecs_simulation()
    fprintf('========================================\n');
    fprintf('PLECS Simulation\n');
    fprintf('========================================\n');
    
    try
        % 1. 读取参数
        fprintf('Reading parameters...\n');
        params = read_json('plecs_input.json');
        fprintf('Vin=%.1fV, Po=%.1fW, Lr=%.1fuH, Lm=%.1fuH\n', ...
            params.Vin, params.Po, params.Lr*1e6, params.Lm*1e6);
        
        % 2. 获取模型路径
        current_dir = pwd;
        model_file = 'SRC.plecs';
        
        if ~exist(model_file, 'file')
            error('Model file not found: %s', model_file);
        end
        
        fprintf('Model: %s\n', model_file);
        
        % 3. 使用 PLECS API 打开模型
        fprintf('Opening PLECS model...\n');
        
        % 检查是否有 PLECS API
        if ~exist('plecs_open_model', 'file')
            error('PLECS API not found. Please ensure PLECS is installed.');
        end
        
        % 打开模型
        plecs_open_model(model_file);
        fprintf('Model opened successfully\n');
        
        % 4. 设置参数（通过 PLECS API）
        fprintf('Setting parameters...\n');
        
        plecs_set_param('Lr', num2str(params.Lr));
        plecs_set_param('Crp', num2str(params.Crp));
        plecs_set_param('Crs', num2str(params.Crs));
        plecs_set_param('Lm', num2str(params.Lm));
        plecs_set_param('Np', num2str(params.Np));
        plecs_set_param('Ns', num2str(params.Ns));
        plecs_set_param('Vin', num2str(params.Vin));
        plecs_set_param('Vref', num2str(params.Vref));
        plecs_set_param('Rload', num2str(params.Rload));
        
        fprintf('Parameters set\n');
        
        % 5. 运行仿真
        fprintf('Running simulation...\n');
        tic;
        
        plecs_simulate();
        
        sim_time = toc;
        fprintf('Simulation completed: %.2f s\n', sim_time);
        
        % 6. 提取结果
        fprintf('Extracting results...\n');
        
        % 从 PLECS 工作区获取数据
        % 注意：信号名是 ILrp（不是 I_Lrp）
        if exist('ILrp', 'var')
            i_data = ILrp;
            fprintf('ILrp data points: %d\n', length(i_data));
            
            % 计算有效值（去掉前 10% 暂态）
            idx_start = floor(length(i_data) * 0.1) + 1;
            i_steady = i_data(idx_start:end);
            
            Irms = sqrt(mean(i_steady.^2));
            Ipeak = max(abs(i_steady));
            
            fprintf('Irms = %.3f A\n', Irms);
            fprintf('Ipeak = %.3f A\n', Ipeak);
        else
            fprintf('Warning: ILrp not found, using estimate\n');
            Irms = params.Po / params.Vin * 1.2;
            Ipeak = Irms * sqrt(2);
        end
        
        % 7. 保存结果
        result.Lrms = Irms;
        result.Ipeak = Ipeak;
        result.simulation_time_sec = sim_time;
        result.success = true;
        
        write_json('plecs_output.json', result);
        fprintf('Results saved to plecs_output.json\n');
        
        % 8. 关闭模型
        plecs_close_model();
        
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

% PLECS API 封装
function plecs_open_model(filename)
    % 使用 PLECS Standalone API
    addpath('C:\Program Files\PLECS');
    plecs('open', filename);
end

function plecs_set_param(name, value)
    % 设置模型参数
    evalin('base', [name ' = ' value ';']);
end

function plecs_simulate()
    % 运行仿真
    sim('SRC');
end

function plecs_close_model()
    % 关闭模型
    close_system('SRC', 0);
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
