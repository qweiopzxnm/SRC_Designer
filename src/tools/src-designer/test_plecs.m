% test_plecs.m
% 测试 PLECS API 是否可用

fprintf('Testing PLECS API...\n\n');

% 1. 检查 PLECS 是否安装
fprintf('1. Checking PLECS installation...\n');
plecs_path = 'C:\Program Files\PLECS';
if exist(plecs_path, 'dir')
    fprintf('   PLECS folder found: %s\n', plecs_path);
else
    fprintf('   PLECS folder NOT found\n');
end

% 2. 检查 PLECS API
fprintf('\n2. Checking PLECS API...\n');
if exist('plecs', 'file')
    fprintf('   plecs() function: AVAILABLE\n');
else
    fprintf('   plecs() function: NOT FOUND\n');
end

if exist('plecs_open_model', 'file')
    fprintf('   plecs_open_model(): AVAILABLE\n');
else
    fprintf('   plecs_open_model(): NOT FOUND\n');
end

% 3. 尝试添加 PLECS 路径
fprintf('\n3. Adding PLECS to path...\n');
addpath(plecs_path);
addpath(fullfile(plecs_path, 'bin'));

% 4. 检查模型文件
fprintf('\n4. Checking model file...\n');
if exist('SRC.plecs', 'file')
    fprintf('   SRC.plecs: FOUND\n');
else
    fprintf('   SRC.plecs: NOT FOUND\n');
end

% 5. 尝试打开模型
fprintf('\n5. Trying to open model...\n');
try
    % 方法 1: 使用 plecs 命令
    if exist('plecs', 'file')
        fprintf('   Trying: plecs(''open'', ''SRC.plecs'')...\n');
        plecs('open', 'SRC.plecs');
        fprintf('   SUCCESS!\n');
        
        % 关闭模型
        plecs('close');
    else
        fprintf('   plecs() not available\n');
    end
catch err
    fprintf('   FAILED: %s\n', err.message);
end

fprintf('\n========================================\n');
fprintf('Test completed\n');
fprintf('========================================\n');
