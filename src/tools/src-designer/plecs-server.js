/**
 * PLECS 仿真服务器 - Node.js 后端
 * 
 * 功能：
 * 1. 接收 LLC 设计工具的参数
 * 2. 调用 MATLAB 运行 PLECS 仿真
 * 3. 返回仿真结果（Irms 等）
 * 
 * 使用方法：
 * node plecs-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const WORKSPACE_DIR = __dirname;

// 服务器
const server = http.createServer((req, res) => {
  // CORS 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 路由处理
  if (req.url === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'PLECS Server is running' }));
  }
  else if (req.url === '/api/simulate' && req.method === 'POST') {
    handleSimulation(req, res);
  }
  else if (req.url === '/api/result' && req.method === 'GET') {
    handleGetResult(req, res);
  }
  else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

/**
 * 处理仿真请求
 */
function handleSimulation(req, res) {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const params = JSON.parse(body);
      console.log('收到仿真参数:', params);

      // 1. 保存参数到 JSON 文件
      const paramsFile = path.join(WORKSPACE_DIR, 'plecs_input.json');
      fs.writeFileSync(paramsFile, JSON.stringify(params, null, 2));
      console.log('参数已保存:', paramsFile);

      // 2. 调用 MATLAB 脚本
      const matlabScript = path.join(WORKSPACE_DIR, 'run_plecs_simulation.m');
      const resultFile = path.join(WORKSPACE_DIR, 'plecs_output.json');

      // 删除旧结果
      if (fs.existsSync(resultFile)) {
        fs.unlinkSync(resultFile);
      }

      console.log('开始调用 MATLAB 仿真...');
      
      // MATLAB 命令（根据系统调整）
      const matlabCmd = process.platform === 'win32'
        ? `matlab -batch "cd('${WORKSPACE_DIR.replace(/\\/g, '\\\\')}'); run_plecs_simulation"`
        : `matlab -batch "cd('${WORKSPACE_DIR}'); run_plecs_simulation"`;

      exec(matlabCmd, { timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('MATLAB 执行错误:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: '仿真执行失败',
            details: error.message,
            stdout: stdout,
            stderr: stderr
          }));
          return;
        }

        // 3. 读取仿真结果
        if (fs.existsSync(resultFile)) {
          const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
          console.log('仿真完成:', result);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            data: result,
            message: '仿真完成'
          }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: '仿真完成但未找到结果文件',
            stdout: stdout,
            stderr: stderr
          }));
        }
      });

    } catch (err) {
      console.error('解析错误:', err);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '无效的参数格式', details: err.message }));
    }
  });
}

/**
 * 获取仿真结果
 */
function handleGetResult(req, res) {
  const resultFile = path.join(WORKSPACE_DIR, 'plecs_output.json');
  
  if (fs.existsSync(resultFile)) {
    const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: result }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '未找到仿真结果' }));
  }
}

// 启动服务器
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`🔌 PLECS 仿真服务器已启动`);
  console.log(`📡 监听端口：http://localhost:${PORT}`);
  console.log(`📂 工作目录：${WORKSPACE_DIR}`);
  console.log(`\n可用接口:`);
  console.log(`  GET  /api/health     - 健康检查`);
  console.log(`  POST /api/simulate   - 运行仿真`);
  console.log(`  GET  /api/result     - 获取结果`);
  console.log(`========================================\n`);
});
