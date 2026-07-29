#!/usr/bin/env node

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
import { optionalAuth } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
}

const fastify = Fastify({
  logger: true,
  bodyLimit: 10 * 1024 * 1024
});

await fastify.register(fastifyCors, {
  origin: process.env.CORS_ORIGIN || true,
  credentials: true
});
await fastify.register(fastifyWebsocket);

try {
  const { connectDatabase } = await import('./services/database.js');
  const prisma = await connectDatabase();
  if (prisma) {
    console.log('[Server] Database connected');
  } else {
    console.warn('[Server] Running without database.');
  }
} catch (err) {
  console.warn('[Server] Database not available:', err.message);
}

try {
  const authRoutes = (await import('./routes/auth.js')).default;
  const projectRoutes = (await import('./routes/projects.js')).default;
  const deploymentRoutes = (await import('./routes/deployments.js')).default;
  const domainRoutes = (await import('./routes/domains.js')).default;
  const envRoutes = (await import('./routes/env-vars.js')).default;
  const webhookRoutes = (await import('./routes/webhooks.js')).default;
  const monitoringRoutes = (await import('./routes/monitoring.js')).default;

  await fastify.register(authRoutes);
  await fastify.register(projectRoutes);
  await fastify.register(deploymentRoutes);
  await fastify.register(domainRoutes);
  await fastify.register(envRoutes);
  await fastify.register(webhookRoutes);
  await fastify.register(monitoringRoutes);

  console.log('[Server] All portal routes registered');
} catch (err) {
  console.warn('[Server] Route registration failed:', err.message);
}

const sessionState = { githubToken: null, vpsIp: null };

function httpRequest(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const req = lib.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const contentType = res.headers['content-type'] || '';
          if (contentType.includes('application/json')) {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } else {
            resolve({ status: res.statusCode, data: body });
          }
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'object' ? JSON.stringify(data) : data);
    req.end();
  });
}

fastify.post('/api/github/device-code', async (request, reply) => {
  const { clientId } = request.body || {};
  const DEFAULT_CLIENT_ID = 'Ov23lixc10ZT3lahfJtf';
  const targetClientId = clientId?.trim() || DEFAULT_CLIENT_ID;
  try {
    const res = await httpRequest('https://github.com/login/device/code', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    }, { client_id: targetClientId, scope: 'repo read:user user:email admin:public_key' });
    return reply.send({ success: true, clientId: targetClientId, ...res.data });
  } catch (err) {
    return reply.status(500).send({ success: false, error: err.message });
  }
});

fastify.post('/api/github/poll-token', { preHandler: [optionalAuth] }, async (request, reply) => {
  const { clientId, deviceCode } = request.body || {};
  try {
    const res = await httpRequest('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    }, { client_id: clientId, device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' });
    if (res.data?.access_token) {
      sessionState.githubToken = res.data.access_token;
      if (request.user?.githubToken !== res.data.access_token) {
        try {
          const { getPrisma } = await import('./services/database.js');
          await getPrisma().user.update({
            where: { id: request.user.id },
            data: { githubToken: res.data.access_token }
          });
        } catch (e) {}
      }
      return reply.send({ success: true, accessToken: res.data.access_token });
    }
    return reply.send({ success: false, ...res.data });
  } catch (err) {
    return reply.status(500).send({ success: false, error: err.message });
  }
});

fastify.get('/api/github/repos', async (request, reply) => {
  const token = request.headers.authorization?.replace('Bearer ', '') || sessionState.githubToken;
  if (!token) return reply.status(401).send({ success: false, error: 'Unauthorized' });
  try {
    const res = await httpRequest('https://api.github.com/user/repos?per_page=100&sort=updated&type=all', {
      method: 'GET', headers: { 'User-Agent': 'Fluid-VPS-Assistant', 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    if (Array.isArray(res.data)) {
      const repos = res.data.map(r => ({
        id: r.id, name: r.name, fullName: r.full_name, private: r.private,
        htmlUrl: r.html_url, cloneUrl: r.clone_url, defaultBranch: r.default_branch || 'main',
        description: r.description, updatedAt: r.updated_at
      }));
      return reply.send({ success: true, repos });
    }
    return reply.send({ success: false, error: res.data?.message || 'Failed' });
  } catch (err) {
    return reply.status(500).send({ success: false, error: err.message });
  }
});

fastify.get('/api/github/branches', async (request, reply) => {
  const { owner, repo } = request.query;
  const token = request.headers.authorization?.replace('Bearer ', '') || sessionState.githubToken;
  if (!owner || !repo) return reply.status(400).send({ success: false, error: 'Missing owner/repo' });
  try {
    const res = await httpRequest(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`, {
      method: 'GET', headers: { 'User-Agent': 'Fluid-VPS-Assistant', 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    if (Array.isArray(res.data)) return reply.send({ success: true, branches: res.data.map(b => b.name) });
    return reply.send({ success: false, branches: ['main', 'master'] });
  } catch {
    return reply.send({ success: true, branches: ['main', 'master'] });
  }
});

fastify.post('/api/system/check-dir', async (request, reply) => {
  const { dirPath } = request.body || {};
  if (!dirPath) return reply.status(400).send({ success: false, error: 'Directory path required' });
  const normalized = path.normalize(dirPath);
  const exists = fs.existsSync(normalized);
  let isEmpty = true;
  if (exists) {
    try { isEmpty = fs.readdirSync(normalized).length === 0; } catch { isEmpty = false; }
  }
  return reply.send({ success: true, path: normalized, exists, isEmpty });
});

fastify.post('/api/deploy/detect', async (request, reply) => {
  const { dirPath } = request.body || {};
  const targetDir = dirPath ? path.normalize(dirPath) : process.cwd();
  if (!fs.existsSync(targetDir)) {
    return reply.status(404).send({ success: false, error: 'Target directory does not exist' });
  }
  const detection = {
    type: 'Unknown', framework: 'Generic', installCmd: 'npm install', buildCmd: 'npm run build',
    startCmd: 'npm start', port: 3000, hasPackageJson: false, hasPython: false, hasPhp: false, hasDocker: false
  };
  const hasFile = (f) => fs.existsSync(path.join(targetDir, f));

  if (hasFile('package.json')) {
    detection.hasPackageJson = true; detection.type = 'Node.js';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['next']) {
        Object.assign(detection, { framework: 'Next.js', installCmd: 'npm install', buildCmd: 'npm run build', startCmd: 'npm start', port: 3000 });
      } else if (deps['react-scripts'] || deps['vite']) {
        Object.assign(detection, { framework: deps['vite'] ? 'Vite / React' : 'Create React App', installCmd: 'npm install', buildCmd: 'npm run build', startCmd: 'npx serve -s build -l 3000', port: 3000 });
      } else if (deps['vue'] || deps['@nuxt/kit'] || deps['nuxt']) {
        Object.assign(detection, { framework: deps['nuxt'] || deps['@nuxt/kit'] ? 'Nuxt.js' : 'Vue.js', installCmd: 'npm install', buildCmd: 'npm run build', startCmd: 'npm start', port: 3000 });
      } else if (deps['express'] || deps['nest'] || deps['@nestjs/core']) {
        Object.assign(detection, { framework: deps['express'] ? 'Express.js' : 'NestJS', installCmd: 'npm install', buildCmd: pkg.scripts?.build ? 'npm run build' : '', startCmd: pkg.scripts?.start ? 'npm start' : 'node index.js', port: 5000 });
      }
    } catch (e) {}
  }
  if (hasFile('requirements.txt') || hasFile('pyproject.toml') || hasFile('Pipfile')) {
    detection.hasPython = true;
    if (!detection.hasPackageJson) {
      detection.type = 'Python'; detection.installCmd = 'pip install -r requirements.txt';
      if (hasFile('manage.py')) {
        Object.assign(detection, { framework: 'Django', buildCmd: 'python manage.py migrate', startCmd: 'gunicorn --bind 0.0.0.0:8000 wsgi:application', port: 8000 });
      } else {
        Object.assign(detection, { framework: 'Flask / FastAPI', buildCmd: '', startCmd: 'python app.py', port: 5000 });
      }
    }
  }
  if (hasFile('composer.json')) {
    detection.hasPhp = true;
    if (!detection.hasPackageJson && !detection.hasPython) {
      detection.type = 'PHP'; detection.framework = hasFile('artisan') ? 'Laravel' : 'PHP Composer';
      detection.installCmd = 'composer install --no-dev'; detection.buildCmd = hasFile('artisan') ? 'php artisan config:cache' : ''; detection.startCmd = hasFile('artisan') ? 'php artisan serve --port=8000' : 'php -S 0.0.0.0:8000'; detection.port = 8000;
    }
  }
  if (hasFile('Dockerfile') || hasFile('docker-compose.yml') || hasFile('compose.yaml')) {
    detection.hasDocker = true;
    if (hasFile('docker-compose.yml') || hasFile('compose.yaml')) {
      Object.assign(detection, { framework: 'Docker Compose', installCmd: 'docker compose build', buildCmd: '', startCmd: 'docker compose up -d' });
    }
  }
  return reply.send({ success: true, detection });
});

fastify.get('/api/system/ip', async (request, reply) => {
  try {
    const res = await httpRequest('https://api.ipify.org?format=json');
    const ip = typeof res.data === 'object' ? res.data.ip?.trim() : res.data?.trim();
    sessionState.vpsIp = ip || request.ip || '127.0.0.1';
    return reply.send({ success: true, ip: sessionState.vpsIp });
  } catch {
    return reply.send({ success: true, ip: '127.0.0.1' });
  }
});

fastify.post('/api/system/check-dns', async (request, reply) => {
  const { domain, wwwDomain, expectedIp } = request.body || {};
  if (!domain) return reply.status(400).send({ success: false, error: 'Domain required' });
  const vpsIp = expectedIp || sessionState.vpsIp;
  const results = {
    domain: { host: domain, resolved: [], matches: false },
    wwwDomain: { host: wwwDomain || `www.${domain}`, resolved: [], matches: false }
  };

  const resolver = new dns.Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1', '208.67.222.222']);

  try {
    const mainIps = await resolver.resolve4(domain);
    results.domain.resolved = mainIps;
    results.domain.matches = mainIps.includes(vpsIp);
  } catch (e) {}

  try {
    const mainIpv6 = await resolver.resolve6(domain);
    if (mainIpv6 && mainIpv6.length > 0) {
      results.domain.resolved = [...results.domain.resolved, ...mainIpv6];
    }
  } catch (e) {}

  const wwwHost = wwwDomain || `www.${domain}`;
  if (wwwHost && wwwHost !== domain) {
    try {
      const wwwIps = await resolver.resolve4(wwwHost);
      results.wwwDomain.resolved = wwwIps;
      results.wwwDomain.matches = wwwIps.includes(vpsIp);
    } catch (e) {}
    try {
      const wwwIpv6 = await resolver.resolve6(wwwHost);
      if (wwwIpv6 && wwwIpv6.length > 0) {
        results.wwwDomain.resolved = [...results.wwwDomain.resolved, ...wwwIpv6];
      }
    } catch (e) {}
  } else {
    results.wwwDomain = results.domain;
  }

  const bothMatch = results.domain.matches && (!wwwHost || wwwHost === domain || results.wwwDomain.matches);
  const domainResolved = results.domain.resolved.length > 0;
  return reply.send({ success: bothMatch || (domainResolved && results.domain.matches), expectedIp: vpsIp, results });
});

fastify.post('/api/system/nginx', async (request, reply) => {
  const { domain, wwwDomain, port } = request.body || {};
  if (!domain || !port) return reply.status(400).send({ success: false, error: 'Domain and port required' });
  const serverNames = `${domain} ${wwwDomain || 'www.' + domain}`;
  const nginxConfig = `server {
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
  }`;
  let written = false;
  let error = null;
  let nginxInstalled = false;
  try {
    const { stdout } = await import('child_process').then(cp =>
      new Promise(r => cp.exec('which nginx 2>/dev/null', (err, stdout) => r({ stdout: stdout || '' })))
    ).catch(() => ({ stdout: '' }));
    nginxInstalled = stdout.trim().length > 0;
  } catch (e) {}

  if (fs.existsSync('/etc/nginx/sites-available')) {
    try {
      const confPath = path.join('/etc/nginx/sites-available', domain);
      fs.writeFileSync(confPath, nginxConfig, 'utf8');
      if (fs.existsSync('/etc/nginx/sites-enabled')) {
        const linkPath = path.join('/etc/nginx/sites-enabled', domain);
        if (!fs.existsSync(linkPath)) fs.symlinkSync(confPath, linkPath);
      }
      written = true;
    } catch (e) {
      error = e.message;
    }
  } else {
    error = 'Nginx sites-available directory not found. Is Nginx installed?';
  }
  return reply.send({ success: true, domain, port, configPreview: nginxConfig, writtenToDisk: written, nginxInstalled, error });
});

fastify.post('/api/system/check-domain', async (request, reply) => {
  const { domain } = request.body || {};
  if (!domain) return reply.status(400).send({ success: false, error: 'Domain required' });
  try {
    const url = `${domain.startsWith('https') ? 'https' : 'http'}://${domain}`;
    const response = await httpRequest(url, { method: 'GET', timeout: 10000, headers: { 'User-Agent': 'Fluid-VPS-Assistant' } });
    return reply.send({ success: true, accessible: true, statusCode: response.statusCode || response.status });
  } catch (e) {
    return reply.send({ success: true, accessible: false });
  }
});

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
              method: 'POST', headers: { 'User-Agent': 'Fluid-VPS-Assistant', 'Authorization': `Bearer ${activeToken}`, 'Content-Type': 'application/json' }
            }, { title: `FLUID Deploy Key (${new Date().toISOString().split('T')[0]})`, key: pubKey, read_only: true });
          } catch (e) {}
        }
        resolve(reply.send({ success: true, publicKey: pubKey }));
      } else {
        resolve(reply.send({ success: false, error: 'Failed to generate SSH key' }));
      }
    });
  });
});

fastify.post('/api/system/cleanup', async (request, reply) => {
  reply.send({ success: true, message: 'Cleanup initiated' });
  setTimeout(() => {
    try {
      sessionState.githubToken = null; sessionState.vpsIp = null;
      ['/tmp/fluid', '/tmp/fluid_server.log'].forEach(p => {
        if (fs.existsSync(p)) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) {} }
      });
      if (fs.existsSync('/tmp')) {
        fs.readdirSync('/tmp').forEach(f => {
          if (f.startsWith('fluid_deploy_key_')) { try { fs.rmSync(path.join('/tmp', f), { force: true }); } catch (e) {} }
        });
      }
    } catch (e) {}
    console.log('[Server] Cleanup complete');
  }, 1500);
});

fastify.get('/ws-test', (request, reply) => {
  reply.send({ status: 'WebSocket available', endpoint: '/ws/terminal', serverTime: new Date().toISOString() });
});

fastify.post('/api/check-port', async (request, reply) => {
  const { port } = request.body || {};
  if (!port) return reply.status(400).send({ success: false, error: 'Port required' });
  try {
    const isWin = process.platform === 'win32';
    const checkCommand = isWin ? `netstat -ano | findstr :${port}` : `netstat -tlnp 2>/dev/null | grep :${port} || ss -tlnp 2>/dev/null | grep :${port} || lsof -i :${port} 2>/dev/null`;
    const proc = spawn('bash', ['-c', checkCommand]);
    let stdout = '';
    proc.stdout.on('data', (chunk) => stdout += chunk.toString());
    const exitCode = await new Promise((resolve) => proc.on('close', resolve));
    return reply.send({ success: true, port, inUse: stdout.trim().length > 0 && exitCode === 0, message: stdout.trim() ? `Port ${port} in use` : `Port ${port} available` });
  } catch (err) {
    return reply.status(500).send({ success: false, error: err.message });
  }
});

fastify.post('/api/kill-port', async (request, reply) => {
  const { port } = request.body || {};
  if (!port) return reply.status(400).send({ success: false, error: 'Port required' });
  try {
    const pidProc = spawn('bash', ['-c', `lsof -ti:${port}`]);
    let pidOutput = '';
    pidProc.stdout.on('data', (chunk) => pidOutput += chunk.toString());
    await new Promise(r => pidProc.on('close', r));
    if (pidOutput.trim()) {
      for (const pid of pidOutput.trim().split('\n').filter(Boolean)) {
        spawn('kill', ['-9', pid.trim()]);
      }
    }
    await new Promise(r => setTimeout(r, 1000));
    return reply.send({ success: true, port, killed: true });
  } catch (err) {
    return reply.status(500).send({ success: false, error: err.message });
  }
});

fastify.post('/api/execute', async (request, reply) => {
  const { command, cwd } = request.body || {};
  if (!command) return reply.status(400).send({ success: false, error: 'No command provided' });
  const workDir = cwd && fs.existsSync(cwd) ? cwd : '/tmp';
  try {
    const isWin = process.platform === 'win32';
    const shell = isWin ? 'cmd.exe' : '/bin/bash';
    const shellArgs = isWin ? ['/c', command] : ['-c', command];
    const proc = spawn(shell, shellArgs, {
      cwd: workDir,
      env: { ...process.env, FORCE_COLOR: '1', PYTHONUNBUFFERED: '1', NPM_CONFIG_PROGRESS: 'true' }
    });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (chunk) => stdout += chunk.toString());
    proc.stderr.on('data', (chunk) => stderr += chunk.toString());
    const exitCode = await new Promise((resolve) => proc.on('close', resolve));
    return reply.send({ success: exitCode === 0, exitCode, stdout, stderr, workDir });
  } catch (err) {
    return reply.status(500).send({ success: false, error: err.message });
  }
});

fastify.register(async function (fastifyApp) {
  fastifyApp.get('/ws/terminal', { websocket: true }, (connection, req) => {
    console.log('[WS] Terminal connection established');
    let activePty = null;

    const send = (type, data) => {
      try {
        if (connection.socket.readyState === 1) {
          connection.socket.send(JSON.stringify({ type, data }));
        }
      } catch (e) {}
    };

    connection.socket.on('message', async (message) => {
      try {
        const parsed = JSON.parse(message.toString());
        if (parsed.type === 'resize' && activePty) {
          try { activePty.resize(parsed.cols || 120, parsed.rows || 30); } catch (e) {}
          return;
        }
        const { command, cwd } = parsed;
        if (!command) { send('error', 'No command provided\n'); return; }

        const workDir = cwd && fs.existsSync(cwd) ? cwd : '/tmp';
        send('info', `\r\n\x1b[36m$ ${command}\x1b[0m\r\n`);

        let usedPty = false;
        try {
          const pty = await import('node-pty').catch(() => null);
          if (pty) {
            activePty = pty.spawn('/bin/bash', ['-c', command], {
              name: 'xterm-256color', cols: 160, rows: 40, cwd: workDir,
              env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', NPM_CONFIG_PROGRESS: 'true' }
            });
            activePty.onData((data) => send('stdout', data));
            activePty.onExit(({ exitCode }) => {
              activePty = null;
              send('exit', exitCode === 0 ? '\r\n\x1b[32m✓ Finished\x1b[0m\r\n' : `\r\n\x1b[31m✗ Exit code ${exitCode}\x1b[0m\r\n`);
              connection.socket.send(JSON.stringify({ type: 'exit', code: exitCode }));
            });
            usedPty = true;
          }
        } catch (e) {}

        if (!usedPty) {
          const isWin = process.platform === 'win32';
          const shell = isWin ? 'cmd.exe' : '/bin/bash';
          const proc = spawn(shell, isWin ? ['/c', command] : ['-c', command], {
            cwd: workDir,
            env: { ...process.env, FORCE_COLOR: '1', PYTHONUNBUFFERED: '1', NPM_CONFIG_PROGRESS: 'true' }
          });
          proc.stdout.on('data', (chunk) => send('stdout', chunk.toString()));
          proc.stderr.on('data', (chunk) => send('stderr', chunk.toString()));
          proc.on('close', (code) => {
            send('exit', code === 0 ? '\r\n\x1b[32m✓ Finished\x1b[0m\r\n' : `\r\n\x1b[31m✗ Exit code ${code}\x1b[0m\r\n`);
            connection.socket.send(JSON.stringify({ type: 'exit', code }));
          });
          proc.on('error', (err) => send('error', `\r\n\x1b[31m${err.message}\x1b[0m\r\n`));
          setTimeout(() => {
            if (!proc.killed) { proc.kill(); send('error', '\r\n\x1b[31mTimeout after 5m\x1b[0m\r\n'); }
          }, 300000);
        }
      } catch (err) {
        send('error', `Invalid message: ${err.message}\n`);
      }
    });

    connection.socket.on('close', () => {
      if (activePty) { try { activePty.kill(); } catch (e) {} activePty = null; }
    });
  });
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.map': 'application/json'
};

function findOutDir() {
  const possiblePaths = [
    path.join(__dirname, '../out'), path.join(__dirname, './out'), path.join(process.cwd(), 'out')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, 'index.html'))) return p;
  }
  return path.join(process.cwd(), 'out');
}

fastify.get('/*', async (request, reply) => {
  if (request.url.startsWith('/api/') || request.url.startsWith('/ws')) return;

  const outDir = findOutDir();
  const reqPath = request.url.split('?')[0];
  const exactPath = path.join(outDir, reqPath);

  if (fs.existsSync(exactPath) && fs.statSync(exactPath).isFile()) {
    const ext = path.extname(exactPath).toLowerCase();
    reply.type(MIME_TYPES[ext] || 'application/octet-stream');
    return reply.send(fs.readFileSync(exactPath));
  }

  const htmlPath = exactPath.endsWith('.html') ? exactPath : exactPath + '.html';
  if (fs.existsSync(htmlPath)) {
    reply.type('text/html; charset=utf-8');
    return reply.send(fs.readFileSync(htmlPath));
  }

  const indexPath = path.join(outDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    reply.type('text/html; charset=utf-8');
    return reply.send(fs.readFileSync(indexPath));
  }

  return reply.status(404).send('<h1>FLUID: Frontend not built. Run npm run build first.</h1>');
});

const PORT = parseInt(process.env.PORT) || 6776;
const HOST = process.env.HOST || '0.0.0.0';

try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`\n==================================================`);
  console.log(`  FLUID VPS PORTAL RUNNING`);
  console.log(`  Open: http://localhost:${PORT}`);
  const { getConnectionStatus } = await import('./services/database.js');
  console.log(`  Status: ${getConnectionStatus().connected ? 'Database connected' : 'No database'}`);
  console.log(`==================================================\n`);

  if (getConnectionStatus().connected) {
    const { getPrisma } = await import('./services/database.js');

    async function collectStats() {
      try {
        const os = await import('os');
        const prisma = getPrisma();
        const { stdout: pm2Out } = await import('child_process').then(cp =>
          new Promise(r => cp.exec('pm2 jlist 2>/dev/null || echo "[]"', (err, stdout) => r({ stdout: stdout || '[]' })))
        ).catch(() => ({ stdout: '[]' }));

        let pm2Processes = [];
        try { pm2Processes = JSON.parse(pm2Out).map(p => ({
          name: p.name, pid: p.pid, cpu: p.monit?.cpu || 0, memory: p.monit?.memory || 0,
          status: p.pm2_env?.status || 'unknown', uptime: p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0, restarts: p.pm2_env?.restart_time || 0
        })); } catch (e) {}

        await prisma.serverStats.create({
          data: {
            timestamp: new Date(),
            cpu: { usage: os.loadavg()[0] / os.cpus().length * 100, loadAvg: os.loadavg(), cores: os.cpus().length },
            memory: { total: os.totalmem(), used: os.totalmem() - os.freemem(), free: os.freemem(), available: os.freemem() },
            disk: [],
            network: {},
            processes: { total: pm2Processes.length, running: pm2Processes.filter(p => p.status === 'online').length, pm2Processes },
            docker: {}
          }
        });
        console.log('[Stats] Collected');
      } catch (e) {
        console.error('[Stats] Collection failed:', e.message);
      }
    }

    collectStats();
    setInterval(collectStats, 60000);
  }

} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
