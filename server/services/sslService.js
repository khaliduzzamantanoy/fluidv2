const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// SSL providers configuration
const SSL_PROVIDERS = {
  letsencrypt: {
    name: "Let's Encrypt",
    command: 'certbot',
    autoInstall: true
  },
  selfsigned: {
    name: 'Self-Signed',
    command: 'openssl',
    autoInstall: true
  },
  cloudflare: {
    name: 'Cloudflare',
    command: null,
    autoInstall: false
  }
};

// Install SSL certificate
async function installSSL(domain, email, provider, io, sessionId) {
  try {
    const providerConfig = SSL_PROVIDERS[provider];
    
    if (!providerConfig) {
      throw new Error('Invalid SSL provider');
    }
    
    if (provider === 'letsencrypt') {
      return await installLetsEncrypt(domain, email, io, sessionId);
    } else if (provider === 'selfsigned') {
      return await installSelfSigned(domain, io, sessionId);
    } else if (provider === 'cloudflare') {
      return { success: true, message: 'Cloudflare SSL will be managed through Cloudflare dashboard' };
    }
    
    throw new Error('SSL provider not implemented');
  } catch (error) {
    throw new Error(`Failed to install SSL: ${error.message}`);
  }
}

// Install Let's Encrypt SSL
async function installLetsEncrypt(domain, email, io, sessionId) {
  try {
    // Check if certbot is installed
    try {
      await execAsync('which certbot');
    } catch {
      // Install certbot
      if (io && sessionId) {
        io.to(sessionId).emit('terminal-output', {
          data: 'Installing certbot...\n'
        });
      }
      await execAsync('sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx');
    }
    
    // Obtain certificate
    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', {
        data: `Obtaining SSL certificate for ${domain}...\n`
      });
    }
    
    const command = `sudo certbot --nginx -d ${domain} -d www.${domain} --non-interactive --agree-tos --email ${email}`;
    
    const { stdout, stderr } = await execAsync(command);
    
    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', { data: stdout });
      if (stderr) {
        io.to(sessionId).emit('terminal-output', { data: stderr });
      }
    }
    
    return {
      success: true,
      message: 'SSL certificate installed successfully',
      provider: "Let's Encrypt"
    };
  } catch (error) {
    throw new Error(`Let's Encrypt installation failed: ${error.message}`);
  }
}

// Install self-signed certificate
async function installSelfSigned(domain, io, sessionId) {
  try {
    const sslDir = '/etc/ssl/custom';
    await fs.mkdir(sslDir, { recursive: true });
    
    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', {
        data: `Generating self-signed certificate for ${domain}...\n`
      });
    }
    
    const keyPath = path.join(sslDir, `${domain}.key`);
    const certPath = path.join(sslDir, `${domain}.crt`);
    
    const command = `sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ${keyPath} -out ${certPath} -subj "/CN=${domain}"`;
    
    const { stdout, stderr } = await execAsync(command);
    
    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', { data: stdout });
      if (stderr) {
        io.to(sessionId).emit('terminal-output', { data: stderr });
      }
    }
    
    return {
      success: true,
      message: 'Self-signed certificate generated',
      keyPath,
      certPath,
      provider: 'Self-Signed'
    };
  } catch (error) {
    throw new Error(`Self-signed certificate generation failed: ${error.message}`);
  }
}

// Configure Nginx
async function configureNginx(domain, projectPath, port, io, sessionId) {
  try {
    // Check if nginx is installed
    try {
      await execAsync('which nginx');
    } catch {
      // Install nginx
      if (io && sessionId) {
        io.to(sessionId).emit('terminal-output', {
          data: 'Installing nginx...\n'
        });
      }
      await execAsync('sudo apt-get update && sudo apt-get install -y nginx');
    }
    
    // Create nginx config
    const config = `
server {
    listen 80;
    server_name ${domain} www.${domain};

    location / {
        proxy_pass http://localhost:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-Forwarded-For $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
`;
    
    const configPath = `/etc/nginx/sites-available/${domain}`;
    
    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', {
        data: `Creating nginx configuration for ${domain}...\n`
      });
    }
    
    await fs.writeFile(configPath, config);
    
    // Enable site
    await execAsync(`sudo ln -sf ${configPath} /etc/nginx/sites-enabled/`);
    
    // Remove default site
    await execAsync('sudo rm -f /etc/nginx/sites-enabled/default');
    
    // Test nginx config
    await execAsync('sudo nginx -t');
    
    // Reload nginx
    await execAsync('sudo systemctl reload nginx');
    
    if (io && sessionId) {
      io.to(sessionId).emit('terminal-output', {
        data: 'Nginx configured successfully\n'
      });
    }
    
    return {
      success: true,
      message: 'Nginx configured successfully',
      configPath
    };
  } catch (error) {
    throw new Error(`Nginx configuration failed: ${error.message}`);
  }
}

// Check SSL status
async function checkSSLStatus(domain) {
  try {
    const { stdout } = await execAsync(`sudo certbot certificates 2>&1 | grep -A 10 "${domain}"`);
    
    if (stdout.includes(domain)) {
      return {
        hasSSL: true,
        details: stdout
      };
    }
    
    return {
      hasSSL: false
    };
  } catch (error) {
    return {
      hasSSL: false,
      error: 'Could not check SSL status'
    };
  }
}

module.exports = {
  installSSL,
  configureNginx,
  checkSSLStatus,
  SSL_PROVIDERS
};
