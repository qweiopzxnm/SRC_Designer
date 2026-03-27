% find_plecs.m
% 查找 PLECS 实际安装路径

fprintf('========================================\n');
fprintf('Finding PLECS Installation\n');
fprintf('========================================\n\n');

% 常见安装路径
possible_paths = {
    'C:\Program Files\PLECS',
    'C:\Program Files (x86)\PLECS',
    'C:\PLECS',
    'D:\Program Files\PLECS',
    'D:\PLECS'
};

% 检查这些路径
fprintf('Checking common installation paths...\n\n');

found_path = '';
for i = 1:length(possible_paths)
    p = possible_paths{i};
    if exist(p, 'dir')
        fprintf('[FOUND] %s\n', p);
        found_path = p;
        
        % 检查 bin 目录
        bin_path = fullfile(p, 'bin');
        if exist(bin_path, 'dir')
            fprintf('        -> bin folder: YES\n');
        end
        
        % 检查是否有 MATLAB API
        api_path = fullfile(p, 'matlab');
        if exist(api_path, 'dir')
            fprintf('        -> matlab folder: YES\n');
        end
    else
        fprintf('[NOT FOUND] %s\n', p);
    end
end

fprintf('\n========================================\n');

if isempty(found_path)
    fprintf('PLECS not found in common locations!\n\n');
    fprintf('Please check:\n');
    fprintf('1. Is PLECS installed?\n');
    fprintf('2. Where is PLECS installed?\n\n');
    fprintf('You can find it by:\n');
    fprintf('1. Right-click PLECS shortcut -> Properties\n');
    fprintf('2. Look at "Target" or "Start in" field\n');
    fprintf('3. The folder path is your PLECS installation\n');
else
    fprintf('PLECS found at: %s\n\n', found_path);
    fprintf('Add this to MATLAB path:\n');
    fprintf('addpath(''%s'');\n', found_path);
    fprintf('addpath(''%s'');\n', fullfile(found_path, 'matlab'));
end

fprintf('========================================\n');
