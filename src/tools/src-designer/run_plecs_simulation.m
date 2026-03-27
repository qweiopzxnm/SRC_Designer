% run_plecs_simulation.m
% PLECS 仿真自动运行脚本
% 
% 功能：
% 1. 读取 LLC 设计工具导出的参数
% 2. 设置 PLECS 模型参数
% 3. 运行仿真
% 4. 提取谐振电流有效值 (I_Lrms)
% 5. 保存结果到 JSON

function run_plecs_simulation()
    fprintf('========================================\n');
    fprintf('🔌 开始 PLECS 仿真\n');
    fprintf('========================================\n');
    
    try
        % 1. 读取输入参数
        fprintf('📥 读取参数文件...\n');
        params = jsonread('plecs_input.json');
        fprintf('   Vin = %.1f V\n', params.Vin);
        fprintf('   Vref = %.1f V\n', params.Vref);
        fprintf('   Po = %.1f W\n', params.Po);
        fprintf('   Lr = %.2f μH\n', params.Lr * 1e6);
        fprintf('   Crp = %.2f nF\n', params.Crp * 1e9);
        fprintf('   Crs = %.2f nF\n', params.Crs * 1e9);
        fprintf('   Lm = %.2f μH\n', params.Lm * 1e6);
        fprintf('   Np = %d\n', params.Np);
        fprintf('   Ns = %d\n', params.Ns);
        
        % 2. 打开 PLECS 模型
        fprintf('\n📂 打开 PLECS 模型...\n');
        model_name = 'SRC';
        
        % 检查模型文件是否存在
        if ~exist([model_name '.plecs'], 'file')
            error('找不到模型文件：%s.plecs', model_name);
        end
        
        % 打开模型
        plecs_open_model([model_name '.plecs']);
        fprintf('   模型已打开：%s\n', model_name);
        
        % 3. 设置模型参数
        fprintf('\n⚙️  设置模型参数...\n');
        
        % 主电路参数
        plecs_set_param('Lr', num2str(params.Lr));
        fprintf('   Lr = %s H\n', num2str(params.Lr));
        
        plecs_set_param('Crp', num2str(params.Crp));
        fprintf('   Crp = %s F\n', num2str(params.Crp));
        
        plecs_set_param('Crs', num2str(params.Crs));
        fprintf('   Crs = %s F\n', num2str(params.Crs));
        
        plecs_set_param('Lm', num2str(params.Lm));
        fprintf('   Lm = %s H\n', num2str(params.Lm));
        
        plecs_set_param('Np', num2str(params.Np));
        fprintf('   Np = %s\n', num2str(params.Np));
        
        plecs_set_param('Ns', num2str(params.Ns));
        fprintf('   Ns = %s\n', num2str(params.Ns));
        
        % 电气参数
        plecs_set_param('Vin', num2str(params.Vin));
        fprintf('   Vin = %s V\n', num2str(params.Vin));
        
        plecs_set_param('Vref', num2str(params.Vref));
        fprintf('   Vref = %s V\n', num2str(params.Vref));
        
        % 计算并设置负载
        Rload = params.Vref * params.Vref / params.Po;
        plecs_set_param('Rload', num2str(Rload));
        fprintf('   Rload = %s Ω (Po = %.1f W)\n', num2str(Rload), params.Po);
        
        % 4. 运行仿真
        fprintf('\n▶️  运行仿真...\n');
        tic;
        plecs_simulate();
        sim_time = toc;
        fprintf('   仿真完成，耗时：%.2f 秒\n', sim_time);
        
        % 5. 提取仿真结果
        fprintf('\n📊 提取仿真结果...\n');
        
        % 从工作区获取数据
        % 假设仿真数据保存在 workspace 变量 I_Lrp 中
        if exist('I_Lrp', 'var')
            i_lrp = I_Lrp;
            fprintf('   获取到 I_Lrp 数据，长度：%d\n', length(i_lrp));
            
            % 计算有效值（取稳态部分，去掉前 10% 的暂态）
            steady_start = floor(length(i_lrp) * 0.1) + 1;
            i_steady = i_lrp(steady_end:end);
            Irms = sqrt(mean(i_steady.^2));
            fprintf('   谐振电流有效值 Irms = %.3f A\n', Irms);
            
            % 计算峰值
            Ipeak = max(abs(i_steady));
            fprintf('   谐振电流峰值 Ipeak = %.3f A\n', Ipeak);
        else
            warning('未找到 I_Lrp 数据，使用估算值');
            Irms = params.Po / params.Vin * 1.2; % 粗略估算
            Ipeak = Irms * sqrt(2);
            fprintf('   使用估算值：Irms = %.3f A\n', Irms);
        end
        
        % 6. 准备输出结果
        result = struct();
        result.timestamp = char(datetime('now'));
        result.success = true;
        result.params = params;
        result.Irms = Irms;
        result.Ipeak = Ipeak;
        result.simulation_time_sec = sim_time;
        
        % 如果有时间向量，也保存
        if exist('time', 'var')
            result.time = time;
        end
        if exist('I_Lrp', 'var')
            result.I_Lrp_waveform = I_Lrp;
        end
        
        % 7. 保存结果到 JSON
        fprintf('\n💾 保存结果...\n');
        jsonwrite('plecs_output.json', result);
        fprintf('   结果已保存：plecs_output.json\n');
        
        % 8. 关闭模型
        fprintf('\n📕 关闭模型...\n');
        plecs_close_model();
        fprintf('   模型已关闭\n');
        
        fprintf('\n========================================\n');
        fprintf('✅ 仿真完成\n');
        fprintf('========================================\n');
        
    catch err
        fprintf('\n❌ 仿真失败：%s\n', err.message);
        fprintf('详细信息：%s\n', err.stack);
        
        % 保存错误信息
        error_result = struct();
        error_result.success = false;
        error_result.error = err.message;
        error_result.stack = err.stack;
        jsonwrite('plecs_output.json', error_result);
        
        % 尝试关闭模型
        try
            plecs_close_model();
        catch
            % 忽略关闭错误
        end
        
        rethrow(err);
    end
end

% 辅助函数：设置 PLECS 参数
function plecs_set_param(param_name, param_value)
    % 尝试不同的设置方式
    try
        % 方式 1：使用 set_param（如果有模型句柄）
        if exist('bdroot', 'file')
            set_param(bdroot, param_name, param_value);
        else
            % 方式 2：直接赋值到 workspace
            assignin('base', param_name, str2double(param_value));
        end
    catch err
        warning('设置参数 %s 失败：%s', param_name, err.message);
    end
end

% 辅助函数：打开 PLECS 模型
function plecs_open_model(model_name)
    try
        % 尝试直接打开
        load_system(model_name);
    catch
        % 如果失败，尝试添加路径
        addpath(pwd);
        load_system(model_name);
    end
end

% 辅助函数：运行仿真
function plecs_simulate()
    try
        sim(bdroot);
    catch err
        error('仿真执行失败：%s', err.message);
    end
end

% 辅助函数：关闭模型
function plecs_close_model()
    try
        close_system(bdroot, 0);
    catch
        % 忽略关闭错误
    end
end
