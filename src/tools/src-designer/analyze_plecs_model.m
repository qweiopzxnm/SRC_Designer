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

% 读取文件内容（前 1000 字节）
fid = fopen(model_file, 'rb');
content = fread(fid, 1000, 'char=>char');
fclose(fid);

% 检查文件类型
if startsWith(content, '<?xml')
    fprintf('Format: XML (text-based)\n');
    fprintf('Can be modified directly!\n\n');
    
    % 显示前 500 字符
    fprintf('First 500 chars:\n');
    fprintf('%s\n\n', content(1:min(500, length(content))));
    
    % 查找参数定义
    fprintf('Searching for parameters...\n');
    
    params_to_find = {'Lr', 'Crp', 'Crs', 'Lm', 'Np', 'Ns', 'Vin', 'Vref'};
    
    for i = 1:length(params_to_find)
        param = params_to_find{i};
        pattern = sprintf('%s[=:\\s]+([\\d.eE+-]+)', param);
        tokens = regexp(content, pattern, 'tokens');
        
        if ~isempty(tokens)
            fprintf('  %s = %s\n', param, tokens{1}{1});
        else
            fprintf('  %s = NOT FOUND\n', param);
        end
    end
    
    fprintf('\n[GOOD] Model can be modified programmatically!\n');
    
elseif ismember(content(1), [char(80), char(75)])  % PK signature (ZIP)
    fprintf('Format: ZIP archive (binary)\n');
    fprintf('Need to extract, modify, and repackage\n');
    fprintf('More complex but still possible\n');
    
else
    fprintf('Format: Unknown (binary?)\n');
    fprintf('First bytes: ');
    fprintf('%02X ', content(1:min(20, length(content))));
    fprintf('\n');
end

fprintf('\n========================================\n');
