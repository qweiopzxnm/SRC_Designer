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

% 显示前 200 字符
fprintf('First 200 chars:\n');
fprintf('%s\n\n', content(1:min(200, length(content))));

% 检查是否包含 XML 标记
is_xml = (length(content) > 5) && (strcmp(content(1:5), '<?xml'));

if is_xml
    fprintf('Format: XML (text-based)\n');
    fprintf('Can be modified directly!\n\n');
else
    fprintf('Format: Binary or compressed\n\n');
end

% 查找参数
fprintf('Searching for parameters...\n');

params_to_find = {'Lr', 'Crp', 'Crs', 'Lm', 'Np', 'Ns', 'Vin', 'Vref'};

for i = 1:length(params_to_find)
    param = params_to_find{i};
    
    % 搜索参数
    idx = strfind(content, ['"' param '"']);
    
    if ~isempty(idx)
        % 找到参数，提取后面的值
        start_idx = idx(1) + length(param) + 3;
        end_idx = start_idx + 20;
        snippet = content(start_idx:min(end_idx, length(content)));
        
        % 提取数字
        num_match = regexp(snippet, '([\\d.eE+-]+)', 'tokens');
        if ~isempty(num_match)
            fprintf('  %s = %s\n', param, num_match{1}{1});
        else
            fprintf('  %s = FOUND (value format unclear)\n', param);
        end
    else
        fprintf('  %s = NOT FOUND\n', param);
    end
end

fprintf('\n========================================\n');
fprintf('Analysis complete\n');
fprintf('========================================\n');
