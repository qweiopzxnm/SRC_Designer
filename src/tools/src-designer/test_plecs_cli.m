% test_plecs_cli.m
% 测试 PLECS 命令行接口

fprintf('========================================\n');
fprintf('Testing PLECS CLI Options\n');
fprintf('========================================\n\n');

plecs_exe = 'C:\Users\m1774\Documents\Plexim\PLECS 4.7 (64 bit)\plecs.exe';
model_file = 'SRC.plecs';

% 测试不同的命令行选项
test_commands = {
    sprintf('"%s" --help', plecs_exe),
    sprintf('"%s" -h', plecs_exe),
    sprintf('"%s" /?', plecs_exe),
    sprintf('"%s" -batch "%s"', plecs_exe, model_file),
    sprintf('"%s" -run "%s"', plecs_exe, model_file),
};

for i = 1:length(test_commands)
    cmd = test_commands{i};
    fprintf('\n--- Test %d: %s ---\n\n', i, cmd);
    
    [status, result] = system(cmd);
    
    if ~isempty(result)
        fprintf('%s\n', result);
    end
    
    fprintf('Status: %d\n', status);
    
    % 如果成功，跳出循环
    if status == 0 && ~isempty(result)
        fprintf('\n[SUCCESS] Found working command!\n');
        break;
    end
    
    pause(1);
end

fprintf('\n========================================\n');
fprintf('Test completed\n');
fprintf('========================================\n');
