import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns/promises';
import http from 'http';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: true });

await fastify.register(fastifyCors, { origin: true });
await fastify.register(fastifyWebsocket);

// Static file serving helper — API routes always take priority
const findOutDir = () => {
  const possiblePaths = [
    path.join(__dirname, '../out'),
    path.join(__dirname, './out'),
    path.join(process.cwd(), 'out'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, 'index.html'))) {
      return p;
    }
  }
  return path.join(process.cwd(), 'out');
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};


// In-memory state for active temporary session (NO DATABASE)
const sessionState = {
  githubToken: null,
  vpsIp: null,
};

// Helper: HTTP request wrapper
function httpRequest(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const req = lib.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const contentType = res.headers['content-type'] || '';
          if (contentType.includes('application/json')) {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } else {
            resolve({ status: res.statusCode, data: body });
          }
        } catch (err) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'object' ? JSON.stringify(data) : data);
    }
    req.end();
  });
}

// ----------------------------------------------------
// 1. STEP 1: GITHUB DEVICE AUTHORIZATION FLOW
// ----------------------------------------------------
fastify.post('/api/github/device-code', async (request, reply) => {
  const { clientId } = request.body || {};
  const DEFAULT_CLIENT_ID = 'Ov23lixc10ZT3lahfJtf';
  const targetClientId = clientId && clientId.trim() ? clientId.trim() : DEFAULT_CLIENT_ID;

  try {
    const res = await httpRequest('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }, {
      client_id: targetClientId,
      scope: 'repo read:user user:email admin:public_key'
    });

    return reply.send({
      success: true,
      clientId: targetClientId,
      ...res.data
    });
  } catch (err) {
    return reply.status(500).send({ success: false, error: err.message });
  }
});

fastify.post('/api/github/poll-token', async (request, reply) => {
  const { clientId, deviceCode } = request.body || {};

  try {
    const res = await httpRequest('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }, {
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    });

    if (res.data && res.data.access_token) {
      sessionState.githubToken = res.data.access_token;
      return reply.send({ success: true, accessToken: res.data.access_token });
    } else {
      return reply.send({ success: false, ...res.data });
    }
  } catch (err) {
    return reply.status(500).send({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 2. STEP 2: REPOSITORY & BRANCH SELECTION
// ----------------------------------------------------
fastify.get('/api/github/repos', async (request, reply) => {
  const token = request.headers.authorization?.replace('Bearer ', '') || sessionState.githubToken;
  if (!token) {
    return reply.status(401).send({ success: false, error: 'Unauthorized: No GitHub token' });
  }

  try {
    const res = await httpRequest('https://api.github.com/user/repos?per_page=100&sort=updated&type=all', {
      method: 'GET',
      headers: {
        'User-Agent': 'Fluid-VPS-Assistant',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (Array.isArray(res.data)) {
      const repos = res.data.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        htmlUrl: r.html_url,
        cloneUrl: r.clone_url,
        defaultBranch: r.default_branch || 'main',
        description: r.description,
        updatedAt: r.updated_at
      }));
      return reply.send({ success: true, repos });
    }
    return reply.send({ success: false, error: res.data.message || 'Failed to fetch repositories' });
  } catch (err) {
    return reply.status(500).send({ success: false, error: err.message });
  }
});

fastify.get('/api/github/branches', async (request, reply) => {
  const { owner, repo } = request.query;
  const token = request.headers.authorization?.replace('Bearer ', '') || sessionState.githubToken;

  if (!owner || !repo) {
    return reply.status(400).send({ success: false, error: 'Missing owner or repo parameter' });
  }

  try {
    const res = await httpRequest(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Fluid-VPS-Assistant',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (Array.isArray(res.data)) {
      const branches = res.data.map((b) => b.name);
      return reply.send({ success: true, branches });
    }
    return reply.send({ success: false, branches: ['main', 'master'] });
  } catch (err) {
    return reply.send({ success: true, branches: ['main', 'master'] });
  }
});

// ----------------------------------------------------
// 3. STEP 3: DIRECTORY CHECK & CREATION
// ----------------------------------------------------
fastify.post('/api/system/check-dir', async (request, reply) => {
  const { dirPath } = request.body || {};
  if (!dirPath) {
    return reply.status(400).send({ success: false, error: 'Directory path is required' });
  }

  const normalized = path.normalize(dirPath);
  const exists = fs.existsSync(normalized);

  let isEmpty = true;
  if (exists) {
    try {
      const files = fs.readdirSync(normalized);
      isEmpty = files.length === 0;
    } catch (e) {
      isEmpty = false;
    }
  }

  return reply.send({
    success: true,
    path: normalized,
    exists,
    isEmpty,
  });
});

// ----------------------------------------------------
// 4. STEP 4: PROJECT DETECTION
// ----------------------------------------------------
fastify.post('/api/deploy/detect', async (request, reply) => {
  const { dirPath } = request.body || {};
  const targetDir = dirPath ? path.normalize(dirPath) : process.cwd();

  if (!fs.existsSync(targetDir)) {
    return reply.status(404).send({ success: false, error: 'Target directory does not exist yet' });
  }

  const detection = {
    type: 'Unknown',
    framework: 'Generic',
    installCmd: 'npm install',
    buildCmd: 'npm run build',
    startCmd: 'npm start',
    port: 3000,
    hasPackageJson: false,
    hasPython: false,
    hasPhp: false,
    hasDocker: false
  };

  const hasFile = (f) => fs.existsSync(path.join(targetDir, f));

  // Node.js Detection
  if (hasFile('package.json')) {
    detection.hasPackageJson = true;
    detection.type = 'Node.js';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['next']) {
        detection.framework = 'Next.js';
        detection.installCmd = 'npm install';
        detection.buildCmd = 'npm run build';
        detection.startCmd = 'npm start';
        detection.port = 3000;
      } else if (deps['react-scripts'] || deps['vite']) {
        detection.framework = deps['vite'] ? 'Vite / React' : 'Create React App';
        detection.installCmd = 'npm install';
        detection.buildCmd = 'npm run build';
        detection.startCmd = 'npx serve -s build -l 3000';
        detection.port = 3000;
      } else if (deps['vue'] || deps['@nuxt/kit'] || deps['nuxt']) {
        detection.framework = deps['nuxt'] || deps['@nuxt/kit'] ? 'Nuxt.js' : 'Vue.js';
        detection.installCmd = 'npm install';
        detection.buildCmd = 'npm run build';
        detection.startCmd = 'npm start';
        detection.port = 3000;
      } else if (deps['express'] || deps['nest'] || deps['@nestjs/core']) {
        detection.framework = deps['express'] ? 'Express.js' : 'NestJS';
        detection.installCmd = 'npm install';
        detection.buildCmd = pkg.scripts?.build ? 'npm run build' : '';
        detection.startCmd = pkg.scripts?.start ? 'npm start' : 'node index.js';
        detection.port = 5000;
      }
    } catch (e) { }
  }

  // Python Detection
  if (hasFile('requirements.txt') || hasFile('pyproject.toml') || hasFile('Pipfile')) {
    detection.hasPython = true;
    if (!detection.hasPackageJson) {
      detection.type = 'Python';
      detection.installCmd = 'pip install -r requirements.txt';
      if (hasFile('manage.py')) {
        detection.framework = 'Django';
        detection.buildCmd = 'python manage.py migrate';
        detection.startCmd = 'gunicorn --bind 0.0.0.0:8000 wsgi:application';
        detection.port = 8000;
      } else {
        detection.framework = 'Flask / FastAPI';
        detection.buildCmd = '';
        detection.startCmd = 'python app.py';
        detection.port = 5000;
      }
    }
  }

  // PHP Detection
  if (hasFile('composer.json')) {
    detection.hasPhp = true;
    if (!detection.hasPackageJson && !detection.hasPython) {
      detection.type = 'PHP';
      detection.framework = hasFile('artisan') ? 'Laravel' : 'PHP Composer';
      detection.installCmd = 'composer install --no-dev --optimize-autoloader';
      detection.buildCmd = hasFile('artisan') ? 'php artisan config:cache' : '';
      detection.startCmd = hasFile('artisan') ? 'php artisan serve --port=8000' : 'php -S 0.0.0.0:8000';
      detection.port = 8000;
    }
  }

  // Docker Detection
  if (hasFile('Dockerfile') || hasFile('docker-compose.yml') || hasFile('compose.yaml')) {
    detection.hasDocker = true;
    if (hasFile('docker-compose.yml') || hasFile('compose.yaml')) {
      detection.framework = 'Docker Compose';
      detection.installCmd = 'docker compose build';
      detection.buildCmd = '';
      detection.startCmd = 'docker compose up -d';
    }
  }

  return reply.send({ success: true, detection });
});

// ----------------------------------------------------
// 8. STEP 8: VPS IP DETECTION
// ----------------------------------------------------
fastify.get('/api/system/ip', async (request, reply) => {
  try {
    const sources = [
      'https://api.ipify.org?format=json',
      'https://icanhazip.com',
      'https://ifconfig.me/ip'
    ];

    let detectedIp = null;
    for (const src of sources) {
      try {
        const res = await httpRequest(src);
        if (typeof res.data === 'object' && res.data.ip) {
          detectedIp = res.data.ip.trim();
          break;
        } else if (typeof res.data === 'string' && res.data.trim()) {
          detectedIp = res.data.trim();
          break;
        }
      } catch (e) { }
    }

    if (!detectedIp) {
      detectedIp = request.ip || '127.0.0.1';
    }

    sessionState.vpsIp = detectedIp;
    return reply.send({ success: true, ip: detectedIp });
  } catch (err) {
    return reply.send({ success: true, ip: '127.0.0.1' });
  }
});

// ----------------------------------------------------
// 9. STEP 9: REAL-TIME DNS CHECK
// ----------------------------------------------------
fastify.post('/api/system/check-dns', async (request, reply) => {
  const { domain, wwwDomain, expectedIp } = request.body || {};
  if (!domain) {
    return reply.status(400).send({ success: false, error: 'Domain is required' });
  }

  const vpsIp = expectedIp || sessionState.vpsIp;
  const results = {
    domain: { host: domain, resolved: [], matches: false },
    wwwDomain: { host: wwwDomain || `www.${domain}`, resolved: [], matches: false }
  };

  try {
    const mainIps = await dns.resolve4(domain).catch(() => []);
    results.domain.resolved = mainIps;
    results.domain.matches = mainIps.includes(vpsIp);
  } catch (e) { }

  if (wwwDomain || domain) {
    const wwwHost = wwwDomain || `www.${domain}`;
    try {
      const wwwIps = await dns.resolve4(wwwHost).catch(() => []);
      results.wwwDomain.resolved = wwwIps;
      results.wwwDomain.matches = wwwIps.includes(vpsIp);
    } catch (e) { }
  }

  const overallSuccess = results.domain.matches || results.domain.resolved.length > 0;

  return reply.send({
    success: overallSuccess,
    expectedIp: vpsIp,
    results
  });
});

// ----------------------------------------------------
// 11. STEP 11: NGINX CONFIGURATION GENERATOR
// ----------------------------------------------------
fastify.post('/api/system/nginx', async (request, reply) => {
  const { domain, wwwDomain, port } = request.body || {};
  if (!domain || !port) {
    return reply.status(400).send({ success: false, error: 'Domain and target port are required' });
  }

  const serverNames = `${domain} ${wwwDomain || 'www.' + domain}`;

  const nginxConfig = `
server {
    listen 80;
    listen [::]:80;
    server_name ${serverNames};

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`.trim();

  // If on Linux/VPS, attempt writing to /etc/nginx/sites-available/
  const sitesAvailable = '/etc/nginx/sites-available';
  const sitesEnabled = '/etc/nginx/sites-enabled';

  let written = false;
  if (fs.existsSync(sitesAvailable)) {
    try {
      const confPath = path.join(sitesAvailable, domain);
      fs.writeFileSync(confPath, nginxConfig, 'utf8');

      if (fs.existsSync(sitesEnabled)) {
        const linkPath = path.join(sitesEnabled, domain);
        if (!fs.existsSync(linkPath)) {
          fs.symlinkSync(confPath, linkPath);
        }
      }
      written = true;
    } catch (e) {
      console.error('Nginx config write failed:', e);
    }
  }

  return reply.send({
    success: true,
    domain,
    port,
    configPreview: nginxConfig,
    writtenToDisk: written
  });
});

// ----------------------------------------------------
// 12. STEP 12: SSH DEPLOY KEY CREATION
// ----------------------------------------------------
fastify.post('/api/system/deploy-key', async (request, reply) => {
  const { owner, repo, token } = request.body || {};
  const activeToken = token || sessionState.githubToken;

  const keyPath = `/tmp/fluid_deploy_key_${Date.now()}`;

  return new Promise((resolve) => {
    const keygen = spawn('ssh-keygen', ['-t', 'ed25519', '-C', 'fluid-vps-deploy', '-f', keyPath, '-N', '']);
    keygen.on('close', async (code) => {
      if (code === 0 && fs.existsSync(`${keyPath}.pub`)) {
        const pubKey = fs.readFileSync(`${keyPath}.pub`, 'utf8');

        if (owner && repo && activeToken) {
          try {
            await httpRequest(`https://api.github.com/repos/${owner}/${repo}/keys`, {
              method: 'POST',
              headers: {
                'User-Agent': 'Fluid-VPS-Assistant',
                'Authorization': `Bearer ${activeToken}`,
                'Content-Type': 'application/json'
              }
            }, {
              title: `FLUID VPS Deploy Key (${new Date().toISOString().split('T')[0]})`,
              key: pubKey,
              read_only: true
            });
          } catch (e) { }
        }

        resolve(reply.send({ success: true, publicKey: pubKey }));
      } else {
        resolve(reply.send({ success: false, error: 'Failed to generate SSH key' }));
      }
    });
  });
});

// ----------------------------------------------------
// 13. STEP 13: CLEANUP & SELF DESTRUCT
// ----------------------------------------------------
fastify.post('/api/system/cleanup', async (request, reply) => {
  reply.send({ success: true, message: 'Fluid installer self-destruct initiated.' });

  setTimeout(() => {
    try {
      // Clear in-memory session tokens
      sessionState.githubToken = null;
      sessionState.vpsIp = null;

      // Clean temporary directories & logs
      const tmpFluid = '/tmp/fluid';
      if (fs.existsSync(tmpFluid)) {
        fs.rmSync(tmpFluid, { recursive: true, force: true });
      }
      if (fs.existsSync('/tmp/fluid_server.log')) {
        fs.rmSync('/tmp/fluid_server.log', { force: true });
      }
      // Remove any temporary deploy keys in /tmp
      const tmpFiles = fs.readdirSync('/tmp');
      tmpFiles.forEach((f) => {
        if (f.startsWith('fluid_deploy_key_')) {
          try { fs.rmSync(path.join('/tmp', f), { force: true }); } catch (e) { }
        }
      });
    } catch (e) { }
    process.exit(0);
  }, 1500);
});

// ----------------------------------------------------
// WEBSOCKET CONNECTION TEST
// ----------------------------------------------------
fastify.get('/ws-test', (request, reply) => {
  reply.send({ 
    status: 'WebSocket endpoint available',
    endpoint: '/ws/terminal',
    serverTime: new Date().toISOString()
  });
});

// ----------------------------------------------------
// PORT CONFLICT CHECK
// ----------------------------------------------------
fastify.post('/api/check-port', async (request, reply) => {
  const { port } = request.body || {};
  console.log('Checking port:', port);
  
  if (!port) {
    return reply.status(400).send({ success: false, error: 'Port is required' });
  }

  try {
    const isWin = process.platform === 'win32';
    const checkCommand = isWin 
      ? `netstat -ano | findstr :${port}`
      : `netstat -tlnp 2>/dev/null | grep :${port} || ss -tlnp 2>/dev/null | grep :${port} || lsof -i :${port} 2>/dev/null`;

    const proc = spawn('bash', ['-c', checkCommand]);
    
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const exitCode = await new Promise((resolve) => {
      proc.on('close', (code) => resolve(code));
    });

    const isPortInUse = stdout.trim().length > 0 && exitCode === 0;
    
    return reply.send({
      success: true,
      port: port,
      inUse: isPortInUse,
      output: stdout,
      message: isPortInUse 
        ? `Port ${port} is already in use by another process` 
        : `Port ${port} is available`
    });
  } catch (err) {
    console.log('Port check error:', err.message);
    return reply.status(500).send({ 
      success: false, 
      error: err.message 
    });
  }
});

// ----------------------------------------------------
// KILL PROCESS BY PORT
// ----------------------------------------------------
fastify.post('/api/kill-port', async (request, reply) => {
  const { port } = request.body || {};
  console.log('Killing process on port:', port);
  
  if (!port) {
    return reply.status(400).send({ success: false, error: 'Port is required' });
  }

  try {
    const isWin = process.platform === 'win32';
    let killCommand;
    
    if (isWin) {
      killCommand = `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /F /PID %a`;
    } else {
      // Try multiple methods to kill the process
      killCommand = `
        # Method 1: lsof
        lsof -ti:${port} 2>/dev/null | xargs -r kill -9 2>/dev/null
        # Method 2: fuser
        fuser -k ${port}/tcp 2>/dev/null
        # Method 3: netstat + kill
        PIDS=$(netstat -tlnp 2>/dev/null | grep :${port} | awk '{print $7}' | cut -d'/' -f1)
        if [ ! -z "$PIDS" ]; then
          for pid in $PIDS; do
            kill -9 $pid 2>/dev/null
          done
        fi
      `;
    }

    const proc = spawn('bash', ['-c', killCommand]);
    
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const exitCode = await new Promise((resolve) => {
      proc.on('close', (code) => resolve(code));
    });

    // Wait a moment for the process to actually be killed
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if port is now free
    const checkCommand = isWin 
      ? `netstat -ano | findstr :${port}`
      : `lsof -i :${port} 2>/dev/null || netstat -tlnp 2>/dev/null | grep :${port}`;

    const checkProc = spawn('bash', ['-c', checkCommand]);
    let checkOutput = '';
    
    checkProc.stdout.on('data', (chunk) => {
      checkOutput += chunk.toString();
    });

    await new Promise(resolve => {
      checkProc.on('close', () => resolve());
    });

    const isPortFree = checkOutput.trim().length === 0;

    return reply.send({
      success: true,
      port: port,
      killed: isPortFree,
      exitCode,
      stdout,
      stderr,
      message: isPortFree 
        ? `Successfully killed process on port ${port}` 
        : `Attempted to kill process on port ${port}, but port may still be in use`
    });
  } catch (err) {
    console.log('Kill port error:', err.message);
    return reply.status(500).send({ 
      success: false, 
      error: err.message 
    });
  }
});

// ----------------------------------------------------
// REST API COMMAND EXECUTION (FALLBACK/DEBUGGING)
// ----------------------------------------------------
fastify.post('/api/execute', async (request, reply) => {
  const { command, cwd } = request.body || {};
  console.log('REST API command execution:', command, 'CWD:', cwd);
  
  if (!command) {
    return reply.status(400).send({ success: false, error: 'No command provided' });
  }

  const workDir = cwd && fs.existsSync(cwd) ? cwd : '/tmp';
  console.log('Working directory:', workDir);

  try {
    const isWin = process.platform === 'win32';
    const shell = isWin ? 'cmd.exe' : '/bin/bash';
    const shellArgs = isWin ? ['/c', command] : ['-c', command];

    const proc = spawn(shell, shellArgs, {
      cwd: workDir,
      env: {
        ...process.env,
        FORCE_COLOR: '1',
        PYTHONUNBUFFERED: '1',
        NPM_CONFIG_PROGRESS: 'true',
        DEBIAN_FRONTEND: 'noninteractive',
      }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      console.log('stdout:', chunk.toString());
    });
    
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      console.log('stderr:', chunk.toString());
    });

    const exitCode = await new Promise((resolve) => {
      proc.on('close', (code) => {
        console.log('Process closed with code:', code);
        resolve(code);
      });
    });

    return reply.send({
      success: exitCode === 0,
      exitCode,
      stdout,
      stderr,
      workDir
    });
  } catch (err) {
    console.log('Command execution error:', err.message);
    return reply.status(500).send({ 
      success: false, 
      error: err.message 
    });
  }
});

// ----------------------------------------------------
// WEBSOCKET TERMINAL EXECUTION (LIVE XTERM PTY STREAMING)
// ----------------------------------------------------
fastify.register(async function (fastifyApp) {
  fastifyApp.get('/ws/terminal', { websocket: true }, (connection, req) => {
    console.log('WebSocket connection established');
    let activePty = null;

    const send = (type, data) => {
      try {
        if (connection.socket.readyState === 1) {
          connection.socket.send(JSON.stringify({ type, data }));
        } else {
          console.log('WebSocket not ready, state:', connection.socket.readyState);
        }
      } catch (e) {
        console.log('Error sending WebSocket message:', e.message);
      }
    };

    connection.socket.on('message', async (message) => {
      try {
        console.log('Received WebSocket message:', message.toString());
        const parsed = JSON.parse(message.toString());
        console.log('Parsed message:', parsed);

        // Resize PTY from frontend
        if (parsed.type === 'resize' && activePty) {
          try { activePty.resize(parsed.cols || 120, parsed.rows || 30); } catch (e) { }
          return;
        }

        const { command, cwd } = parsed;
        console.log('Command:', command, 'CWD:', cwd);
        
        if (!command) {
          send('error', 'No command provided\n');
          return;
        }

        const workDir = cwd && fs.existsSync(cwd) ? cwd : '/tmp';
        console.log('Working directory:', workDir);
        send('info', `\r\n\x1b[36m$ ${command}\x1b[0m\r\n`);

        // Try node-pty for true PTY (if installed)
        let usedPty = false;
        try {
          const pty = await import('node-pty').catch(() => null);
          if (pty) {
            console.log('Using node-pty for command execution');
            activePty = pty.spawn('/bin/bash', ['-c', command], {
              name: 'xterm-256color',
              cols: 160,
              rows: 40,
              cwd: workDir,
              env: {
                ...process.env,
                TERM: 'xterm-256color',
                FORCE_COLOR: '3',
                NPM_CONFIG_PROGRESS: 'true',
              }
            });

            activePty.onData((data) => {
              send('stdout', data);
            });

            activePty.onExit(({ exitCode }) => {
              console.log('Process exited with code:', exitCode);
              activePty = null;
              send('exit', exitCode === 0
                ? '\r\n\x1b[32m✓ Process finished successfully\x1b[0m\r\n'
                : `\r\n\x1b[31m✗ Process exited with code ${exitCode}\x1b[0m\r\n`
              );
              connection.socket.send(JSON.stringify({ type: 'exit', code: exitCode }));
            });
            usedPty = true;
          }
        } catch (e) {
          console.log('node-pty not available, using fallback:', e.message);
        }

        // Fallback: spawn with unbuffered env
        if (!usedPty) {
          console.log('Using spawn fallback for command execution');
          const isWin = process.platform === 'win32';
          const shell = isWin ? 'cmd.exe' : '/bin/bash';
          const shellArgs = isWin ? ['/c', command] : ['-c', command];

          const proc = spawn(shell, shellArgs, {
            cwd: workDir,
            env: {
              ...process.env,
              FORCE_COLOR: '1',
              PYTHONUNBUFFERED: '1',
              NPM_CONFIG_PROGRESS: 'true',
              DEBIAN_FRONTEND: 'noninteractive',
            }
          });

          proc.stdout.on('data', (chunk) => {
            console.log('stdout:', chunk.toString());
            send('stdout', chunk.toString());
          });
          
          proc.stderr.on('data', (chunk) => {
            console.log('stderr:', chunk.toString());
            send('stderr', chunk.toString());
          });

          proc.on('close', (code) => {
            console.log('Process closed with code:', code);
            send('exit', code === 0
              ? '\r\n\x1b[32m✓ Process finished successfully\x1b[0m\r\n'
              : `\r\n\x1b[31m✗ Process exited with code ${code}\x1b[0m\r\n`
            );
            connection.socket.send(JSON.stringify({ type: 'exit', code }));
          });

          proc.on('error', (err) => {
            console.log('Process error:', err.message);
            send('error', `\r\n\x1b[31mCommand error: ${err.message}\x1b[0m\r\n`);
          });
          
          // Add timeout to prevent hanging
          setTimeout(() => {
            if (!proc.killed) {
              console.log('Command timeout, killing process');
              proc.kill();
              send('error', '\r\n\x1b[31mCommand timed out after 5 minutes\x1b[0m\r\n');
              connection.socket.send(JSON.stringify({ type: 'exit', code: -1 }));
            }
          }, 5 * 60 * 1000); // 5 minute timeout
        }
      } catch (err) {
        send('error', `Invalid WS message: ${err.message}\n`);
      }
    });

    connection.socket.on('close', () => {
      if (activePty) {
        try { activePty.kill(); } catch (e) { }
        activePty = null;
      }
    });
  });
});

// -----------------------------------------------------------
// STATIC FILE SERVER — registered LAST so all API routes win
// -----------------------------------------------------------
fastify.get('/*', async (request, reply) => {
  const outDir = findOutDir();
  const reqPath = request.url.split('?')[0]; // strip query strings

  // Try exact file match first
  const exactPath = path.join(outDir, reqPath);
  if (fs.existsSync(exactPath) && fs.statSync(exactPath).isFile()) {
    const ext = path.extname(exactPath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    reply.type(mime);
    return reply.send(fs.readFileSync(exactPath));
  }

  // Try with .html extension (Next.js export)
  const htmlPath = exactPath.endsWith('.html') ? exactPath : exactPath + '.html';
  if (fs.existsSync(htmlPath)) {
    reply.type('text/html; charset=utf-8');
    return reply.send(fs.readFileSync(htmlPath));
  }

  // SPA fallback: serve index.html
  const indexPath = path.join(outDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    reply.type('text/html; charset=utf-8');
    return reply.send(fs.readFileSync(indexPath));
  }

  return reply.status(404).send('<h1>FLUID: Frontend not built. Run npm run build first.</h1>');
});

const PORT = 6776;
const HOST = '0.0.0.0';

try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`\n==================================================`);
  console.log(` FLUID VPS DEPLOYMENT ASSISTANT RUNNING`);
  console.log(` Open Web GUI: http://localhost:${PORT}`);
  console.log(` WebSocket Endpoint: ws://localhost:${PORT}/ws/terminal`);
  console.log(` REST API: http://localhost:${PORT}/api/execute`);
  console.log(`==================================================\n`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
