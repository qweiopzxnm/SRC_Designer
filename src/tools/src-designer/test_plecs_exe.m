% test_plecs_exe.m
% 测试 PLECS 可执行文件和命令行

fprintf('========================================\n');
fprintf('Testing PLECS Executable\n');
fprintf('========================================\n\n');

% PLECS 路径
plecs_exe = 'C:\Users\m1774\Documents\Plexim\PLECS 4.7 (64 bit)\plecs.exe';

fprintf('PLECS executable: %s\n\n', plecs_exe);

% 1. 检查文件是否存在
fprintf('1. Checking if file exists...\n');
if exist(plecs_exe, 'file')
    fprintf('   [OK] File exists\n');
    
    % 获取文件信息
    info = dir(plecs_exe);
    fprintf('   Size: %d bytes\n', info.bytes);
    fprintf('   Modified: %s\n', info.date);
else
    fprintf('   [ERROR] File not found!\n');
    fprintf('\nSearching for plecs.exe...\n');
    
    % 搜索
    files = dir('C:\Users\m1774\Documents\Plexim\**\plecs.exe');
    if ~isempty(files)
        fprintf('Found:\n');
        for i = 1:length(files)
            fprintf('  %s\n', fullfile(files(i).folder, files(i).name));
        end
    else
        fprintf('No plecs.exe found in Plexim folder\n');
    end
    return;
end

% 2. 测试命令行帮助
fprintf('\n2. Testing command line help...\n');
cmd = sprintf('"%s" --help', plecs_exe);
[status, result] = system(cmd);

if ~isempty(result)
    fprintf('Output:\n%s\n', result);
else
    fprintf('No output (status: %d)\n', status);
end

% 3. 检查模型文件
fprintf('\n3. Checking model file...\n');
if exist('SRC.plecs', 'file')
    fprintf('   [OK] SRC.plecs found\n');
else
    fprintf('   [ERROR] SRC.plecs not found\n');
end

% 4. 检查参数文件
fprintf('\n4. Checking parameter file...\n');
if exist('plecs_input.json', 'file')
    fprintf('   [OK] plecs_input.json found\n');
else
    fprintf('   [WARN] plecs_input.json not found\n');
end

fprintf('\n========================================\n');
fprintf('Test completed\n');
fprintf('========================================\n');
