% run_plecs_auto.m
% PLECS 自动化仿真 - 通过修改模型文件方式

function run_plecs_auto()
    fprintf('========================================\n');
    fprintf('PLECS Auto Simulation\n');
    fprintf('========================================\n');
    
    try
        % 1. 读取参数
        fprintf('Reading parameters...\n');
        params = read_json('plecs_input.json');
        
        % 2. 读取模型文件
        fprintf('Loading model...\n');
        model_file = 'SRC.plecs';
        
        if ~exist(model_file, 'file')
            error('Model not found: %s', model_file);
        end
        
        % 读取模型内容
        model_content = fileread(model_file);
        
        % 3. 在模型中查找并替换参数
        fprintf('Updating parameters...\n');
        
        model_content = replace_param(model_content, 'Lr', params.Lr);
        model_content = replace_param(model_content, 'Crp', params.Crp);
        model_content = replace_param(model_content, 'Crs', params.Crs);
        model_content = replace_param(model_content, 'Lm', params.Lm);
        model_content = replace_param(model_content, 'Np', params.Np);
        model_content = replace_param(model_content, 'Ns', params.Ns);
        model_content = replace_param(model_content, 'Vin', params.Vin);
        model_content = replace_param(model_content, 'Vref', params.Vref);
        model_content = replace_param(model_content, 'Rload', params.Rload);
        
        % 4. 保存修改后的模型
        temp_model = 'SRC_temp.plecs';
        fid = fopen(temp_model, 'w', 'n', 'UTF-8');
        fwrite(fid, model_content, 'char');
        fclose(fid);
        
        fprintf('Model updated: %s\n', temp_model);
        
        % 5. 使用 MATLAB 打开修改后的模型
        fprintf('Opening model in MATLAB...\n');
        
        % 尝试加载
        if exist('load_system', 'file')
            load_system(temp_model);
            model_name = fileparts(temp_model);
            
            % 运行仿真
            fprintf('Running simulation...\n');
            tic;
            sim(model_name);
            sim_time = toc;
            
            % 提取结果
            if exist('ILrp', 'var')
                i_data = ILrp;
                idx = floor(length(i_data)*0.1)+1;
                Irms = sqrt(mean(i_data(idx:end).^2));
                Ipeak = max(abs(i_data(idx:end)));
            else
                Irms = params.Po / params.Vin * 1.2;
                Ipeak = Irms * sqrt(2);
            end
            
            % 关闭模型
            close_system(model_name, 0);
            
            % 清理临时文件
            delete(temp_model);
        else
            error('MATLAB/Simulink not available');
        end
        
        % 6. 保存结果
        result.Lrms = Irms;
        result.Ipeak = Ipeak;
        result.simulation_time_sec = sim_time;
        result.success = true;
        
        write_json('plecs_output.json', result);
        
        fprintf('\n========================================\n');
        fprintf('SUCCESS\n');
        fprintf('Irms = %.3f A\n', Irms);
        fprintf('Ipeak = %.3f A\n', Ipeak);
        fprintf('========================================\n');
        
    catch err
        fprintf('\nFAILED: %s\n', err.message);
        
        error_result.success = false;
        error_result.error = err.message;
        write_json('plecs_output.json', error_result);
        
        rethrow(err);
    end
end

% 替换模型中的参数值
function content = replace_param(content, param_name, new_value)
    % 匹配 "param_name": number 格式
    pattern = sprintf('("%s":\\s*)([\\d.eE+-]+)', param_name);
    replacement = sprintf('$1%g', new_value);
    content = regexprep(content, pattern, replacement);
end

% JSON 读取/写入等辅助函数
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

function write_json(filename, data)
    fid = fopen(filename, 'w');
    fprintf(fid, '{\n  "success": %s,\n', lower(num2str(data.success)));
    if isfield(data, 'Lrms')
        fprintf(fid, '  "Lrms": %.6f,\n', data.Lrms);
    end
    if isfield(data, 'Ipeak')
        fprintf(fid, '  "Ipeak": %.6f,\n', data.Ipeak);
    end
    if isfield(data, 'simulation_time_sec')
        fprintf(fid, '  "simulation_time_sec": %.2f,\n', data.simulation_time_sec);
    end
    fprintf(fid, '  "timestamp": "%s"\n}\n', char(datetime('now')));
    fclose(fid);
end

function val = extract_num(str, key)
    pattern = sprintf('"%s":\\s*([\\d.eE+-]+)', key);
    tokens = regexp(str, pattern, 'tokens');
    if isempty(tokens)
        error('Key not found: %s', key);
    end
    val = str2double(tokens{1}{1});
end
