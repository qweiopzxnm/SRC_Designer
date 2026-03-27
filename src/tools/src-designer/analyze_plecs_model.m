% analyze_plecs_model.m
% 分析 PLECS 模型文件结构

fprintf('========================================\n');
fprintf('Analyzing PLECS Model Structure\n');
fprintf('========================================\n\n');

model_file = 'SRC.plecs';

if ~exist(model_file, 'file')
    fprintf('ERROR: %s not found!\n', model_file);
    return;
end

% 获取文件信息
info = dir(model_file);
fprintf('File: %s\n', model_file);
fprintf('Size: %d bytes\n', info.bytes);
fprintf('Modified: %s\n\n', info.date);

% 读取文件内容
fid = fopen(model_file, 'r');
if fid == -1
    fprintf('ERROR: Cannot open file!\n');
    return;
end

content = fread(fid, 2000, 'char=>char');
fclose(fid);

% 显示前 500 字符
fprintf('First 500 chars:\n');
fprintf('----------------------------------------\n');
fprintf('%s', content(1:min(500, length(content))));
fprintf('\n----------------------------------------\n\n');

% 搜索参数的简单方法
fprintf('Searching for parameters...\n');

params_to_find = {'Lr', 'Crp', 'Crs', 'Lm', 'Np', 'Ns', 'Vin', 'Vref'};

for i = 1:length(params_to_find)
    param = params_to_find{i};
    search_str = [param ' '];
    
    % 使用正则表达式搜索
    pattern = sprintf('%s\\s+\"?([\\d.eE+-]+)\"?', param);
    tokens = regexp(content, pattern, 'tokens');
    
    if ~isempty(tokens)
        fprintf('  %s = %s\n', param, tokens{1}{1});
    else
        % 尝试其他格式
        pattern2 = sprintf('%s\\s*=\\s*([\\d.eE+-]+)', param);
        tokens2 = regexp(content, pattern2, 'tokens');
        
        if ~isempty(tokens2)
            fprintf('  %s = %s\n', param, tokens2{1}{1});
        else
            fprintf('  %s = NOT FOUND\n', param);
        end
    end
end

fprintf('\n========================================\n');
fprintf('Analysis complete\n');
fprintf('========================================\n');
