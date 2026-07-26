import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
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

// Serve static Next.js frontend if built in ./out or ../out
const findOutDir = () => {
  const possiblePaths = [
    path.join(__dirname, '../out'),
    path.join(__dirname, './out'),
    path.join(process.cwd(), 'out'),
    path.join(__dirname, '../public'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, 'index.html'))) {
      return p;
    }
  }
  return path.join(process.cwd(), 'out');
};

const clientOutPath = findOutDir();

if (!fs.existsSync(clientOutPath)) {
  fs.mkdirSync(clientOutPath, { recursive: true });
}

await fastify.register(fastifyStatic, {
  root: clientOutPath,
  prefix: '/',
  index: ['index.html'],
  wildcard: false,
});

// Serve index.html for SPA client routes and GET /
fastify.setNotFoundHandler((request, reply) => {
  if (request.raw.url && (request.raw.url.startsWith('/api') || request.raw.url.startsWith('/ws'))) {
    return reply.status(404).send({ success: false, error: 'API endpoint not found' });
  }
  const currentOut = findOutDir();
  const indexPath = path.join(currentOut, 'index.html');
  if (fs.existsSync(indexPath)) {
    return reply.type('text/html').send(fs.readFileSync(indexPath, 'utf8'));
  }
  return reply.status(404).send({ success: false, error: 'Frontend static build not found' });
});

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
  const DEFAULT_CLIENT_ID = 'Ov23li44i69R3gU2sQvY'; // Default fallback or prompt user
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
    } catch (e) {}
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
      } catch (e) {}
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
  } catch (e) {}

  if (wwwDomain || domain) {
    const wwwHost = wwwDomain || `www.${domain}`;
    try {
      const wwwIps = await dns.resolve4(wwwHost).catch(() => []);
      results.wwwDomain.resolved = wwwIps;
      results.wwwDomain.matches = wwwIps.includes(vpsIp);
    } catch (e) {}
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
          } catch (e) {}
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
          try { fs.rmSync(path.join('/tmp', f), { force: true }); } catch (e) {}
        }
      });
    } catch (e) {}
    process.exit(0);
  }, 1500);
});

// ----------------------------------------------------
// WEBSOCKET TERMINAL EXECUTION (LIVE XTERM STREAMING)
// ----------------------------------------------------
fastify.register(async function (fastifyApp) {
  fastifyApp.get('/ws/terminal', { websocket: true }, (connection, req) => {
    connection.socket.on('message', (message) => {
      try {
        const parsed = JSON.parse(message.toString());
        const { command, cwd } = parsed;

        if (!command) {
          connection.socket.send(JSON.stringify({ type: 'error', data: 'No command provided\n' }));
          return;
        }

        const workDir = cwd && fs.existsSync(cwd) ? cwd : process.cwd();
        connection.socket.send(JSON.stringify({ type: 'info', data: `\r\n\x1b[36m$ ${command}\x1b[0m\r\n` }));

        const isWin = process.platform === 'win32';
        const shell = isWin ? 'cmd.exe' : '/bin/bash';
        const args = isWin ? ['/c', command] : ['-c', command];

        const proc = spawn(shell, args, {
          cwd: workDir,
          env: { ...process.env, PATH: process.env.PATH, FORCE_COLOR: '1' }
        });

        proc.stdout.on('data', (chunk) => {
          connection.socket.send(JSON.stringify({ type: 'stdout', data: chunk.toString() }));
        });

        proc.stderr.on('data', (chunk) => {
          connection.socket.send(JSON.stringify({ type: 'stderr', data: chunk.toString() }));
        });

        proc.on('close', (code) => {
          connection.socket.send(JSON.stringify({
            type: 'exit',
            code,
            data: `\r\n\x1b[${code === 0 ? '32m✓ Process finished successfully' : '31m✗ Process exited with code ' + code}\x1b[0m\r\n`
          }));
        });

        proc.on('error', (err) => {
          connection.socket.send(JSON.stringify({
            type: 'error',
            data: `\r\n\x1b[31mCommand execution error: ${err.message}\x1b[0m\r\n`
          }));
        });
      } catch (err) {
        connection.socket.send(JSON.stringify({ type: 'error', data: `Invalid WS message: ${err.message}\n` }));
      }
    });
  });
});

const PORT = 6776;
const HOST = '0.0.0.0';

try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`\n==================================================`);
  console.log(` FLUID VPS DEPLOYMENT ASSISTANT RUNNING`);
  console.log(` Open Web GUI: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
