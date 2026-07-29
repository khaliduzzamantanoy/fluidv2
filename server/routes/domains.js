import { getPrisma } from '../services/database.js';
import { authenticate } from '../middleware/auth.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execPromise = promisify(exec);

export default async function domainRoutes(fastify) {
  fastify.post('/api/projects/:id/domains', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id, deletedAt: null }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const { domain, isPrimary, wwwRedirect, forceHttps } = request.body || {};
    if (!domain) {
      return reply.status(400).send({ success: false, error: 'Domain is required' });
    }

    const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

    const existing = await prisma.domain.findFirst({
      where: { projectId: project.id, domain: cleanDomain }
    });
    if (existing) {
      return reply.status(400).send({ success: false, error: 'Domain already added to this project' });
    }

    const domainCount = await prisma.domain.count({ where: { projectId: project.id } });
    const isFirst = domainCount === 0;

    const created = await prisma.domain.create({
      data: {
        projectId: project.id,
        domain: cleanDomain,
        isPrimary: isPrimary || isFirst,
        wwwRedirect: wwwRedirect !== false,
        forceHttps: forceHttps !== false,
        sslStatus: 'none',
        dnsVerified: false
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        projectId: project.id,
        action: 'domain.add',
        category: 'domain',
        description: `Added domain ${cleanDomain} to ${project.name}`,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }
    });

    return reply.status(201).send({ success: true, domain: created });
  });

  fastify.delete('/api/projects/:id/domains/:domainId', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id, deletedAt: null }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const domain = await prisma.domain.findFirst({
      where: { id: request.params.domainId, projectId: project.id }
    });
    if (!domain) {
      return reply.status(404).send({ success: false, error: 'Domain not found' });
    }

    await prisma.domain.delete({ where: { id: domain.id } });

    if (domain.isPrimary) {
      const nextDomain = await prisma.domain.findFirst({
        where: { projectId: project.id },
        orderBy: { createdAt: 'asc' }
      });
      if (nextDomain) {
        await prisma.domain.update({
          where: { id: nextDomain.id },
          data: { isPrimary: true }
        });
      }
    }

    const nginxAvailable = `/etc/nginx/sites-available/${domain.domain}`;
    const nginxEnabled = `/etc/nginx/sites-enabled/${domain.domain}`;
    try { await execPromise(`rm -f ${nginxAvailable} ${nginxEnabled}`); } catch (e) { }

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        projectId: project.id,
        action: 'domain.remove',
        category: 'domain',
        description: `Removed domain ${domain.domain} from ${project.name}`,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }
    });

    return reply.send({ success: true, removedDomain: domain.domain });
  });

  fastify.put('/api/projects/:id/domains/:domainId', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id, deletedAt: null }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const domain = await prisma.domain.findFirst({
      where: { id: request.params.domainId, projectId: project.id }
    });
    if (!domain) {
      return reply.status(404).send({ success: false, error: 'Domain not found' });
    }

    const { isPrimary, wwwRedirect, forceHttps, hstsEnabled } = request.body || {};
    const updateData = {};

    if (isPrimary) {
      await prisma.domain.updateMany({
        where: { projectId: project.id },
        data: { isPrimary: false }
      });
      updateData.isPrimary = true;
    }
    if (wwwRedirect !== undefined) updateData.wwwRedirect = wwwRedirect;
    if (forceHttps !== undefined) updateData.forceHttps = forceHttps;
    if (hstsEnabled !== undefined) updateData.hstsEnabled = hstsEnabled;

    const updated = await prisma.domain.update({ where: { id: domain.id }, data: updateData });
    return reply.send({ success: true, domain: updated });
  });

  fastify.post('/api/projects/:id/domains/:domainId/verify-dns', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id, deletedAt: null }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const domain = await prisma.domain.findFirst({
      where: { id: request.params.domainId, projectId: project.id }
    });
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

    await prisma.domain.update({
      where: { id: domain.id },
      data: { dnsVerified: results.a.matches }
    });

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

  fastify.post('/api/projects/:id/domains/:domainId/ssl', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id, deletedAt: null }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const domain = await prisma.domain.findFirst({
      where: { id: request.params.domainId, projectId: project.id }
    });
    if (!domain) {
      return reply.status(404).send({ success: false, error: 'Domain not found' });
    }

    if (!domain.dnsVerified) {
      return reply.status(400).send({ success: false, error: 'DNS not verified. Verify DNS first.' });
    }

    const sslRecord = await prisma.sslCertificate.upsert({
      where: { domain: domain.domain },
      update: {
        projectId: project.id,
        domainId: domain.id,
        status: 'issuing',
        lastAttemptAt: new Date(),
        attempts: { increment: 1 }
      },
      create: {
        projectId: project.id,
        domainId: domain.id,
        domain: domain.domain,
        status: 'issuing',
        lastAttemptAt: new Date(),
        attempts: 1
      }
    });

    await prisma.domain.update({
      where: { id: domain.id },
      data: { sslStatus: 'pending' }
    });

    runCertbot(project, domain, sslRecord).catch(err => {
      console.error('[SSL] Certbot failed:', err.message);
    });

    return reply.send({ success: true, message: 'SSL certificate request initiated', sslRecord });
  });

  fastify.get('/api/projects/:id/domains/:domainId/ssl', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id, deletedAt: null }
    });
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' });
    }

    const domain = await prisma.domain.findFirst({
      where: { id: request.params.domainId, projectId: project.id }
    });
    if (!domain) {
      return reply.status(404).send({ success: false, error: 'Domain not found' });
    }

    const sslRecord = await prisma.sslCertificate.findUnique({ where: { domain: domain.domain } });
    const certExpiry = sslRecord?.sslCertificate?.expiresAt || domain.certExpiry;
    const daysUntilExpiry = certExpiry ? Math.floor((new Date(certExpiry) - new Date()) / (1000 * 60 * 60 * 24)) : null;

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

  fastify.get('/api/projects/:id/nginx-config', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id, deletedAt: null },
      include: { domains: true }
    });
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
    
    ${d.wwwRedirect ? `
    if ($host = www.${d.domain}) {
        return 301 https://${d.domain}$request_uri;
    }` : ''}` : '';

      const httpsRedirect = d.forceHttps ? `
    
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

  fastify.post('/api/projects/:id/nginx-apply', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.user.id, deletedAt: null },
      include: { domains: true }
    });
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

        if (!fs.existsSync(enabledPath)) {
          await execPromise(`ln -sf ${configPath} ${enabledPath}`);
        }

        results.push({ domain: domain.domain, success: true, configPath });
      } catch (err) {
        results.push({ domain: domain.domain, success: false, error: err.message });
      }
    }

    try {
      await execPromise('nginx -t');
      await execPromise('systemctl reload nginx || nginx -s reload');
    } catch (err) {
      return reply.send({ success: false, results, nginxError: err.message });
    }

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        projectId: project.id,
        action: 'nginx.apply',
        category: 'domain',
        description: `Applied Nginx config for ${project.domains.map(d => d.domain).join(', ')}`,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }
    });

    return reply.send({ success: true, results });
  });
}

async function runCertbot(project, domain, sslRecord) {
  const { getPrisma } = await import('../services/database.js');
  try {
    const email = process.env.SSL_EMAIL || 'admin@' + domain.domain;
    const staging = process.env.SSL_STAGING === 'true' ? '--staging' : '';

    const { stdout, stderr } = await execPromise(
      `certbot certonly --nginx -d ${domain.domain} ${domain.wwwRedirect ? `-d www.${domain.domain}` : ''} ` +
      `--non-interactive --agree-tos --email ${email} ${staging} 2>&1`
    );

    const certDir = `/etc/letsencrypt/live/${domain.domain}`;

    if (fs.existsSync(`${certDir}/fullchain.pem`)) {
      const cert = fs.readFileSync(`${certDir}/fullchain.pem`, 'utf8');
      const key = fs.readFileSync(`${certDir}/privkey.pem`, 'utf8');

      const prisma = getPrisma();
      await prisma.domain.update({
        where: { id: domain.id },
        data: { sslStatus: 'active', sslProvider: 'letsencrypt', certExpiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) }
      });

      await prisma.sslCertificate.update({
        where: { id: sslRecord.id },
        data: {
          status: 'active',
          sslCertificate: { cert, key, chain: cert, fullchain: cert, issuer: 'letsencrypt', expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() }
        }
      });
    }
  } catch (err) {
    console.error('[SSL] Certbot execution error:', err.message);
    const prisma = getPrisma();
    await prisma.domain.update({ where: { id: domain.id }, data: { sslStatus: 'failed' } });
    await prisma.sslCertificate.update({ where: { id: sslRecord.id }, data: { status: 'failed', error: err.message } });
  }
}
