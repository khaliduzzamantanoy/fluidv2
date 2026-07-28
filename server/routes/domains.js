import Project from '../models/Project.js';
import SslCertificate from '../models/SslCertificate.js';
import ActivityLog from '../models/ActivityLog.js';
import { authenticate } from '../middleware/auth.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export default async function domainRoutes(fastify) {
  // Add domain to project
  fastify.post('/api/projects/:id/domains', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const { domain, isPrimary, wwwRedirect, forceHttps } = request.body || {};
    if (!domain) {
      return reply.status(400).send({ success: false, error: 'Domain is required' });
    }

    const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const existing = project.domains.find(d => d.domain === cleanDomain);
    if (existing) {
      return reply.status(400).send({ success: false, error: 'Domain already added to this project' });
    }

    const isFirst = project.domains.length === 0;

    project.domains.push({
      domain: cleanDomain,
      isPrimary: isPrimary || isFirst,
      wwwRedirect: wwwRedirect !== false,
      forceHttps: forceHttps !== false,
      sslStatus: 'none',
      dnsVerified: false
    });

    await project.save();

    await ActivityLog.create({
      userId: request.user._id,
      projectId: project._id,
      action: 'domain.add',
      category: 'domain',
      description: `Added domain ${cleanDomain} to ${project.name}`,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    return reply.status(201).send({ success: true, project });
  });

  // Remove domain from project
  fastify.delete('/api/projects/:id/domains/:domainId', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const domainIdx = project.domains.findIndex(d => d._id.toString() === request.params.domainId);
    if (domainIdx === -1) {
      return reply.status(404).send({ success: false, error: 'Domain not found' });
    }

    const removedDomain = project.domains[domainIdx];
    project.domains.splice(domainIdx, 1);

    if (removedDomain.isPrimary && project.domains.length > 0) {
      project.domains[0].isPrimary = true;
    }

    await project.save();

    // Remove Nginx config
    const nginxAvailable = `/etc/nginx/sites-available/${removedDomain.domain}`;
    const nginxEnabled = `/etc/nginx/sites-enabled/${removedDomain.domain}`;
    try {
      await execPromise(`rm -f ${nginxAvailable} ${nginxEnabled}`);
    } catch (e) { }

    await ActivityLog.create({
      userId: request.user._id,
      projectId: project._id,
      action: 'domain.remove',
      category: 'domain',
      description: `Removed domain ${removedDomain.domain} from ${project.name}`,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    return reply.send({ success: true, project, removedDomain: removedDomain.domain });
  });

  // Update domain settings
  fastify.put('/api/projects/:id/domains/:domainId', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const domain = project.domains.id(request.params.domainId);
    if (!domain) {
      return reply.status(404).send({ success: false, error: 'Domain not found' });
    }

    const { isPrimary, wwwRedirect, forceHttps, hstsEnabled } = request.body || {};

    if (isPrimary) {
      project.domains.forEach(d => d.isPrimary = false);
      domain.isPrimary = true;
    }
    if (wwwRedirect !== undefined) domain.wwwRedirect = wwwRedirect;
    if (forceHttps !== undefined) domain.forceHttps = forceHttps;
    if (hstsEnabled !== undefined) domain.hstsEnabled = hstsEnabled;

    await project.save();
    return reply.send({ success: true, project });
  });

  // Verify DNS for domain
  fastify.post('/api/projects/:id/domains/:domainId/verify-dns', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const domain = project.domains.id(request.params.domainId);
    if (!domain) {
      return reply.status(404).send({ success: false, error: 'Domain not found' });
    }

    const dnsPromises = await import('dns/promises');
    const vpsIp = process.env.VPS_IP || '127.0.0.1';

    const results = {
      a: { host: domain.domain, resolved: [], matches: false },
      www: { host: `www.${domain.domain}`, resolved: [], matches: false }
    };

    try {
      const aIps = await dnsPromises.resolve4(domain.domain).catch(() => []);
      results.a.resolved = aIps;
      results.a.matches = aIps.includes(vpsIp);
    } catch (e) { }

    try {
      const wwwIps = await dnsPromises.resolve4(`www.${domain.domain}`).catch(() => []);
      results.www.resolved = wwwIps;
    } catch (e) { }

    domain.dnsVerified = results.a.matches;
    await project.save();

    return reply.send({
      success: true,
      dnsVerified: results.a.matches,
      results,
      instructions: !results.a.matches ? [
        `Create an A record for ${domain.domain} pointing to ${vpsIp}`,
        `Optionally create an A record for www.${domain.domain} pointing to ${vpsIp}`
      ] : []
    });
  });

  // Setup SSL for a domain
  fastify.post('/api/projects/:id/domains/:domainId/ssl', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const domain = project.domains.id(request.params.domainId);
    if (!domain) {
      return reply.status(404).send({ success: false, error: 'Domain not found' });
    }

    if (!domain.dnsVerified) {
      return reply.status(400).send({ success: false, error: 'DNS not verified. Verify DNS first.' });
    }

    const sslRecord = await SslCertificate.findOneAndUpdate(
      { domain: domain.domain },
      {
        projectId: project._id,
        domainId: domain._id,
        domain: domain.domain,
        status: 'issuing',
        lastAttemptAt: new Date(),
        $inc: { attempts: 1 }
      },
      { upsert: true, new: true }
    );

    domain.sslStatus = 'pending';
    await project.save();

    // Execute certbot in background
    runCertbot(project, domain, sslRecord).catch(err => {
      console.error('[SSL] Certbot failed:', err.message);
    });

    return reply.send({
      success: true,
      message: 'SSL certificate request initiated',
      sslRecord
    });
  });

  // Get domain SSL status
  fastify.get('/api/projects/:id/domains/:domainId/ssl', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const domain = project.domains.id(request.params.domainId);
    if (!domain) {
      return reply.status(404).send({ success: false, error: 'Domain not found' });
    }

    const sslRecord = await SslCertificate.findOne({ domain: domain.domain });
    const certExpiry = sslRecord?.sslCertificate?.expiresAt || domain.certExpiry;
    const daysUntilExpiry = certExpiry ? Math.floor((certExpiry - new Date()) / (1000 * 60 * 60 * 24)) : null;

    return reply.send({
      success: true,
      domain: domain.domain,
      sslStatus: domain.sslStatus,
      sslProvider: domain.sslProvider,
      dnsVerified: domain.dnsVerified,
      certExpiry,
      daysUntilExpiry,
      sslRecord: sslRecord ? {
        status: sslRecord.status,
        attempts: sslRecord.attempts,
        lastAttemptAt: sslRecord.lastAttemptAt,
        nextRetryAt: sslRecord.nextRetryAt,
        autoRenew: sslRecord.autoRenew
      } : null
    });
  });

  // Generate Nginx config for project domains
  fastify.get('/api/projects/:id/nginx-config', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    if (!project.domains || project.domains.length === 0) {
      return reply.status(400).send({ success: false, error: 'No domains configured' });
    }

    const configs = project.domains.map(d => {
      const serverNames = d.wwwRedirect ? `${d.domain} www.${d.domain}` : d.domain;
      const sslBlock = d.sslStatus === 'active' ? `
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/${d.domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${d.domain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Redirect www to non-www
    ${d.wwwRedirect ? `
    if ($host = www.${d.domain}) {
        return 301 https://${d.domain}$request_uri;
    }` : ''}` : '';

      const httpsRedirect = d.forceHttps ? `
    
    # HTTP -> HTTPS redirect
    server {
        listen 80;
        listen [::]:80;
        server_name ${serverNames};
        return 301 https://$server_name$request_uri;
    }` : '';

      const hsts = d.hstsEnabled ? `
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;` : '';

      return `
# ${d.domain} - ${project.name}
server {
    listen 80;
    listen [::]:80;
    server_name ${serverNames};
    ${sslBlock}

    location / {
        proxy_pass http://127.0.0.1:${project.port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;${hsts}
    }

    location /_next/static {
        alias ${project.outputDirectory ? project.directory + '/' + project.outputDirectory + '/static' : project.directory + '/.next/static'};
        expires 365d;
        access_log off;
    }

    access_log /var/log/nginx/${d.domain}.log;
    error_log /var/log/nginx/${d.domain}.error.log;
}${httpsRedirect}`;
    }).join('\n\n');

    return reply.send({
      success: true,
      project: project.name,
      domains: project.domains.map(d => d.domain),
      configs,
      configPreview: configs
    });
  });

  // Write Nginx configs to disk
  fastify.post('/api/projects/:id/nginx-apply', { preHandler: [authenticate] }, async (request, reply) => {
    const project = await Project.findOne({ _id: request.params.id, userId: request.user._id, deletedAt: null });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const results = [];
    for (const domain of project.domains) {
      try {
        const serverNames = domain.wwwRedirect ? `${domain.domain} www.${domain.domain}` : domain.domain;
        const configContent = `server {
    listen 80;
    server_name ${serverNames};

    location / {
        proxy_pass http://127.0.0.1:${project.port};
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

        const configPath = `/etc/nginx/sites-available/${domain.domain}`;
        const enabledPath = `/etc/nginx/sites-enabled/${domain.domain}`;

        await execPromise(`mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled`);
        await execPromise(`cat > ${configPath} << 'NGINXEOF'\n${configContent}\nNGINXEOF`);

        if (!require('fs').existsSync(enabledPath)) {
          await execPromise(`ln -sf ${configPath} ${enabledPath}`);
        }

        results.push({ domain: domain.domain, success: true, configPath });
      } catch (err) {
        results.push({ domain: domain.domain, success: false, error: err.message });
      }
    }

    // Test and reload nginx
    try {
      await execPromise('nginx -t');
      await execPromise('systemctl reload nginx || nginx -s reload');
    } catch (err) {
      return reply.send({ success: false, results, nginxError: err.message });
    }

    await ActivityLog.create({
      userId: request.user._id,
      projectId: project._id,
      action: 'nginx.apply',
      category: 'domain',
      description: `Applied Nginx config for ${project.domains.map(d => d.domain).join(', ')}`,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    return reply.send({ success: true, results });
  });
}

async function runCertbot(project, domain, sslRecord) {
  try {
    const email = process.env.SSL_EMAIL || 'admin@' + domain.domain;
    const staging = process.env.SSL_STAGING === 'true' ? '--staging' : '';

    const { stdout, stderr } = await execPromise(
      `certbot certonly --nginx -d ${domain.domain} ${domain.wwwRedirect ? `-d www.${domain.domain}` : ''} ` +
      `--non-interactive --agree-tos --email ${email} ${staging} 2>&1`
    );

    const certDir = `/etc/letsencrypt/live/${domain.domain}`;
    const fs = await import('fs');

    if (fs.existsSync(`${certDir}/fullchain.pem`)) {
      const cert = fs.readFileSync(`${certDir}/fullchain.pem`, 'utf8');
      const key = fs.readFileSync(`${certDir}/privkey.pem`, 'utf8');

      // Update domain and SSL record
      domain.sslStatus = 'active';
      domain.sslProvider = 'letsencrypt';
      await project.save();

      sslRecord.status = 'active';
      sslRecord.sslCertificate = {
        cert,
        key,
        chain: cert,
        fullchain: cert,
        issuer: 'letsencrypt',
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      };
      await sslRecord.save();
    }
  } catch (err) {
    console.error('[SSL] Certbot execution error:', err.message);
    domain.sslStatus = 'failed';
    await project.save();

    sslRecord.status = 'failed';
    sslRecord.error = err.message;
    await sslRecord.save();
  }
}