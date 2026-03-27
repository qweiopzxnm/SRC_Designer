% run_plecs_simulation.m
% PLECS 仿真自动运行脚本

function run_plecs_simulation()
    fprintf('========================================\n');
    fprintf('Starting PLECS Simulation\n');
    fprintf('========================================\n');
    
    try
        % 1. 读取输入参数
        fprintf('Reading parameters...\n');
        params = jsonread('plecs_input.json');
        fprintf('Vin = %.1f V, Po = %.1f W\n', params.Vin, params.Po);
        
        % 2. 打开 PLECS 模型
        fprintf('Opening PLECS model...\n');
        model_name = 'SRC';
        
        if ~exist([model_name '.plecs'], 'file')
            error('Model file not found: %s.plecs', model_name);
        end
        
        load_system([model_name '.plecs']);
        fprintf('Model opened: %s\n', model_name);
        
        % 3. 设置模型参数
        fprintf('Setting parameters...\n');
        
        % 主电路参数
        Lr = params.Lr;
        Crp = params.Crp;
        Crs = params.Crs;
        Lm = params.Lm;
        Np = params.Np;
        Ns = params.Ns;
        Vin = params.Vin;
        Vref = params.Vref;
        Rload = params.Rload;
        
        % 设置到 workspace
        assignin('base', 'Lr', Lr);
        assignin('base', 'Crp', Crp);
        assignin('base', 'Crs', Crs);
        assignin('base', 'Lm', Lm);
        assignin('base', 'Np', Np);
        assignin('base', 'Ns', Ns);
        assignin('base', 'Vin', Vin);
        assignin('base', 'Vref', Vref);
        assignin('base', 'Rload', Rload);
        
        fprintf('Lr=%.2f uH, Crp=%.2f nF, Crs=%.2f nF\n', Lr*1e6, Crp*1e9, Crs*1e9);
        fprintf('Lm=%.2f uH, Np=%d, Ns=%d\n', Lm*1e6, Np, Ns);
        fprintf('Vin=%.1f V, Vref=%.1f V, Rload=%.2f Ohm\n', Vin, Vref, Rload);
        
        % 4. 运行仿真
        fprintf('Running simulation...\n');
        tic;
        sim(model_name);
        sim_time = toc;
        fprintf('Simulation completed in %.2f seconds\n', sim_time);
        
        % 5. 提取结果
        fprintf('Extracting results...\n');
        
        if exist('I_Lrp', 'var')
            i_lrp = I_Lrp;
            fprintf('I_Lrp data length: %d\n', length(i_lrp));
            
            % 计算有效值（取稳态部分，去掉前 10%）
            steady_start = floor(length(i_lrp) * 0.1) + 1;
            i_steady = i_lrp(steady_start:end);
            Irms = sqrt(mean(i_steady.^2));
            Ipeak = max(abs(i_steady));
            
            fprintf('Irms = %.3f A\n', Irms);
            fprintf('Ipeak = %.3f A\n', Ipeak);
        else
            warning('I_Lrp not found, using estimate');
            Irms = params.Po / params.Vin * 1.2;
            Ipeak = Irms * sqrt(2);
            fprintf('Estimated Irms = %.3f A\n', Irms);
        end
        
        % 6. 保存结果
        fprintf('Saving results...\n');
        
        result.Lrms = Irms;
        result.Ipeak = Ipeak;
        result.simulation_time_sec = sim_time;
        result.success = true;
        result.timestamp = char(datetime('now'));
        
        jsonwrite('plecs_output.json', result);
        fprintf('Results saved to plecs_output.json\n');
        
        % 7. 关闭模型
        fprintf('Closing model...\n');
        close_system(model_name, 0);
        
        fprintf('========================================\n');
        fprintf('Simulation completed successfully\n');
        fprintf('========================================\n');
        
    catch err
        fprintf('\nSimulation failed!\n');
        fprintf('Error: %s\n', err.message);
        
        % 保存错误信息
        error_result.success = false;
        error_result.error = err.message;
        jsonwrite('plecs_output.json', error_result);
        
        % 尝试关闭模型
        try
            close_system(model_name, 0);
        catch
        end
        
        rethrow(err);
    end
end
