/**
 * PLECS Simulation Server
 * Usage: node plecs-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const WORKSPACE_DIR = __dirname;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  }
  else if (req.url === '/api/simulate' && req.method === 'POST') {
    handleSimulation(req, res);
  }
  else {
    res.writeHead(404);
    res.end('Not found');
  }
});

function handleSimulation(req, res) {
  let body = '';
  
  req.on('data', chunk => { body += chunk.toString(); });

  req.on('end', () => {
    try {
      const params = JSON.parse(body);
      console.log('Parameters received:', params);

      // Save parameters
      const paramsFile = path.join(WORKSPACE_DIR, 'plecs_input.json');
      fs.writeFileSync(paramsFile, JSON.stringify(params, null, 2));
      console.log('Saved:', paramsFile);

      // Run MATLAB
      const resultFile = path.join(WORKSPACE_DIR, 'plecs_output.json');
      if (fs.existsSync(resultFile)) {
        fs.unlinkSync(resultFile);
      }

      console.log('Starting MATLAB simulation...');
      
      const matlabCmd = process.platform === 'win32'
        ? `matlab -batch "cd('${WORKSPACE_DIR.replace(/\\/g, '\\\\')}'); run_plecs_simulation"`
        : `matlab -batch "cd('${WORKSPACE_DIR}'); run_plecs_simulation"`;

      exec(matlabCmd, { timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('MATLAB error:', error.message);
          console.error('stdout:', stdout);
          console.error('stderr:', stderr);
          
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'Simulation failed',
            details: error.message,
            matlabOutput: stdout,
            matlabError: stderr
          }));
          return;
        }

        // Read results
        if (fs.existsSync(resultFile)) {
          const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
          console.log('Simulation completed:', result);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: result }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'No results found',
            matlabOutput: stdout
          }));
        }
      });

    } catch (err) {
      console.error('Parse error:', err.message);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('PLECS Server running on http://localhost:' + PORT);
  console.log('Workspace:', WORKSPACE_DIR);
});
