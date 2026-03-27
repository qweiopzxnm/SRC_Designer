% analyze_plecs_model.m
% 分析 PLECS 模型文件结构 - 最简版本

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

% 按行读取文件
fid = fopen(model_file, 'r');
if fid == -1
    fprintf('ERROR: Cannot open file!\n');
    return;
end

fprintf('File structure (first 50 lines):\n');
fprintf('----------------------------------------\n');

line_num = 0;

while ~feof(fid)
    line_num = line_num + 1;
    line = fgetl(fid);
    
    % 显示前 50 行
    if line_num <= 50
        fprintf('%4d: %s\n', line_num, line);
    end
end

fclose(fid);

fprintf('----------------------------------------\n\n');

% 重新读取，搜索参数
fprintf('Searching for parameters...\n');

fid = fopen(model_file, 'r');
line_num = 0;

params_to_find = {'Lr', 'Crp', 'Crs', 'Lm', 'Np', 'Ns', 'Vin', 'Vref'};

while ~feof(fid)
    line_num = line_num + 1;
    line = fgetl(fid);
    
    for i = 1:length(params_to_find)
        param = params_to_find{i};
        
        % 使用 strfind 搜索
        if ~isempty(strfind(line, [param ' '])) || ...
           ~isempty(strfind(line, [param '='])) || ...
           ~isempty(strfind(line, ['"' param '"']))
            fprintf('Line %d: %s\n', line_num, line);
        end
    end
end

fclose(fid);

fprintf('\n========================================\n');
fprintf('Analysis complete\n');
fprintf('========================================\n');
